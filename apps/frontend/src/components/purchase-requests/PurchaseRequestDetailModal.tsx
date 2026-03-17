import { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  RotateCcw,
  Ban,
  Clock,
  FileText,
  AlertCircle,
  Loader2,
  Download,
} from 'lucide-react';
import { api } from '@/services/api';
import { usePurchaseRequestForm } from '@/hooks/usePurchaseRequestForm';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { PurchaseRequest, PurchaseRequestStatus } from '@/types/purchase-request';
import { RC_STATUS_LABELS, RC_URGENCY_LABELS } from '@/types/purchase-request';
import './PurchaseRequestDetailModal.css';

interface PurchaseRequestDetailModalProps {
  isOpen: boolean;
  purchaseRequestId: string;
  onClose: () => void;
  onAction: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffH < 1) return 'Agora';
  if (diffH < 24) return `ha ${diffH}h`;
  if (diffD < 30) return `ha ${diffD}d`;
  return formatDate(dateStr).split(' ')[0];
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const STATUS_CONFIG: Record<PurchaseRequestStatus, { icon: React.ReactNode; className: string }> = {
  RASCUNHO: {
    icon: <FileText size={12} aria-hidden="true" />,
    className: 'prdm-status prdm-status--rascunho',
  },
  PENDENTE: {
    icon: <Clock size={12} aria-hidden="true" />,
    className: 'prdm-status prdm-status--pendente',
  },
  APROVADA: {
    icon: <CheckCircle size={12} aria-hidden="true" />,
    className: 'prdm-status prdm-status--aprovada',
  },
  REJEITADA: {
    icon: <XCircle size={12} aria-hidden="true" />,
    className: 'prdm-status prdm-status--rejeitada',
  },
  DEVOLVIDA: {
    icon: <RotateCcw size={12} aria-hidden="true" />,
    className: 'prdm-status prdm-status--devolvida',
  },
  CANCELADA: {
    icon: <Ban size={12} aria-hidden="true" />,
    className: 'prdm-status prdm-status--cancelada',
  },
};

function StatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const { icon, className } = STATUS_CONFIG[status];
  return (
    <span className={className}>
      {icon}
      {RC_STATUS_LABELS[status].toUpperCase()}
    </span>
  );
}

interface TimelineEvent {
  id: string;
  actorName: string;
  actionLabel: string;
  actionType: 'criada' | 'enviada' | 'aprovada' | 'rejeitada' | 'devolvida' | 'cancelada';
  timestamp: string;
  comment?: string;
  isDelegation?: boolean;
  originalApproverName?: string;
}

function buildTimeline(rc: PurchaseRequest): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  events.push({
    id: 'created',
    actorName: rc.creator.name,
    actionLabel: 'Criou a requisicao',
    actionType: 'criada',
    timestamp: rc.createdAt,
  });
  if (rc.submittedAt) {
    events.push({
      id: 'submitted',
      actorName: rc.creator.name,
      actionLabel: 'Enviou para aprovacao',
      actionType: 'enviada',
      timestamp: rc.submittedAt,
    });
  }
  if (rc.approvalActions) {
    for (const action of rc.approvalActions) {
      if (!action.decidedAt) continue;
      const typeMap: Record<string, TimelineEvent['actionType']> = {
        APPROVED: 'aprovada',
        REJECTED: 'rejeitada',
        RETURNED: 'devolvida',
      };
      const actionType = typeMap[action.status];
      if (!actionType) continue;
      const labelMap: Record<string, string> = {
        APPROVED: 'Aprovou',
        REJECTED: 'Rejeitou',
        RETURNED: 'Devolveu para revisao',
      };
      events.push({
        id: action.id,
        actorName: action.assignee.name,
        actionLabel: labelMap[action.status] ?? action.status,
        actionType,
        timestamp: action.decidedAt,
        comment: action.comment,
        isDelegation: !!action.originalAssignee,
        originalApproverName: action.originalAssignee
          ? rc.approvalActions?.find((a) => a.assignedTo === action.originalAssignee)?.assignee.name
          : undefined,
      });
    }
  }
  if (rc.status === 'CANCELADA') {
    events.push({
      id: 'cancelled',
      actorName: rc.creator.name,
      actionLabel: 'Cancelou a requisicao',
      actionType: 'cancelada',
      timestamp: rc.updatedAt,
    });
  }
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

