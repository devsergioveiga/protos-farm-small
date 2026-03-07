import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import type { OrgDashboardStats } from '@/types/dashboard';

interface UseDashboardReturn {
  data: OrgDashboardStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const { selectedFarmId } = useFarmContext();
  const [data, setData] = useState<OrgDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!selectedFarmId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<OrgDashboardStats>('/org/dashboard');
      setData(result);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 403) {
        setError(null);
        setData(null);
      } else {
        setError('Não foi possível carregar o dashboard.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { data, isLoading, error, refresh: fetchDashboard };
}
