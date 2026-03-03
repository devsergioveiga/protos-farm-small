import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { ProducerListItem, ProducersResponse } from '@/types/producer';
import type { PaginationMeta } from '@/types/admin';

interface UseProducersParams {
  search?: string;
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
}

interface UseProducersResult {
  producers: ProducerListItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProducers(params: UseProducersParams = {}): UseProducersResult {
  const [producers, setProducers] = useState<ProducerListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, page, limit, type, status } = params;

  const fetchProducers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (type) query.set('type', type);
      if (status) query.set('status', status);

      const qs = query.toString();
      const path = `/org/producers${qs ? `?${qs}` : ''}`;
      const result = await api.get<ProducersResponse>(path);
      setProducers(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar produtores';
      setError(message);
      setProducers([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [search, page, limit, type, status]);

  useEffect(() => {
    void fetchProducers();
  }, [fetchProducers]);

  return { producers, meta, isLoading, error, refetch: fetchProducers };
}
