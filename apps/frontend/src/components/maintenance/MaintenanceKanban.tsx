import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Circle, Loader2, PackageX } from 'lucide-react';
import type { WorkOrder, WorkOrderStatus } from '@/types/maintenance';

// ─── Column definitions ────────────────────────────────────────────────

export type OSKanbanColumnId = 'ABERTA' | 'EM_ANDAMENTO' | 'AGUARDANDO_PECA';

export const OS_KANBAN_COLUMNS: Array<{
  id: OSKanbanColumnId;
  label: string;
  color: string;
  Icon: React.ElementType;
}> = [
  { id: 'ABERTA', label: 'Abertas', color: 'var(--color-info-500, #0277bd)', Icon: Circle },
  { id: 'EM_ANDAMENTO', label: 'Em andamento', color: 'var(--color-warning-500, #f57f17)', Icon: Loader2 },
  { id: 'AGUARDANDO_PECA', label: 'Aguardando peca', color: 'var(--color-error-500, #c62828)', Icon: PackageX },
];

export const OS_VALID_DROPS: Record<OSKanbanColumnId, OSKanbanColumnId[]> = {
  ABERTA: ['EM_ANDAMENTO'],
  EM_ANDAMENTO: ['ABERTA', 'AGUARDANDO_PECA'],
  AGUARDANDO_PECA: ['EM_ANDAMENTO'],
};

// ─── Props ─────────────────────────────────────────────────────────────

interface MaintenanceKanbanProps {
  workOrders: WorkOrder[];
  onStatusChange: (id: string, newStatus: WorkOrderStatus) => Promise<void> | void;
}

// ─── OS Card ──────────────────────────────────────────────────────────

interface OSCardProps {
  workOrder: WorkOrder;
  isOverlay?: boolean;
}

function getDaysOpen(openedAt: string): number {
  const now = new Date();
  const opened = new Date(openedAt);
  return Math.floor((now.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24));
}

const TYPE_LABELS: Record<string, string> = {
  PREVENTIVA: 'Preventiva',
  CORRETIVA: 'Corretiva',
  SOLICITACAO: 'Solicitacao',
};

function OSCard({ workOrder, isOverlay = false }: OSCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: workOrder.id,
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const daysOpen = getDaysOpen(workOrder.openedAt);
  const ariaLabel = `OS #${workOrder.sequentialNumber} — ${workOrder.asset?.name ?? 'Ativo'}, ${workOrder.type}, ${daysOpen} dias`;

  return (
    <article
      ref={setNodeRef}
      style={{
        ...style,
        padding: 'var(--space-4)',
        border: '1px solid var(--color-neutral-200)',
        borderRadius: 'var(--radius-md, 6px)',
        background: 'var(--color-neutral-0, #ffffff)',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        boxShadow: isOverlay ? 'var(--shadow-xl)' : undefined,
        transform: isOverlay ? `${CSS.Transform.toString(transform) ?? ''} rotate(4deg)` : CSS.Transform.toString(transform) ?? undefined,
        marginBottom: 'var(--space-2)',
      }}
      aria-label={ariaLabel}
      {...attributes}
      {...listeners}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
        <span style={{ fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', fontSize: '0.875rem', color: 'var(--color-neutral-800)' }}>
          #{String(workOrder.sequentialNumber).padStart(4, '0')}
        </span>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '2px var(--space-2)',
          borderRadius: '9999px',
          background: 'var(--color-neutral-100)',
          color: 'var(--color-neutral-600)',
        }}>
          {TYPE_LABELS[workOrder.type] ?? workOrder.type}
        </span>
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-700)', marginBottom: 'var(--space-1)' }}>
        {workOrder.asset?.name ?? '—'}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)' }}>
        {daysOpen} {daysOpen === 1 ? 'dia' : 'dias'} aberta
      </div>
    </article>
  );
}

// ─── OS Column ────────────────────────────────────────────────────────

interface OSColumnProps {
  id: OSKanbanColumnId;
  label: string;
  color: string;
  Icon: React.ElementType;
  cards: WorkOrder[];
  isValidTarget: boolean;
  isInvalidTarget: boolean;
}

