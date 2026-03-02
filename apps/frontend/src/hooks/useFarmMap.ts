import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FarmDetail, BoundaryInfo, FieldPlot } from '@/types/farm';

interface RegistrationBoundary {
  registrationId: string;
  boundary: BoundaryInfo;
}

interface PlotBoundary {
  plotId: string;
  plot: FieldPlot;
  boundary: BoundaryInfo;
}

export interface FarmMapData {
  farm: FarmDetail;
  farmBoundary: BoundaryInfo;
  registrationBoundaries: RegistrationBoundary[];
  plotBoundaries: PlotBoundary[];
}

interface UseFarmMapResult {
  data: FarmMapData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFarmMap(farmId: string | undefined): UseFarmMapResult {
  const [data, setData] = useState<FarmMapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!farmId) return;

    setIsLoading(true);
    setError(null);
    try {
      const [farm, plots] = await Promise.all([
        api.get<FarmDetail>(`/org/farms/${farmId}`),
        api.get<FieldPlot[]>(`/org/farms/${farmId}/plots`).catch(() => [] as FieldPlot[]),
      ]);

      const [farmBoundary, ...rest] = await Promise.all([
        api.get<BoundaryInfo>(`/org/farms/${farmId}/boundary`),
        ...farm.registrations.map((reg) =>
          api
            .get<BoundaryInfo>(`/org/farms/${farmId}/registrations/${reg.id}/boundary`)
            .then((boundary) => ({ type: 'reg' as const, registrationId: reg.id, boundary })),
        ),
        ...plots.map((plot) =>
          api
            .get<BoundaryInfo>(`/org/farms/${farmId}/plots/${plot.id}/boundary`)
            .then((boundary) => ({ type: 'plot' as const, plotId: plot.id, plot, boundary }))
            .catch(() => null),
        ),
      ]);

      const regBoundaries: RegistrationBoundary[] = [];
      const plotBoundaries: PlotBoundary[] = [];

      for (const item of rest) {
        if (!item) continue;
        if (item.type === 'reg') {
          regBoundaries.push({ registrationId: item.registrationId, boundary: item.boundary });
        } else {
          plotBoundaries.push({ plotId: item.plotId, plot: item.plot, boundary: item.boundary });
        }
      }

      setData({
        farm,
        farmBoundary,
        registrationBoundaries: regBoundaries,
        plotBoundaries,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados do mapa';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
