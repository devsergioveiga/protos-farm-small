import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { SanitaryProtocol, SanitaryProtocolsResponse } from '@/types/sanitary-protocol';
import type { PaginationMeta } from '@/types/admin';

interface UseSanitaryProtocolsParams {
  page?: number;
  limit?: number;
  status?: string;
  procedureType?: string;
  targetCategory?: string;
  search?: string;
}

interface UseSanitaryProtocolsResult {
  protocols: SanitaryProtocol[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSanitaryProtocols(
  params: UseSanitaryProtocolsParams,
): UseSanitaryProtocolsResult {
  const [protocols, setProtocols] = useState<SanitaryProtocol[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, status, procedureType, targetCategory, search } = params;

  const fetchProtocols = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (status) query.set('status', status);
      if (procedureType) query.set('procedureType', procedureType);
      if (targetCategory) query.set('targetCategory', targetCategory);

      const qs = query.toString();
      const path = `/org/sanitary-protocols${qs ? `?${qs}` : ''}`;
      const result = await api.get<SanitaryProtocolsResponse>(path);
      setProtocols(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar protocolos sanitários';
      setError(message);
      setProtocols([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, status, procedureType, targetCategory, search]);

  useEffect(() => {
    void fetchProtocols();
  }, [fetchProtocols]);

  return { protocols, meta, isLoading, error, refetch: fetchProtocols };
}
