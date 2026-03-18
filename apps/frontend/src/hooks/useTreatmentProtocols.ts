import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { ProtocolItem, ProtocolsResponse } from '@/types/treatment-protocol';
import type { PaginationMeta } from '@/types/admin';

interface UseTreatmentProtocolsParams {
  page?: number;
  limit?: number;
  status?: string;
  diseaseId?: string;
  search?: string;
}

interface UseTreatmentProtocolsResult {
  protocols: ProtocolItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTreatmentProtocols(
  params: UseTreatmentProtocolsParams,
): UseTreatmentProtocolsResult {
  const [protocols, setProtocols] = useState<ProtocolItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, status, diseaseId, search } = params;

  const fetchProtocols = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (status) query.set('status', status);
      if (diseaseId) query.set('diseaseId', diseaseId);

      const qs = query.toString();
      const path = `/org/treatment-protocols${qs ? `?${qs}` : ''}`;
      const result = await api.get<ProtocolsResponse>(path);
      setProtocols(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar protocolos de tratamento';
      setError(message);
      setProtocols([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, status, diseaseId, search]);

  useEffect(() => {
    void fetchProtocols();
  }, [fetchProtocols]);

  return { protocols, meta, isLoading, error, refetch: fetchProtocols };
}
