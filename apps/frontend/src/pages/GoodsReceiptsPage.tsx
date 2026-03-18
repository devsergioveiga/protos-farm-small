import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Plus,
  Eye,
  Clock,
} from 'lucide-react';
import { useGoodsReceipts, usePendingDeliveries } from '@/hooks/useGoodsReceipts';
import type { GoodsReceiptListItem } from '@/types/goods-receipt';
import { GR_STATUS_COLORS, RECEIVING_TYPE_LABELS } from '@/types/goods-receipt';
import GoodsReceiptModal from '@/components/goods-receipts/GoodsReceiptModal';
import './GoodsReceiptsPage.css';

// ─── Helpers ─────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Status Badge ─────────────────────────────────────────────────

function GrStatusBadge({ status, statusLabel }: { status: string; statusLabel: string }) {
  const colorClass = GR_STATUS_COLORS[status as keyof typeof GR_STATUS_COLORS] ?? 'badge--neutral';
  return <span className={`gr-badge ${colorClass}`}>{statusLabel}</span>;
}

// ─── Skeleton ─────────────────────────────────────────────────────

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <tbody aria-busy="true" aria-label="Carregando...">
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="gr-table__skeleton-row">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j}>
              <div className="skeleton-line skeleton-line--text" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ─── Tab: Recebimentos ────────────────────────────────────────────

