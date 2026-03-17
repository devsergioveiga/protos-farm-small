import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Plus,
  AlertCircle,
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Ban,
  Eye,
} from 'lucide-react';
import { useChecks } from '@/hooks/useChecks';
import type { CheckOutput, CheckStatus, CheckType } from '@/hooks/useChecks';
import CheckModal from '@/components/checks/CheckModal';
import CompensateCheckModal from '@/components/checks/CompensateCheckModal';
import './ChecksPage.css';

// ─── Constants ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<CheckStatus, string> = {
  EMITIDO: 'Emitido',
  A_COMPENSAR: 'A Compensar',
  COMPENSADO: 'Compensado',
  DEVOLVIDO: 'Devolvido',
  CANCELADO: 'Cancelado',
};

const TYPE_LABELS: Record<CheckType, string> = {
  EMITIDO: 'Emitido',
  RECEBIDO: 'Recebido',
};

// ─── Helpers ──────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ─── Status badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: CheckStatus }) {
  const icons: Record<CheckStatus, React.ElementType> = {
    EMITIDO: Clock,
    A_COMPENSAR: AlertCircle,
    COMPENSADO: CheckCircle2,
    DEVOLVIDO: XCircle,
    CANCELADO: Ban,
  };
  const Icon = icons[status];
  return (
    <span
      className={`chks-page__status-badge chks-page__status-badge--${status.toLowerCase().replace('_', '-')}`}
      aria-label={`Status: ${STATUS_LABELS[status]}`}
    >
      <Icon size={12} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Type badge ───────────────────────────────────────────────────

function TypeBadge({ type }: { type: CheckType }) {
  return (
    <span className={`chks-page__type-badge chks-page__type-badge--${type.toLowerCase()}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="chks-page__skeleton-row" aria-hidden="true">
      {[120, 80, 160, 100, 100, 120, 80, 100].map((w, i) => (
        <td key={i}>
          <div className="chks-page__skeleton-cell" style={{ width: `${w}px` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── ChecksPage ───────────────────────────────────────────────────

const ChecksPage = () => {
  const {
    checks,
    loading,
    error,
    fetchChecks,
    markACompensar,
    compensateCheck,
    returnCheck,
    resubmitCheck,
    cancelCheck,
  } = useChecks();

  // Filter state
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Modal state
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [compensateTarget, setCompensateTarget] = useState<CheckOutput | null>(null);

  // Inline cancel confirmation
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Apply filters
  const applyFilters = useCallback(() => {
    void fetchChecks({
      status: filterStatus || undefined,
      type: filterType || undefined,
      startDate: filterStartDate || undefined,
      endDate: filterEndDate || undefined,
    });
  }, [fetchChecks, filterStatus, filterType, filterStartDate, filterEndDate]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleCreateSuccess = useCallback(() => {
    setShowCheckModal(false);
    showToast('Cheque registrado com sucesso');
    void fetchChecks({
      status: filterStatus || undefined,
      type: filterType || undefined,
      startDate: filterStartDate || undefined,
      endDate: filterEndDate || undefined,
    });
  }, [fetchChecks, filterStatus, filterType, filterStartDate, filterEndDate, showToast]);

  const handleMarkACompensar = useCallback(
    async (id: string) => {
      try {
        await markACompensar(id);
        showToast('Cheque marcado como A Compensar');
      } catch {
        showToast('Não foi possível atualizar o cheque. Tente novamente.');
      }
    },
    [markACompensar, showToast],
  );

  const handleReturnCheck = useCallback(
    async (id: string) => {
      try {
        await returnCheck(id);
        showToast('Cheque marcado como devolvido');
      } catch {
        showToast('Não foi possível devolver o cheque. Tente novamente.');
      }
    },
    [returnCheck, showToast],
  );

  const handleResubmitCheck = useCallback(
    async (id: string) => {
      try {
        await resubmitCheck(id);
        showToast('Cheque reapresentado com sucesso');
      } catch {
        showToast('Não foi possível reapresentar o cheque. Tente novamente.');
      }
    },
    [resubmitCheck, showToast],
  );

  const handleCancelConfirm = useCallback(
    async (id: string) => {
      try {
        await cancelCheck(id);
        setCancelConfirmId(null);
        showToast('Cheque cancelado com sucesso');
      } catch {
        showToast('Não foi possível cancelar o cheque. Tente novamente.');
      }
    },
    [cancelCheck, showToast],
  );

  const handleCompensateSuccess = useCallback(
    async (compensationDate: string) => {
      if (!compensateTarget) return;
      try {
        await compensateCheck(compensateTarget.id, compensationDate);
        setCompensateTarget(null);
        showToast('Cheque compensado. Saldo bancário atualizado.');
      } catch {
        showToast('Não foi possível compensar o cheque. Tente novamente.');
      }
    },
    [compensateTarget, compensateCheck, showToast],
  );

  return (
    <main className="chks-page" id="main-content">
      {/* Toast */}
      {toast && (
        <div className="chks-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="chks-page__header">
        <div>
          <h1 className="chks-page__title">Cheques</h1>
          <p className="chks-page__subtitle">Controle de cheques emitidos e recebidos</p>
        </div>
        <button
          type="button"
          className="chks-page__btn-primary"
          onClick={() => setShowCheckModal(true)}
        >
          <Plus size={20} aria-hidden="true" />
          Novo Cheque
        </button>
      </header>

      {/* Filters */}
      <section className="chks-page__filters" aria-label="Filtros">
        <div className="chks-page__filter-group">
          <label htmlFor="chks-filter-status" className="chks-page__filter-label">
            Status
          </label>
          <select
            id="chks-filter-status"
            className="chks-page__filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="EMITIDO">Emitido</option>
            <option value="A_COMPENSAR">A Compensar</option>
            <option value="COMPENSADO">Compensado</option>
            <option value="DEVOLVIDO">Devolvido</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>

        <div className="chks-page__filter-group">
          <label htmlFor="chks-filter-type" className="chks-page__filter-label">
            Tipo
          </label>
          <select
            id="chks-filter-type"
            className="chks-page__filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            <option value="EMITIDO">Emitido</option>
            <option value="RECEBIDO">Recebido</option>
          </select>
        </div>

        <div className="chks-page__filter-group">
          <label htmlFor="chks-filter-start" className="chks-page__filter-label">
            De
          </label>
          <input
            id="chks-filter-start"
            type="date"
            className="chks-page__filter-input"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
          />
        </div>

        <div className="chks-page__filter-group">
          <label htmlFor="chks-filter-end" className="chks-page__filter-label">
            Até
          </label>
          <input
            id="chks-filter-end"
            type="date"
            className="chks-page__filter-input"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            min={filterStartDate || undefined}
          />
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="chks-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Table / Empty state */}
      {!error && !loading && checks.length === 0 ? (
        <div className="chks-page__empty">
          <CheckSquare size={48} className="chks-page__empty-icon" aria-hidden="true" />
          <h2 className="chks-page__empty-title">Nenhum cheque registrado</h2>
          <p className="chks-page__empty-desc">
            Controle cheques emitidos e recebidos com rastreamento automático de compensação e saldo
            contábil.
          </p>
          <button
            type="button"
            className="chks-page__btn-primary"
            onClick={() => setShowCheckModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Novo Cheque
          </button>
        </div>
      ) : (
        <div className="chks-page__table-wrap">
          <table className="chks-page__table">
            <caption className="sr-only">Lista de cheques</caption>
            <thead>
              <tr>
                <th scope="col">N° Cheque</th>
                <th scope="col">Tipo</th>
                <th scope="col">Beneficiário / Emitente</th>
                <th scope="col">Valor</th>
                <th scope="col">Data Emissão</th>
                <th scope="col">Compensação Prevista</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : checks.map((check) => (
                    <>
                      <tr
                        key={check.id}
                        className={cancelConfirmId === check.id ? 'chks-page__row--confirming' : ''}
                      >
                        <td className="chks-page__cell-mono">{check.checkNumber}</td>
                        <td>
                          <TypeBadge type={check.type} />
                        </td>
                        <td>{check.payeeName}</td>
                        <td className="chks-page__cell-mono">{formatBRL(check.amount)}</td>
                        <td>{formatDate(check.issueDate)}</td>
                        <td>{formatDate(check.expectedCompensationDate)}</td>
                        <td>
                          <StatusBadge status={check.status} />
                        </td>
                        <td className="chks-page__cell-actions">
                          {check.status === 'EMITIDO' && (
                            <>
                              <button
                                type="button"
                                className="chks-page__action-btn"
                                onClick={() => void handleMarkACompensar(check.id)}
                                aria-label={`Marcar A Compensar cheque N° ${check.checkNumber}`}
                              >
                                <Clock size={14} aria-hidden="true" />
                                Marcar A Compensar
                              </button>
                              <button
                                type="button"
                                className="chks-page__action-btn chks-page__action-btn--danger"
                                onClick={() => setCancelConfirmId(check.id)}
                                aria-label={`Cancelar cheque N° ${check.checkNumber}`}
                              >
                                <Ban size={14} aria-hidden="true" />
                                Cancelar
                              </button>
                            </>
                          )}
                          {check.status === 'A_COMPENSAR' && (
                            <>
                              <button
                                type="button"
                                className="chks-page__action-btn chks-page__action-btn--success"
                                onClick={() => setCompensateTarget(check)}
                                aria-label={`Compensar cheque N° ${check.checkNumber}`}
                              >
                                <CheckCircle2 size={14} aria-hidden="true" />
                                Compensar
                              </button>
                              <button
                                type="button"
                                className="chks-page__action-btn chks-page__action-btn--warning"
                                onClick={() => void handleReturnCheck(check.id)}
                                aria-label={`Devolver cheque N° ${check.checkNumber}`}
                              >
                                <RotateCcw size={14} aria-hidden="true" />
                                Devolver
                              </button>
                              <button
                                type="button"
                                className="chks-page__action-btn chks-page__action-btn--danger"
                                onClick={() => setCancelConfirmId(check.id)}
                                aria-label={`Cancelar cheque N° ${check.checkNumber}`}
                              >
                                <Ban size={14} aria-hidden="true" />
                                Cancelar
                              </button>
                            </>
                          )}
                          {check.status === 'DEVOLVIDO' && (
                            <>
                              <button
                                type="button"
                                className="chks-page__action-btn"
                                onClick={() => void handleResubmitCheck(check.id)}
                                aria-label={`Re-apresentar cheque N° ${check.checkNumber}`}
                              >
                                <RotateCcw size={14} aria-hidden="true" />
                                Re-apresentar
                              </button>
                              <button
                                type="button"
                                className="chks-page__action-btn chks-page__action-btn--danger"
                                onClick={() => setCancelConfirmId(check.id)}
                                aria-label={`Cancelar cheque N° ${check.checkNumber}`}
                              >
                                <Ban size={14} aria-hidden="true" />
                                Cancelar
                              </button>
                            </>
                          )}
                          {(check.status === 'COMPENSADO' || check.status === 'CANCELADO') && (
                            <button
                              type="button"
                              className="chks-page__action-btn chks-page__action-btn--neutral"
                              aria-label={`Ver detalhes do cheque N° ${check.checkNumber}`}
                              disabled
                            >
                              <Eye size={14} aria-hidden="true" />
                              Ver detalhes
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Inline cancel confirmation */}
                      {cancelConfirmId === check.id && (
                        <tr key={`${check.id}-cancel`} className="chks-page__row--cancel-confirm">
                          <td colSpan={8}>
                            <div className="chks-page__cancel-confirm">
                              <AlertCircle
                                size={16}
                                aria-hidden="true"
                                className="chks-page__cancel-confirm-icon"
                              />
                              <span>
                                Confirmar cancelamento do cheque N°{' '}
                                <strong>{check.checkNumber}</strong>? Esta ação não pode ser
                                desfeita.
                              </span>
                              <button
                                type="button"
                                className="chks-page__cancel-confirm-btn chks-page__cancel-confirm-btn--confirm"
                                onClick={() => void handleCancelConfirm(check.id)}
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                className="chks-page__cancel-confirm-btn chks-page__cancel-confirm-btn--abort"
                                onClick={() => setCancelConfirmId(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CheckModal
        isOpen={showCheckModal}
        onClose={() => setShowCheckModal(false)}
        onSuccess={handleCreateSuccess}
      />

      <CompensateCheckModal
        isOpen={compensateTarget !== null}
        onClose={() => setCompensateTarget(null)}
        onSuccess={handleCompensateSuccess}
        check={compensateTarget}
      />
    </main>
  );
};

export default ChecksPage;
