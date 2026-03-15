import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { BullItem, BullsResponse } from '@/types/bull';
import type { PaginationMeta } from '@/types/admin';

interface UseBullsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

interface UseBullsResult {
  bulls: BullItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBulls(params: UseBullsParams): UseBullsResult {
  const [bulls, setBulls] = useState<BullItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, search, status } = params;

  const fetchBulls = useCallback(async () => {
    if (!farmId) {
      setBulls([]);
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
      if (search) query.set('search', search);
      if (status) query.set('status', status);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/bulls${qs ? `?${qs}` : ''}`;
      const result = await api.get<BullsResponse>(path);
      setBulls(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar touros';
      setError(message);
      setBulls([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, search, status]);

  useEffect(() => {
    void fetchBulls();
  }, [fetchBulls]);

  return { bulls, meta, isLoading, error, refetch: fetchBulls };
}
