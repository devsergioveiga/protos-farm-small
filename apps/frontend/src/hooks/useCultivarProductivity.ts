import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { CultivarProductivityComparison } from '@/types/cultivar';

interface UseCultivarProductivityParams {
  farmId: string | null;
  crop?: string;
}

interface UseCultivarProductivityResult {
  productivity: CultivarProductivityComparison[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCultivarProductivity(
  params: UseCultivarProductivityParams,
): UseCultivarProductivityResult {
  const [productivity, setProductivity] = useState<CultivarProductivityComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, crop } = params;

  const fetchProductivity = useCallback(async () => {
    if (!farmId) {
      setProductivity([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (crop) query.set('crop', crop);
      const qs = query.toString();
      const path = `/org/farms/${farmId}/cultivars/productivity${qs ? `?${qs}` : ''}`;
      const result = await api.get<CultivarProductivityComparison[]>(path);
      setProductivity(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar dados de produtividade';
      setError(message);
      setProductivity([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, crop]);

  useEffect(() => {
    void fetchProductivity();
  }, [fetchProductivity]);

  return { productivity, isLoading, error, refetch: fetchProductivity };
}
