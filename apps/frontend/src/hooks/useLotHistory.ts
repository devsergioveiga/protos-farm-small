import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { LotCompositionHistoryEntry } from '@/types/lot';

interface UseLotHistoryParams {
  farmId: string | null;
  lotId: string | null;
}

interface UseLotHistoryResult {
  history: LotCompositionHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLotHistory(params: UseLotHistoryParams): UseLotHistoryResult {
  const [history, setHistory] = useState<LotCompositionHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { farmId, lotId } = params;

  const fetchHistory = useCallback(async () => {
    if (!farmId || !lotId) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<LotCompositionHistoryEntry[]>(
        `/org/farms/${farmId}/lots/${lotId}/history`,
      );
      setHistory(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar histórico do lote';
      setError(message);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, lotId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return { history, isLoading, error, refetch: fetchHistory };
}
