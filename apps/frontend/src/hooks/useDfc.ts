import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { DfcOutput } from '@/types/financial-statements';

export function useDfc(
  orgId: string | undefined,
  fiscalYearId: string | null,
  month: number | null,
) {
  const [data, setData] = useState<DfcOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDfc = useCallback(async () => {
    if (!orgId || !fiscalYearId || !month) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fiscalYearId,
        month: String(month),
      });
      const result = await api.get<DfcOutput>(
        `/org/${orgId}/financial-statements/dfc?${params.toString()}`,
      );
      setData(result);
    } catch {
      setError('Nao foi possivel carregar a DFC. Verifique sua conexao e tente novamente.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, fiscalYearId, month]);

  useEffect(() => {
    void fetchDfc();
  }, [fetchDfc]);

  return { data, loading, error, refetch: fetchDfc };
}

// ─── useOrgId (re-export convenience) ────────────────────────────────────────

export function useOrgId(): string | undefined {
  const { user } = useAuth();
  return user?.organizationId ?? undefined;
}
