import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { SanitaryDashboardData } from '@/types/sanitary-dashboard';

interface UseSanitaryDashboardParams {
  farmId: string | null;
  lotId?: string;
  category?: string;
}

interface UseSanitaryDashboardResult {
  data: SanitaryDashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSanitaryDashboard(
  params: UseSanitaryDashboardParams,
): UseSanitaryDashboardResult {
  const [data, setData] = useState<SanitaryDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, lotId, category } = params;

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
      if (lotId) query.set('lotId', lotId);
      if (category) query.set('category', category);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/sanitary-dashboard${qs ? `?${qs}` : ''}`;
      const result = await api.get<SanitaryDashboardData>(path);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dashboard sanitário';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, lotId, category]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { data, isLoading, error, refetch: fetchDashboard };
}
