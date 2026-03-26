import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { HrDashboardQuery, HrDashboardResponse } from '@/types/hr-dashboard';

interface UseHrDashboardResult {
  data: HrDashboardResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useHrDashboard(params: HrDashboardQuery): UseHrDashboardResult {
  const [data, setData] = useState<HrDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, year, month } = params;

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set('year', String(year));
      query.set('month', String(month));
      if (farmId) query.set('farmId', farmId);

      const qs = query.toString();
      const path = `/org/hr-dashboard${qs ? `?${qs}` : ''}`;
      const result = await api.get<HrDashboardResponse>(path);
      setData(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o dashboard. Verifique sua conexão e tente novamente.';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, year, month]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { data, isLoading, error, refetch: fetchDashboard };
}
