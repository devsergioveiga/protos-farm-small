import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ReceiptText,
  AlertCircle,
  Pencil,
  Trash2,
  ArrowDownCircle,
  RefreshCw,
  FileText,
} from 'lucide-react';
import {
  useReceivables,
  useReceivablesAging,
  type Receivable,
  type ReceivableStatus,
  type ReceivableCategory,
  type AgingBucket,
} from '@/hooks/useReceivables';
import { useFarms } from '@/hooks/useFarms';
import { api } from '@/services/api';
import ReceivableModal from '@/components/receivables/ReceivableModal';
import ReceiptModal from '@/components/receivables/ReceiptModal';
import RenegotiateModal from '@/components/receivables/RenegotiateModal';
import './ReceivablesPage.css';

// ─── Constants ────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ReceivableStatus, string> = {
  PENDING: 'Pendente',
  RECEIVED: 'Recebido',
  OVERDUE: 'Vencido',
  RENEGOTIATED: 'Renegociado',
  CANCELLED: 'Cancelado',
};

const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  OVERDUE: 'Vencidas',
  DUE_IN_7: 'Vence em até 7 dias',
  DUE_IN_15: 'Vence em até 15 dias',
  DUE_IN_30: 'Vence em até 30 dias',
  DUE_IN_60: 'Vence em até 60 dias',
  DUE_IN_90: 'Vence em até 90 dias',
  DUE_AFTER_90: 'Vence em mais de 90 dias',
};

