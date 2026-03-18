import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { IatfProtocolItem, IatfProtocolsResponse } from '@/types/iatf-protocol';
import type { PaginationMeta } from '@/types/admin';

interface UseIatfProtocolsParams {
  page?: number;
  limit?: number;
  status?: string;
  targetCategory?: string;
  search?: string;
}

interface UseIatfProtocolsResult {
  protocols: IatfProtocolItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useIatfProtocols(params: UseIatfProtocolsParams): UseIatfProtocolsResult {
  const [protocols, setProtocols] = useState<IatfProtocolItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, status, targetCategory, search } = params;

  const fetchProtocols = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (status) query.set('status', status);
      if (targetCategory) query.set('targetCategory', targetCategory);

      const qs = query.toString();
      const path = `/org/iatf-protocols${qs ? `?${qs}` : ''}`;
      const result = await api.get<IatfProtocolsResponse>(path);
      setProtocols(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar protocolos IATF';
      setError(message);
      setProtocols([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, status, targetCategory, search]);

  useEffect(() => {
    void fetchProtocols();
  }, [fetchProtocols]);

  return { protocols, meta, isLoading, error, refetch: fetchProtocols };
}
