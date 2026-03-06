import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { WeighingItem, WeighingStats } from '@/types/animal';

interface UseAnimalWeighingsResult {
  weighings: WeighingItem[];
  stats: WeighingStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createWeighing: (input: {
    weightKg: number;
    measuredAt: string;
    bodyConditionScore?: number | null;
    notes?: string | null;
  }) => Promise<WeighingItem>;
  updateWeighing: (
    weighingId: string,
    input: {
      weightKg?: number;
      measuredAt?: string;
      bodyConditionScore?: number | null;
      notes?: string | null;
    },
  ) => Promise<WeighingItem>;
  deleteWeighing: (weighingId: string) => Promise<void>;
}

export function useAnimalWeighings(
  farmId: string | null,
  animalId: string | null,
): UseAnimalWeighingsResult {
  const [weighings, setWeighings] = useState<WeighingItem[]>([]);
  const [stats, setStats] = useState<WeighingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const basePath = farmId && animalId ? `/org/farms/${farmId}/animals/${animalId}/weighings` : null;

  const fetchData = useCallback(async () => {
    if (!basePath) {
      setWeighings([]);
      setStats(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [weighingsData, statsData] = await Promise.all([
        api.get<WeighingItem[]>(basePath),
        api.get<WeighingStats>(`${basePath}/stats`),
      ]);
      setWeighings(weighingsData);
      setStats(statsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar pesagens';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const createWeighing = useCallback(
    async (input: {
      weightKg: number;
      measuredAt: string;
      bodyConditionScore?: number | null;
      notes?: string | null;
    }) => {
      if (!basePath) throw new Error('Fazenda ou animal não selecionado');
      const result = await api.post<WeighingItem>(basePath, input);
      await fetchData();
      return result;
    },
    [basePath, fetchData],
  );

  const updateWeighing = useCallback(
    async (
      weighingId: string,
      input: {
        weightKg?: number;
        measuredAt?: string;
        bodyConditionScore?: number | null;
        notes?: string | null;
      },
    ) => {
      if (!basePath) throw new Error('Fazenda ou animal não selecionado');
      const result = await api.patch<WeighingItem>(`${basePath}/${weighingId}`, input);
      await fetchData();
      return result;
    },
    [basePath, fetchData],
  );

  const deleteWeighing = useCallback(
    async (weighingId: string) => {
      if (!basePath) throw new Error('Fazenda ou animal não selecionado');
      await api.delete(`${basePath}/${weighingId}`);
      await fetchData();
    },
    [basePath, fetchData],
  );

  return {
    weighings,
    stats,
    isLoading,
    error,
    refetch: fetchData,
    createWeighing,
    updateWeighing,
    deleteWeighing,
  };
}
