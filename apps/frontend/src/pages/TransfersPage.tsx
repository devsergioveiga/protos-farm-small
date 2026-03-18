import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, AlertCircle, ArrowLeftRight, ArrowRight, Trash2 } from 'lucide-react';
import { useTransfers } from '@/hooks/useTransfers';
import type { TransferOutput, TransferType } from '@/hooks/useTransfers';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import TransferModal from '@/components/transfers/TransferModal';
import './TransfersPage.css';

// ─── Constants ────────────────────────────────────────────────────

const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  INTERNA: 'Interna',
  TED: 'TED',
  APLICACAO: 'Aplicação',
  RESGATE: 'Resgate',
};

const TYPE_BADGE_CLASSES: Record<TransferType, string> = {
  INTERNA: 'tr-page__badge--neutral',
  TED: 'tr-page__badge--info',
  APLICACAO: 'tr-page__badge--success',
  RESGATE: 'tr-page__badge--info',
};

// ─── Helpers ──────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ─── Skeleton row ─────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="tr-page__skeleton-row" aria-hidden="true">
      <td>
        <div className="tr-page__skeleton-cell" style={{ width: '60%' }} />
      </td>
      <td>
        <div className="tr-page__skeleton-cell" style={{ width: 64, height: 24 }} />
      </td>
      <td>
        <div className="tr-page__skeleton-cell" style={{ width: '70%' }} />
      </td>
      <td>
        <div className="tr-page__skeleton-cell" style={{ width: '70%' }} />
      </td>
      <td>
        <div className="tr-page__skeleton-cell" style={{ width: '50%' }} />
      </td>
      <td>
        <div className="tr-page__skeleton-cell" style={{ width: '40%' }} />
      </td>
      <td>
        <div className="tr-page__skeleton-cell" style={{ width: '60%' }} />
      </td>
      <td>
        <div className="tr-page__skeleton-cell" style={{ width: 32, height: 32 }} />
      </td>
    </tr>
  );
}

// ─── TypeBadge ────────────────────────────────────────────────────

