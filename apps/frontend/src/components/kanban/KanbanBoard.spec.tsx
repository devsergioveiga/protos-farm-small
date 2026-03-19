import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { KanbanCard, KanbanColumn, KanbanColumnId } from '@/hooks/usePurchasingKanban';

type DnDHandlers = {
  onDragStart?: (event: unknown) => void;
  onDragEnd?: (event: unknown) => void;
};

// Mutable container updated on every render so we always have fresh handlers
const dndHandlerRef: DnDHandlers = {};

// Mock @dnd-kit/core — update mutable ref on every render
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
  }: {
    children: React.ReactNode;
  } & DnDHandlers) => {
    dndHandlerRef.onDragStart = onDragStart;
    dndHandlerRef.onDragEnd = onDragEnd;
    return <>{children}</>;
  },
  DragOverlay: () => null,
  closestCenter: vi.fn(),
}));

// Mock @dnd-kit/modifiers
vi.mock('@dnd-kit/modifiers', () => ({
  restrictToHorizontalAxis: vi.fn(),
}));

// Mock KanbanColumn
vi.mock('./KanbanColumn', () => ({
  default: ({
    column,
  }: {
    column: KanbanColumn;
    isValidTarget: boolean;
    isInvalidTarget: boolean;
  }) => (
    <div data-testid={`column-${column.id}`} data-column-id={column.id}>
      {column.label}
      {column.cards.map((card) => (
        <div key={card.id} data-testid={`card-${card.id}`}>
          {card.sequentialNumber}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('./KanbanCard', () => ({
  default: ({ card }: { card: KanbanCard }) => (
    <div data-testid={`card-overlay-${card.id}`}>{card.sequentialNumber}</div>
  ),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const MOCK_CARD: KanbanCard = {
  id: 'card-1',
  entityType: 'RC',
  sequentialNumber: 'RC-001',
  urgency: 'NORMAL',
  requesterName: 'João Silva',
  totalValue: 1500,
  daysInStage: 3,
  isOverdue: false,
  farmId: 'farm-1',
  farmName: 'Fazenda Sol',
};

const MOCK_COLUMNS: KanbanColumn[] = [
  {
    id: 'EM_COTACAO' as KanbanColumnId,
    label: 'Em Cotação',
    count: 1,
    cards: [MOCK_CARD],
  },
  {
    id: 'OC_EMITIDA' as KanbanColumnId,
    label: 'OC Emitida',
    count: 0,
    cards: [],
  },
];

/**
 * Simulate a drag sequence. Must be called after render.
 * Step 1: dragStart sets activeCard/activeColumnId state.
 * Step 2: re-render updates dndHandlerRef.onDragEnd with fresh closure.
 * Step 3: dragEnd runs with the updated handler (fresh closure has activeCard set).
 */
async function simulateDrag(cardId: string, toColId: KanbanColumnId) {
  // Step 1: fire dragStart — this sets activeCard + activeColumnId state
  await act(async () => {
    dndHandlerRef.onDragStart?.({ active: { id: cardId } });
  });
  // After act(), React re-renders and dndHandlerRef.onDragEnd is updated with
  // a fresh closure that has the correct activeCard/activeColumnId values.

  // Step 2: fire dragEnd — now uses fresh handler with activeCard set
  await act(async () => {
    dndHandlerRef.onDragEnd?.({
      active: { id: cardId },
      over: { id: toColId },
    });
  });
}

describe('KanbanBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dndHandlerRef.onDragStart = undefined;
    dndHandlerRef.onDragEnd = undefined;
  });

  describe('EM_COTACAO->OC_EMITIDA transition', () => {
    it('shows "Aprovar cotacao vencedora?" for EM_COTACAO->OC_EMITIDA transition', async () => {
      const { default: KanbanBoard } = await import('./KanbanBoard');

      render(<KanbanBoard columns={MOCK_COLUMNS} onCardMove={vi.fn()} />);

      await simulateDrag(MOCK_CARD.id, 'OC_EMITIDA');

      // After drag end with valid transition, confirmPending is set and ConfirmModal renders.
      // Current code shows "Emitir pedido?" — this test asserts the CORRECT title after Plan 13-01.
      // FAILS against current code (which has 'Emitir pedido?' as title for EM_COTACAO->OC_EMITIDA).
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeDefined();

      // Correct title expected after Plan 13-01 fix
      expect(screen.getByRole('heading', { name: 'Aprovar cotacao vencedora?' })).toBeDefined();

      // Correct confirm button label expected after Plan 13-01 fix
      expect(screen.getByRole('button', { name: 'Ir para Cotacoes' })).toBeDefined();
    });

    it('navigates to /quotations?purchaseRequestId={id} on EM_COTACAO->OC_EMITIDA confirm', async () => {
      const user = userEvent.setup();
      const { default: KanbanBoard } = await import('./KanbanBoard');

      render(<KanbanBoard columns={MOCK_COLUMNS} onCardMove={vi.fn()} />);

      await simulateDrag(MOCK_CARD.id, 'OC_EMITIDA');

      // Wait for confirm modal
      await screen.findByRole('dialog');

      // Click the confirm button (current: "Emitir pedido", fixed: "Ir para Cotacoes")
      const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
      const allButtons = screen.getAllByRole('button');
      const confirmBtn = allButtons.find((b) => b !== cancelBtn);
      if (confirmBtn) {
        await user.click(confirmBtn);
      }

      // After confirm, navigate should be called with quotations URL.
      // Current code calls onCardMove for EM_COTACAO->OC_EMITIDA (no navigate).
      // This test FAILS against current code because mockNavigate is not called.
      expect(mockNavigate).toHaveBeenCalledWith(`/quotations?purchaseRequestId=${MOCK_CARD.id}`);
    });

    it('does not show "Emitir pedido?" for EM_COTACAO->OC_EMITIDA transition', async () => {
      const { default: KanbanBoard } = await import('./KanbanBoard');

      render(<KanbanBoard columns={MOCK_COLUMNS} onCardMove={vi.fn()} />);

      await simulateDrag(MOCK_CARD.id, 'OC_EMITIDA');

      // Wait for confirm modal to appear
      await screen.findByRole('dialog');

      // The old broken title "Emitir pedido?" must NOT appear.
      // Current code shows it — this test FAILS against current code.
      expect(screen.queryByRole('heading', { name: 'Emitir pedido?' })).toBeNull();
    });
  });
});
