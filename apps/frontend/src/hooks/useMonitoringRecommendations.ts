import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  RecommendationItem,
  RecommendationSummary,
  RecommendationsResponse,
} from '@/types/monitoring-record';

interface UseMonitoringRecommendationsParams {
  farmId: string;
  fieldPlotId: string;
  pestId?: string;
  urgency?: 'ALERTA' | 'CRITICO';
}

interface UseMonitoringRecommendationsResult {
  recommendations: RecommendationItem[];
  summary: RecommendationSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMonitoringRecommendations(
  params: UseMonitoringRecommendationsParams,
): UseMonitoringRecommendationsResult {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [summary, setSummary] = useState<RecommendationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, fieldPlotId, pestId, urgency } = params;

  const fetchRecommendations = useCallback(async () => {
    if (!farmId || !fieldPlotId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (pestId) query.set('pestId', pestId);
      if (urgency) query.set('urgency', urgency);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/field-plots/${fieldPlotId}/monitoring-recommendations${qs ? `?${qs}` : ''}`;
      const result = await api.get<RecommendationsResponse>(path);
      setRecommendations(result.data);
      setSummary(result.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar recomendações';
      setError(message);
      setRecommendations([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, fieldPlotId, pestId, urgency]);

  useEffect(() => {
    void fetchRecommendations();
  }, [fetchRecommendations]);

  return { recommendations, summary, isLoading, error, refetch: fetchRecommendations };
}
