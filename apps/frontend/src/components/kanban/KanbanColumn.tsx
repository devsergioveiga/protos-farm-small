import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Link } from 'react-router-dom';
import KanbanCard from './KanbanCard';
import type { KanbanColumn as KanbanColumnType } from '@/hooks/usePurchasingKanban';
import './KanbanColumn.css';

interface KanbanColumnProps {
  column: KanbanColumnType;
  isValidTarget?: boolean;
  isInvalidTarget?: boolean;
}

export default function KanbanColumn({
  column,
  isValidTarget = false,
  isInvalidTarget = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    disabled: isInvalidTarget,
  });

  const classNames = [
    'kanban-column',
    isValidTarget ? 'kanban-column--valid-target' : '',
    isInvalidTarget ? 'kanban-column--invalid-target' : '',
    isOver && isValidTarget ? 'kanban-column--over' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const isPagoColumn = column.id === 'PAGO';

  return (
    <section
      className={classNames}
      aria-label={`Coluna ${column.label}: ${column.count} itens`}
      aria-disabled={isInvalidTarget ? 'true' : undefined}
    >
      <header className="kanban-column__header">
        <h2 className="kanban-column__title">{column.label}</h2>
        <span
          className={`kanban-column__counter ${column.count > 0 ? 'kanban-column__counter--active' : ''}`}
          aria-live="polite"
        >
          {column.count}
        </span>
      </header>

      <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="kanban-column__cards">
          {column.cards.length === 0 && isPagoColumn && (
            <p className="kanban-column__empty-pago">Nenhum pagamento nos últimos 30 dias</p>
          )}
          {column.cards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </div>
      </SortableContext>

      {isPagoColumn && (
        <Link to="/purchase-requests?status=PAGO" className="kanban-column__ver-todos">
          Ver todos
        </Link>
      )}
    </section>
  );
}
