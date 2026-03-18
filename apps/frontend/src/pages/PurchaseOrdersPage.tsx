import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Zap,
  Trash2,
  Eye,
} from 'lucide-react';
import { usePurchaseOrders, deletePO } from '@/hooks/usePurchaseOrders';
import ConfirmModal from '@/components/ui/ConfirmModal';
import PurchaseOrderModal from '@/components/purchase-orders/PurchaseOrderModal';
import PurchaseOrderDetailModal from '@/components/purchase-orders/PurchaseOrderDetailModal';
import type { PurchaseOrderListItem } from '@/types/purchase-order';
import { OC_STATUS_LABELS } from '@/types/purchase-order';
import './PurchaseOrdersPage.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useState(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  });
  return debounced;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CSS: Record<string, string> = {
  RASCUNHO: 'oc-status-badge oc-status-badge--rascunho',
  EMITIDA: 'oc-status-badge oc-status-badge--emitida',
  CONFIRMADA: 'oc-status-badge oc-status-badge--confirmada',
  EM_TRANSITO: 'oc-status-badge oc-status-badge--em-transito',
  ENTREGUE: 'oc-status-badge oc-status-badge--entregue',
  CANCELADA: 'oc-status-badge oc-status-badge--cancelada',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={STATUS_CSS[status] ?? 'oc-status-badge'}>
      {OC_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <tbody aria-busy="true" aria-label="Carregando pedidos de compra">
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="po-table__skeleton-row">
          <td>
            <div className="skeleton-line skeleton-line--title" />
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
            <div className="skeleton-line skeleton-line--short" />
          </td>
          <td />
        </tr>
      ))}
    </tbody>
  );
}

// ─── Mobile Card ─────────────────────────────────────────────────────────────

