import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { CultivarPlotHistoryItem } from '@/types/cultivar';

interface UseCultivarPlotHistoryParams {
  farmId: string | null;
  plotId?: string;
}

interface UseCultivarPlotHistoryResult {
  plotHistory: CultivarPlotHistoryItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCultivarPlotHistory(
  params: UseCultivarPlotHistoryParams,
): UseCultivarPlotHistoryResult {
  const [plotHistory, setPlotHistory] = useState<CultivarPlotHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, plotId } = params;

  const fetchHistory = useCallback(async () => {
    if (!farmId) {
      setPlotHistory([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (plotId) query.set('plotId', plotId);
      const qs = query.toString();
      const path = `/org/farms/${farmId}/cultivars/plot-history${qs ? `?${qs}` : ''}`;
      const result = await api.get<CultivarPlotHistoryItem[]>(path);
      setPlotHistory(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar histórico de cultivares';
      setError(message);
      setPlotHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, plotId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return { plotHistory, isLoading, error, refetch: fetchHistory };
}
