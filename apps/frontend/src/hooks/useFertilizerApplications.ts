import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  FertilizerApplicationItem,
  FertilizerApplicationsResponse,
} from '@/types/fertilizer-application';
import type { PaginationMeta } from '@/types/admin';

interface UseFertilizerApplicationsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  fieldPlotId?: string;
  applicationType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseFertilizerApplicationsResult {
  applications: FertilizerApplicationItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFertilizerApplications(
  params: UseFertilizerApplicationsParams,
): UseFertilizerApplicationsResult {
  const [applications, setApplications] = useState<FertilizerApplicationItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, fieldPlotId, applicationType, search, dateFrom, dateTo } = params;

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
      if (applicationType) query.set('applicationType', applicationType);
      if (search) query.set('search', search);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/fertilizer-applications${qs ? `?${qs}` : ''}`;
      const result = await api.get<FertilizerApplicationsResponse>(path);
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
  }, [farmId, page, limit, fieldPlotId, applicationType, search, dateFrom, dateTo]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  return { applications, meta, isLoading, error, refetch: fetchApplications };
}
