import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { DreResponse } from '@/types/financial-statements';

export interface DreFilters {
  fiscalYearId: string;
  month: number;
  costCenterId?: string;
}

export function useDre(orgId: string | undefined, filters: DreFilters | null) {
  const [data, setData] = useState<DreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDre = useCallback(async () => {
    if (!orgId || !filters) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fiscalYearId: filters.fiscalYearId,
        month: String(filters.month),
      });
      if (filters.costCenterId) params.set('costCenterId', filters.costCenterId);
      const result = await api.get<DreResponse>(
        `/org/${orgId}/financial-statements/dre?${params.toString()}`,
      );
      setData(result);
    } catch {
      setError('Não foi possível carregar a DRE. Verifique sua conexão e tente novamente.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, filters]);

  useEffect(() => {
    void fetchDre();
  }, [fetchDre]);

  return { data, loading, error, refetch: fetchDre };
}

// ─── useOrgId (re-export convenience) ────────────────────────────────────────

export function useOrgId(): string | undefined {
  const { user } = useAuth();
  return user?.organizationId ?? undefined;
}