function OSColumn({ id, label, color, Icon, cards, isValidTarget, isInvalidTarget }: OSColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: isInvalidTarget,
  });

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: 'var(--radius-md, 6px)',
        background: isValidTarget && isOver
          ? 'var(--color-primary-100, #c8e6c9)'
          : isValidTarget
          ? 'var(--color-neutral-50, #fafaf8)'
          : 'var(--color-neutral-50, #fafaf8)',
        border: isValidTarget && isOver
          ? '2px solid var(--color-primary-500)'
          : '1px solid var(--color-neutral-200)',
        borderTop: `3px solid ${color}`,
        transition: 'background 100ms, border-color 100ms',
        opacity: isInvalidTarget ? 0.5 : 1,
      }}
      aria-label={`Coluna ${label}: ${cards.length} itens`}
    >
      <header style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-neutral-200)' }}>
        <Icon size={16} aria-hidden="true" style={{ color }} />
        <span style={{ fontFamily: 'var(--font-body, "Source Sans 3", system-ui, sans-serif)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-neutral-700)' }}>
          {label}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-body, "Source Sans 3", system-ui, sans-serif)',
          fontSize: '0.75rem',
          fontWeight: 700,
          padding: '2px var(--space-2)',
          borderRadius: '9999px',
          background: 'var(--color-neutral-200)',
          color: 'var(--color-neutral-600)',
        }} aria-live="polite">
          {cards.length}
        </span>
      </header>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          style={{ padding: 'var(--space-3)', minHeight: '120px' }}
        >
          {cards.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-neutral-400)', fontSize: '0.8125rem', padding: 'var(--space-4)' }}>
              Nenhuma OS
            </p>
          )}
          {cards.map((wo) => (
            <OSCard key={wo.id} workOrder={wo} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

// ─── Main component ────────────────────────────────────────────────────

export default function MaintenanceKanban({ workOrders, onStatusChange }: MaintenanceKanbanProps) {
  const [activeWorkOrder, setActiveWorkOrder] = useState<WorkOrder | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<OSKanbanColumnId | null>(null);

  // Build columns
  const columns = OS_KANBAN_COLUMNS.map((col) => ({
    ...col,
    cards: workOrders.filter((wo) => wo.status === col.id),
  }));

  const findWorkOrder = useCallback(
    (id: string): WorkOrder | null => workOrders.find((wo) => wo.id === id) ?? null,
    [workOrders],
  );

  const findWorkOrderColumn = useCallback(
    (id: string): OSKanbanColumnId | null => {
      const wo = workOrders.find((w) => w.id === id);
      if (!wo) return null;
      const statusAsCol = wo.status as OSKanbanColumnId;
      return OS_KANBAN_COLUMNS.some((c) => c.id === statusAsCol) ? statusAsCol : null;
    },
    [workOrders],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const wo = findWorkOrder(String(event.active.id));
      const colId = findWorkOrderColumn(String(event.active.id));
      setActiveWorkOrder(wo);
      setActiveColumnId(colId);
    },
    [findWorkOrder, findWorkOrderColumn],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const overId = event.over?.id ? String(event.over.id) : null;
      const wo = activeWorkOrder;
      const fromCol = activeColumnId;

      setActiveWorkOrder(null);
      setActiveColumnId(null);

      if (!wo || !fromCol || !overId) return;
      if (overId === fromCol) return;

      const validTargets = OS_VALID_DROPS[fromCol];
      if (!validTargets.includes(overId as OSKanbanColumnId)) return;

      void onStatusChange(wo.id, overId as WorkOrderStatus);
    },
    [activeWorkOrder, activeColumnId, onStatusChange],
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto' }}>
        {columns.map((col) => {
          const isValidTarget =
            activeColumnId !== null &&
            col.id !== activeColumnId &&
            OS_VALID_DROPS[activeColumnId].includes(col.id);

          const isInvalidTarget =
            activeColumnId !== null &&
            col.id !== activeColumnId &&
            !OS_VALID_DROPS[activeColumnId].includes(col.id);

          return (
            <OSColumn
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              Icon={col.Icon}
              cards={col.cards}
              isValidTarget={isValidTarget}
              isInvalidTarget={isInvalidTarget}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeWorkOrder ? <OSCard workOrder={activeWorkOrder} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
