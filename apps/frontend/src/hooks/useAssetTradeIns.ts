import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { CreateTradeInInput, TradeInOutput } from '@/types/asset';

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAssetTradeIns() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [tradeIns, setTradeIns] = useState<TradeInOutput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTradeIns = useCallback(
    async (farmId?: string): Promise<void> => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const params = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
        const result = await api.get<TradeInOutput[]>(`/org/${orgId}/asset-trade-ins${params}`);
        setTradeIns(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Nao foi possivel carregar as trocas de ativo.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const createTradeIn = useCallback(
    async (input: CreateTradeInInput): Promise<TradeInOutput> => {
      if (!orgId) throw new Error('Organizacao nao encontrada.');
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<TradeInOutput>(`/org/${orgId}/asset-trade-ins`, input);
        // Refresh list after creation
        await fetchTradeIns();
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel registrar a troca de ativo. Verifique os dados e tente novamente.';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [orgId, fetchTradeIns],
  );

  const refetch = useCallback(() => fetchTradeIns(), [fetchTradeIns]);

  return {
    tradeIns,
    loading,
    error,
    createTradeIn,
    fetchTradeIns,
    refetch,
  };
}
