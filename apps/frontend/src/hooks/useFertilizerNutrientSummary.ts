import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { NutrientSummaryItem } from '@/types/fertilizer-application';

interface UseFertilizerNutrientSummaryResult {
  summary: NutrientSummaryItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFertilizerNutrientSummary(
  farmId: string | null,
  seasonYear?: string,
): UseFertilizerNutrientSummaryResult {
  const [summary, setSummary] = useState<NutrientSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!farmId) {
      setSummary([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (seasonYear) query.set('seasonYear', seasonYear);
      const qs = query.toString();
      const path = `/org/farms/${farmId}/fertilizer-applications/nutrient-summary${qs ? `?${qs}` : ''}`;
      const result = await api.get<NutrientSummaryItem[]>(path);
      setSummary(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar acumulado de nutrientes';
      setError(message);
      setSummary([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, seasonYear]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return { summary, isLoading, error, refetch: fetchSummary };
}
