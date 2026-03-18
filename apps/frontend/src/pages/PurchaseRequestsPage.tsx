import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Search,
  Eye,
  Pencil,
  AlertTriangle,
  AlertOctagon,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  Ban,
  CheckCircle2,
  Plus,
  X,
} from 'lucide-react';
import { usePurchaseRequests } from '@/hooks/usePurchaseRequests';
import { usePurchaseRequestForm } from '@/hooks/usePurchaseRequestForm';
import PurchaseRequestModal from '@/components/purchase-requests/PurchaseRequestModal';
import PurchaseRequestDetailModal from '@/components/purchase-requests/PurchaseRequestDetailModal';
import type {
  PurchaseRequest,
  PurchaseRequestStatus,
  PurchaseRequestUrgency,
} from '@/types/purchase-request';
import { RC_STATUS_LABELS, RC_URGENCY_LABELS } from '@/types/purchase-request';
import './PurchaseRequestsPage.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffH < 1) return 'Agora';
  if (diffH < 24) return `ha ${diffH}h`;
  if (diffD < 7) return `ha ${diffD}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcTotal(items: PurchaseRequest['items']): number | null {
  let total = 0;
  let hasPrice = false;
  for (const item of items) {
    if (item.estimatedUnitPrice != null) {
      total += item.quantity * item.estimatedUnitPrice;
      hasPrice = true;
    }
  }
  return hasPrice ? total : null;
}

// ─── Status Badge ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PurchaseRequestStatus, { icon: React.ReactNode; className: string }> = {
  RASCUNHO: {
    icon: <FileText size={12} aria-hidden="true" />,
    className: 'rc-status-badge rc-status-badge--rascunho',
  },
  PENDENTE: {
    icon: <Clock size={12} aria-hidden="true" />,
    className: 'rc-status-badge rc-status-badge--pendente',
  },
  APROVADA: {
    icon: <CheckCircle size={12} aria-hidden="true" />,
    className: 'rc-status-badge rc-status-badge--aprovada',
  },
  REJEITADA: {
    icon: <XCircle size={12} aria-hidden="true" />,
    className: 'rc-status-badge rc-status-badge--rejeitada',
  },
  DEVOLVIDA: {
    icon: <RotateCcw size={12} aria-hidden="true" />,
    className: 'rc-status-badge rc-status-badge--devolvida',
  },
  CANCELADA: {
    icon: <Ban size={12} aria-hidden="true" />,
    className: 'rc-status-badge rc-status-badge--cancelada',
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

// ─── Urgency Chip ─────────────────────────────────────────────────────────

function UrgencyChip({ urgency }: { urgency: PurchaseRequestUrgency }) {
  if (urgency === 'NORMAL') {
    return (
      <span className="rc-urgency-chip rc-urgency-chip--normal">{RC_URGENCY_LABELS.NORMAL}</span>
    );
  }
  if (urgency === 'URGENTE') {
    return (
      <span className="rc-urgency-chip rc-urgency-chip--urgente">
        <AlertTriangle size={12} aria-hidden="true" />
        {RC_URGENCY_LABELS.URGENTE}
      </span>
    );
  }
  return (
    <span className="rc-urgency-chip rc-urgency-chip--emergencial">
      <AlertOctagon size={12} aria-hidden="true" />
      {RC_URGENCY_LABELS.EMERGENCIAL}
      <span className="rc-emergencial-dot" aria-hidden="true" />
    </span>
  );
}

// ─── SLA Indicator ────────────────────────────────────────────────────────

function SlaIndicator({ slaDeadline }: { slaDeadline?: string }) {
  if (!slaDeadline) return null;
  const now = new Date();
  const deadline = new Date(slaDeadline);
  const diffMs = deadline.getTime() - now.getTime();
  const diffH = Math.ceil(diffMs / 3600000);

  if (diffMs < 0) {
    return (
      <span className="rc-sla-indicator rc-sla-indicator--overdue">
        <Clock size={12} aria-hidden="true" />
        Prazo vencido
      </span>
    );
  }
  if (diffH < 2) {
    return (
      <span className="rc-sla-indicator rc-sla-indicator--warning">
        <Clock size={12} aria-hidden="true" />
        {diffH}h restantes
      </span>
    );
  }
  return (
    <span className="rc-sla-indicator rc-sla-indicator--ok">
      <Clock size={12} aria-hidden="true" />
      {diffH}h restantes
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <tbody aria-busy="true" aria-label="Carregando requisicoes">
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="rc-table__skeleton-row">
          <td>
            <div className="skeleton-line skeleton-line--short" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--text" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--text" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--short" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--short" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--short" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--badge" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--short" />
          </td>
          <td />
        </tr>
      ))}
    </tbody>
  );
}

// ─── Mobile Card ──────────────────────────────────────────────────────────

function RCCard({
  rc,
  onView,
  onEdit,
}: {
  rc: PurchaseRequest;
  onView: (rc: PurchaseRequest) => void;
  onEdit: (rc: PurchaseRequest) => void;
}) {
  const total = calcTotal(rc.items);
  const canEdit = rc.status === 'RASCUNHO' || rc.status === 'DEVOLVIDA';

  return (
    <article className="rc-card">
      <div className="rc-card__header">
        <span className="rc-number">{rc.sequentialNumber}</span>
        <StatusBadge status={rc.status} />
      </div>
      <div className="rc-card__row">
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--color-neutral-800)',
          }}
        >
          {rc.farm.name}
        </span>
      </div>
      <div className="rc-card__row">
        <UrgencyChip urgency={rc.urgency} />
        <span>
          {rc.items.length} {rc.items.length === 1 ? 'item' : 'itens'}
        </span>
        {total != null && <span className="rc-total">{formatCurrency(total)}</span>}
      </div>
      <div className="rc-card__actions">
        <button
          type="button"
          className="rc-card__action-btn"
          onClick={() => onView(rc)}
          aria-label={`Ver detalhes da requisicao ${rc.sequentialNumber}`}
        >
          <Eye size={16} aria-hidden="true" /> Ver
        </button>
        {canEdit && (
          <button
            type="button"
            className="rc-card__action-btn"
            onClick={() => onEdit(rc)}
            aria-label={`Editar requisicao ${rc.sequentialNumber}`}
          >
            <Pencil size={16} aria-hidden="true" /> Editar
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

function PurchaseRequestsPage() {
  const [showModal, setShowModal] = useState(false);
  const [rcToEdit, setRcToEdit] = useState<PurchaseRequest | null>(null);
  const [rcToView, setRcToView] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data,
    total,
    page,
    totalPages,
    isLoading,
    error,
    setPage,
    setStatus,
    setSearch,
    refresh,
  } = usePurchaseRequests();

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Unused but needed for hook initialization
  void usePurchaseRequestForm(() => refresh());

  function showToast(message: string) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  const handleModalSuccess = useCallback(
    (message: string) => {
      setShowModal(false);
      setRcToEdit(null);
      showToast(message);
      refresh();
    },
    [refresh],
  );

  function handleSearchChange(val: string) {
    setSearchInput(val);
    setSearch(val);
  }

  function handleStatusChange(val: string) {
    setStatusFilter(val);
    setStatus(val);
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
  }

  function clearStatus() {
    setStatusFilter('');
    setStatus('');
  }

  const hasFilters = !!(searchInput || statusFilter);

  const statusOptions: Array<{ value: PurchaseRequestStatus | ''; label: string }> = [
    { value: '', label: 'Todos os status' },
    { value: 'RASCUNHO', label: 'Rascunho' },
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'APROVADA', label: 'Aprovada' },
    { value: 'REJEITADA', label: 'Rejeitada' },
    { value: 'DEVOLVIDA', label: 'Devolvida' },
    { value: 'CANCELADA', label: 'Cancelada' },
  ];

  return (
    <main className="rc-page">
      {/* Breadcrumb */}
      <nav className="rc-page__breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>Compras</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Requisicoes</span>
      </nav>

      {/* Toast */}
      {successMessage && (
        <div className="rc-page__success" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          {successMessage}
        </div>
      )}

      {/* Page header */}
      <header className="rc-page__header">
        <div>
          <h1 className="rc-page__title">Requisicoes de Compra</h1>
          <p className="rc-page__subtitle">Gerencie as requisicoes de compra da organizacao</p>
        </div>
        <button
          type="button"
          className="rc-page__new-btn"
          onClick={() => {
            setRcToEdit(null);
            setShowModal(true);
          }}
        >
          <ShoppingCart size={20} aria-hidden="true" />
          Nova Requisicao
        </button>
      </header>

      {/* Filter bar */}
      <div className="rc-page__filters">
        <div className="rc-page__search-wrapper">
          <Search size={16} aria-hidden="true" className="rc-page__search-icon" />
          <label htmlFor="rcp-search" className="sr-only">
            Buscar por numero ou produto
          </label>
          <input
            id="rcp-search"
            type="search"
            className="rc-page__search"
            placeholder="Buscar por numero ou produto..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <select
          id="rcp-status"
          className="rc-page__filter-select"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          aria-label="Filtrar por status"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Active chips */}
      {hasFilters && (
        <div
          role="group"
          aria-label="Filtros ativos"
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            marginBottom: 'var(--space-4)',
          }}
        >
          {searchInput && (
            <button
              type="button"
              className="filter-chip"
              onClick={clearSearch}
              aria-label={`Remover filtro de busca: ${searchInput}`}
            >
              Busca: {searchInput}
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {statusFilter && (
            <button
              type="button"
              className="filter-chip"
              onClick={clearStatus}
              aria-label="Remover filtro de status"
            >
              Status: {RC_STATUS_LABELS[statusFilter as PurchaseRequestStatus]}
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rc-page__error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="rc-page__table-wrapper">
        <table className="rc-table">
          <caption className="sr-only">Lista de requisicoes de compra</caption>
          <thead>
            <tr>
              <th scope="col">Numero</th>
              <th scope="col">Tipo</th>
              <th scope="col">Fazenda</th>
              <th scope="col">Urgencia</th>
              <th scope="col">Itens</th>
              <th scope="col">Total Est.</th>
              <th scope="col">Status</th>
              <th scope="col">Data</th>
              <th scope="col">
                <span className="sr-only">Acoes</span>
              </th>
            </tr>
          </thead>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            <tbody>
              {data.map((rc) => {
                const total = calcTotal(rc.items);
                const canEdit = rc.status === 'RASCUNHO' || rc.status === 'DEVOLVIDA';
                const showSla =
                  rc.status === 'PENDENTE' &&
                  (rc.urgency === 'URGENTE' || rc.urgency === 'EMERGENCIAL');

                return (
                  <tr key={rc.id}>
                    <td>
                      <span className="rc-number">{rc.sequentialNumber}</span>
                    </td>
                    <td>{rc.requestType}</td>
                    <td>{rc.farm.name}</td>
                    <td>
                      <UrgencyChip urgency={rc.urgency} />
                      {showSla && <SlaIndicator slaDeadline={rc.slaDeadline} />}
                    </td>
                    <td>{rc.items.length}</td>
                    <td className="rc-total">{total != null ? formatCurrency(total) : '—'}</td>
                    <td>
                      <StatusBadge status={rc.status} />
                    </td>
                    <td>{formatDate(rc.createdAt)}</td>
                    <td className="rc-table__actions">
                      <button
                        type="button"
                        className="rc-table__icon-btn"
                        aria-label={`Ver detalhes da requisicao ${rc.sequentialNumber}`}
                        onClick={() => setRcToView(rc.id)}
                      >
                        <Eye size={20} aria-hidden="true" />
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          className="rc-table__icon-btn"
                          aria-label={`Editar requisicao ${rc.sequentialNumber}`}
                          onClick={() => {
                            setRcToEdit(rc);
                            setShowModal(true);
                          }}
                        >
                          <Pencil size={20} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* Mobile cards */}
      {!isLoading && data.length > 0 && (
        <div className="rc-page__cards" aria-label="Lista de requisicoes">
          {data.map((rc) => (
            <RCCard
              key={rc.id}
              rc={rc}
              onView={(r) => setRcToView(r.id)}
              onEdit={(r) => {
                setRcToEdit(r);
                setShowModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Empty states */}
      {!isLoading && !error && data.length === 0 && !hasFilters && (
        <div className="rc-page__empty">
          <ShoppingCart size={48} aria-hidden="true" className="rc-page__empty-icon" />
          <h2 className="rc-page__empty-title">Nenhuma requisicao ainda</h2>
          <p className="rc-page__empty-desc">
            Crie a primeira requisicao de compra da sua organizacao.
          </p>
          <button
            type="button"
            className="rc-page__new-btn"
            onClick={() => {
              setRcToEdit(null);
              setShowModal(true);
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Nova Requisicao
          </button>
        </div>
      )}

      {!isLoading && !error && data.length === 0 && hasFilters && (
        <div className="rc-page__empty">
          <Search size={48} aria-hidden="true" className="rc-page__empty-icon" />
          <h2 className="rc-page__empty-title">Nenhum resultado encontrado</h2>
          <p className="rc-page__empty-desc">Tente ajustar os filtros ou limpar a busca.</p>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="rc-page__pagination">
          <button
            type="button"
            className="rc-page__page-btn"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Pagina anterior"
          >
            Anterior
          </button>
          <span className="rc-page__page-info">
            Pagina {page} de {totalPages} ({total} total)
          </span>
          <button
            type="button"
            className="rc-page__page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            aria-label="Proxima pagina"
          >
            Proxima
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <PurchaseRequestModal
        isOpen={showModal}
        rc={rcToEdit ?? undefined}
        onClose={() => {
          setShowModal(false);
          setRcToEdit(null);
        }}
        onSuccess={handleModalSuccess}
      />

      {/* Detail Modal */}
      {rcToView && (
        <PurchaseRequestDetailModal
          isOpen={!!rcToView}
          purchaseRequestId={rcToView}
          onClose={() => setRcToView(null)}
          onAction={() => {
            setRcToView(null);
            refresh();
            showToast('Acao registrada com sucesso.');
          }}
        />
      )}
    </main>
  );
}

export default PurchaseRequestsPage;