const ACTION_DOT_COLORS: Record<TimelineEvent['actionType'], string> = {
  criada: 'var(--color-neutral-500)',
  enviada: 'var(--color-warning-500)',
  aprovada: 'var(--color-success-500)',
  rejeitada: 'var(--color-error-500)',
  devolvida: 'var(--color-sky-500)',
  cancelada: 'var(--color-neutral-400)',
};

type ActionMode = 'APPROVE' | 'REJECT' | 'RETURN' | null;

export default function PurchaseRequestDetailModal({
  isOpen,
  purchaseRequestId,
  onClose,
  onAction,
}: PurchaseRequestDetailModalProps) {
  const titleId = 'prdm-title';
  const [rc, setRc] = useState<PurchaseRequest | null>(null);
  const [isLoadingRc, setIsLoadingRc] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { transition, isLoading: isActing } = usePurchaseRequestForm(() => {});
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen || !purchaseRequestId) return;
    let cancelled = false;
    setIsLoadingRc(true);
    setLoadError(null);
    setRc(null);
    setActionMode(null);
    setComment('');
    setCommentError('');
    async function load() {
      try {
        const result = await api.get<PurchaseRequest>(
          `/org/purchase-requests/${purchaseRequestId}`,
        );
        if (!cancelled) setRc(result);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Erro ao carregar RC.');
      } finally {
        if (!cancelled) setIsLoadingRc(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, purchaseRequestId]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  async function handleApprove() {
    if (!rc) return;
    await transition(rc.id, { action: 'APPROVE', comment: comment.trim() || undefined });
    onAction();
  }

  async function handleReturnConfirm() {
    if (!comment.trim()) {
      setCommentError('O motivo e obrigatorio para devolver a requisicao.');
      return;
    }
    if (!rc) return;
    await transition(rc.id, { action: 'RETURN', comment: comment.trim() });
    onAction();
  }

  function handleRejectClick() {
    if (!comment.trim()) {
      setCommentError('O motivo e obrigatorio para rejeitar a requisicao.');
      return;
    }
    setShowRejectConfirm(true);
  }

  async function executeReject() {
    if (!rc) return;
    setShowRejectConfirm(false);
    await transition(rc.id, { action: 'REJECT', comment: comment.trim() });
    onAction();
  }

  async function executeCancel() {
    if (!rc) return;
    setShowCancelConfirm(false);
    await transition(rc.id, { action: 'CANCEL' });
    onAction();
  }

  if (!isOpen) return null;

  const calcTotal = () => {
    if (!rc) return null;
    let total = 0;
    let hasPrice = false;
    for (const item of rc.items) {
      if (item.estimatedUnitPrice != null) {
        total += item.quantity * item.estimatedUnitPrice;
        hasPrice = true;
      }
    }
    return hasPrice ? total : null;
  };

  const total = calcTotal();
  const timeline = rc ? buildTimeline(rc) : [];

  return (
    <>
      <div
        className="prdm-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="prdm-modal">
          <div className="prdm-modal__header">
            <div className="prdm-modal__header-main">
              {rc ? (
                <>
                  <span id={titleId} className="prdm-rc-number">
                    {rc.sequentialNumber}
                  </span>
                  <StatusBadge status={rc.status} />
                  <span
                    className={`prdm-urgency-chip prdm-urgency-chip--${rc.urgency.toLowerCase()}`}
                  >
                    {RC_URGENCY_LABELS[rc.urgency]}
                  </span>
                </>
              ) : (
                <span id={titleId} className="prdm-rc-number">
                  Carregando...
                </span>
              )}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="prdm-modal__close"
              onClick={onClose}
              aria-label="Fechar detalhes da requisicao"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {rc && (
            <div className="prdm-meta">
              <span>{rc.farm.name}</span>
              <span className="prdm-meta__sep" aria-hidden="true">
                ·
              </span>
              <span>
                Solicitado por <strong>{rc.creator.name}</strong>
              </span>
              <span className="prdm-meta__sep" aria-hidden="true">
                ·
              </span>
              <time dateTime={rc.createdAt} title={formatDate(rc.createdAt)}>
                {formatRelative(rc.createdAt)}
              </time>
            </div>
          )}

          <div className="prdm-modal__body">
            {isLoadingRc && (
              <div className="prdm-loading">
                <Loader2 size={32} aria-hidden="true" className="prdm-spin" />
                <span>Carregando requisicao...</span>
              </div>
            )}

            {loadError && (
              <div className="prdm-error" role="alert">
                <AlertCircle size={20} aria-hidden="true" />
                {loadError}
              </div>
            )}

            {rc && (
              <>
                <section aria-labelledby="prdm-items-title">
                  <h3 id="prdm-items-title" className="prdm-section-title">
                    Itens
                  </h3>
                  <div className="prdm-table-wrapper">
                    <table className="prdm-table">
                      <thead>
                        <tr>
                          <th scope="col">Produto</th>
                          <th scope="col">Qtd</th>
                          <th scope="col">Unidade</th>
                          <th scope="col">Preco Unit. Est.</th>
                          <th scope="col">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rc.items.map((item, idx) => {
                          const lineTotal =
                            item.estimatedUnitPrice != null
                              ? item.quantity * item.estimatedUnitPrice
                              : null;
                          return (
                            <tr key={item.id ?? idx}>
                              <td>{item.productName}</td>
                              <td>{item.quantity}</td>
                              <td>{item.unitName}</td>
                              <td>
                                {item.estimatedUnitPrice != null
                                  ? formatCurrency(item.estimatedUnitPrice)
                                  : '—'}
                              </td>
                              <td>{lineTotal != null ? formatCurrency(lineTotal) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {total != null && (
                        <tfoot>
                          <tr>
                            <td colSpan={4} className="prdm-table__total-label">
                              Total Estimado
                            </td>
                            <td className="prdm-table__total-value">{formatCurrency(total)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </section>

                {rc.attachments && rc.attachments.length > 0 && (
                  <section aria-labelledby="prdm-attachments-title" className="prdm-section-gap">
                    <h3 id="prdm-attachments-title" className="prdm-section-title">
                      Anexos
                    </h3>
                    <ul className="prdm-attachments">
                      {rc.attachments.map((att) => (
                        <li key={att.id} className="prdm-attachment-item">
                          <FileText size={16} aria-hidden="true" />
                          <span className="prdm-attachment-name">{att.fileName}</span>
                          <span className="prdm-attachment-size">{formatBytes(att.sizeBytes)}</span>
                          <a
                            href={`/api/${att.filePath}`}
                            download={att.fileName}
                            className="prdm-attachment-link"
                            aria-label={`Baixar ${att.fileName}`}
                          >
                            <Download size={14} aria-hidden="true" /> Baixar
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section aria-labelledby="prdm-timeline-title" className="prdm-section-gap">
                  <h3 id="prdm-timeline-title" className="prdm-section-title">
                    Historico
                  </h3>
                  <ol className="prdm-timeline" aria-label="Historico de aprovacao">
                    {timeline.map((event) => (
                      <li key={event.id} className="prdm-timeline__item">
                        <div
                          className="prdm-timeline__dot"
                          style={{ backgroundColor: ACTION_DOT_COLORS[event.actionType] }}
                          aria-hidden="true"
                        />
                        <div className="prdm-timeline__content">
                          <div className="prdm-timeline__header">
                            <span className="prdm-timeline__actor">{event.actorName}</span>
                            <span className="prdm-timeline__action">{event.actionLabel}</span>
                            <time
                              className="prdm-timeline__time"
                              dateTime={event.timestamp}
                              title={formatDate(event.timestamp)}
                            >
                              {formatRelative(event.timestamp)}
                            </time>
                          </div>
                          {event.isDelegation && event.originalApproverName && (
                            <span className="prdm-timeline__delegation">
                              por delegacao de {event.originalApproverName}
                            </span>
                          )}
                          {event.comment && (
                            <blockquote className="prdm-timeline__comment">
                              {event.comment}
                            </blockquote>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                {rc.status === 'PENDENTE' && (
                  <section
                    aria-labelledby="prdm-actions-title"
                    className="prdm-section-gap prdm-action-bar"
                  >
                    <h3 id="prdm-actions-title" className="prdm-section-title">
                      Acoes
                    </h3>
                    <div className="prdm-action-buttons">
                      <button
                        type="button"
                        className={`prdm-action-btn prdm-action-btn--approve ${actionMode === 'APPROVE' ? 'prdm-action-btn--active' : ''}`}
                        onClick={() => setActionMode(actionMode === 'APPROVE' ? null : 'APPROVE')}
                      >
                        <CheckCircle size={16} aria-hidden="true" />
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className={`prdm-action-btn prdm-action-btn--return ${actionMode === 'RETURN' ? 'prdm-action-btn--active' : ''}`}
                        onClick={() => setActionMode(actionMode === 'RETURN' ? null : 'RETURN')}
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        Devolver
                      </button>
                      <button
                        type="button"
                        className={`prdm-action-btn prdm-action-btn--reject ${actionMode === 'REJECT' ? 'prdm-action-btn--active' : ''}`}
                        onClick={() => setActionMode(actionMode === 'REJECT' ? null : 'REJECT')}
                      >
                        <XCircle size={16} aria-hidden="true" />
                        Rejeitar
                      </button>
                    </div>

                    {actionMode && (
                      <div className="prdm-comment-area">
                        <label htmlFor="prdm-comment" className="prdm-section-label">
                          {actionMode === 'APPROVE' ? 'Comentario (opcional)' : 'Motivo *'}
                        </label>
                        <textarea
                          id="prdm-comment"
                          className={`prdm-comment-input ${commentError ? 'prdm-comment-input--error' : ''}`}
                          rows={3}
                          value={comment}
                          aria-required={actionMode !== 'APPROVE'}
                          placeholder={
                            actionMode === 'APPROVE'
                              ? 'Adicione um comentario opcional...'
                              : 'Informe o motivo (obrigatorio)...'
                          }
                          onChange={(e) => {
                            setComment(e.target.value);
                            if (commentError) setCommentError('');
                          }}
                        />
                        {commentError && (
                          <span role="alert" className="prdm-error-msg">
                            <AlertCircle size={14} aria-hidden="true" /> {commentError}
                          </span>
                        )}
                        <div className="prdm-confirm-actions">
                          <button
                            type="button"
                            className="prdm-btn prdm-btn--ghost"
                            onClick={() => {
                              setActionMode(null);
                              setComment('');
                              setCommentError('');
                            }}
                          >
                            Cancelar
                          </button>
                          {actionMode === 'APPROVE' && (
                            <button
                              type="button"
                              className="prdm-btn prdm-btn--primary"
                              onClick={() => void handleApprove()}
                              disabled={isActing}
                            >
                              {isActing && (
                                <Loader2 size={14} aria-hidden="true" className="prdm-spin" />
                              )}
                              Confirmar Aprovacao
                            </button>
                          )}
                          {actionMode === 'RETURN' && (
                            <button
                              type="button"
                              className="prdm-btn prdm-btn--warning"
                              onClick={() => void handleReturnConfirm()}
                              disabled={isActing}
                            >
                              {isActing && (
                                <Loader2 size={14} aria-hidden="true" className="prdm-spin" />
                              )}
                              Confirmar Devolucao
                            </button>
                          )}
                          {actionMode === 'REJECT' && (
                            <button
                              type="button"
                              className="prdm-btn prdm-btn--danger"
                              onClick={handleRejectClick}
                              disabled={isActing}
                            >
                              {isActing && (
                                <Loader2 size={14} aria-hidden="true" className="prdm-spin" />
                              )}
                              Confirmar Rejeicao
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {rc.status === 'APROVADA' && (
                  <div className="prdm-section-gap">
                    <button
                      type="button"
                      className="prdm-btn prdm-btn--danger-outlined"
                      onClick={() => setShowCancelConfirm(true)}
                    >
                      <Ban size={16} aria-hidden="true" />
                      Cancelar RC
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showRejectConfirm}
        title={rc ? `Rejeitar a requisicao ${rc.sequentialNumber}?` : 'Rejeitar requisicao?'}
        message="O solicitante sera notificado com o motivo informado. Essa acao nao pode ser desfeita."
        confirmLabel="Rejeitar"
        variant="danger"
        isLoading={isActing}
        onConfirm={() => void executeReject()}
        onCancel={() => setShowRejectConfirm(false)}
      />

      <ConfirmModal
        isOpen={showCancelConfirm}
        title={rc ? `Cancelar a requisicao ${rc.sequentialNumber}?` : 'Cancelar requisicao?'}
        message="A requisicao aprovada sera cancelada. Ela nao podera ser reativada."
        confirmLabel="Cancelar RC"
        variant="danger"
        isLoading={isActing}
        onConfirm={() => void executeCancel()}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </>
  );
}
