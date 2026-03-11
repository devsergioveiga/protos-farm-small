import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { PestItem, PestsResponse } from '@/types/pest';
import type { PaginationMeta } from '@/types/admin';

interface UsePestsParams {
  page?: number;
  limit?: number;
  category?: string;
  crop?: string;
  search?: string;
}

interface UsePestsResult {
  pests: PestItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePests(params: UsePestsParams): UsePestsResult {
  const [pests, setPests] = useState<PestItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, category, crop, search } = params;

  const fetchPests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (category) query.set('category', category);
      if (crop) query.set('crop', crop);

      const qs = query.toString();
      const path = `/org/pests${qs ? `?${qs}` : ''}`;
      const result = await api.get<PestsResponse>(path);
      setPests(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar pragas/doenças';
      setError(message);
      setPests([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, category, crop, search]);

  useEffect(() => {
    void fetchPests();
  }, [fetchPests]);

  return { pests, meta, isLoading, error, refetch: fetchPests };
}
