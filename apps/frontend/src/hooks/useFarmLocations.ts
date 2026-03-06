import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FarmLocationMapItem } from '@/types/farm-location';

interface UseFarmLocationsResult {
  locations: FarmLocationMapItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFarmLocations(farmId: string | undefined): UseFarmLocationsResult {
  const [locations, setLocations] = useState<FarmLocationMapItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!farmId) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<FarmLocationMapItem[]>(`/org/farms/${farmId}/locations/map`);
      setLocations(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar locais';
      setError(message);
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  return { locations, isLoading, error, refetch: fetchLocations };
}
