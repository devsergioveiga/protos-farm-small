import { useState, useCallback, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Undo2,
  Search,
  AlertCircle,
  CheckCircle2,
  Plus,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';

const GoodsReturnModal = lazy(() => import('@/components/goods-returns/GoodsReturnModal'));
import {
  useGoodsReturns,
  useGoodsReturn,
  transitionGoodsReturn,
  GR_RETURN_STATUS_LABELS,
  GR_RETURN_STATUS_COLORS,
  GR_RETURN_REASON_LABELS,
  GR_RETURN_ACTION_LABELS,
} from '@/hooks/useGoodsReturns';
import type { GoodsReturnListItem, GoodsReturnStatus } from '@/hooks/useGoodsReturns';
import './DevolucoesPage.css';

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

function ReturnStatusBadge({ status, statusLabel }: { status: string; statusLabel: string }) {
  const colorClass = GR_RETURN_STATUS_COLORS[status as GoodsReturnStatus] ?? 'badge--neutral';
  return <span className={`devolucoes-badge ${colorClass}`}>{statusLabel}</span>;
}

// ─── Skeleton ─────────────────────────────────────────────────────

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <tbody aria-busy="true" aria-label="Carregando...">
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="devolucoes-table__skeleton-row">
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

// ─── Inline Detail ────────────────────────────────────────────────

function InlineDetail({ id, onTransition }: { id: string; onTransition: () => void }) {
  const { goodsReturn, isLoading, error } = useGoodsReturn(id);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const handleTransition = useCallback(
    async (newStatus: string) => {
      setTransitioning(true);
      setTransitionError(null);
      try {
        await transitionGoodsReturn(id, { status: newStatus });
        onTransition();
      } catch (err) {
        setTransitionError(err instanceof Error ? err.message : 'Erro ao atualizar status');
      } finally {
        setTransitioning(false);
      }
    },
    [id, onTransition],
  );

  if (isLoading) {
    return (
      <div className="devolucoes-detail__loading" aria-live="polite">
        Carregando detalhes...
      </div>
    );
  }

  if (error || !goodsReturn) {
    return (
      <div className="devolucoes-detail__error" role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        {error ?? 'Devolução não encontrada.'}
      </div>
    );
  }

  const canAnalisar = goodsReturn.status === 'PENDENTE';
  const canAprovar = goodsReturn.status === 'EM_ANALISE';
  const canConcluir = goodsReturn.status === 'APROVADA';
  const canCancelar = ['PENDENTE', 'EM_ANALISE'].includes(goodsReturn.status);

  return (
    <div className="devolucoes-detail">
      {transitionError && (
        <div className="devolucoes-detail__transition-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {transitionError}
        </div>
      )}

      <div className="devolucoes-detail__meta">
        <div className="devolucoes-detail__meta-item">
          <span className="devolucoes-detail__meta-label">Recebimento vinculado</span>
          <span className="devolucoes-detail__meta-value">
            {goodsReturn.goodsReceipt.sequentialNumber}
          </span>
        </div>
        {goodsReturn.resolutionDeadline && (
          <div className="devolucoes-detail__meta-item">
            <span className="devolucoes-detail__meta-label">Prazo de resolução</span>
            <span className="devolucoes-detail__meta-value">
              {formatDate(goodsReturn.resolutionDeadline)}
            </span>
          </div>
        )}
        {goodsReturn.resolutionStatus && (
          <div className="devolucoes-detail__meta-item">
            <span className="devolucoes-detail__meta-label">Status resolução</span>
            <span className="devolucoes-detail__meta-value">{goodsReturn.resolutionStatus}</span>
          </div>
        )}
        {goodsReturn.returnInvoiceNumber && (
          <div className="devolucoes-detail__meta-item">
            <span className="devolucoes-detail__meta-label">NF devolução</span>
            <span className="devolucoes-detail__meta-value">
              {goodsReturn.returnInvoiceNumber}
              {goodsReturn.returnInvoiceDate
                ? ` — ${formatDate(goodsReturn.returnInvoiceDate)}`
                : ''}
            </span>
          </div>
        )}
        {goodsReturn.notes && (
          <div className="devolucoes-detail__meta-item">
            <span className="devolucoes-detail__meta-label">Observações</span>
            <span className="devolucoes-detail__meta-value">{goodsReturn.notes}</span>
          </div>
        )}
      </div>

      <h3 className="devolucoes-detail__items-title">Itens devolvidos</h3>
      <div className="devolucoes-detail__table-wrapper">
        <table className="devolucoes-detail__table">
          <caption className="sr-only">Itens da devolução</caption>
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Unidade</th>
              <th scope="col">Qtd devolvida</th>
              <th scope="col">Preço unitário</th>
              <th scope="col">Total</th>
              <th scope="col">Lote</th>
              <th scope="col">Foto</th>
            </tr>
          </thead>
          <tbody>
            {goodsReturn.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productName}</td>
                <td>{item.unitName}</td>
                <td>{item.returnQty}</td>
                <td>{formatCurrency(item.unitPrice)}</td>
                <td>{formatCurrency(item.totalPrice)}</td>
                <td>{item.batchNumber ?? '—'}</td>
                <td>
                  {item.photoUrl ? (
                    <a
                      href={item.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="devolucoes-detail__photo-link"
                    >
                      <img
                        src={item.photoUrl}
                        alt={`Foto do item ${item.productName}`}
                        className="devolucoes-detail__photo-thumb"
                      />
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="devolucoes-detail__actions">
        {canAnalisar && (
          <button
            type="button"
            className="devolucoes-detail__action-btn devolucoes-detail__action-btn--info"
            onClick={() => void handleTransition('EM_ANALISE')}
            disabled={transitioning}
          >
            Analisar
          </button>
        )}
        {canAprovar && (
          <button
            type="button"
            className="devolucoes-detail__action-btn devolucoes-detail__action-btn--success"
            onClick={() => void handleTransition('APROVADA')}
            disabled={transitioning}
          >
            Aprovar
          </button>
        )}
        {canConcluir && (
          <button
            type="button"
            className="devolucoes-detail__action-btn devolucoes-detail__action-btn--primary"
            onClick={() => void handleTransition('CONCLUIDA')}
            disabled={transitioning}
          >
            Concluir
          </button>
        )}
        {canCancelar && (
          <button
            type="button"
            className="devolucoes-detail__action-btn devolucoes-detail__action-btn--danger"
            onClick={() => void handleTransition('CANCELADA')}
            disabled={transitioning}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────

function DevolucoesRow({
  item,
  isExpanded,
  onToggle,
  onTransition,
}: {
  item: GoodsReturnListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onTransition: () => void;
}) {
  const reasonLabel = GR_RETURN_REASON_LABELS[item.reason] ?? item.reason;
  const actionLabel = GR_RETURN_ACTION_LABELS[item.expectedAction] ?? item.expectedAction;

  return (
    <>
      <tr
        className={`devolucoes-table__row ${isExpanded ? 'devolucoes-table__row--expanded' : ''}`}
      >
        <td>
          <span className="devolucoes-table__number">{item.sequentialNumber}</span>
        </td>
        <td>
          <span className="devolucoes-table__supplier">{item.supplierName}</span>
        </td>
        <td>
          <ReturnStatusBadge status={item.status} statusLabel={item.statusLabel} />
        </td>
        <td>
          <span className="devolucoes-table__reason">{reasonLabel}</span>
        </td>
        <td>
          <span className="devolucoes-table__action">{actionLabel}</span>
        </td>
        <td>
          <span className="devolucoes-table__value">{formatCurrency(item.totalValue)}</span>
        </td>
        <td>
          <span className="devolucoes-table__count">{item.itemCount}</span>
        </td>
        <td>
          <span className="devolucoes-table__date">{formatDate(item.createdAt)}</span>
        </td>
        <td className="devolucoes-table__actions">
          <button
            type="button"
            className="devolucoes-table__expand-btn"
            aria-label={
              isExpanded
                ? `Fechar detalhe ${item.sequentialNumber}`
                : `Ver detalhe ${item.sequentialNumber}`
            }
            aria-expanded={isExpanded}
            onClick={onToggle}
          >
            {isExpanded ? (
              <ChevronUp size={20} aria-hidden="true" />
            ) : (
              <ChevronDown size={20} aria-hidden="true" />
            )}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="devolucoes-table__detail-row">
          <td colSpan={9}>
            <InlineDetail id={item.id} onTransition={onTransition} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Mobile Card ─────────────────────────────────────────────────

function DevolucoesCard({
  item,
  isExpanded,
  onToggle,
  onTransition,
}: {
  item: GoodsReturnListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onTransition: () => void;
}) {
  const reasonLabel = GR_RETURN_REASON_LABELS[item.reason] ?? item.reason;
  const actionLabel = GR_RETURN_ACTION_LABELS[item.expectedAction] ?? item.expectedAction;

  return (
    <article className="devolucoes-card">
      <div className="devolucoes-card__header">
        <span className="devolucoes-card__number">{item.sequentialNumber}</span>
        <ReturnStatusBadge status={item.status} statusLabel={item.statusLabel} />
      </div>
      <p className="devolucoes-card__supplier">{item.supplierName}</p>
      <div className="devolucoes-card__meta">
        <span>Motivo: {reasonLabel}</span>
        <span>Ação: {actionLabel}</span>
        {item.totalValue !== null && <span>Valor: {formatCurrency(item.totalValue)}</span>}
        <span>{item.itemCount} item(s)</span>
        <span>Data: {formatDate(item.createdAt)}</span>
      </div>
      <div className="devolucoes-card__actions">
        <button
          type="button"
          className="devolucoes-card__expand-btn"
          aria-expanded={isExpanded}
          onClick={onToggle}
        >
          {isExpanded ? (
            <>
              <ChevronUp size={16} aria-hidden="true" />
              Fechar detalhe
            </>
          ) : (
            <>
              <ChevronDown size={16} aria-hidden="true" />
              Ver detalhe
            </>
          )}
        </button>
      </div>
      {isExpanded && (
        <div className="devolucoes-card__detail">
          <InlineDetail id={item.id} onTransition={onTransition} />
        </div>
      )}
    </article>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

function DevolucoesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const LIMIT = 20;

  const { goodsReturns, total, totalPages, isLoading, error, refetch } = useGoodsReturns({
    page: currentPage,
    limit: LIMIT,
    search: searchInput || undefined,
    status: statusFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const showToast = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleTransition = useCallback(() => {
    refetch();
    setExpandedId(null);
  }, [refetch]);

  const handleOpenModal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleSuccess = useCallback(() => {
    setShowCreateModal(false);
    refetch();
    showToast('Devolução registrada com sucesso');
  }, [refetch, showToast]);

  return (
    <main className="devolucoes-page">
      {/* Breadcrumb */}
      <nav className="devolucoes-page__breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>Compras</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Devoluções</span>
      </nav>

      {/* Header */}
      <header className="devolucoes-page__header">
        <div>
          <h1 className="devolucoes-page__title">Devoluções</h1>
          <p className="devolucoes-page__subtitle">
            Registre e acompanhe devoluções de mercadorias aos fornecedores
          </p>
        </div>
        <button type="button" className="devolucoes-page__new-btn" onClick={handleOpenModal}>
          <Plus size={20} aria-hidden="true" />
          Nova Devolução
        </button>
      </header>

      {/* Success toast */}
      {successMessage && (
        <div className="devolucoes-page__success" role="status">
          <CheckCircle2 size={20} aria-hidden="true" />
          {successMessage}
        </div>
      )}

      {/* Filter bar */}
      <div className="devolucoes-page__filters">
        <div className="devolucoes-page__search-wrapper">
          <Search size={16} aria-hidden="true" className="devolucoes-page__search-icon" />
          <label htmlFor="dev-search" className="sr-only">
            Buscar por numero ou fornecedor
          </label>
          <input
            id="dev-search"
            type="search"
            className="devolucoes-page__search"
            placeholder="Buscar por numero ou fornecedor..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="devolucoes-page__filter-group">
          <label htmlFor="filter-dev-status" className="sr-only">
            Status
          </label>
          <select
            id="filter-dev-status"
            className="devolucoes-page__filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Todos os status</option>
            {Object.entries(GR_RETURN_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="devolucoes-page__filter-group">
          <label htmlFor="filter-dev-start" className="sr-only">
            Data inicial
          </label>
          <input
            id="filter-dev-start"
            type="date"
            className="devolucoes-page__filter-date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="devolucoes-page__filter-group">
          <label htmlFor="filter-dev-end" className="sr-only">
            Data final
          </label>
          <input
            id="filter-dev-end"
            type="date"
            className="devolucoes-page__filter-date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="devolucoes-page__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Count */}
      {!isLoading && !error && (
        <p className="devolucoes-page__count">
          {total} devolução{total !== 1 ? 'ões' : ''} encontrada{total !== 1 ? 's' : ''}
        </p>
      )}

      {/* Desktop table */}
      <div className="devolucoes-page__table-wrapper">
        <table className="devolucoes-table">
          <caption className="sr-only">Lista de devoluções de mercadorias</caption>
          <thead>
            <tr>
              <th scope="col">Numero</th>
              <th scope="col">Fornecedor</th>
              <th scope="col">Status</th>
              <th scope="col">Motivo</th>
              <th scope="col">Ação Esperada</th>
              <th scope="col">Valor Total</th>
              <th scope="col">Itens</th>
              <th scope="col">Data</th>
              <th scope="col">
                <span className="sr-only">Detalhe</span>
              </th>
            </tr>
          </thead>
          {isLoading ? (
            <SkeletonRows cols={9} />
          ) : (
            <tbody>
              {goodsReturns.map((item) => (
                <DevolucoesRow
                  key={item.id}
                  item={item}
                  isExpanded={expandedId === item.id}
                  onToggle={() => handleToggleExpand(item.id)}
                  onTransition={handleTransition}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* Mobile cards */}
      {!isLoading && goodsReturns.length > 0 && (
        <div className="devolucoes-page__cards" aria-label="Lista de devoluções">
          {goodsReturns.map((item) => (
            <DevolucoesCard
              key={item.id}
              item={item}
              isExpanded={expandedId === item.id}
              onToggle={() => handleToggleExpand(item.id)}
              onTransition={handleTransition}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && goodsReturns.length === 0 && (
        <div className="devolucoes-page__empty">
          <Undo2 size={64} aria-hidden="true" className="devolucoes-page__empty-icon" />
          <h2 className="devolucoes-page__empty-title">Nenhuma devolução registrada.</h2>
          <p className="devolucoes-page__empty-desc">
            Registre a primeira devolução vinculando a um recebimento confirmado.
          </p>
          <button type="button" className="devolucoes-page__new-btn" onClick={handleOpenModal}>
            <Plus size={20} aria-hidden="true" />
            Nova Devolução
          </button>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="devolucoes-page__pagination">
          <button
            type="button"
            className="devolucoes-page__page-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            aria-label="Pagina anterior"
          >
            Anterior
          </button>
          <span className="devolucoes-page__page-info">
            Pagina {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="devolucoes-page__page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            aria-label="Proxima pagina"
          >
            Proxima
          </button>
        </div>
      )}

      {/* Package icon for empty state fallback */}
      <span style={{ display: 'none' }}>
        <Package aria-hidden="true" />
      </span>

      {/* Create modal */}
      {showCreateModal && (
        <Suspense fallback={null}>
          <GoodsReturnModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleSuccess}
          />
        </Suspense>
      )}
    </main>
  );
}

export default DevolucoesPage;
