import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { PlotSeasonComparison } from '@/types/productivity-map';

interface UseSeasonComparisonParams {
  farmId: string | null;
  fieldPlotId?: string;
}

interface UseSeasonComparisonResult {
  data: PlotSeasonComparison[];
  isLoading: boolean;
  error: string | null;
}

export function useSeasonComparison(params: UseSeasonComparisonParams): UseSeasonComparisonResult {
  const [data, setData] = useState<PlotSeasonComparison[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!params.farmId) {
      setData([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      if (params.fieldPlotId) searchParams.set('fieldPlotId', params.fieldPlotId);
      const qs = searchParams.toString();
      const url = `/org/farms/${params.farmId}/productivity-map/seasons${qs ? `?${qs}` : ''}`;
      const result = await api.get<PlotSeasonComparison[]>(url);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar comparativo';
      setError(message);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [params.farmId, params.fieldPlotId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, isLoading, error };
}
