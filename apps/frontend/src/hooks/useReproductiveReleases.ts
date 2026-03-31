import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { ReleaseItem } from '@/types/reproductive-release';
import type { PaginationMeta } from '@/types/admin';

interface UseReproductiveReleasesParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
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

  const { farmId, page, limit, search, dateFrom, dateTo } = params;

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
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/reproductive-releases${qs ? `?${qs}` : ''}`;
      const result = await api.get<{ data: ReleaseItem[]; total: number }>(path);
      setReleases(result.data);
      const currentLimit = limit ?? 50;
      setMeta({
        page: page ?? 1,
        limit: currentLimit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / currentLimit)),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar liberações reprodutivas';
      setError(message);
      setReleases([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, search, dateFrom, dateTo]);

  useEffect(() => {
    void fetchReleases();
  }, [fetchReleases]);

  return { releases, meta, isLoading, error, refetch: fetchReleases };
}