function TypeBadge({ type }: { type: TransferType }) {
  return (
    <span className={`tr-page__badge ${TYPE_BADGE_CLASSES[type]}`}>
      {TRANSFER_TYPE_LABELS[type]}
    </span>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────

interface DeleteConfirmProps {
  transfer: TransferOutput;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ transfer, onConfirm, onCancel }: DeleteConfirmProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  return (
    <div
      className="tr-page__delete-confirm"
      ref={ref}
      role="dialog"
      aria-label="Confirmar exclusão"
    >
      <p className="tr-page__delete-confirm-text">
        Excluir transferência de {formatBRL(transfer.amount)}? Esta ação reverterá os saldos.
      </p>
      <div className="tr-page__delete-confirm-actions">
        <button type="button" className="tr-page__delete-confirm-cancel" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="tr-page__delete-confirm-ok" onClick={onConfirm}>
          Excluir
        </button>
      </div>
    </div>
  );
}

// ─── TransfersPage ────────────────────────────────────────────────

export default function TransfersPage() {
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const { transfers, loading, error, fetchTransfers, deleteTransfer } = useTransfers({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    type: filterType || undefined,
    accountId: filterAccountId || undefined,
  });

  const { accounts } = useBankAccounts();

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTransfer(id);
        showToast('Transferência excluída com sucesso');
      } catch {
        showToast('Não foi possível excluir a transferência.');
      } finally {
        setDeleteId(null);
      }
    },
    [deleteTransfer, showToast],
  );

  return (
    <main className="tr-page" id="main-content">
      {toast && (
        <div className="tr-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="tr-page__header">
        <div>
          <h1 className="tr-page__title">Transferências</h1>
          <p className="tr-page__subtitle">
            Movimentações entre contas bancárias, aplicações e resgates
          </p>
        </div>
        <button type="button" className="tr-page__btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} aria-hidden="true" />
          Nova transferência
        </button>
      </header>

      {/* Filters */}
      <section className="tr-page__filters" aria-label="Filtros">
        <div className="tr-page__filter-group">
          <label htmlFor="tr-filter-start" className="tr-page__filter-label">
            De
          </label>
          <input
            id="tr-filter-start"
            type="date"
            className="tr-page__filter-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="tr-page__filter-group">
          <label htmlFor="tr-filter-end" className="tr-page__filter-label">
            Até
          </label>
          <input
            id="tr-filter-end"
            type="date"
            className="tr-page__filter-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="tr-page__filter-group">
          <label htmlFor="tr-filter-type" className="tr-page__filter-label">
            Tipo
          </label>
          <select
            id="tr-filter-type"
            className="tr-page__filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            <option value="INTERNA">Interna</option>
            <option value="TED">TED</option>
            <option value="APLICACAO">Aplicação</option>
            <option value="RESGATE">Resgate</option>
          </select>
        </div>

        <div className="tr-page__filter-group">
          <label htmlFor="tr-filter-account" className="tr-page__filter-label">
            Conta
          </label>
          <select
            id="tr-filter-account"
            className="tr-page__filter-select"
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
          >
            <option value="">Todas as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="tr-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          Não foi possível carregar as transferências. Verifique sua conexão e tente novamente.
        </div>
      )}

      {/* Table */}
      {!error && (
        <section className="tr-page__table-wrap" aria-label="Lista de transferências">
          {/* Desktop table */}
          <table className="tr-page__table">
            <caption className="sr-only">Transferências entre contas bancárias</caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Tipo</th>
                <th scope="col">Conta origem</th>
                <th scope="col">Conta destino</th>
                <th scope="col">Valor</th>
                <th scope="col">Tarifa</th>
                <th scope="col">Descrição</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!loading && transfers.length === 0 && (
                <tr>
                  <td colSpan={8} className="tr-page__empty-cell">
                    <div className="tr-page__empty">
                      <ArrowLeftRight
                        size={48}
                        className="tr-page__empty-icon"
                        aria-hidden="true"
                      />
                      <h2 className="tr-page__empty-title">Nenhuma transferência registrada</h2>
                      <p className="tr-page__empty-desc">
                        Registre movimentações entre contas bancárias, incluindo aplicações e
                        resgates.
                      </p>
                      <button
                        type="button"
                        className="tr-page__btn-primary"
                        onClick={() => setShowModal(true)}
                      >
                        <Plus size={20} aria-hidden="true" />
                        Nova transferência
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                transfers.map((transfer) => (
                  <tr key={transfer.id} className="tr-page__row">
                    <td className="tr-page__cell">{formatDate(transfer.transferDate)}</td>
                    <td className="tr-page__cell">
                      <TypeBadge type={transfer.type} />
                    </td>
                    <td className="tr-page__cell">{transfer.fromAccountName}</td>
                    <td className="tr-page__cell">{transfer.toAccountName}</td>
                    <td className="tr-page__cell tr-page__cell--mono">
                      {formatBRL(transfer.amount)}
                    </td>
                    <td className="tr-page__cell tr-page__cell--mono">
                      {transfer.feeAmount ? formatBRL(transfer.feeAmount) : '—'}
                    </td>
                    <td className="tr-page__cell">{transfer.description}</td>
                    <td className="tr-page__cell tr-page__cell--actions">
                      <div className="tr-page__actions-wrap">
                        <button
                          type="button"
                          className="tr-page__btn-delete"
                          onClick={() => setDeleteId(transfer.id)}
                          aria-label={`Excluir transferência de ${formatBRL(transfer.amount)}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                        {deleteId === transfer.id && (
                          <DeleteConfirm
                            transfer={transfer}
                            onConfirm={() => void handleDelete(transfer.id)}
                            onCancel={() => setDeleteId(null)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          {!loading && transfers.length > 0 && (
            <ul className="tr-page__cards" aria-label="Transferências">
              {transfers.map((transfer) => (
                <li key={transfer.id} className="tr-page__card">
                  <div className="tr-page__card-row tr-page__card-row--header">
                    <span className="tr-page__card-date">{formatDate(transfer.transferDate)}</span>
                    <TypeBadge type={transfer.type} />
                  </div>
                  <div className="tr-page__card-row tr-page__card-row--accounts">
                    <span className="tr-page__card-account">{transfer.fromAccountName}</span>
                    <ArrowRight size={16} className="tr-page__card-arrow" aria-hidden="true" />
                    <span className="tr-page__card-account">{transfer.toAccountName}</span>
                  </div>
                  <div className="tr-page__card-row tr-page__card-row--values">
                    <span className="tr-page__card-amount">{formatBRL(transfer.amount)}</span>
                    {transfer.feeAmount ? (
                      <span className="tr-page__card-fee">
                        Tarifa: {formatBRL(transfer.feeAmount)}
                      </span>
                    ) : null}
                  </div>
                  <div className="tr-page__card-row">
                    <span className="tr-page__card-desc">{transfer.description}</span>
                    <div className="tr-page__actions-wrap">
                      <button
                        type="button"
                        className="tr-page__btn-delete"
                        onClick={() => setDeleteId(transfer.id)}
                        aria-label={`Excluir transferência de ${formatBRL(transfer.amount)}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                      {deleteId === transfer.id && (
                        <DeleteConfirm
                          transfer={transfer}
                          onConfirm={() => void handleDelete(transfer.id)}
                          onCancel={() => setDeleteId(null)}
                        />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Modal */}
      <TransferModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          showToast('Transferência registrada com sucesso');
          void fetchTransfers();
        }}
      />
    </main>
  );
}
