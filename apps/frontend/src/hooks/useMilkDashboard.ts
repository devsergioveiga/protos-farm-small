import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { MilkDashboardData } from '@/types/milk-dashboard';

export type MilkDashboardPeriod = '30d' | '90d' | '365d';

interface UseMilkDashboardParams {
  farmId: string | null;
  period: MilkDashboardPeriod;
  lotId?: string;
  breedName?: string;
}

interface UseMilkDashboardResult {
  data: MilkDashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMilkDashboard(params: UseMilkDashboardParams): UseMilkDashboardResult {
  const [data, setData] = useState<MilkDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, period, lotId, breedName } = params;

  const fetchDashboard = useCallback(async () => {
    if (!farmId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set('period', period);
      if (lotId) query.set('lotId', lotId);
      if (breedName) query.set('breedName', breedName);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/milk-dashboard${qs ? `?${qs}` : ''}`;
      const result = await api.get<MilkDashboardData>(path);
      setData(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar dashboard de produção de leite';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, period, lotId, breedName]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { data, isLoading, error, refetch: fetchDashboard };
}
