import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { BreedItem } from '@/types/animal';

interface UseBreedsResult {
  breeds: BreedItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBreeds(): UseBreedsResult {
  const [breeds, setBreeds] = useState<BreedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBreeds = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<BreedItem[]>('/org/breeds');
      setBreeds(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar raças';
      setError(message);
      setBreeds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBreeds();
  }, [fetchBreeds]);

  return { breeds, isLoading, error, refetch: fetchBreeds };
}
