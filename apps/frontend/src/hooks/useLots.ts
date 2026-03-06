import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { LotListItem, LotsResponse } from '@/types/lot';
import type { PaginationMeta } from '@/types/admin';

interface UseLotsParams {
  farmId: string | null;
  search?: string;
  page?: number;
  limit?: number;
  category?: string;
  locationType?: string;
}

interface UseLotsResult {
  lots: LotListItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLots(params: UseLotsParams): UseLotsResult {
  const [lots, setLots] = useState<LotListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, search, page, limit, category, locationType } = params;

  const fetchLots = useCallback(async () => {
    if (!farmId) {
      setLots([]);
      setMeta(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (category) query.set('category', category);
      if (locationType) query.set('locationType', locationType);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/lots${qs ? `?${qs}` : ''}`;
      const result = await api.get<LotsResponse>(path);
      setLots(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar lotes';
      setError(message);
      setLots([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, search, page, limit, category, locationType]);

  useEffect(() => {
    void fetchLots();
  }, [fetchLots]);

  return { lots, meta, isLoading, error, refetch: fetchLots };
}
