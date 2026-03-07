import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AnimalListItem, AnimalsResponse } from '@/types/animal';
import type { PaginationMeta } from '@/types/admin';

interface UseAnimalsParams {
  farmId: string | null;
  search?: string;
  page?: number;
  limit?: number;
  sex?: string;
  category?: string;
  breedId?: string;
  origin?: string;
  lotId?: string;
  minWeightKg?: number;
  maxWeightKg?: number;
  minAgeDays?: number;
  maxAgeDays?: number;
  sortBy?: string;
  sortOrder?: string;
}

interface UseAnimalsResult {
  animals: AnimalListItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAnimals(params: UseAnimalsParams): UseAnimalsResult {
  const [animals, setAnimals] = useState<AnimalListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    farmId,
    search,
    page,
    limit,
    sex,
    category,
    breedId,
    origin,
    lotId,
    minWeightKg,
    maxWeightKg,
    minAgeDays,
    maxAgeDays,
    sortBy,
    sortOrder,
  } = params;

  const fetchAnimals = useCallback(async () => {
    if (!farmId) {
      setAnimals([]);
      setMeta(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (sex) query.set('sex', sex);
      if (category) query.set('category', category);
      if (breedId) query.set('breedId', breedId);
      if (origin) query.set('origin', origin);
      if (lotId) query.set('lotId', lotId);
      if (minWeightKg != null) query.set('minWeightKg', String(minWeightKg));
      if (maxWeightKg != null) query.set('maxWeightKg', String(maxWeightKg));
      if (minAgeDays != null) query.set('minAgeDays', String(minAgeDays));
      if (maxAgeDays != null) query.set('maxAgeDays', String(maxAgeDays));
      if (sortBy) query.set('sortBy', sortBy);
      if (sortOrder) query.set('sortOrder', sortOrder);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/animals${qs ? `?${qs}` : ''}`;
      const result = await api.get<AnimalsResponse>(path);
      setAnimals(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar animais';
      setError(message);
      setAnimals([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    farmId,
    search,
    page,
    limit,
    sex,
    category,
    breedId,
    origin,
    lotId,
    minWeightKg,
    maxWeightKg,
    minAgeDays,
    maxAgeDays,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    void fetchAnimals();
  }, [fetchAnimals]);

  return { animals, meta, isLoading, error, refetch: fetchAnimals };
}
