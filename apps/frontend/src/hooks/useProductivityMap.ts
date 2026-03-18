import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { CultureType, ProductivityMapResponse } from '@/types/productivity-map';

interface UseProductivityMapParams {
  farmId: string | null;
  cultureType?: CultureType;
  crop?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseProductivityMapResult {
  data: ProductivityMapResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProductivityMap(params: UseProductivityMapParams): UseProductivityMapResult {
  const [data, setData] = useState<ProductivityMapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!params.farmId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      if (params.cultureType) searchParams.set('cultureType', params.cultureType);
      if (params.crop) searchParams.set('crop', params.crop);
      if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
      if (params.dateTo) searchParams.set('dateTo', params.dateTo);

      const qs = searchParams.toString();
      const url = `/org/farms/${params.farmId}/productivity-map${qs ? `?${qs}` : ''}`;
      const result = await api.get<ProductivityMapResponse>(url);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar mapa de produtividade';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [params.farmId, params.cultureType, params.crop, params.dateFrom, params.dateTo]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
