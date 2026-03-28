import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { PatrimonyDashboardOutput } from '@/types/asset';

// ─── Hook ──────────────────────────────────────────────────────────────────

export function usePatrimonyDashboard() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [farmId, setFarmId] = useState<string | undefined>();

  const [data, setData] = useState<PatrimonyDashboardOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(
    async (
      y: number = year,
      m: number = month,
      fId?: string,
    ): Promise<PatrimonyDashboardOutput | null> => {
      if (!orgId) return null;
      setIsLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set('year', String(y));
        qs.set('month', String(m));
        if (fId) qs.set('farmId', fId);
        const result = await api.get<PatrimonyDashboardOutput>(
          `/org/${orgId}/financial-dashboard/patrimony?${qs.toString()}`,
        );
        setData(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Nao foi possivel carregar o dashboard patrimonial. Verifique sua conexao.';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [orgId, year, month],
  );

  // Auto-fetch on mount and when filters change
  useEffect(() => {
    if (orgId) {
      void fetchDashboard(year, month, farmId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, year, month, farmId]);

  const refetch = useCallback(() => {
    void fetchDashboard(year, month, farmId);
  }, [fetchDashboard, year, month, farmId]);

  return {
    data,
    isLoading,
    error,
    year,
    month,
    farmId,
    setYear,
    setMonth,
    setFarmId,
    refetch,
  };
}
