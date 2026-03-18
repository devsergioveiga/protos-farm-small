import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import KanbanColumn from '@/components/purchase-kanban/KanbanColumn';
import KanbanCard from '@/components/purchase-kanban/KanbanCard';
import {
  usePurchaseKanban,
  KANBAN_COLUMNS_CONFIG,
  type KanbanCardData,
  type KanbanColumn as KanbanColumnType,
} from '@/hooks/usePurchaseKanban';
import './PurchaseKanbanPage.css';

// ─── Skeleton loading ─────────────────────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="kanban-board" aria-label="Carregando kanban" aria-busy="true">
      {KANBAN_COLUMNS_CONFIG.map((col) => (
        <div key={col.id} className="kanban-skeleton-column">
          <div className="kanban-skeleton-header" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="kanban-skeleton-card" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function KanbanEmptyState() {
  return (
    <div className="kanban-empty-state">
      <ShoppingCart size={64} className="kanban-empty-state__icon" aria-hidden="true" />
      <h2 className="kanban-empty-state__title">Nenhuma requisicao em andamento</h2>
      <p className="kanban-empty-state__desc">
        Crie uma requisicao de compra para iniciar o fluxo de compras
      </p>
      <Link to="/purchase-requests" className="kanban-empty-state__cta">
        <ShoppingCart size={20} aria-hidden="true" />
        Criar Requisicao
      </Link>
    </div>
  );
}

// ─── PurchaseKanbanPage ───────────────────────────────────────────────────────

export default function PurchaseKanbanPage() {
  const navigate = useNavigate();
  const { cards, cardsByColumn, isLoading, error, filters, setFilters, transitionCard, refresh } =
    usePurchaseKanban();

  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{
    cardId: string;
    card: KanbanCardData;
    from: KanbanColumnType;
    to: KanbanColumnType;
  } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    const cardData = event.active.data.current?.card as KanbanCardData | undefined;
    if (cardData) setActiveCard(cardData);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);

    const from = event.active.data.current?.column as KanbanColumnType | undefined;
    const to = event.over?.id as KanbanColumnType | undefined;

    if (!from || !to || from === to) return;

    // Find the card data for confirm modal description
    const cardId = String(event.active.id);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    // LOCKED DECISION: never silent transitions — always confirm
    setPendingTransition({ cardId, card, from, to });
  }

  const handleConfirmTransition = useCallback(async () => {
    if (!pendingTransition) return;
    setIsTransitioning(true);
    setTransitionError(null);
    try {
      const result = await transitionCard(pendingTransition.cardId, pendingTransition.to);
      if (result.success) {
        setPendingTransition(null);
      } else {
        // Backend returns human-readable pt-BR errors (e.g., "Use a pagina de cotacoes para criar uma cotacao")
        setTransitionError(result.error ?? 'Nao foi possivel realizar a transicao');
        setPendingTransition(null);
      }
    } finally {
      setIsTransitioning(false);
    }
  }, [pendingTransition, transitionCard]);

  function handleCancelTransition() {
    setPendingTransition(null);
  }

  function handleCardClick(card: KanbanCardData) {
    if (card.payableId) {
      navigate('/payables');
    } else if (card.goodsReceiptId) {
      navigate('/goods-receipts');
    } else if (card.purchaseOrderId) {
      navigate('/purchase-orders');
    } else if (card.quotationId) {
      navigate('/quotations');
    } else {
      navigate('/purchase-requests');
    }
  }

  // Get column label for ConfirmModal description
  function getColumnLabel(colId: KanbanColumnType): string {
    return KANBAN_COLUMNS_CONFIG.find((c) => c.id === colId)?.label ?? colId;
  }

  const hasAnyCards = cards.length > 0;

  return (
    <main className="purchase-kanban-page" id="main-content">
      {/* Header */}
      <header className="purchase-kanban-page__header">
        <nav className="purchase-kanban-page__breadcrumb" aria-label="Navegacao">
          <Link to="/dashboard">Inicio</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span>Compras</span>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page">Kanban</span>
        </nav>
        <h1 className="purchase-kanban-page__title">Kanban de Compras</h1>
      </header>

      {/* Filter bar */}
      <div className="purchase-kanban-page__filters" role="search" aria-label="Filtros do kanban">
        <div className="purchase-kanban-page__filter-group">
          <label htmlFor="kanban-filter-farm">Fazenda</label>
          <input
            id="kanban-filter-farm"
            type="text"
            placeholder="ID da fazenda"
            value={filters.farmId ?? ''}
            onChange={(e) => setFilters({ ...filters, farmId: e.target.value || undefined })}
            aria-label="Filtrar por fazenda"
          />
        </div>

        <div className="purchase-kanban-page__filter-group">
          <label htmlFor="kanban-filter-supplier">Fornecedor</label>
          <input
            id="kanban-filter-supplier"
            type="text"
            placeholder="ID do fornecedor"
            value={filters.supplierId ?? ''}
            onChange={(e) => setFilters({ ...filters, supplierId: e.target.value || undefined })}
            aria-label="Filtrar por fornecedor"
          />
        </div>

        <div className="purchase-kanban-page__filter-group">
          <label htmlFor="kanban-filter-urgency">Urgencia</label>
          <select
            id="kanban-filter-urgency"
            value={filters.urgency ?? ''}
            onChange={(e) => setFilters({ ...filters, urgency: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            <option value="NORMAL">Normal</option>
            <option value="URGENTE">Urgente</option>
            <option value="EMERGENCIAL">Emergencial</option>
          </select>
        </div>

        <div className="purchase-kanban-page__filter-group">
          <label htmlFor="kanban-filter-start">De</label>
          <input
            id="kanban-filter-start"
            type="date"
            value={filters.startDate ?? ''}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
            aria-label="Data inicial"
          />
        </div>

        <div className="purchase-kanban-page__filter-group">
          <label htmlFor="kanban-filter-end">Ate</label>
          <input
            id="kanban-filter-end"
            type="date"
            value={filters.endDate ?? ''}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
            aria-label="Data final"
          />
        </div>

        <button
          type="button"
          className="purchase-kanban-page__clear-btn"
          onClick={() => setFilters({})}
        >
          Limpar filtros
        </button>

        <button
          type="button"
          className="purchase-kanban-page__clear-btn"
          onClick={() => void refresh()}
          style={{ marginLeft: 'auto' }}
          aria-label="Atualizar kanban"
        >
          Atualizar
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="purchase-kanban-page__error" role="alert">
          {error}
          <button
            type="button"
            className="purchase-kanban-page__retry-btn"
            onClick={() => void refresh()}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Transition error banner */}
      {transitionError && (
        <div className="purchase-kanban-page__error" role="alert">
          {transitionError}
          <button
            type="button"
            className="purchase-kanban-page__retry-btn"
            onClick={() => setTransitionError(null)}
          >
            Fechar
          </button>
        </div>
      )}

      {/* Board content */}
      {isLoading ? (
        <KanbanSkeleton />
      ) : !hasAnyCards ? (
        <KanbanEmptyState />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="kanban-board">
            {KANBAN_COLUMNS_CONFIG.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                cards={cardsByColumn[col.id]}
                onCardClick={handleCardClick}
              />
            ))}
          </div>

          {/* Drag overlay — shows card preview while dragging */}
          <DragOverlay>
            {activeCard ? <KanbanCard card={activeCard} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Transition confirmation modal */}
      {pendingTransition && (
        <ConfirmModal
          isOpen={true}
          title="Confirmar transicao"
          message={`Mover ${pendingTransition.card.number} de "${getColumnLabel(pendingTransition.from)}" para "${getColumnLabel(pendingTransition.to)}"?`}
          confirmLabel="Mover"
          cancelLabel="Cancelar"
          variant="warning"
          isLoading={isTransitioning}
          onConfirm={() => void handleConfirmTransition()}
          onCancel={handleCancelTransition}
        />
      )}
    </main>
  );
}
