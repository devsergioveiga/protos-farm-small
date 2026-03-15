import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { ReleaseItem, ReleasesResponse } from '@/types/reproductive-release';
import type { PaginationMeta } from '@/types/admin';

interface UseReproductiveReleasesParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  search?: string;
}

interface UseReproductiveReleasesResult {
  releases: ReleaseItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useReproductiveReleases(
  params: UseReproductiveReleasesParams,
): UseReproductiveReleasesResult {
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, search } = params;

  const fetchReleases = useCallback(async () => {
    if (!farmId) {
      setReleases([]);
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

      const qs = query.toString();
      const path = `/org/farms/${farmId}/reproductive-releases${qs ? `?${qs}` : ''}`;
      const result = await api.get<ReleasesResponse>(path);
      setReleases(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar liberações reprodutivas';
      setError(message);
      setReleases([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, search]);

  useEffect(() => {
    void fetchReleases();
  }, [fetchReleases]);

  return { releases, meta, isLoading, error, refetch: fetchReleases };
}
