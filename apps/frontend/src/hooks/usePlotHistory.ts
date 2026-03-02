import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { CropSeasonItem, SoilAnalysisItem, RotationIndicator } from '@/types/farm';

interface PlotHistoryData {
  seasons: CropSeasonItem[];
  analyses: SoilAnalysisItem[];
  rotation: RotationIndicator;
}

interface UsePlotHistoryReturn {
  data: PlotHistoryData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePlotHistory(
  farmId: string | undefined,
  plotId: string | undefined,
): UsePlotHistoryReturn {
  const [data, setData] = useState<PlotHistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!farmId || !plotId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [seasons, analyses, rotation] = await Promise.all([
        api.get<CropSeasonItem[]>(`/org/farms/${farmId}/plots/${plotId}/crop-seasons`),
        api.get<SoilAnalysisItem[]>(`/org/farms/${farmId}/plots/${plotId}/soil-analyses`),
        api.get<RotationIndicator>(`/org/farms/${farmId}/plots/${plotId}/rotation-indicator`),
      ]);

      setData({ seasons, analyses, rotation });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar histórico';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, plotId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
