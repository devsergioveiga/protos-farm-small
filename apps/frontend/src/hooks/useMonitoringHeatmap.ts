import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { HeatmapPoint, HeatmapResponse } from '@/types/monitoring-record';

interface UseMonitoringHeatmapParams {
  farmId: string;
  fieldPlotId: string;
  pestId?: string;
  startDate?: string;
  endDate?: string;
}

interface UseMonitoringHeatmapResult {
  points: HeatmapPoint[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMonitoringHeatmap(
  params: UseMonitoringHeatmapParams,
): UseMonitoringHeatmapResult {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, fieldPlotId, pestId, startDate, endDate } = params;

  const fetchHeatmap = useCallback(async () => {
    if (!farmId || !fieldPlotId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (pestId) query.set('pestId', pestId);
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/field-plots/${fieldPlotId}/monitoring-heatmap${qs ? `?${qs}` : ''}`;
      const result = await api.get<HeatmapResponse>(path);
      setPoints(result.data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar dados do mapa de calor';
      setError(message);
      setPoints([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, fieldPlotId, pestId, startDate, endDate]);

  useEffect(() => {
    void fetchHeatmap();
  }, [fetchHeatmap]);

  return { points, isLoading, error, refetch: fetchHeatmap };
}
