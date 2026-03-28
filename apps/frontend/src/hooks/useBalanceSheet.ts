import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { BpOutput } from '@/types/financial-statements';

export interface BalanceSheetFilters {
  fiscalYearId: string;
  month: number;
}

export function useBalanceSheet(orgId: string | undefined, filters: BalanceSheetFilters | null) {
  const [data, setData] = useState<BpOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalanceSheet = useCallback(async () => {
    if (!orgId || !filters) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fiscalYearId: filters.fiscalYearId,
        month: String(filters.month),
      });
      const result = await api.get<BpOutput>(
        `/org/${orgId}/financial-statements/balance-sheet?${params.toString()}`,
      );
      setData(result);
    } catch {
      setError(
        'Não foi possível carregar o Balanço Patrimonial. Verifique sua conexão e tente novamente.',
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, filters]);

  useEffect(() => {
    void fetchBalanceSheet();
  }, [fetchBalanceSheet]);

  return { data, loading, error, refetch: fetchBalanceSheet };
}
