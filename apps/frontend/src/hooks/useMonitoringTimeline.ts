import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  TimelineDataPoint,
  TimelineSummary,
  TimelineResponse,
} from '@/types/monitoring-record';

interface UseMonitoringTimelineParams {
  farmId: string;
  fieldPlotId: string;
  pestIds?: string[];
  startDate?: string;
  endDate?: string;
  aggregation?: 'daily' | 'weekly' | 'monthly';
}

interface UseMonitoringTimelineResult {
  data: TimelineDataPoint[];
  summary: TimelineSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMonitoringTimeline(
  params: UseMonitoringTimelineParams,
): UseMonitoringTimelineResult {
  const [data, setData] = useState<TimelineDataPoint[]>([]);
  const [summary, setSummary] = useState<TimelineSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, fieldPlotId, pestIds, startDate, endDate, aggregation } = params;
  const pestIdsKey = pestIds?.join(',') ?? '';

  const fetchTimeline = useCallback(async () => {
    if (!farmId || !fieldPlotId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (pestIds && pestIds.length > 0) query.set('pestIds', pestIds.join(','));
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);
      if (aggregation) query.set('aggregation', aggregation);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/field-plots/${fieldPlotId}/monitoring-timeline${qs ? `?${qs}` : ''}`;
      const result = await api.get<TimelineResponse>(path);
      setData(result.data);
      setSummary(result.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados do histórico';
      setError(message);
      setData([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, fieldPlotId, pestIdsKey, startDate, endDate, aggregation]);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  return { data, summary, isLoading, error, refetch: fetchTimeline };
}
