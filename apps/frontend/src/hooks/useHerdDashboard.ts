import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AnimalsSummary } from '@/types/animal';

interface UseHerdDashboardParams {
  farmId: string | null;
}

interface UseHerdDashboardResult {
  data: AnimalsSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useHerdDashboard(params: UseHerdDashboardParams): UseHerdDashboardResult {
  const [data, setData] = useState<AnimalsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId } = params;

  const fetchDashboard = useCallback(async () => {
    if (!farmId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<AnimalsSummary>(`/org/farms/${farmId}/animals/summary`);
      setData(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar resumo do rebanho';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { data, isLoading, error, refetch: fetchDashboard };
}
