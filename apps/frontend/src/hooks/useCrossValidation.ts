import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { CrossValidationOutput } from '@/types/financial-statements';

export interface CrossValidationFilters {
  fiscalYearId: string;
  month: number;
}

export function useCrossValidation(
  orgId: string | undefined,
  filters: CrossValidationFilters | null,
) {
  const [data, setData] = useState<CrossValidationOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCrossValidation = useCallback(async () => {
    if (!orgId || !filters) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fiscalYearId: filters.fiscalYearId,
        month: String(filters.month),
      });
      const result = await api.get<CrossValidationOutput>(
        `/org/${orgId}/financial-statements/cross-validation?${params.toString()}`,
      );
      setData(result);
    } catch {
      setError('Nao foi possivel carregar as validacoes. Tente novamente.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, filters]);

  useEffect(() => {
    void fetchCrossValidation();
  }, [fetchCrossValidation]);

  return { data, loading, error, refetch: fetchCrossValidation };
}
