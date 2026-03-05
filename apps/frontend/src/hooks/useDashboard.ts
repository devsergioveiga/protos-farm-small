import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { OrgDashboardStats } from '@/types/dashboard';

interface UseDashboardResult {
  stats: OrgDashboardStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const [stats, setStats] = useState<OrgDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<OrgDashboardStats>('/org/dashboard');
      setStats(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(message);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
}
