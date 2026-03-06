import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AnimalMovementItem, AnimalMovementStats } from '@/types/animal';

interface UseAnimalMovementsResult {
  movements: AnimalMovementItem[];
  stats: AnimalMovementStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAnimalMovements(
  farmId: string | null,
  animalId: string | null,
): UseAnimalMovementsResult {
  const [movements, setMovements] = useState<AnimalMovementItem[]>([]);
  const [stats, setStats] = useState<AnimalMovementStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const basePath = farmId && animalId ? `/org/farms/${farmId}/animals/${animalId}/movements` : null;

  const fetchData = useCallback(async () => {
    if (!basePath) {
      setMovements([]);
      setStats(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [movementsData, statsData] = await Promise.all([
        api.get<AnimalMovementItem[]>(basePath),
        api.get<AnimalMovementStats>(`${basePath}/stats`),
      ]);
      setMovements(movementsData);
      setStats(statsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar movimentações';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    movements,
    stats,
    isLoading,
    error,
    refetch: fetchData,
  };
}
