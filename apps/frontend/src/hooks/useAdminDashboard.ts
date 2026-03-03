import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AdminDashboardStats } from '@/types/admin';

interface UseAdminDashboardResult {
  stats: AdminDashboardStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAdminDashboard(): UseAdminDashboardResult {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<AdminDashboardStats>('/admin/dashboard');
      setStats(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar estatísticas';
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
