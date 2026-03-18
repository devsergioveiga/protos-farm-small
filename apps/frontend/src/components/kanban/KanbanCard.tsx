import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle } from 'lucide-react';
import type { KanbanCard as KanbanCardType } from '@/hooks/usePurchasingKanban';
import './KanbanCard.css';

const ENTITY_TYPE_LABELS: Record<KanbanCardType['entityType'], string> = {
  RC: 'Requisição',
  SC: 'Solicitação',
  OC: 'Pedido',
  GR: 'Recebimento',
  PAYABLE: 'Pagamento',
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface KanbanCardProps {
  card: KanbanCardType;
  isOverlay?: boolean;
}

export default function KanbanCard({ card, isOverlay = false }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { card },
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const classNames = [
    'kanban-card',
    isDragging ? 'kanban-card--dragging' : '',
    isOverlay ? 'kanban-card--overlay' : '',
    card.isOverdue ? 'kanban-card--overdue' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const ariaLabel = `${card.sequentialNumber} — ${card.requesterName}, ${formatCurrency(card.totalValue)}`;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={classNames}
      aria-label={ariaLabel}
      {...attributes}
      {...listeners}
    >
      {/* Row 1: number + urgency badge */}
      <div className="kanban-card__row">
        <span className="kanban-card__number">{card.sequentialNumber}</span>
        {card.urgency && (
          <span className={`kanban-card__urgency kanban-card__urgency--${card.urgency}`}>
            {card.urgency === 'NORMAL'
              ? 'Normal'
              : card.urgency === 'URGENTE'
                ? 'Urgente'
                : 'Emergencial'}
          </span>
        )}
      </div>

      {/* Row 2: entity type + farm name */}
      <div className="kanban-card__row">
        <span className="kanban-card__type">
          {ENTITY_TYPE_LABELS[card.entityType] ?? card.entityType}
        </span>
        <span className="kanban-card__farm" title={card.farmName}>
          {card.farmName}
        </span>
      </div>

      {/* Row 3: requester name */}
      <div className="kanban-card__requester" title={card.requesterName}>
        {card.requesterName}
      </div>

      {/* Row 4: value + days in stage */}
      <div className="kanban-card__row">
        <span className="kanban-card__value">{formatCurrency(card.totalValue)}</span>
        <span className="kanban-card__days">
          {card.daysInStage} {card.daysInStage === 1 ? 'dia' : 'dias'}
          {card.isOverdue && (
            <AlertCircle size={16} className="kanban-card__overdue-icon" aria-hidden="true" />
          )}
        </span>
      </div>
    </article>
  );
}
