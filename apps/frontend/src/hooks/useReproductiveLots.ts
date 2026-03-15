import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { ReproductiveLotItem, ReproductiveLotsResponse } from '@/types/iatf-execution';

interface UseReproductiveLotsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  status?: string;
}

interface UseReproductiveLotsResult {
  lots: ReproductiveLotItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useReproductiveLots(params: UseReproductiveLotsParams): UseReproductiveLotsResult {
  const [lots, setLots] = useState<ReproductiveLotItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, status } = params;

  const fetchLots = useCallback(async () => {
    if (!farmId) {
      setLots([]);
      setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (status) query.set('status', status);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/reproductive-lots${qs ? `?${qs}` : ''}`;
      const result = await api.get<ReproductiveLotsResponse>(path);
      setLots(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar lotes reprodutivos';
      setError(message);
      setLots([]);
      setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, status]);

  useEffect(() => {
    void fetchLots();
  }, [fetchLots]);

  return { lots, meta, isLoading, error, refetch: fetchLots };
}
