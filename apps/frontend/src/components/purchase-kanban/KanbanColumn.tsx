import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type {
  KanbanColumn as KanbanColumnType,
  KanbanCardData,
} from '../../hooks/usePurchaseKanban';
import KanbanCard from './KanbanCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: { id: KanbanColumnType; label: string };
  cards: KanbanCardData[];
  onCardClick: (card: KanbanCardData) => void;
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

export default function KanbanColumn({ column, cards, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const cardIds = cards.map((c) => c.id);

  return (
    <div
      className="kanban-column"
      style={
        isOver
          ? {
              background: 'var(--color-primary-50)',
              borderColor: 'var(--color-primary-300)',
              borderWidth: 2,
              borderStyle: 'solid',
            }
          : undefined
      }
      aria-label={`Coluna ${column.label}`}
    >
      {/* Column header */}
      <div className="kanban-column-header">
        <span>{column.label}</span>
        <span className="kanban-column-count" aria-label={`${cards.length} itens`}>
          {cards.length}
        </span>
      </div>

      {/* Cards drop area */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          style={{
            flex: 1,
            minHeight: 60,
            // Dashed border for empty column drop zone
            ...(cards.length === 0
              ? {
                  border: '2px dashed var(--color-neutral-200)',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                }
              : {}),
          }}
        >
          {cards.length === 0 ? (
            <span
              style={{
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontSize: 13,
                color: 'var(--color-neutral-400)',
              }}
            >
              Nenhum item
            </span>
          ) : (
            cards.map((card) => (
              <KanbanCard key={card.id} card={card} onClick={() => onCardClick(card)} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
