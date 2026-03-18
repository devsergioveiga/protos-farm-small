import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSearch,
  Search,
  Eye,
  Trash2,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  CheckCircle2,
  Plus,
  X,
  LayoutList,
} from 'lucide-react';
import { useQuotations, deleteQuotation } from '@/hooks/useQuotations';
import QuotationModal from '@/components/quotations/QuotationModal';
import QuotationDetailModal from '@/components/quotations/QuotationDetailModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { Quotation, QuotationStatus } from '@/types/quotation';
import { SC_STATUS_LABELS, SC_STATUS_COLORS } from '@/types/quotation';
import './QuotationsPage.css';

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

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Status Badge ─────────────────────────────────────────────────────────

const STATUS_ICON: Record<QuotationStatus, React.ReactNode> = {
  RASCUNHO: <FileText size={12} aria-hidden="true" />,
  AGUARDANDO_PROPOSTA: <Clock size={12} aria-hidden="true" />,
  EM_ANALISE: <LayoutList size={12} aria-hidden="true" />,
  APROVADA: <CheckCircle size={12} aria-hidden="true" />,
  CANCELADA: <XCircle size={12} aria-hidden="true" />,
  FECHADA: <Ban size={12} aria-hidden="true" />,
};

function StatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <span className={`sc-badge ${SC_STATUS_COLORS[status]}`}>
      {STATUS_ICON[status]}
      {SC_STATUS_LABELS[status].toUpperCase()}
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <tbody aria-busy="true" aria-label="Carregando cotacoes">
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="sc-table__skeleton-row">
          <td>
            <div className="skeleton-line skeleton-line--short" />
          </td>
          <td>
            <div className="skeleton-line skeleton-line--text" />
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