function RecebimentosTab({
  onOpenModal,
  onViewDetail,
}: {
  onOpenModal: (purchaseOrderId?: string) => void;
  onViewDetail: (id: string) => void;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [receivingTypeFilter, setReceivingTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const LIMIT = 20;

  const { goodsReceipts, total, totalPages, isLoading, error } = useGoodsReceipts({
    page: currentPage,
    limit: LIMIT,
    search: searchInput || undefined,
    status: statusFilter || undefined,
    receivingType: receivingTypeFilter || undefined,
  });

  const showToast = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  }, []);

  void showToast;

  return (
    <section aria-label="Lista de recebimentos">
      {/* Success toast */}
      {successMessage && (
        <div className="gr-page__success" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          {successMessage}
        </div>
      )}

      {/* Filter bar */}
      <div className="gr-page__filters">
        <div className="gr-page__search-wrapper">
          <Search size={16} aria-hidden="true" className="gr-page__search-icon" />
          <label htmlFor="gr-search" className="sr-only">
            Buscar por numero, NF ou fornecedor
          </label>
          <input
            id="gr-search"
            type="search"
            className="gr-page__search"
            placeholder="Buscar por numero, NF ou fornecedor..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="gr-page__filter-group">
          <label htmlFor="filter-gr-status" className="sr-only">
            Status
          </label>
          <select
            id="filter-gr-status"
            className="gr-page__filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Todos os status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="EM_CONFERENCIA">Em Conferencia</option>
            <option value="CONFERIDO">Conferido</option>
            <option value="CONFIRMADO">Confirmado</option>
            <option value="REJEITADO">Rejeitado</option>
          </select>
        </div>

        <div className="gr-page__filter-group">
          <label htmlFor="filter-gr-type" className="sr-only">
            Tipo de recebimento
          </label>
          <select
            id="filter-gr-type"
            className="gr-page__filter-select"
            value={receivingTypeFilter}
            onChange={(e) => {
              setReceivingTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Todos os tipos</option>
            <option value="STANDARD">NF + Mercadoria</option>
            <option value="NF_ANTECIPADA">NF Antecipada</option>
            <option value="MERCADORIA_ANTECIPADA">Mercadoria Antecipada</option>
            <option value="PARCIAL">Recebimento Parcial</option>
            <option value="NF_FRACIONADA">NF Fracionada</option>
            <option value="EMERGENCIAL">Emergencial</option>
          </select>
        </div>

        <button type="button" className="gr-page__new-btn" onClick={() => onOpenModal()}>
          <Plus size={20} aria-hidden="true" />
          Novo Recebimento
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="gr-page__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Count */}
      {!isLoading && !error && (
        <p className="gr-page__count">
          {total} recebimento{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </p>
      )}

      {/* Desktop table */}
      <div className="gr-page__table-wrapper">
        <table className="gr-table">
          <caption className="sr-only">Lista de recebimentos de mercadorias</caption>
          <thead>
            <tr>
              <th scope="col">Numero</th>
              <th scope="col">Fornecedor</th>
              <th scope="col">OC</th>
              <th scope="col">Tipo</th>
              <th scope="col">NF</th>
              <th scope="col">Valor NF</th>
              <th scope="col">Status</th>
              <th scope="col">Itens</th>
              <th scope="col">Data</th>
              <th scope="col">
                <span className="sr-only">Acoes</span>
              </th>
            </tr>
          </thead>
          {isLoading ? (
            <SkeletonRows cols={10} />
          ) : (
            <tbody>
              {goodsReceipts.map((item) => (
                <GoodsReceiptRow key={item.id} item={item} onViewDetail={onViewDetail} />
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* Mobile cards */}
      {!isLoading && goodsReceipts.length > 0 && (
        <div className="gr-page__cards" aria-label="Lista de recebimentos">
          {goodsReceipts.map((item) => (
            <GoodsReceiptCard key={item.id} item={item} onViewDetail={onViewDetail} />
          ))}
        </div>
      )}

      {/* Empty state — no data */}
      {!isLoading && !error && goodsReceipts.length === 0 && (
        <div className="gr-page__empty">
          <Package size={64} aria-hidden="true" className="gr-page__empty-icon" />
          <h2 className="gr-page__empty-title">Nenhum recebimento registrado.</h2>
          <p className="gr-page__empty-desc">
            Registre o primeiro recebimento para acompanhar suas entregas.
          </p>
          <button type="button" className="gr-page__new-btn" onClick={() => onOpenModal()}>
            <Plus size={20} aria-hidden="true" />
            Novo Recebimento
          </button>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="gr-page__pagination">
          <button
            type="button"
            className="gr-page__page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            aria-label="Pagina anterior"
          >
            Anterior
          </button>
          <span className="gr-page__page-info">
            Pagina {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="gr-page__page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            aria-label="Proxima pagina"
          >
            Proxima
          </button>
        </div>
      )}
    </section>
  );
}

function GoodsReceiptRow({
  item,
  onViewDetail,
}: {
  item: GoodsReceiptListItem;
  onViewDetail: (id: string) => void;
}) {
  return (
    <tr className="gr-table__row">
      <td>
        <span className="gr-table__number">{item.sequentialNumber}</span>
      </td>
      <td>
        <span className="gr-table__supplier">{item.supplier.name}</span>
      </td>
      <td>
        <span className="gr-table__oc">
          {item.purchaseOrder ? item.purchaseOrder.sequentialNumber : '—'}
        </span>
      </td>
      <td>
        <span className="gr-table__type">
          {RECEIVING_TYPE_LABELS[item.receivingType] ?? item.receivingType}
        </span>
      </td>
      <td>
        <span className="gr-table__nf">{item.invoiceNumber ?? '—'}</span>
      </td>
      <td>
        <span className="gr-table__value">{formatCurrency(item.invoiceTotal)}</span>
      </td>
      <td>
        <div className="gr-table__status-cell">
          <GrStatusBadge status={item.status} statusLabel={item.statusLabel} />
          {item.isProvisional && <span className="gr-table__provisional">(provisorio)</span>}
        </div>
      </td>
      <td>
        <span className="gr-table__count">{item._count.items}</span>
      </td>
      <td>
        <span className="gr-table__date">{formatDate(item.createdAt)}</span>
      </td>
      <td className="gr-table__actions">
        <button
          type="button"
          className="gr-table__icon-btn"
          aria-label={`Ver detalhe ${item.sequentialNumber}`}
          onClick={() => onViewDetail(item.id)}
        >
          <Eye size={20} aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

function GoodsReceiptCard({
  item,
  onViewDetail,
}: {
  item: GoodsReceiptListItem;
  onViewDetail: (id: string) => void;
}) {
  return (
    <article className="gr-card">
      <div className="gr-card__header">
        <span className="gr-card__number">{item.sequentialNumber}</span>
        <GrStatusBadge status={item.status} statusLabel={item.statusLabel} />
      </div>
      <p className="gr-card__supplier">{item.supplier.name}</p>
      <div className="gr-card__meta">
        <span>Tipo: {RECEIVING_TYPE_LABELS[item.receivingType] ?? item.receivingType}</span>
        {item.invoiceNumber && <span>NF: {item.invoiceNumber}</span>}
        {item.invoiceTotal !== null && <span>Valor: {formatCurrency(item.invoiceTotal)}</span>}
        <span>{item._count.items} item(s)</span>
        <span>Data: {formatDate(item.createdAt)}</span>
      </div>
      <div className="gr-card__actions">
        <button
          type="button"
          className="gr-card__action-btn"
          aria-label={`Ver recebimento ${item.sequentialNumber}`}
          onClick={() => onViewDetail(item.id)}
        >
          <Eye size={16} aria-hidden="true" />
          Ver detalhe
        </button>
      </div>
    </article>
  );
}

// ─── Tab: Pendencias ──────────────────────────────────────────────

function PendenciasTab({ onOpenModal }: { onOpenModal: (purchaseOrderId?: string) => void }) {
  const { deliveries, isLoading, error } = usePendingDeliveries();

  return (
    <section aria-label="Entregas pendentes">
      {/* Error */}
      {error && (
        <div className="gr-page__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="gr-page__table-wrapper">
        <table className="gr-table">
          <caption className="sr-only">Pedidos de compra aguardando entrega</caption>
          <thead>
            <tr>
              <th scope="col">OC</th>
              <th scope="col">Fornecedor</th>
              <th scope="col">Entrega prevista</th>
              <th scope="col">Status</th>
              <th scope="col">Itens pendentes</th>
              <th scope="col">
                <span className="sr-only">Acoes</span>
              </th>
            </tr>
          </thead>
          {isLoading ? (
            <SkeletonRows cols={6} />
          ) : (
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.purchaseOrderId} className="gr-table__row">
                  <td>
                    <span className="gr-table__number">{delivery.sequentialNumber}</span>
                  </td>
                  <td>
                    <span className="gr-table__supplier">{delivery.supplier.name}</span>
                  </td>
                  <td>
                    {delivery.isOverdue ? (
                      <span className="gr-table__date gr-table__date--overdue">
                        <AlertTriangle size={14} aria-hidden="true" />
                        {formatDate(delivery.expectedDeliveryDate)}
                      </span>
                    ) : (
                      <span className="gr-table__date">
                        {formatDate(delivery.expectedDeliveryDate)}
                      </span>
                    )}
                  </td>
                  <td>
                    {delivery.isOverdue ? (
                      <span className="gr-badge gr-badge--overdue">
                        <AlertTriangle size={12} aria-hidden="true" />
                        Atrasada
                      </span>
                    ) : (
                      <span className="gr-badge gr-badge--waiting">
                        <Clock size={12} aria-hidden="true" />
                        Aguardando
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="gr-table__count">
                      {delivery.totalPendingItems} / {delivery.itemCount}
                    </span>
                  </td>
                  <td className="gr-table__actions">
                    <button
                      type="button"
                      className="gr-table__action-btn"
                      onClick={() => onOpenModal(delivery.purchaseOrderId)}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Registrar Recebimento
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* Empty state */}
      {!isLoading && !error && deliveries.length === 0 && (
        <div className="gr-page__empty">
          <CheckCircle2 size={64} aria-hidden="true" className="gr-page__empty-icon" />
          <h2 className="gr-page__empty-title">Nenhuma entrega pendente.</h2>
          <p className="gr-page__empty-desc">Todos os pedidos foram recebidos.</p>
        </div>
      )}
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

type ActiveTab = 'recebimentos' | 'pendencias';

function GoodsReceiptsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('recebimentos');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [preselectedPOId, setPreselectedPOId] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  const handleOpenModal = useCallback((purchaseOrderId?: string) => {
    setPreselectedPOId(purchaseOrderId ?? null);
    setShowCreateModal(true);
  }, []);

  const handleViewDetail = useCallback((id: string) => {
    setSelectedReceiptId(id);
  }, []);

  return (
    <main className="gr-page">
      {/* Breadcrumb */}
      <nav className="gr-page__breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>Compras</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Recebimentos</span>
      </nav>

      {/* Header */}
      <header className="gr-page__header">
        <div>
          <h1 className="gr-page__title">Recebimentos de Mercadorias</h1>
          <p className="gr-page__subtitle">
            Confira e registre o recebimento de mercadorias dos pedidos de compra
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="gr-page__tabs" role="tablist" aria-label="Secoes de recebimentos">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'recebimentos'}
          className={`gr-page__tab ${activeTab === 'recebimentos' ? 'gr-page__tab--active' : ''}`}
          onClick={() => setActiveTab('recebimentos')}
        >
          Recebimentos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pendencias'}
          className={`gr-page__tab ${activeTab === 'pendencias' ? 'gr-page__tab--active' : ''}`}
          onClick={() => setActiveTab('pendencias')}
        >
          Pendencias
        </button>
      </div>

      {/* Tab panels */}
      <div className="gr-page__tab-content">
        {activeTab === 'recebimentos' && (
          <RecebimentosTab
            key={refetchKey}
            onOpenModal={handleOpenModal}
            onViewDetail={handleViewDetail}
          />
        )}
        {activeTab === 'pendencias' && <PendenciasTab onOpenModal={handleOpenModal} />}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <GoodsReceiptModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setPreselectedPOId(null);
          }}
          onSuccess={() => {
            refetch();
            setShowCreateModal(false);
            setPreselectedPOId(null);
          }}
          preselectedPurchaseOrderId={preselectedPOId ?? undefined}
        />
      )}

      {/* Detail modal */}
      {selectedReceiptId && (
        <GoodsReceiptModal
          isOpen={!!selectedReceiptId}
          onClose={() => setSelectedReceiptId(null)}
          onSuccess={() => {
            refetch();
            setSelectedReceiptId(null);
          }}
          existingId={selectedReceiptId}
        />
      )}
    </main>
  );
}

export default GoodsReceiptsPage;
