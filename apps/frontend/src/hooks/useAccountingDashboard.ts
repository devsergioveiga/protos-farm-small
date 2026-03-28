import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AccountingDashboardOutput } from '@/types/financial-statements';

export function useAccountingDashboard(
  orgId: string | undefined,
  fiscalYearId: string | null,
  month: number | null,
) {
  const [data, setData] = useState<AccountingDashboardOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!orgId || !fiscalYearId || !month) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fiscalYearId,
        month: String(month),
      });
      const result = await api.get<AccountingDashboardOutput>(
        `/org/${orgId}/accounting-dashboard?${params.toString()}`,
      );
      setData(result);
    } catch {
      setError('Nao foi possivel carregar o dashboard. Verifique sua conexao e tente novamente.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, fiscalYearId, month]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refetch: fetchDashboard };
}
