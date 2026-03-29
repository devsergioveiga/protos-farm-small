import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FarmWeighingItem, FarmWeighingsResponse } from '@/types/animal';
import type { PaginationMeta } from '@/types/admin';

interface UseFarmWeighingsParams {
  farmId: string | null;
  page?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  lotId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UseFarmWeighingsResult {
  weighings: FarmWeighingItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFarmWeighings(params: UseFarmWeighingsParams): UseFarmWeighingsResult {
  const [weighings, setWeighings] = useState<FarmWeighingItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, dateFrom, dateTo, search, lotId, sortBy, sortOrder } = params;

  const fetch = useCallback(async () => {
    if (!farmId) {
      setWeighings([]);
      setMeta(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      if (search) query.set('search', search);
      if (lotId) query.set('lotId', lotId);
      if (sortBy) query.set('sortBy', sortBy);
      if (sortOrder) query.set('sortOrder', sortOrder);
      query.set('limit', '30');

      const qs = query.toString();
      const result = await api.get<FarmWeighingsResponse>(
        `/org/farms/${farmId}/weighings${qs ? `?${qs}` : ''}`,
      );
      setWeighings(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar pesagens';
      setError(message);
      setWeighings([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, dateFrom, dateTo, search, lotId, sortBy, sortOrder]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { weighings, meta, isLoading, error, refetch: fetch };
}
