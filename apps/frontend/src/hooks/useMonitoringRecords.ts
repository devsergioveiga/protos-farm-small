import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { MonitoringRecordItem, MonitoringRecordsResponse } from '@/types/monitoring-record';
import type { PaginationMeta } from '@/types/admin';

interface UseMonitoringRecordsParams {
  farmId: string;
  fieldPlotId: string;
  page?: number;
  limit?: number;
  monitoringPointId?: string;
  pestId?: string;
  infestationLevel?: string;
  startDate?: string;
  endDate?: string;
}

interface UseMonitoringRecordsResult {
  records: MonitoringRecordItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMonitoringRecords(
  params: UseMonitoringRecordsParams,
): UseMonitoringRecordsResult {
  const [records, setRecords] = useState<MonitoringRecordItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    farmId,
    fieldPlotId,
    page,
    limit,
    monitoringPointId,
    pestId,
    infestationLevel,
    startDate,
    endDate,
  } = params;

  const fetchRecords = useCallback(async () => {
    if (!farmId || !fieldPlotId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (monitoringPointId) query.set('monitoringPointId', monitoringPointId);
      if (pestId) query.set('pestId', pestId);
      if (infestationLevel) query.set('infestationLevel', infestationLevel);
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/field-plots/${fieldPlotId}/monitoring-records${qs ? `?${qs}` : ''}`;
      const result = await api.get<MonitoringRecordsResponse>(path);
      setRecords(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar registros de monitoramento';
      setError(message);
      setRecords([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    farmId,
    fieldPlotId,
    page,
    limit,
    monitoringPointId,
    pestId,
    infestationLevel,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  return { records, meta, isLoading, error, refetch: fetchRecords };
}
