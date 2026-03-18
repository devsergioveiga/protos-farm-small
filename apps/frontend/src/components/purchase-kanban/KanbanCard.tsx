import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Zap } from 'lucide-react';
import type { KanbanCardData } from '../../hooks/usePurchaseKanban';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  card: KanbanCardData;
  isOverlay?: boolean;
  onClick?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRL_FORMAT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatBRL(value: number): string {
  return BRL_FORMAT.format(value);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

// ─── Urgency badge ────────────────────────────────────────────────────────────

interface UrgencyBadgeProps {
  urgency: KanbanCardData['urgency'];
}

function UrgencyBadge({ urgency }: UrgencyBadgeProps) {
  const styles: Record<KanbanCardData['urgency'], React.CSSProperties> = {
    NORMAL: {
      background: 'var(--color-neutral-200)',
      color: 'var(--color-neutral-600)',
    },
    URGENTE: {
      background: 'var(--color-warning-100)',
      color: 'var(--color-warning-700)',
    },
    EMERGENCIAL: {
      background: 'var(--color-error-100)',
      color: 'var(--color-error-700)',
    },
  };

  const labels: Record<KanbanCardData['urgency'], string> = {
    NORMAL: 'Normal',
    URGENTE: 'Urgente',
    EMERGENCIAL: 'Emergencial',
  };

  return (
    <span
      style={{
        ...styles[urgency],
        borderRadius: 12,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
        display: 'inline-block',
      }}
    >
      {labels[urgency]}
    </span>
  );
}

// ─── KanbanCard ───────────────────────────────────────────────────────────────

export default function KanbanCard({ card, isOverlay = false, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { column: card.column, card },
  });

  const baseTransform = CSS.Transform.toString(transform);
  const style: React.CSSProperties = {
    transform: isOverlay ? `${baseTransform ?? ''} rotate(3deg)` : (baseTransform ?? undefined),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isOverlay ? 'grabbing' : 'grab',
    boxShadow: isOverlay ? 'var(--shadow-lg)' : undefined,
  };

  function handleClick(e: React.MouseEvent) {
    // Only fire onClick if not dragging (pointer didn't move significantly)
    if (!isDragging && onClick) {
      onClick();
    }
    e.stopPropagation();
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`kanban-card${isDragging ? ' dragging' : ''}${isOverlay ? ' overlay' : ''}`}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Card ${card.number} — ${card.type}, ${card.requester}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Header: number + overdue icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--color-neutral-800)',
          }}
        >
          {card.number}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {card.isOverdue && (
            <AlertTriangle
              size={16}
              style={{ color: 'var(--color-error-500)' }}
              aria-label="SLA excedido"
            />
          )}
          <span
            style={{
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: 12,
              color: 'var(--color-neutral-500)',
            }}
          >
            {card.daysInStage}d
          </span>
        </div>
      </div>

      {/* Type */}
      <div
        style={{
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          fontSize: 11,
          color: 'var(--color-neutral-500)',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {card.type}
      </div>

      {/* Requester */}
      <div
        style={{
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          fontSize: 13,
          color: 'var(--color-neutral-700)',
          marginBottom: 8,
        }}
        title={card.requester}
      >
        {truncate(card.requester, 20)}
      </div>

      {/* Value */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--color-neutral-800)',
          marginBottom: 8,
        }}
      >
        {formatBRL(card.totalValue)}
      </div>

      {/* Footer: urgency badge + emergency badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <UrgencyBadge urgency={card.urgency} />
        {card.isEmergency && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: 11,
              fontStyle: 'italic',
              color: 'var(--color-error-700)',
            }}
          >
            <Zap size={14} aria-hidden="true" />
            Emergencial direto
          </span>
        )}
      </div>
    </article>
  );
}
