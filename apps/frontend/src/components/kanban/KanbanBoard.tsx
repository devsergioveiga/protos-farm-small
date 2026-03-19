import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { useNavigate } from 'react-router-dom';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  KANBAN_VALID_DROPS,
  type KanbanCard as KanbanCardType,
  type KanbanColumn as KanbanColumnType,
  type KanbanColumnId,
} from '@/hooks/usePurchasingKanban';

interface ConfirmPending {
  card: KanbanCardType;
  from: KanbanColumnId;
  to: KanbanColumnId;
}

interface TransitionCopy {
  title: string;
  message: string;
  confirmLabel: string;
}

function getTransitionCopy(
  card: KanbanCardType,
  from: KanbanColumnId,
  to: KanbanColumnId,
): TransitionCopy {
  const n = card.sequentialNumber;
  const transitions: Partial<Record<string, TransitionCopy>> = {
    'RC_PENDENTE->RC_APROVADA': {
      title: 'Aprovar requisição?',
      message: `A requisição ${n} será aprovada e seguirá para cotação.`,
      confirmLabel: 'Aprovar',
    },
    'RC_APROVADA->EM_COTACAO': {
      title: 'Iniciar cotação?',
      message: `Uma solicitação de cotação será criada a partir de ${n}.`,
      confirmLabel: 'Iniciar cotação',
    },
    'EM_COTACAO->OC_EMITIDA': {
      title: 'Aprovar cotacao vencedora?',
      message: 'Para emitir o pedido de compra, e necessario aprovar a cotacao vencedora primeiro.',
      confirmLabel: 'Ir para Cotacoes',
    },
    'OC_EMITIDA->AGUARDANDO_ENTREGA': {
      title: 'Confirmar envio?',
      message: `O pedido ${n} será marcado como em trânsito.`,
      confirmLabel: 'Confirmar',
    },
    'AGUARDANDO_ENTREGA->RECEBIDO': {
      title: 'Registrar recebimento?',
      message: 'Você será redirecionado para confirmar os itens recebidos.',
      confirmLabel: 'Ir para recebimento',
    },
  };

  const key = `${from}->${to}`;
  return (
    transitions[key] ?? {
      title: 'Confirmar movimentação?',
      message: `Mover ${n} de ${from} para ${to}?`,
      confirmLabel: 'Confirmar',
    }
  );
}

interface KanbanBoardProps {
  columns: KanbanColumnType[];
  onCardMove: (cardId: string, from: KanbanColumnId, to: KanbanColumnId) => Promise<void>;
}

export default function KanbanBoard({ columns, onCardMove }: KanbanBoardProps) {
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = useState<KanbanCardType | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<KanbanColumnId | null>(null);
  const [confirmPending, setConfirmPending] = useState<ConfirmPending | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const findCardColumn = useCallback(
    (cardId: string): KanbanColumnId | null => {
      for (const col of columns) {
        if (col.cards.some((c) => c.id === cardId)) {
          return col.id;
        }
      }
      return null;
    },
    [columns],
  );

  const findCard = useCallback(
    (cardId: string): KanbanCardType | null => {
      for (const col of columns) {
        const card = col.cards.find((c) => c.id === cardId);
        if (card) return card;
      }
      return null;
    },
    [columns],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const card = findCard(String(event.active.id));
      const colId = findCardColumn(String(event.active.id));
      setActiveCard(card);
      setActiveColumnId(colId);
    },
    [findCard, findCardColumn],
  );

  const handleDragOver = useCallback(() => {
    // Valid/invalid target state is computed from activeColumnId in column props
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const overId = event.over?.id ? String(event.over.id) : null;
      const card = activeCard;
      const fromCol = activeColumnId;

      setActiveCard(null);
      setActiveColumnId(null);

      if (!card || !fromCol || !overId) return;
      if (overId === fromCol) return;

      const validTargets = KANBAN_VALID_DROPS[fromCol];
      if (!validTargets.includes(overId as KanbanColumnId)) return;

      setConfirmPending({ card, from: fromCol, to: overId as KanbanColumnId });
    },
    [activeCard, activeColumnId],
  );

  const handleConfirm = useCallback(async () => {
    if (!confirmPending) return;
    const { card, from, to } = confirmPending;

    // Special case: EM_COTACAO -> OC_EMITIDA navigates to quotations page
    if (from === 'EM_COTACAO' && to === 'OC_EMITIDA') {
      setConfirmPending(null);
      navigate(`/quotations?purchaseRequestId=${card.id}`);
      return;
    }

    // Special case: AGUARDANDO_ENTREGA -> RECEBIDO navigates instead of API call
    if (from === 'AGUARDANDO_ENTREGA' && to === 'RECEBIDO') {
      setConfirmPending(null);
      navigate(`/goods-receipts?poId=${card.id}`);
      return;
    }

    setIsConfirming(true);
    try {
      await onCardMove(card.id, from, to);
    } finally {
      setIsConfirming(false);
      setConfirmPending(null);
    }
  }, [confirmPending, onCardMove, navigate]);

  const handleCancel = useCallback(() => {
    setConfirmPending(null);
  }, []);

  const transitionCopy = confirmPending
    ? getTransitionCopy(confirmPending.card, confirmPending.from, confirmPending.to)
    : null;

  return (
    <>
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board">
          {columns.map((column) => {
            const isValidTarget =
              activeColumnId !== null &&
              column.id !== activeColumnId &&
              KANBAN_VALID_DROPS[activeColumnId].includes(column.id);

            const isInvalidTarget =
              activeColumnId !== null &&
              column.id !== activeColumnId &&
              !KANBAN_VALID_DROPS[activeColumnId].includes(column.id);

            return (
              <KanbanColumn
                key={column.id}
                column={column}
                isValidTarget={isValidTarget}
                isInvalidTarget={isInvalidTarget}
              />
            );
          })}
        </div>

        <DragOverlay>{activeCard ? <KanbanCard card={activeCard} isOverlay /> : null}</DragOverlay>
      </DndContext>

      {confirmPending && transitionCopy && (
        <ConfirmModal
          isOpen={true}
          title={transitionCopy.title}
          message={transitionCopy.message}
          confirmLabel={transitionCopy.confirmLabel}
          variant="warning"
          isLoading={isConfirming}
          onConfirm={() => void handleConfirm()}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
