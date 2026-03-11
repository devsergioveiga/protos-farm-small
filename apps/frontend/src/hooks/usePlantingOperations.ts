import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { PlantingItem, PlantingResponse } from '@/types/planting';
import type { PaginationMeta } from '@/types/admin';

interface UsePlantingParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  fieldPlotId?: string;
  search?: string;
  crop?: string;
  seasonYear?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UsePlantingResult {
  operations: PlantingItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePlantingOperations(params: UsePlantingParams): UsePlantingResult {
  const [operations, setOperations] = useState<PlantingItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, fieldPlotId, search, crop, seasonYear, dateFrom, dateTo } = params;

  const fetchOperations = useCallback(async () => {
    if (!farmId) {
      setOperations([]);
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
      if (search) query.set('search', search);
      if (crop) query.set('crop', crop);
      if (seasonYear) query.set('seasonYear', seasonYear);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/planting-operations${qs ? `?${qs}` : ''}`;
      const result = await api.get<PlantingResponse>(path);
      setOperations(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar plantios';
      setError(message);
      setOperations([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, fieldPlotId, search, crop, seasonYear, dateFrom, dateTo]);

  useEffect(() => {
    void fetchOperations();
  }, [fetchOperations]);

  return { operations, meta, isLoading, error, refetch: fetchOperations };
}
