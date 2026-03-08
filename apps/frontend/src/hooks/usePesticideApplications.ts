import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  PesticideApplicationItem,
  PesticideApplicationsResponse,
} from '@/types/pesticide-application';
import type { PaginationMeta } from '@/types/admin';

interface UsePesticideApplicationsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  fieldPlotId?: string;
  target?: string;
  search?: string;
}

interface UsePesticideApplicationsResult {
  applications: PesticideApplicationItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePesticideApplications(
  params: UsePesticideApplicationsParams,
): UsePesticideApplicationsResult {
  const [applications, setApplications] = useState<PesticideApplicationItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, fieldPlotId, target, search } = params;

  const fetchApplications = useCallback(async () => {
    if (!farmId) {
      setApplications([]);
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
      if (fieldPlotId) query.set('fieldPlotId', fieldPlotId);
      if (target) query.set('target', target);
      if (search) query.set('search', search);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/pesticide-applications${qs ? `?${qs}` : ''}`;
      const result = await api.get<PesticideApplicationsResponse>(path);
      setApplications(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar aplicações';
      setError(message);
      setApplications([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, fieldPlotId, target, search]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  return { applications, meta, isLoading, error, refetch: fetchApplications };
}
