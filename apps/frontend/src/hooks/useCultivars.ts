import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { CultivarItem, CultivarsResponse } from '@/types/cultivar';
import type { PaginationMeta } from '@/types/admin';

interface UseCultivarsParams {
  page?: number;
  limit?: number;
  crop?: string;
  search?: string;
}

interface UseCultivarsResult {
  cultivars: CultivarItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCultivars(params: UseCultivarsParams): UseCultivarsResult {
  const [cultivars, setCultivars] = useState<CultivarItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, crop, search } = params;

  const fetchCultivars = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (crop) query.set('crop', crop);

      const qs = query.toString();
      const path = `/org/cultivars${qs ? `?${qs}` : ''}`;
      const result = await api.get<CultivarsResponse>(path);
      setCultivars(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar cultivares';
      setError(message);
      setCultivars([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, crop, search]);

  useEffect(() => {
    void fetchCultivars();
  }, [fetchCultivars]);

  return { cultivars, meta, isLoading, error, refetch: fetchCultivars };
}