function PurchaseOrderCard({
  po,
  onView,
  onDelete,
}: {
  po: PurchaseOrderListItem;
  onView: (po: PurchaseOrderListItem) => void;
  onDelete: (po: PurchaseOrderListItem) => void;
}) {
  return (
    <article className="po-card">
      <div className="po-card__header">
        <div className="po-card__number-group">
          <span className="po-card__number">{po.sequentialNumber}</span>
          {po.isEmergency && (
            <span className="po-badge po-badge--emergency">
              <Zap size={10} aria-hidden="true" />
              Emergencial
            </span>
          )}
        </div>
        <StatusBadge status={po.status} />
      </div>
      <p className="po-card__supplier">{po.supplier.name}</p>
      <div className="po-card__meta">
        <span>{po._count.items} item(s)</span>
        {po.expectedDeliveryDate && (
          <span className={po.isOverdue ? 'po-card__date--overdue' : ''}>
            {po.isOverdue && <AlertTriangle size={12} aria-hidden="true" />}
            Previsao: {formatDate(po.expectedDeliveryDate)}
            {po.isOverdue && ' (Atrasado)'}
          </span>
        )}
      </div>
      <div className="po-card__actions">
        <button
          type="button"
          className="po-card__action-btn"
          onClick={() => onView(po)}
          aria-label={`Ver pedido ${po.sequentialNumber}`}
        >
          <Eye size={16} aria-hidden="true" />
          Ver detalhe
        </button>
        {po.status === 'RASCUNHO' && (
          <button
            type="button"
            className="po-card__action-btn po-card__action-btn--danger"
            onClick={() => onDelete(po)}
            aria-label={`Excluir pedido ${po.sequentialNumber}`}
          >
            <Trash2 size={16} aria-hidden="true" />
            Excluir
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PurchaseOrdersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrderListItem | null>(null);
  const [isDeletingPo, setIsDeletingPo] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchInput, 400);

  const LIMIT = 20;

  const { purchaseOrders, total, totalPages, isLoading, error, refetch } = usePurchaseOrders({
    page: currentPage,
    limit: LIMIT,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    overdue: overdueOnly || undefined,
  });

  const hasFilters = !!(debouncedSearch || statusFilter || overdueOnly);

  function showToast(msg: string) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    showToast('Pedido emergencial criado com sucesso');
    void refetch();
  }, [refetch]);

  const handleDetailUpdate = useCallback(() => {
    void refetch();
  }, [refetch]);

  async function handleDeleteConfirm() {
    if (!poToDelete) return;
    setIsDeletingPo(true);
    try {
      await deletePO(poToDelete.id);
      setPoToDelete(null);
      showToast('Pedido excluido com sucesso');
      void refetch();
    } catch {
      showToast('Nao foi possivel excluir o pedido. Tente novamente.');
    } finally {
      setIsDeletingPo(false);
    }
  }

  function clearFilters() {
    setSearchInput('');
    setStatusFilter('');
    setOverdueOnly(false);
    setCurrentPage(1);
  }

  return (
    <main className="po-page">
      {/* Breadcrumb */}
      <nav className="po-page__breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>Compras</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Pedidos de Compra</span>
      </nav>

      {/* Success toast */}
      {successMessage && (
        <div className="po-page__success" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          {successMessage}
        </div>
      )}

      {/* Header */}
      <header className="po-page__header">
        <div>
          <h1 className="po-page__title">Pedidos de Compra</h1>
          <p className="po-page__subtitle">Emita e acompanhe pedidos de compra aos fornecedores</p>
        </div>
        <div className="po-page__header-actions">
          <button
            type="button"
            className="po-page__new-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Pedido Emergencial
          </button>
          <Link to="/quotations" className="po-page__link-btn">
            Ver Cotacoes
          </Link>
        </div>
      </header>

      {/* Filter bar */}
      <div className="po-page__filters">
        <div className="po-page__search-wrapper">
          <Search size={16} aria-hidden="true" className="po-page__search-icon" />
          <label htmlFor="po-search" className="sr-only">
            Buscar por numero ou fornecedor
          </label>
          <input
            id="po-search"
            type="search"
            className="po-page__search"
            placeholder="Buscar por numero ou fornecedor..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="po-page__filter-group">
          <label htmlFor="filter-status" className="sr-only">
            Status
          </label>
          <select
            id="filter-status"
            className="po-page__filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Todos os status</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="EMITIDA">Emitida</option>
            <option value="CONFIRMADA">Confirmada</option>
            <option value="EM_TRANSITO">Em Transito</option>
            <option value="ENTREGUE">Entregue</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>

        <label className="po-page__overdue-toggle">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => {
              setOverdueOnly(e.target.checked);
              setCurrentPage(1);
            }}
          />
          Apenas atrasados
        </label>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="po-page__chips" role="group" aria-label="Filtros ativos">
          {debouncedSearch && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setSearchInput('')}
              aria-label={`Remover filtro de busca: ${debouncedSearch}`}
            >
              Busca: {debouncedSearch}
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {statusFilter && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setStatusFilter('')}
              aria-label={`Remover filtro de status: ${OC_STATUS_LABELS[statusFilter]}`}
            >
              Status: {OC_STATUS_LABELS[statusFilter]}
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {overdueOnly && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setOverdueOnly(false)}
              aria-label="Remover filtro de atrasados"
            >
              Apenas atrasados
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="po-page__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Summary count */}
      {!isLoading && !error && (
        <p className="po-page__count">
          {total} pedido{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </p>
      )}

      {/* Desktop table */}
      <div className="po-page__table-wrapper">
        <table className="po-table">
          <caption className="sr-only">Lista de pedidos de compra</caption>
          <thead>
            <tr>
              <th scope="col">Numero</th>
              <th scope="col">Fornecedor</th>
              <th scope="col">Itens</th>
              <th scope="col">Status</th>
              <th scope="col">Emissao</th>
              <th scope="col">Previsao Entrega</th>
              <th scope="col">
                <span className="sr-only">Acoes</span>
              </th>
            </tr>
          </thead>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            <tbody>
              {purchaseOrders.map((po) => (
                <tr
                  key={po.id}
                  className="po-table__row"
                  onClick={() => setSelectedPoId(po.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div className="po-table__number-cell">
                      <span className="po-table__number">{po.sequentialNumber}</span>
                      {po.isEmergency && (
                        <span className="po-badge po-badge--emergency">
                          <Zap size={10} aria-hidden="true" />
                          Emergencial
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="po-table__supplier">{po.supplier.name}</span>
                  </td>
                  <td>
                    <span className="po-table__count">{po._count.items}</span>
                  </td>
                  <td>
                    <StatusBadge status={po.status} />
                  </td>
                  <td>
                    <span className="po-table__date">{formatDate(po.issuedAt)}</span>
                  </td>
                  <td>
                    {po.isOverdue ? (
                      <span className="po-table__date po-table__date--overdue">
                        <AlertTriangle size={14} aria-hidden="true" />
                        {formatDate(po.expectedDeliveryDate)}
                        <span className="po-table__overdue-label">Atrasado</span>
                      </span>
                    ) : (
                      <span className="po-table__date">{formatDate(po.expectedDeliveryDate)}</span>
                    )}
                  </td>
                  <td className="po-table__actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="po-table__icon-btn"
                      aria-label={`Ver detalhe ${po.sequentialNumber}`}
                      onClick={() => setSelectedPoId(po.id)}
                    >
                      <Eye size={20} aria-hidden="true" />
                    </button>
                    {po.status === 'RASCUNHO' && (
                      <button
                        type="button"
                        className="po-table__icon-btn po-table__icon-btn--danger"
                        aria-label={`Excluir ${po.sequentialNumber}`}
                        onClick={() => setPoToDelete(po)}
                      >
                        <Trash2 size={20} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* Mobile cards */}
      {!isLoading && purchaseOrders.length > 0 && (
        <div className="po-page__cards" aria-label="Lista de pedidos de compra">
          {purchaseOrders.map((po) => (
            <PurchaseOrderCard
              key={po.id}
              po={po}
              onView={(p) => setSelectedPoId(p.id)}
              onDelete={(p) => setPoToDelete(p)}
            />
          ))}
        </div>
      )}

      {/* Empty states */}
      {!isLoading && !error && purchaseOrders.length === 0 && !hasFilters && (
        <div className="po-page__empty">
          <ClipboardList size={64} aria-hidden="true" className="po-page__empty-icon" />
          <h2 className="po-page__empty-title">Nenhum pedido de compra</h2>
          <p className="po-page__empty-desc">
            Os pedidos de compra sao criados a partir de cotacoes aprovadas ou diretamente em modo
            emergencial.
          </p>
          <button
            type="button"
            className="po-page__new-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Criar pedido emergencial
          </button>
        </div>
      )}

      {!isLoading && !error && purchaseOrders.length === 0 && hasFilters && (
        <div className="po-page__empty">
          <Search size={64} aria-hidden="true" className="po-page__empty-icon" />
          <h2 className="po-page__empty-title">Nenhum pedido encontrado</h2>
          <p className="po-page__empty-desc">
            Nenhum pedido corresponde aos filtros aplicados. Tente ajustar a busca ou limpar os
            filtros.
          </p>
          <button type="button" className="po-page__clear-btn" onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="po-page__pagination">
          <button
            type="button"
            className="po-page__page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            aria-label="Pagina anterior"
          >
            Anterior
          </button>
          <span className="po-page__page-info">
            Pagina {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="po-page__page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            aria-label="Proxima pagina"
          >
            Proxima
          </button>
        </div>
      )}

      {/* Emergency PO Create Modal */}
      <PurchaseOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Detail Modal */}
      <PurchaseOrderDetailModal
        isOpen={!!selectedPoId}
        purchaseOrderId={selectedPoId}
        onClose={() => setSelectedPoId(null)}
        onUpdate={handleDetailUpdate}
      />

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!poToDelete}
        title="Excluir pedido de compra?"
        message={`Tem certeza que deseja excluir o pedido ${poToDelete?.sequentialNumber ?? ''}? Esta acao nao pode ser desfeita.`}
        confirmLabel="Excluir pedido"
        variant="danger"
        isLoading={isDeletingPo}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setPoToDelete(null)}
      />
    </main>
  );
}

export default PurchaseOrdersPage;
