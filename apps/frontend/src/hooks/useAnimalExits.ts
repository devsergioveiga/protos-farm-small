import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AnimalExitItem } from '@/types/animal-exit';

interface UseAnimalExitsParams {
  farmId: string | null;
  page?: number;
  exitType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface UseAnimalExitsResult {
  exits: AnimalExitItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAnimalExits({
  farmId,
  page = 1,
  exitType,
  dateFrom,
  dateTo,
  search,
}: UseAnimalExitsParams): UseAnimalExitsResult {
  const [exits, setExits] = useState<AnimalExitItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExits = useCallback(async () => {
    if (!farmId) {
      setExits([]);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (exitType) params.set('exitType', exitType);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (search) params.set('search', search);

      const result = await api.get<{ data: AnimalExitItem[]; total: number }>(
        `/org/farms/${farmId}/animal-exits?${params.toString()}`,
      );
      setExits(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar saídas de animais';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, exitType, dateFrom, dateTo, search]);

  useEffect(() => {
    void fetchExits();
  }, [fetchExits]);

  return { exits, total, isLoading, error, refetch: fetchExits };
}
