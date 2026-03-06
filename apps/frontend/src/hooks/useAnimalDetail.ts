import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AnimalDetail } from '@/types/animal';

interface UseAnimalDetailResult {
  animal: AnimalDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAnimalDetail(
  farmId: string | null,
  animalId: string | null,
): UseAnimalDetailResult {
  const [animal, setAnimal] = useState<AnimalDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnimal = useCallback(async () => {
    if (!farmId || !animalId) {
      setAnimal(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<AnimalDetail>(`/org/farms/${farmId}/animals/${animalId}`);
      setAnimal(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar animal';
      setError(message);
      setAnimal(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, animalId]);

  useEffect(() => {
    void fetchAnimal();
  }, [fetchAnimal]);

  return { animal, isLoading, error, refetch: fetchAnimal };
}
