import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DepreciationProjectionRow {
  year: number;
  month: number;
  projectedDepreciation: number;
  cumulativeDepreciation: number;
  remainingBookValue: number;
}

export interface DepreciationProjectionResult {
  rows: DepreciationProjectionRow[];
  assetsIncluded: number;
  assetsEstimated: number;
  generatedAt: string;
}

export interface UseDepreciationProjectionParams {
  horizonMonths: 12 | 36 | 60;
  farmId?: string;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useDepreciationProjection(params: UseDepreciationProjectionParams) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [data, setData] = useState<DepreciationProjectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjection = useCallback(async (): Promise<DepreciationProjectionResult | null> => {
    if (!orgId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('horizonMonths', String(params.horizonMonths));
      if (params.farmId) qs.set('farmId', params.farmId);
      const result = await api.get<DepreciationProjectionResult>(
        `/orgs/${orgId}/asset-reports/depreciation-projection?${qs.toString()}`,
      );
      setData(result);
      return result;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar a projecao de depreciacao. Verifique sua conexao.';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [orgId, params.horizonMonths, params.farmId]);

  useEffect(() => {
    if (orgId) {
      void fetchProjection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, params.horizonMonths, params.farmId]);

  return {
    data,
    isLoading,
    error,
    fetchProjection,
  };
}
