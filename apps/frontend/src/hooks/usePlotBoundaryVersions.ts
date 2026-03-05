import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { PlotBoundaryVersionItem } from '@/types/farm';

interface UsePlotBoundaryVersionsReturn {
  versions: PlotBoundaryVersionItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePlotBoundaryVersions(
  farmId: string | undefined,
  plotId: string | undefined,
): UsePlotBoundaryVersionsReturn {
  const [versions, setVersions] = useState<PlotBoundaryVersionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!farmId || !plotId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<PlotBoundaryVersionItem[]>(
        `/org/farms/${farmId}/plots/${plotId}/boundary/versions`,
      );
      setVersions(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar versões do perímetro';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, plotId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { versions, isLoading, error, refetch };
}
