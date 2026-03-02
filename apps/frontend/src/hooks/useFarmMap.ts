import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FarmDetail, BoundaryInfo } from '@/types/farm';

interface RegistrationBoundary {
  registrationId: string;
  boundary: BoundaryInfo;
}

export interface FarmMapData {
  farm: FarmDetail;
  farmBoundary: BoundaryInfo;
  registrationBoundaries: RegistrationBoundary[];
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
      const farm = await api.get<FarmDetail>(`/org/farms/${farmId}`);

      const [farmBoundary, ...regBoundaries] = await Promise.all([
        api.get<BoundaryInfo>(`/org/farms/${farmId}/boundary`),
        ...farm.registrations.map((reg) =>
          api
            .get<BoundaryInfo>(`/org/farms/${farmId}/registrations/${reg.id}/boundary`)
            .then((boundary) => ({ registrationId: reg.id, boundary })),
        ),
      ]);

      setData({
        farm,
        farmBoundary,
        registrationBoundaries: regBoundaries,
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
