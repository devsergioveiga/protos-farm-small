import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { CoffeeHarvestItem, CoffeeHarvestsResponse } from '@/types/coffee-harvest';
import type { PaginationMeta } from '@/types/admin';

interface UseCoffeeHarvestsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  fieldPlotId?: string;
  harvestType?: string;
  isSpecialLot?: boolean;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseCoffeeHarvestsResult {
  harvests: CoffeeHarvestItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCoffeeHarvests(params: UseCoffeeHarvestsParams): UseCoffeeHarvestsResult {
  const [harvests, setHarvests] = useState<CoffeeHarvestItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, fieldPlotId, harvestType, isSpecialLot, search, dateFrom, dateTo } =
    params;

  const fetchHarvests = useCallback(async () => {
    if (!farmId) {
      setHarvests([]);
      setMeta(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (fieldPlotId) query.set('fieldPlotId', fieldPlotId);
      if (harvestType) query.set('harvestType', harvestType);
      if (isSpecialLot !== undefined) query.set('isSpecialLot', String(isSpecialLot));
      if (search) query.set('search', search);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/coffee-harvests${qs ? `?${qs}` : ''}`;
      const result = await api.get<CoffeeHarvestsResponse>(path);
      setHarvests(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar colheitas de café';
      setError(message);
      setHarvests([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, fieldPlotId, harvestType, isSpecialLot, search, dateFrom, dateTo]);

  useEffect(() => {
    void fetchHarvests();
  }, [fetchHarvests]);

  return { harvests, meta, isLoading, error, refetch: fetchHarvests };
}
