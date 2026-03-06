import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { LotDashboard } from '@/types/lot';

interface UseLotDashboardParams {
  farmId: string | null;
  lotId: string | null;
}

interface UseLotDashboardResult {
  dashboard: LotDashboard | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLotDashboard(params: UseLotDashboardParams): UseLotDashboardResult {
  const [dashboard, setDashboard] = useState<LotDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { farmId, lotId } = params;

  const fetchDashboard = useCallback(async () => {
    if (!farmId || !lotId) {
      setDashboard(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<LotDashboard>(`/org/farms/${farmId}/lots/${lotId}/dashboard`);
      setDashboard(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dashboard do lote';
      setError(message);
      setDashboard(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, lotId]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { dashboard, isLoading, error, refetch: fetchDashboard };
}