function SCCard({
  quotation,
  onView,
  onDelete,
}: {
  quotation: Quotation;
  onView: (id: string) => void;
  onDelete: (q: Quotation) => void;
}) {
  const canDelete = quotation.status === 'RASCUNHO';
  const supplierCount = quotation.suppliers.length;

  return (
    <article className="sc-card">
      <div className="sc-card__header">
        <span className="sc-number">{quotation.sequentialNumber}</span>
        <StatusBadge status={quotation.status} />
      </div>
      <div className="sc-card__row">
        <span className="sc-card__label">RC:</span>
        <span className="sc-mono">{quotation.purchaseRequest.sequentialNumber}</span>
      </div>
      <div className="sc-card__row">
        <span>
          {supplierCount} {supplierCount === 1 ? 'fornecedor' : 'fornecedores'}
        </span>
        {quotation.responseDeadline && (
          <span>Prazo: {formatDateShort(quotation.responseDeadline)}</span>
        )}
      </div>
      <div className="sc-card__actions">
        <button
          type="button"
          className="sc-card__action-btn"
          onClick={() => onView(quotation.id)}
          aria-label={`Ver detalhes da cotacao ${quotation.sequentialNumber}`}
        >
          <Eye size={16} aria-hidden="true" /> Ver
        </button>
        {canDelete && (
          <button
            type="button"
            className="sc-card__action-btn sc-card__action-btn--danger"
            onClick={() => onDelete(quotation)}
            aria-label={`Excluir cotacao ${quotation.sequentialNumber}`}
          >
            <Trash2 size={16} aria-hidden="true" /> Excluir
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

function QuotationsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [quotationToView, setQuotationToView] = useState<string | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    quotations,
    total,
    page,
    totalPages,
    isLoading,
    error,
    setPage,
    setStatus,
    setSearch,
    refresh,
  } = useQuotations();

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  function showToast(message: string) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    showToast('Cotacao criada com sucesso');
    refresh();
  }, [refresh]);

  const handleDetailUpdate = useCallback(() => {
    refresh();
  }, [refresh]);

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

  async function handleConfirmDelete() {
    if (!quotationToDelete) return;
    setIsDeleting(true);
    try {
      await deleteQuotation(quotationToDelete.id);
      setQuotationToDelete(null);
      showToast('Cotacao excluida com sucesso');
      refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir cotacao');
    } finally {
      setIsDeleting(false);
    }
  }

  const hasFilters = !!(searchInput || statusFilter);

  const statusOptions: Array<{ value: QuotationStatus | ''; label: string }> = [
    { value: '', label: 'Todos os status' },
    { value: 'RASCUNHO', label: 'Rascunho' },
    { value: 'AGUARDANDO_PROPOSTA', label: 'Aguardando Proposta' },
    { value: 'EM_ANALISE', label: 'Em Analise' },
    { value: 'APROVADA', label: 'Aprovada' },
    { value: 'CANCELADA', label: 'Cancelada' },
    { value: 'FECHADA', label: 'Fechada' },
  ];

  return (
    <main className="sc-page">
      {/* Breadcrumb */}
      <nav className="sc-page__breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>Compras</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Cotacoes</span>
      </nav>

      {/* Toast */}
      {successMessage && (
        <div className="sc-page__success" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          {successMessage}
        </div>
      )}

      {/* Page header */}
      <header className="sc-page__header">
        <div>
          <h1 className="sc-page__title">Cotacoes de Compra</h1>
          <p className="sc-page__subtitle">
            Gerencie as solicitacoes de cotacao e compare propostas
          </p>
        </div>
        <button type="button" className="sc-page__new-btn" onClick={() => setShowCreateModal(true)}>
          <FileSearch size={20} aria-hidden="true" />
          Nova Cotacao
        </button>
      </header>

      {/* Filter bar */}
      <div className="sc-page__filters">
        <div className="sc-page__search-wrapper">
          <Search size={16} aria-hidden="true" className="sc-page__search-icon" />
          <label htmlFor="sc-search" className="sr-only">
            Buscar por numero
          </label>
          <input
            id="sc-search"
            type="search"
            className="sc-page__search"
            placeholder="Buscar por numero..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <select
          id="sc-status"
          className="sc-page__filter-select"
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

      {/* Active filter chips */}
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
              Status: {SC_STATUS_LABELS[statusFilter as QuotationStatus]}
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="sc-page__error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="sc-page__table-wrapper">
        <table className="sc-table">
          <caption className="sr-only">Lista de cotacoes de compra</caption>
          <thead>
            <tr>
              <th scope="col">Numero</th>
              <th scope="col">RC Ref</th>
              <th scope="col">Fornecedores</th>
              <th scope="col">Status</th>
              <th scope="col">Prazo Resposta</th>
              <th scope="col">Data Criacao</th>
              <th scope="col">
                <span className="sr-only">Acoes</span>
              </th>
            </tr>
          </thead>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            <tbody>
              {quotations.map((q) => {
                const canDelete = q.status === 'RASCUNHO';
                return (
                  <tr key={q.id}>
                    <td>
                      <span className="sc-number">{q.sequentialNumber}</span>
                    </td>
                    <td>
                      <span className="sc-mono">{q.purchaseRequest.sequentialNumber}</span>
                    </td>
                    <td>{q.suppliers.length}</td>
                    <td>
                      <StatusBadge status={q.status} />
                    </td>
                    <td>{formatDateShort(q.responseDeadline)}</td>
                    <td>{formatDate(q.createdAt)}</td>
                    <td className="sc-table__actions">
                      <button
                        type="button"
                        className="sc-table__icon-btn"
                        aria-label={`Ver detalhes da cotacao ${q.sequentialNumber}`}
                        onClick={() => setQuotationToView(q.id)}
                      >
                        <Eye size={20} aria-hidden="true" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          className="sc-table__icon-btn sc-table__icon-btn--danger"
                          aria-label={`Excluir cotacao ${q.sequentialNumber}`}
                          onClick={() => setQuotationToDelete(q)}
                        >
                          <Trash2 size={20} aria-hidden="true" />
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
      {!isLoading && quotations.length > 0 && (
        <div className="sc-page__cards" aria-label="Lista de cotacoes">
          {quotations.map((q) => (
            <SCCard
              key={q.id}
              quotation={q}
              onView={(id) => setQuotationToView(id)}
              onDelete={(q) => setQuotationToDelete(q)}
            />
          ))}
        </div>
      )}

      {/* Empty states */}
      {!isLoading && !error && quotations.length === 0 && !hasFilters && (
        <div className="sc-page__empty">
          <FileSearch size={48} aria-hidden="true" className="sc-page__empty-icon" />
          <h2 className="sc-page__empty-title">Nenhuma cotacao ainda</h2>
          <p className="sc-page__empty-desc">
            Crie a primeira cotacao de compra a partir de uma requisicao aprovada.
          </p>
          <button
            type="button"
            className="sc-page__new-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Nova Cotacao
          </button>
        </div>
      )}

      {!isLoading && !error && quotations.length === 0 && hasFilters && (
        <div className="sc-page__empty">
          <Search size={48} aria-hidden="true" className="sc-page__empty-icon" />
          <h2 className="sc-page__empty-title">Nenhum resultado encontrado</h2>
          <p className="sc-page__empty-desc">Tente ajustar os filtros ou limpar a busca.</p>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="sc-page__pagination">
          <button
            type="button"
            className="sc-page__page-btn"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Pagina anterior"
          >
            Anterior
          </button>
          <span className="sc-page__page-info">
            Pagina {page} de {totalPages} ({total} total)
          </span>
          <button
            type="button"
            className="sc-page__page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            aria-label="Proxima pagina"
          >
            Proxima
          </button>
        </div>
      )}

      {/* Create Modal */}
      <QuotationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Detail Modal */}
      <QuotationDetailModal
        isOpen={!!quotationToView}
        quotationId={quotationToView}
        onClose={() => setQuotationToView(null)}
        onUpdate={handleDetailUpdate}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!quotationToDelete}
        title="Excluir cotacao"
        message={`Tem certeza que deseja excluir a cotacao ${quotationToDelete?.sequentialNumber ?? ''}? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setQuotationToDelete(null)}
      />
    </main>
  );
}

export default QuotationsPage;