const STATUS_OPTIONS: { value: ReceivableStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'RECEIVED', label: 'Recebido' },
  { value: 'OVERDUE', label: 'Vencido' },
  { value: 'RENEGOTIATED', label: 'Renegociado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const CATEGORY_OPTIONS: { value: ReceivableCategory; label: string }[] = [
  { value: 'GRAIN_SALE', label: 'Venda de Grãos' },
  { value: 'CATTLE_SALE', label: 'Venda de Gado' },
  { value: 'MILK_SALE', label: 'Venda de Leite' },
  { value: 'LEASE', label: 'Arrendamento' },
  { value: 'SERVICES', label: 'Serviços' },
  { value: 'OTHER', label: 'Outros' },
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function truncateNfeKey(key: string): string {
  return key.length > 12 ? `${key.slice(0, 6)}...${key.slice(-6)}` : key;
}

// ─── Skeleton ────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr className="cr-page__row--skeleton" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <td key={i}>
          <div className="cr-page__skeleton-cell" />
        </td>
      ))}
    </tr>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReceivableStatus }) {
  return (
    <span className={`cr-page__status cr-page__status--${status.toLowerCase()}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Titles tab ──────────────────────────────────────────────────────

interface TitlesTabProps {
  farmFilter: string;
  statusFilter: ReceivableStatus | '';
  categoryFilter: ReceivableCategory | '';
  startDate: string;
  endDate: string;
  search: string;
  agingBucket: AgingBucket | '';
  onEdit: (receivable: Receivable) => void;
  onSettle: (receivable: Receivable) => void;
  onRenegotiate: (receivable: Receivable) => void;
  onDelete: (receivable: Receivable) => void;
  onReverse: (receivable: Receivable) => void;
  refetchTrigger: number;
}

function TitlesTab({
  farmFilter,
  statusFilter,
  categoryFilter,
  startDate,
  endDate,
  search,
  agingBucket,
  onEdit,
  onSettle,
  onRenegotiate,
  onDelete,
  onReverse,
  refetchTrigger,
}: TitlesTabProps) {
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const { receivables, total, isLoading, error, refetch } = useReceivables({
    farmId: farmFilter || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: search || undefined,
    agingBucket: agingBucket || undefined,
    page,
    limit: LIMIT,
  });

  // Re-fetch when refetch trigger changes (triggered by parent after CRUD actions)
  useEffect(() => {
    if (refetchTrigger > 0) {
      void refetch();
    }
  }, [refetchTrigger]); // refetch intentionally excluded — triggered by counter

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  if (error) {
    return (
      <div className="cr-page__error" role="alert">
        <AlertCircle size={20} aria-hidden="true" />
        {error}
      </div>
    );
  }

  return (
    <section aria-label="Títulos a receber">
      <div className="cr-page__table-wrap">
        <table className="cr-page__table">
          <caption className="sr-only">Lista de contas a receber</caption>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Descrição</th>
              <th scope="col" className="cr-page__col-right">
                Valor
              </th>
              <th scope="col">FUNRURAL</th>
              <th scope="col">Vencimento</th>
              <th scope="col">Status</th>
              <th scope="col">Parcela</th>
              <th scope="col">NF-e</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && [1, 2, 3, 4, 5].map((i) => <RowSkeleton key={i} />)}

            {!isLoading && receivables.length === 0 && (
              <tr>
                <td colSpan={9} className="cr-page__empty-row">
                  <div className="cr-page__empty">
                    <ReceiptText size={48} aria-hidden="true" className="cr-page__empty-icon" />
                    <h3 className="cr-page__empty-title">Nenhuma conta a receber encontrada</h3>
                    <p className="cr-page__empty-desc">
                      Registre sua primeira conta a receber para começar.
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              receivables.map((rec) => (
                <tr key={rec.id} className="cr-page__row">
                  <td className="cr-page__col-client">{rec.clientName}</td>
                  <td className="cr-page__col-desc">{rec.description}</td>
                  <td className="cr-page__col-right cr-page__col-mono">
                    {formatBRL(rec.totalAmount)}
                  </td>
                  <td className="cr-page__col-funrural">
                    {rec.funruralRate != null && rec.funruralAmount != null ? (
                      <span className="cr-page__funrural">
                        <span className="cr-page__funrural-rate">
                          {rec.funruralRate.toFixed(2)}%
                        </span>
                        <span className="cr-page__funrural-amount cr-page__col-mono">
                          {formatBRL(rec.funruralAmount)}
                        </span>
                      </span>
                    ) : (
                      <span className="cr-page__funrural-none">—</span>
                    )}
                  </td>
                  <td className="cr-page__col-mono">{formatDate(rec.dueDate)}</td>
                  <td>
                    <StatusBadge status={rec.status} />
                  </td>
                  <td className="cr-page__col-mono">
                    {rec.installmentCount > 1
                      ? `${rec.installments.length}/${rec.installmentCount}`
                      : '—'}
                  </td>
                  <td>
                    {rec.nfeKey ? (
                      <span
                        className="cr-page__nfe"
                        title={rec.nfeKey}
                        aria-label={`Chave NF-e: ${rec.nfeKey}`}
                      >
                        {truncateNfeKey(rec.nfeKey)}
                      </span>
                    ) : (
                      <span className="cr-page__funrural-none">—</span>
                    )}
                  </td>
                  <td>
                    <div className="cr-page__actions">
                      <button
                        type="button"
                        className="cr-page__action-btn"
                        onClick={() => onEdit(rec)}
                        aria-label={`Editar ${rec.clientName}`}
                        title="Editar"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      {(rec.status === 'PENDING' || rec.status === 'OVERDUE') && (
                        <button
                          type="button"
                          className="cr-page__action-btn cr-page__action-btn--settle"
                          onClick={() => onSettle(rec)}
                          aria-label={`Registrar recebimento de ${rec.clientName}`}
                          title="Registrar recebimento"
                        >
                          <ArrowDownCircle size={14} aria-hidden="true" />
                        </button>
                      )}
                      {rec.status === 'OVERDUE' && (
                        <button
                          type="button"
                          className="cr-page__action-btn cr-page__action-btn--renegotiate"
                          onClick={() => onRenegotiate(rec)}
                          aria-label={`Renegociar ${rec.clientName}`}
                          title="Renegociar"
                        >
                          <RefreshCw size={14} aria-hidden="true" />
                        </button>
                      )}
                      {rec.status === 'RECEIVED' && (
                        <button
                          type="button"
                          className="cr-page__action-btn cr-page__action-btn--reverse"
                          onClick={() => onReverse(rec)}
                          aria-label={`Estornar ${rec.clientName}`}
                          title="Estornar"
                        >
                          <RefreshCw size={14} aria-hidden="true" />
                        </button>
                      )}
                      {rec.status !== 'RECEIVED' && rec.status !== 'RENEGOTIATED' && (
                        <button
                          type="button"
                          className="cr-page__action-btn cr-page__action-btn--danger"
                          onClick={() => onDelete(rec)}
                          aria-label={`Excluir ${rec.clientName}`}
                          title="Excluir"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      {!isLoading && receivables.length > 0 && (
        <div className="cr-page__cards" aria-label="Contas a receber (visualização em cards)">
          {receivables.map((rec) => (
            <article key={`card-${rec.id}`} className="cr-page__card">
              <div className="cr-page__card-top">
                <div>
                  <p className="cr-page__card-client">{rec.clientName}</p>
                  <p className="cr-page__card-desc">{rec.description}</p>
                </div>
                <StatusBadge status={rec.status} />
              </div>
              <div className="cr-page__card-row">
                <span className="cr-page__card-label">Valor</span>
                <span className="cr-page__card-value cr-page__col-mono">
                  {formatBRL(rec.totalAmount)}
                </span>
              </div>
              {rec.funruralRate != null && (
                <div className="cr-page__card-row">
                  <span className="cr-page__card-label">FUNRURAL</span>
                  <span className="cr-page__card-value cr-page__col-mono">
                    {rec.funruralRate.toFixed(2)}% ({formatBRL(rec.funruralAmount ?? 0)})
                  </span>
                </div>
              )}
              <div className="cr-page__card-row">
                <span className="cr-page__card-label">Vencimento</span>
                <span className="cr-page__card-value cr-page__col-mono">
                  {formatDate(rec.dueDate)}
                </span>
              </div>
              <div className="cr-page__card-actions">
                <button
                  type="button"
                  className="cr-page__card-btn"
                  onClick={() => onEdit(rec)}
                  aria-label={`Editar ${rec.clientName}`}
                >
                  <Pencil size={14} aria-hidden="true" />
                  Editar
                </button>
                {(rec.status === 'PENDING' || rec.status === 'OVERDUE') && (
                  <button
                    type="button"
                    className="cr-page__card-btn cr-page__card-btn--settle"
                    onClick={() => onSettle(rec)}
                    aria-label={`Registrar recebimento`}
                  >
                    <ArrowDownCircle size={14} aria-hidden="true" />
                    Receber
                  </button>
                )}
                {rec.status === 'OVERDUE' && (
                  <button
                    type="button"
                    className="cr-page__card-btn cr-page__card-btn--renegotiate"
                    onClick={() => onRenegotiate(rec)}
                    aria-label="Renegociar"
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    Renegociar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="cr-page__pagination" aria-label="Paginação">
          <button
            type="button"
            className="cr-page__page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            Anterior
          </button>
          <span className="cr-page__page-info">
            {page} / {totalPages} ({total} títulos)
          </span>
          <button
            type="button"
            className="cr-page__page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="Próxima página"
          >
            Próxima
          </button>
        </nav>
      )}
    </section>
  );
}

// ─── Aging tab ────────────────────────────────────────────────────────

interface AgingTabProps {
  farmFilter: string;
  onBucketClick: (bucket: AgingBucket) => void;
}

function AgingTab({ farmFilter, onBucketClick }: AgingTabProps) {
  const { aging, isLoading, error } = useReceivablesAging(farmFilter || undefined);

  if (error) {
    return (
      <div className="cr-page__error" role="alert">
        <AlertCircle size={20} aria-hidden="true" />
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="cr-page__aging-skeleton" aria-busy="true">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="cr-page__aging-skeleton-row" aria-hidden="true">
            <div className="cr-page__skeleton-cell cr-page__skeleton-cell--wide" />
            <div className="cr-page__skeleton-cell" />
            <div className="cr-page__skeleton-cell" />
          </div>
        ))}
      </div>
    );
  }

  if (!aging) return null;

  return (
    <section aria-label="Aging de recebíveis">
      {/* Summary cards */}
      <div className="cr-page__aging-summary">
        <div className="cr-page__aging-summary-card cr-page__aging-summary-card--overdue">
          <span className="cr-page__aging-summary-label">Inadimplência</span>
          <span className="cr-page__aging-summary-value cr-page__col-mono">
            {formatBRL(aging.overdueAmount)}
          </span>
          <span className="cr-page__aging-summary-count">
            {aging.overdueCount} títulos vencidos
          </span>
        </div>
        <div className="cr-page__aging-summary-card">
          <span className="cr-page__aging-summary-label">Total a receber</span>
          <span className="cr-page__aging-summary-value cr-page__col-mono">
            {formatBRL(aging.totalReceivable)}
          </span>
        </div>
      </div>

      {/* Aging table */}
      <div className="cr-page__table-wrap">
        <table className="cr-page__table cr-page__table--aging">
          <caption className="sr-only">Aging de recebíveis por faixa de vencimento</caption>
          <thead>
            <tr>
              <th scope="col">Faixa</th>
              <th scope="col" className="cr-page__col-right">
                Qtd
              </th>
              <th scope="col" className="cr-page__col-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {aging.buckets.map((b) => (
              <tr
                key={b.bucket}
                className={`cr-page__aging-row ${b.bucket === 'OVERDUE' ? 'cr-page__aging-row--overdue' : ''}`}
                onClick={() => onBucketClick(b.bucket)}
                role="button"
                aria-label={`Filtrar por ${AGING_BUCKET_LABELS[b.bucket]}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onBucketClick(b.bucket);
                }}
              >
                <td className="cr-page__aging-label">
                  <FileText size={14} aria-hidden="true" />
                  {AGING_BUCKET_LABELS[b.bucket]}
                </td>
                <td className="cr-page__col-right cr-page__col-mono">{b.count}</td>
                <td className="cr-page__col-right cr-page__col-mono">{formatBRL(b.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cr-page__aging-note">
        Clique em uma faixa para filtrar os títulos correspondentes. Títulos renegociados não são
        incluídos no aging.
      </p>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

type TabType = 'titulos' | 'aging';

export default function ReceivablesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('titulos');
  const [farmFilter, setFarmFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReceivableStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<ReceivableCategory | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [agingBucket, setAgingBucket] = useState<AgingBucket | ''>('');

  // Modal states
  const [showReceivableModal, setShowReceivableModal] = useState(false);
  const [editReceivable, setEditReceivable] = useState<Receivable | undefined>();
  const [settleReceivable, setSettleReceivable] = useState<Receivable | undefined>();
  const [renegotiateReceivable, setRenegotiateReceivable] = useState<Receivable | undefined>();
  const [deleteConfirm, setDeleteConfirm] = useState<Receivable | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const { farms } = useFarms();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const triggerRefetch = useCallback(() => {
    setRefetchTrigger((n) => n + 1);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setShowReceivableModal(false);
    setEditReceivable(undefined);
    triggerRefetch();
    showToast('Conta a receber cadastrada com sucesso');
  }, [triggerRefetch, showToast]);

  const handleEditSuccess = useCallback(() => {
    setShowReceivableModal(false);
    setEditReceivable(undefined);
    triggerRefetch();
    showToast('Conta a receber atualizada com sucesso');
  }, [triggerRefetch, showToast]);

  const handleSettleSuccess = useCallback(() => {
    setSettleReceivable(undefined);
    triggerRefetch();
    showToast('Recebimento registrado com sucesso');
  }, [triggerRefetch, showToast]);

  const handleRenegotiateSuccess = useCallback(() => {
    setRenegotiateReceivable(undefined);
    triggerRefetch();
    showToast('Título renegociado com sucesso');
  }, [triggerRefetch, showToast]);

  const handleEdit = useCallback((receivable: Receivable) => {
    setEditReceivable(receivable);
    setShowReceivableModal(true);
  }, []);

  const handleSettle = useCallback((receivable: Receivable) => {
    setSettleReceivable(receivable);
  }, []);

  const handleRenegotiate = useCallback((receivable: Receivable) => {
    setRenegotiateReceivable(receivable);
  }, []);

  const handleReverse = useCallback(
    async (receivable: Receivable) => {
      try {
        await api.post(`/org/receivables/${receivable.id}/reverse`, {});
        triggerRefetch();
        showToast('Recebimento estornado com sucesso');
      } catch {
        showToast('Não foi possível estornar o recebimento. Tente novamente.');
      }
    },
    [triggerRefetch, showToast],
  );

  const handleDelete = useCallback(
    async (receivable: Receivable) => {
      try {
        await api.delete(`/org/receivables/${receivable.id}`);
        triggerRefetch();
        showToast('Conta a receber excluída');
      } catch {
        showToast('Não foi possível excluir. Tente novamente.');
      } finally {
        setDeleteConfirm(null);
      }
    },
    [triggerRefetch, showToast],
  );

  const handleBucketClick = useCallback((bucket: AgingBucket) => {
    setAgingBucket(bucket);
    setActiveTab('titulos');
  }, []);

  const openForCreate = useCallback(() => {
    setEditReceivable(undefined);
    setShowReceivableModal(true);
  }, []);

  return (
    <main className="cr-page" id="main-content">
      {toast && (
        <div className="cr-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="cr-page__confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar exclusão"
        >
          <div className="cr-page__confirm-panel">
            <h3 className="cr-page__confirm-title">Excluir conta a receber?</h3>
            <p className="cr-page__confirm-text">
              O título de <strong>{deleteConfirm.clientName}</strong> no valor de{' '}
              <strong>{formatBRL(deleteConfirm.totalAmount)}</strong> será excluído permanentemente.
            </p>
            <div className="cr-page__confirm-actions">
              <button
                type="button"
                className="cr-page__confirm-cancel"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cr-page__confirm-delete"
                onClick={() => void handleDelete(deleteConfirm)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="cr-page__header">
        <div>
          <h1 className="cr-page__title">Contas a Receber</h1>
          <p className="cr-page__subtitle">Gerencie títulos e acompanhe recebimentos</p>
        </div>
        <button type="button" className="cr-page__btn-primary" onClick={openForCreate}>
          <Plus size={20} aria-hidden="true" />
          Nova Conta a Receber
        </button>
      </header>

      {/* Filters */}
      <section className="cr-page__filters" aria-label="Filtros">
        <div className="cr-page__filter-group">
          <label htmlFor="cr-filter-status" className="cr-page__filter-label">
            Status
          </label>
          <select
            id="cr-filter-status"
            className="cr-page__filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReceivableStatus | '')}
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="cr-page__filter-group">
          <label htmlFor="cr-filter-category" className="cr-page__filter-label">
            Categoria rural
          </label>
          <select
            id="cr-filter-category"
            className="cr-page__filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ReceivableCategory | '')}
          >
            <option value="">Todas as categorias</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="cr-page__filter-group">
          <label htmlFor="cr-filter-farm" className="cr-page__filter-label">
            Fazenda
          </label>
          <select
            id="cr-filter-farm"
            className="cr-page__filter-select"
            value={farmFilter}
            onChange={(e) => setFarmFilter(e.target.value)}
          >
            <option value="">Todas as fazendas</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="cr-page__filter-group">
          <label htmlFor="cr-filter-start" className="cr-page__filter-label">
            Vencimento de
          </label>
          <input
            id="cr-filter-start"
            type="date"
            className="cr-page__filter-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="cr-page__filter-group">
          <label htmlFor="cr-filter-end" className="cr-page__filter-label">
            Vencimento até
          </label>
          <input
            id="cr-filter-end"
            type="date"
            className="cr-page__filter-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="cr-page__filter-group cr-page__filter-group--search">
          <label htmlFor="cr-filter-search" className="cr-page__filter-label">
            Busca
          </label>
          <input
            id="cr-filter-search"
            type="search"
            className="cr-page__filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cliente ou descrição..."
          />
        </div>

        {agingBucket && (
          <div className="cr-page__filter-group cr-page__filter-group--bucket">
            <span className="cr-page__filter-label">Faixa aging</span>
            <div className="cr-page__bucket-chip">
              {AGING_BUCKET_LABELS[agingBucket]}
              <button
                type="button"
                className="cr-page__bucket-clear"
                onClick={() => setAgingBucket('')}
                aria-label="Remover filtro de faixa aging"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Tabs */}
      <div className="cr-page__tabs" role="tablist" aria-label="Visualizações">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'titulos'}
          aria-controls="tab-titulos"
          id="tab-btn-titulos"
          className={`cr-page__tab ${activeTab === 'titulos' ? 'cr-page__tab--active' : ''}`}
          onClick={() => setActiveTab('titulos')}
        >
          <ReceiptText size={16} aria-hidden="true" />
          Títulos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'aging'}
          aria-controls="tab-aging"
          id="tab-btn-aging"
          className={`cr-page__tab ${activeTab === 'aging' ? 'cr-page__tab--active' : ''}`}
          onClick={() => setActiveTab('aging')}
        >
          <FileText size={16} aria-hidden="true" />
          Aging
        </button>
      </div>

      {/* Tab panels */}
      <div
        id="tab-titulos"
        role="tabpanel"
        aria-labelledby="tab-btn-titulos"
        hidden={activeTab !== 'titulos'}
      >
        <TitlesTab
          farmFilter={farmFilter}
          statusFilter={statusFilter}
          categoryFilter={categoryFilter}
          startDate={startDate}
          endDate={endDate}
          search={search}
          agingBucket={agingBucket}
          onEdit={handleEdit}
          onSettle={handleSettle}
          onRenegotiate={handleRenegotiate}
          onDelete={(rec) => setDeleteConfirm(rec)}
          onReverse={(rec) => void handleReverse(rec)}
          refetchTrigger={refetchTrigger}
        />
      </div>

      <div
        id="tab-aging"
        role="tabpanel"
        aria-labelledby="tab-btn-aging"
        hidden={activeTab !== 'aging'}
      >
        <AgingTab farmFilter={farmFilter} onBucketClick={handleBucketClick} />
      </div>

      {/* Modals */}
      <ReceivableModal
        isOpen={showReceivableModal}
        onClose={() => {
          setShowReceivableModal(false);
          setEditReceivable(undefined);
        }}
        onSuccess={editReceivable ? handleEditSuccess : handleCreateSuccess}
        receivable={editReceivable}
      />

      {settleReceivable && (
        <ReceiptModal
          receivable={settleReceivable}
          onClose={() => setSettleReceivable(undefined)}
          onSuccess={handleSettleSuccess}
        />
      )}

      {renegotiateReceivable && (
        <RenegotiateModal
          receivable={renegotiateReceivable}
          onClose={() => setRenegotiateReceivable(undefined)}
          onSuccess={handleRenegotiateSuccess}
        />
      )}
    </main>
  );
}
