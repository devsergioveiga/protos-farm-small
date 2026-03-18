import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export type KanbanColumnId =
  | 'RC_PENDENTE'
  | 'RC_APROVADA'
  | 'EM_COTACAO'
  | 'OC_EMITIDA'
  | 'AGUARDANDO_ENTREGA'
  | 'RECEBIDO'
  | 'PAGO';

export interface KanbanCard {
  id: string;
  entityType: 'RC' | 'SC' | 'OC' | 'GR' | 'PAYABLE';
  sequentialNumber: string;
  urgency?: 'NORMAL' | 'URGENTE' | 'EMERGENCIAL';
  requesterName: string;
  totalValue: number;
  daysInStage: number;
  isOverdue: boolean;
  farmId: string;
  farmName: string;
}

export interface KanbanColumn {
  id: KanbanColumnId;
  label: string;
  count: number;
  cards: KanbanCard[];
}

export const KANBAN_VALID_DROPS: Record<KanbanColumnId, KanbanColumnId[]> = {
  RC_PENDENTE: ['RC_APROVADA'],
  RC_APROVADA: ['EM_COTACAO'],
  EM_COTACAO: ['OC_EMITIDA'],
  OC_EMITIDA: ['AGUARDANDO_ENTREGA'],
  AGUARDANDO_ENTREGA: ['RECEBIDO'],
  RECEBIDO: [],
  PAGO: [],
};

export interface KanbanFilters {
  farmId?: string;
  urgency?: string;
  search?: string;
}

export function usePurchasingKanban(orgId: string, filters: KanbanFilters) {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.farmId) params.set('farmId', filters.farmId);
      if (filters.urgency) params.set('urgency', filters.urgency);
      if (filters.search) params.set('search', filters.search);
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api.get<{ columns: KanbanColumn[] }>(
        `/org/${orgId}/purchasing/kanban${query}`,
      );
      setColumns(data.columns);
    } catch {
      setError('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.');
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, filters.farmId, filters.urgency, filters.search]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  const moveCard = useCallback(
    async (
      cardId: string,
      fromCol: KanbanColumnId,
      toCol: KanbanColumnId,
    ): Promise<string | null> => {
      // Find card details for API calls
      const sourceColumn = columns.find((c) => c.id === fromCol);
      const card = sourceColumn?.cards.find((c) => c.id === cardId);
      if (!card) return 'Cartão não encontrado.';

      // Optimistic update: move card locally
      const prevColumns = columns.map((col) => ({ ...col, cards: [...col.cards] }));

      setColumns((prev) => {
        const updated = prev.map((col) => {
          if (col.id === fromCol) {
            return {
              ...col,
              count: col.count - 1,
              cards: col.cards.filter((c) => c.id !== cardId),
            };
          }
          if (col.id === toCol) {
            return {
              ...col,
              count: col.count + 1,
              cards: [...col.cards, card],
            };
          }
          return col;
        });
        return updated;
      });

      try {
        if (fromCol === 'RC_PENDENTE' && toCol === 'RC_APROVADA') {
          await api.post(`/org/${orgId}/purchase-requests/${cardId}/approve`);
        } else if (fromCol === 'RC_APROVADA' && toCol === 'EM_COTACAO') {
          await api.post(`/org/${orgId}/quotations`, { purchaseRequestId: cardId });
        } else if (fromCol === 'EM_COTACAO' && toCol === 'OC_EMITIDA') {
          await api.post(`/org/${orgId}/purchase-orders`, { quotationId: cardId });
        } else if (fromCol === 'OC_EMITIDA' && toCol === 'AGUARDANDO_ENTREGA') {
          await api.put(`/org/${orgId}/purchase-orders/${cardId}/status`, {
            status: 'EM_TRANSITO',
          });
        } else if (fromCol === 'AGUARDANDO_ENTREGA' && toCol === 'RECEBIDO') {
          // Navigation handled in the board component — redirect to goods-receipts
          return null;
        }
        return null;
      } catch {
        // Rollback on error
        setColumns(prevColumns);
        return 'Não foi possível mover o cartão. Tente novamente.';
      }
    },
    [columns, orgId],
  );

  return { columns, loading, error, refetch: fetchBoard, moveCard };
}
