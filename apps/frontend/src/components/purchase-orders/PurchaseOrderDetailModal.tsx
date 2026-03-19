import { useState } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Download,
  Mail,
  Copy,
  Lock,
  Zap,
} from 'lucide-react';
import {
  usePurchaseOrder,
  downloadPOPdf,
  duplicatePO,
  transitionPO,
  deletePO,
  updatePO,
  sendPOEmail,
} from '@/hooks/usePurchaseOrders';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { PurchaseOrder, PurchaseOrderItem } from '@/types/purchase-order';
import { OC_STATUS_LABELS } from '@/types/purchase-order';
import './PurchaseOrderDetailModal.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBRL(raw: string): number {
  const cleaned = raw.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CSS: Record<string, string> = {
  RASCUNHO: 'podm-status-badge--rascunho',
  EMITIDA: 'podm-status-badge--emitida',
  CONFIRMADA: 'podm-status-badge--confirmada',
  EM_TRANSITO: 'podm-status-badge--em-transito',
  ENTREGUE: 'podm-status-badge--entregue',
  CANCELADA: 'podm-status-badge--cancelada',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`podm-status-badge ${STATUS_CSS[status] ?? ''}`}>
      {OC_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Items table ─────────────────────────────────────────────────────────────

interface EditableItem {
  productName: string;
  unitName: string;
  quantity: string;
  unitPrice: string;
}

function ItemsTable({ items, frozen }: { items: PurchaseOrderItem[]; frozen: boolean }) {
  const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
  return (
    <>
      {frozen && (
        <div className="podm-frozen-notice">
          <Lock size={12} aria-hidden="true" />
          Precos congelados no momento da emissao — nao podem ser alterados
        </div>
      )}
      <table className="podm-items-table">
        <caption className="sr-only">Itens do pedido de compra</caption>
        <thead>
          <tr>
            <th scope="col">Produto</th>
            <th scope="col">Unidade</th>
            <th scope="col">Qtd</th>
            <th scope="col">Preco unit.</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.productName}</td>
              <td>{item.unitName}</td>
              <td>{item.quantity}</td>
              <td>{formatBRL(item.unitPrice)}</td>
              <td>{formatBRL(item.totalPrice)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="podm-items-table__total-label">
              Total do pedido
            </td>
            <td>{formatBRL(total)}</td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

// ─── Edit mode items ─────────────────────────────────────────────────────────

function EditableItemsTable({
  items,
  onChange,
}: {
  items: EditableItem[];
  onChange: (items: EditableItem[]) => void;
}) {
  function update(index: number, field: keyof EditableItem, value: string) {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(next);
  }

  return (
    <div>
      <div className="podm-edit-row podm-edit-row--header">
        <span>Produto</span>
        <span>Unidade</span>
        <span>Qtd</span>
        <span>Preco unit.</span>
      </div>
      {items.map((item, index) => (
        <div key={index} className="podm-edit-row">
          <input
            type="text"
            className="podm-edit-input"
            value={item.productName}
            onChange={(e) => update(index, 'productName', e.target.value)}
            aria-label={`Produto do item ${index + 1}`}
          />
          <input
            type="text"
            className="podm-edit-input"
            value={item.unitName}
            onChange={(e) => update(index, 'unitName', e.target.value)}
            aria-label={`Unidade do item ${index + 1}`}
          />
          <input
            type="number"
            className="podm-edit-input"
            value={item.quantity}
            onChange={(e) => update(index, 'quantity', e.target.value)}
            min="0.001"
            step="any"
            aria-label={`Quantidade do item ${index + 1}`}
          />
          <input
            type="text"
            className="podm-edit-input"
            value={item.unitPrice}
            onChange={(e) => update(index, 'unitPrice', e.target.value)}
            onBlur={(e) => {
              const val = parseBRL(e.target.value);
              if (val > 0) update(index, 'unitPrice', formatBRL(val));
            }}
            aria-label={`Preco unitario do item ${index + 1}`}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Main detail component ────────────────────────────────────────────────────

interface PurchaseOrderDetailModalProps {
  isOpen: boolean;
  purchaseOrderId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

function PurchaseOrderDetail({
  purchaseOrderId,
  onClose,
  onUpdate,
}: Omit<PurchaseOrderDetailModalProps, 'isOpen'> & { purchaseOrderId: string }) {
  const { purchaseOrder, isLoading, error, refetch } = usePurchaseOrder(purchaseOrderId);

  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmailSection, setShowEmailSection] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Email state
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  function enterEditMode(po: PurchaseOrder) {
    setEditItems(
      po.items.map((item) => ({
        productName: item.productName,
        unitName: item.unitName,
        quantity: String(item.quantity),
        unitPrice: formatBRL(item.unitPrice),
      })),
    );
    setIsEditMode(true);
  }

  function openEmailSection(po: PurchaseOrder) {
    setEmailAddress(po.supplier.contactEmail ?? '');
    setEmailSubject(`Pedido de Compra ${po.sequentialNumber}`);
    setEmailBody(
      `Prezado fornecedor,\n\nSegue em anexo o pedido de compra ${po.sequentialNumber}.\n\nAtenciosamente,`,
    );
    setShowEmailSection(true);
  }

  async function handlePdfDownload(po: PurchaseOrder) {
    setIsPdfDownloading(true);
    try {
      await downloadPOPdf(po.id, po.sequentialNumber);
    } catch {
      showToast('Nao foi possivel baixar o PDF. Tente novamente.');
    } finally {
      setIsPdfDownloading(false);
    }
  }

  async function handleTransition(po: PurchaseOrder, status: PurchaseOrder['status']) {
    setIsTransitioning(true);
    try {
      await transitionPO(po.id, { status });
      const messages: Record<string, string> = {
        EMITIDA: 'Pedido emitido com sucesso',
        CONFIRMADA: 'Recebimento confirmado pelo fornecedor',
        EM_TRANSITO: 'Pedido marcado como em transito',
        ENTREGUE: 'Pedido marcado como entregue',
        CANCELADA: 'Pedido cancelado',
      };
      showToast(messages[status] ?? 'Status atualizado com sucesso');
      refetch();
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setIsTransitioning(false);
      setShowCancelConfirm(false);
    }
  }

  async function handleDuplicate(po: PurchaseOrder) {
    setIsDuplicating(true);
    try {
      const newPo = await duplicatePO({ sourcePurchaseOrderId: po.id });
      showToast(`Pedido duplicado como rascunho — ${newPo.sequentialNumber}`);
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao duplicar pedido');
    } finally {
      setIsDuplicating(false);
    }
  }

  async function handleSaveEdit(po: PurchaseOrder) {
    setIsSavingEdit(true);
    try {
      await updatePO(po.id, {
        items: editItems.map((item) => ({
          productName: item.productName,
          unitName: item.unitName || 'un',
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseBRL(item.unitPrice),
        })),
      });
      setIsEditMode(false);
      showToast('Pedido atualizado com sucesso');
      refetch();
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar alteracoes');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(po: PurchaseOrder) {
    setIsDeleting(true);
    try {
      await deletePO(po.id);
      showToast('Pedido excluido com sucesso');
      onUpdate();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir pedido');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleEmailSend() {
    if (!purchaseOrder || !emailAddress) return;
    setIsSendingEmail(true);
    try {
      await sendPOEmail(purchaseOrder.id, {
        to: emailAddress,
        subject: emailSubject,
        body: emailBody,
      });
      showToast('Email enviado com sucesso ao fornecedor');
      setShowEmailSection(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nao foi possivel enviar o email. Verifique a configuracao SMTP.');
    } finally {
      setIsSendingEmail(false);
    }
  }

  if (isLoading) {
    return (
      <div className="podm-modal" style={{ padding: 40 }}>
        <div className="podm-loading">
          <Loader2 size={24} className="podm-spin" aria-hidden="true" />
          Carregando pedido...
        </div>
      </div>
    );
  }

  if (error || !purchaseOrder) {
    return (
      <div className="podm-modal">
        <div className="podm-modal__header">
          <h2 className="podm-modal__title">Erro</h2>
          <button type="button" className="podm-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="podm-modal__body">
          <div className="podm-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            {error ?? 'Pedido nao encontrado'}
          </div>
        </div>
      </div>
    );
  }

  const po = purchaseOrder;
  const isFrozen = po.status !== 'RASCUNHO';
  const canEdit = po.status === 'RASCUNHO';
  const canIssue = po.status === 'RASCUNHO';
  const canConfirm = po.status === 'EMITIDA';
  const canTransit = po.status === 'CONFIRMADA';
  const canDeliver = po.status === 'EM_TRANSITO';
  const canCancel = ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO'].includes(po.status);
  const canDownloadPdf = ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO', 'ENTREGUE'].includes(po.status);
  const canEmail = po.status === 'EMITIDA';
  const canDuplicate = ['EMITIDA', 'ENTREGUE', 'CANCELADA'].includes(po.status);
  const canDelete = po.status === 'RASCUNHO';

  return (
    <div className="podm-modal" role="dialog" aria-modal="true" aria-labelledby="podm-title">
      {/* Header */}
      <div className="podm-modal__header">
        <div className="podm-modal__header-info">
          {/* Number + badges */}
          <div className="podm-modal__number-row">
            <h2 id="podm-title" className="podm-modal__number">
              {po.sequentialNumber}
            </h2>
            <StatusBadge status={po.status} />
            {po.isEmergency && (
              <span className="podm-badge podm-badge--emergency">
                <Zap size={10} aria-hidden="true" />
                Emergencial
              </span>
            )}
          </div>

          {/* Supplier */}
          <p className="podm-modal__supplier">{po.supplier.name}</p>

          {/* Dates */}
          <div className="podm-modal__meta">
            {po.issuedAt && (
              <div className="podm-modal__meta-item">
                <span className="podm-modal__meta-label">Emissao</span>
                <span className="podm-modal__meta-value">{formatDate(po.issuedAt)}</span>
              </div>
            )}
            {po.confirmedAt && (
              <div className="podm-modal__meta-item">
                <span className="podm-modal__meta-label">Confirmacao</span>
                <span className="podm-modal__meta-value">{formatDate(po.confirmedAt)}</span>
              </div>
            )}
            {po.expectedDeliveryDate && (
              <div className="podm-modal__meta-item">
                <span className="podm-modal__meta-label">Previsao entrega</span>
                {po.isOverdue ? (
                  <span className="podm-modal__meta-value podm-modal__meta-value--overdue">
                    <AlertTriangle size={12} aria-hidden="true" />
                    {formatDate(po.expectedDeliveryDate)} (Atrasado)
                  </span>
                ) : (
                  <span className="podm-modal__meta-value">
                    {formatDate(po.expectedDeliveryDate)}
                  </span>
                )}
              </div>
            )}
            {po.quotation && (
              <div className="podm-modal__meta-item">
                <span className="podm-modal__meta-label">Cotacao</span>
                <span className="podm-modal__meta-value">{po.quotation.sequentialNumber}</span>
              </div>
            )}
            {po.internalReference && (
              <div className="podm-modal__meta-item">
                <span className="podm-modal__meta-label">Ref. interna</span>
                <span className="podm-modal__meta-value">{po.internalReference}</span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="podm-modal__close"
          onClick={onClose}
          aria-label="Fechar modal"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            padding: '12px 24px',
            background: 'var(--color-success-100)',
            color: 'var(--color-success-700)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          role="status"
        >
          {toastMessage}
        </div>
      )}

      {/* Actions bar */}
      <div className="podm-actions">
        {canIssue && (
          <button
            type="button"
            className="podm-action-btn podm-action-btn--primary"
            onClick={() => void handleTransition(po, 'EMITIDA')}
            disabled={isTransitioning}
          >
            {isTransitioning ? (
              <Loader2 size={16} className="podm-spin" aria-hidden="true" />
            ) : null}
            Emitir
          </button>
        )}
        {canEdit && !isEditMode && (
          <button
            type="button"
            className="podm-action-btn podm-action-btn--secondary"
            onClick={() => enterEditMode(po)}
          >
            Editar
          </button>
        )}
        {isEditMode && (
          <>
            <button
              type="button"
              className="podm-action-btn podm-action-btn--primary"
              onClick={() => void handleSaveEdit(po)}
              disabled={isSavingEdit}
            >
              {isSavingEdit ? <Loader2 size={16} className="podm-spin" aria-hidden="true" /> : null}
              Salvar
            </button>
            <button
              type="button"
              className="podm-action-btn podm-action-btn--secondary"
              onClick={() => setIsEditMode(false)}
              disabled={isSavingEdit}
            >
              Cancelar edicao
            </button>
          </>
        )}
        {canConfirm && (
          <button
            type="button"
            className="podm-action-btn podm-action-btn--primary"
            onClick={() => void handleTransition(po, 'CONFIRMADA')}
            disabled={isTransitioning}
          >
            {isTransitioning ? (
              <Loader2 size={16} className="podm-spin" aria-hidden="true" />
            ) : null}
            Confirmar recebimento do fornecedor
          </button>
        )}
        {canTransit && (
          <button
            type="button"
            className="podm-action-btn podm-action-btn--primary"
            onClick={() => void handleTransition(po, 'EM_TRANSITO')}
            disabled={isTransitioning}
          >
            {isTransitioning ? (
              <Loader2 size={16} className="podm-spin" aria-hidden="true" />
            ) : null}
            Marcar em transito
          </button>
        )}
        {canDeliver && (
          <button
            type="button"
            className="podm-action-btn podm-action-btn--primary"
            onClick={() => void handleTransition(po, 'ENTREGUE')}
            disabled={isTransitioning}
          >
            {isTransitioning ? (
              <Loader2 size={16} className="podm-spin" aria-hidden="true" />
            ) : null}
            Marcar entregue
          </button>
        )}
        {canDownloadPdf && (
          <button
            type="button"
            className="podm-action-btn podm-action-btn--secondary"
            onClick={() => void handlePdfDownload(po)}
            disabled={isPdfDownloading}
            aria-busy={isPdfDownloading}
          >
            {isPdfDownloading ? (
              <Loader2 size={16} className="podm-spin" aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            Baixar PDF
          </button>
        )}
        {canEmail && (
          <button
            type="button"
            className="podm-action-btn podm-action-btn--secondary"
            onClick={() => openEmailSection(po)}
          >
            <Mail size={16} aria-hidden="true" />
            Enviar por email
          </button>
        )}
        {canDuplicate && (
          <button
            type="button"
            className="podm-action-btn podm-action-btn--secondary"
            onClick={() => void handleDuplicate(po)}
            disabled={isDuplicating}
          >
            {isDuplicating ? (
              <Loader2 size={16} className="podm-spin" aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            Duplicar
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            className="podm-action-btn podm-action-btn--danger"
            onClick={() => setShowCancelConfirm(true)}
            disabled={isTransitioning}
          >
            Cancelar pedido
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="podm-action-btn podm-action-btn--danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Excluir
          </button>
        )}
      </div>

      {/* Body */}
      <div className="podm-modal__body">
        {/* Email section */}
        {showEmailSection && (
          <section className="podm-email-section" aria-label="Envio por email">
            <p className="podm-email-section__title">Enviar por email</p>
            <div className="podm-email-field">
              <label htmlFor="podm-email-to" className="podm-email-label">
                Para
              </label>
              <input
                id="podm-email-to"
                type="email"
                className="podm-email-input"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="email@fornecedor.com"
              />
            </div>
            <div className="podm-email-field">
              <label htmlFor="podm-email-subject" className="podm-email-label">
                Assunto
              </label>
              <input
                id="podm-email-subject"
                type="text"
                className="podm-email-input"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="podm-email-field">
              <label htmlFor="podm-email-body" className="podm-email-label">
                Mensagem
              </label>
              <textarea
                id="podm-email-body"
                className="podm-email-textarea"
                rows={4}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
              />
            </div>
            <div className="podm-email-actions">
              <button
                type="button"
                className="podm-action-btn podm-action-btn--secondary"
                onClick={() => setShowEmailSection(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="podm-action-btn podm-action-btn--primary"
                onClick={() => void handleEmailSend()}
                disabled={isSendingEmail || !emailAddress}
                aria-busy={isSendingEmail}
              >
                {isSendingEmail ? (
                  <Loader2 size={16} className="podm-spin" aria-hidden="true" />
                ) : (
                  <Mail size={16} aria-hidden="true" />
                )}
                {isSendingEmail ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </section>
        )}

        {/* Items */}
        <section aria-label="Itens do pedido">
          <h3 className="podm-section-title">Itens</h3>
          {isEditMode ? (
            <EditableItemsTable items={editItems} onChange={setEditItems} />
          ) : (
            <ItemsTable items={po.items} frozen={isFrozen} />
          )}
        </section>

        {/* Emergency justification */}
        {po.isEmergency && po.emergencyJustification && (
          <section aria-label="Justificativa">
            <h3 className="podm-section-title">Justificativa do pedido emergencial</h3>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-neutral-700)',
                background: '#fff8e1',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                borderLeft: '3px solid #f9a825',
              }}
            >
              {po.emergencyJustification}
            </p>
          </section>
        )}

        {/* Notes */}
        {po.notes && (
          <section aria-label="Observacoes">
            <h3 className="podm-section-title">Observacoes</h3>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-neutral-700)',
              }}
            >
              {po.notes}
            </p>
          </section>
        )}
      </div>

      {/* Cancel Confirm */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        title="Cancelar pedido?"
        message="Esta acao nao pode ser desfeita. O pedido sera cancelado permanentemente."
        confirmLabel="Cancelar pedido"
        variant="danger"
        isLoading={isTransitioning}
        onConfirm={() => void handleTransition(po, 'CANCELADA')}
        onCancel={() => setShowCancelConfirm(false)}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Excluir pedido?"
        message={`Tem certeza que deseja excluir o pedido ${po.sequentialNumber}? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir pedido"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleDelete(po)}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

export default function PurchaseOrderDetailModal({
  isOpen,
  purchaseOrderId,
  onClose,
  onUpdate,
}: PurchaseOrderDetailModalProps) {
  if (!isOpen || !purchaseOrderId) return null;

  return (
    <div
      className="podm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <PurchaseOrderDetail
        key={purchaseOrderId}
        purchaseOrderId={purchaseOrderId}
        onClose={onClose}
        onUpdate={onUpdate}
      />
    </div>
  );
}
