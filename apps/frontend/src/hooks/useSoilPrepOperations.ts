import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { SoilPrepItem, SoilPrepResponse } from '@/types/soil-prep';
import type { PaginationMeta } from '@/types/admin';

interface UseSoilPrepParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  fieldPlotId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseSoilPrepResult {
  operations: SoilPrepItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSoilPrepOperations(params: UseSoilPrepParams): UseSoilPrepResult {
  const [operations, setOperations] = useState<SoilPrepItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, fieldPlotId, search, dateFrom, dateTo } = params;

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
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/soil-prep-operations${qs ? `?${qs}` : ''}`;
      const result = await api.get<SoilPrepResponse>(path);
      setOperations(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar operações';
      setError(message);
      setOperations([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, fieldPlotId, search, dateFrom, dateTo]);

  useEffect(() => {
    void fetchOperations();
  }, [fetchOperations]);

  return { operations, meta, isLoading, error, refetch: fetchOperations };
}
