import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type KanbanColumn =
  | 'RC_PENDENTE'
  | 'APROVADA'
  | 'EM_COTACAO'
  | 'OC_EMITIDA'
  | 'AGUARDANDO_ENTREGA'
  | 'RECEBIDO'
  | 'PAGO';

export interface KanbanCardData {
  id: string;
  column: KanbanColumn;
  number: string;
  type: string;
  requester: string;
  totalValue: number;
  urgency: 'NORMAL' | 'URGENTE' | 'EMERGENCIAL';
  daysInStage: number;
  isOverdue: boolean;
  purchaseRequestId: string | null;
  quotationId: string | null;
  purchaseOrderId: string | null;
  goodsReceiptId: string | null;
  payableId: string | null;
  isEmergency: boolean;
}

export interface KanbanFilters {
  farmId?: string;
  urgency?: string;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
}

export const KANBAN_COLUMNS_CONFIG: { id: KanbanColumn; label: string }[] = [
  { id: 'RC_PENDENTE', label: 'RC Pendente' },
  { id: 'APROVADA', label: 'Aprovada' },
  { id: 'EM_COTACAO', label: 'Em Cotacao' },
  { id: 'OC_EMITIDA', label: 'OC Emitida' },
  { id: 'AGUARDANDO_ENTREGA', label: 'Aguardando Entrega' },
  { id: 'RECEBIDO', label: 'Recebido' },
  { id: 'PAGO', label: 'Pago' },
];

// ─── Hook result ──────────────────────────────────────────────────────────────

interface UsePurchaseKanbanResult {
  cards: KanbanCardData[];
  cardsByColumn: Record<KanbanColumn, KanbanCardData[]>;
  isLoading: boolean;
  error: string | null;
  filters: KanbanFilters;
  setFilters: (filters: KanbanFilters) => void;
  transitionCard: (
    cardId: string,
    targetColumn: KanbanColumn,
  ) => Promise<{ success: boolean; error?: string }>;
  refresh: () => void;
}

// ─── usePurchaseKanban ────────────────────────────────────────────────────────

export function usePurchaseKanban(): UsePurchaseKanbanResult {
  const [cards, setCards] = useState<KanbanCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<KanbanFilters>({});
  const [refreshCounter, setRefreshCounter] = useState(0);

  const { farmId, urgency, supplierId, startDate, endDate } = filters;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const p = new URLSearchParams();
        if (farmId) p.set('farmId', farmId);
        if (urgency) p.set('urgency', urgency);
        if (supplierId) p.set('supplierId', supplierId);
        if (startDate) p.set('startDate', startDate);
        if (endDate) p.set('endDate', endDate);

        const qs = p.toString();
        const data = await api.get<KanbanCardData[]>(`/org/purchase-kanban${qs ? `?${qs}` : ''}`);
        if (!cancelled) setCards(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erro ao carregar kanban de compras');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [farmId, urgency, supplierId, startDate, endDate, refreshCounter]);

  // Derive cardsByColumn from cards array (not separate state)
  const cardsByColumn: Record<KanbanColumn, KanbanCardData[]> = {
    RC_PENDENTE: [],
    APROVADA: [],
    EM_COTACAO: [],
    OC_EMITIDA: [],
    AGUARDANDO_ENTREGA: [],
    RECEBIDO: [],
    PAGO: [],
  };
  for (const card of cards) {
    cardsByColumn[card.column].push(card);
  }

  const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

  const transitionCard = useCallback(
    async (
      cardId: string,
      targetColumn: KanbanColumn,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await api.post('/org/purchase-kanban/transition', { cardId, targetColumn });
        refresh();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erro ao mover card',
        };
      }
    },
    [refresh],
  );

  return {
    cards,
    cardsByColumn,
    isLoading,
    error,
    filters,
    setFilters,
    transitionCard,
    refresh,
  };
}
