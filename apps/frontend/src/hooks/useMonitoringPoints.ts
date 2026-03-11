import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { MonitoringPointItem, MonitoringPointsResponse } from '@/types/monitoring-point';
import type { PaginationMeta } from '@/types/admin';

interface UseMonitoringPointsParams {
  farmId: string;
  fieldPlotId: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface UseMonitoringPointsResult {
  points: MonitoringPointItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMonitoringPoints(params: UseMonitoringPointsParams): UseMonitoringPointsResult {
  const [points, setPoints] = useState<MonitoringPointItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, fieldPlotId, page, limit, search } = params;

  const fetchPoints = useCallback(async () => {
    if (!farmId || !fieldPlotId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));

      const qs = query.toString();
      const path = `/org/farms/${farmId}/field-plots/${fieldPlotId}/monitoring-points${qs ? `?${qs}` : ''}`;
      const result = await api.get<MonitoringPointsResponse>(path);
      setPoints(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar pontos de monitoramento';
      setError(message);
      setPoints([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, fieldPlotId, page, limit, search]);

  useEffect(() => {
    void fetchPoints();
  }, [fetchPoints]);

  return { points, meta, isLoading, error, refetch: fetchPoints };
}
