import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  WeaningItem,
  WeaningsResponse,
  WeaningConfig,
  UnweanedAnimal,
} from '@/types/weaning';
import type { PaginationMeta } from '@/types/admin';

/* ─── useWeanings ────────────────────────────────────────────────── */

interface UseWeaningsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  search?: string;
}

interface UseWeaningsResult {
  weanings: WeaningItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWeanings(params: UseWeaningsParams): UseWeaningsResult {
  const [weanings, setWeanings] = useState<WeaningItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, search } = params;

  const fetch = useCallback(async () => {
    if (!farmId) {
      setWeanings([]);
      setMeta(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (search) query.set('search', search);
      const qs = query.toString();
      const path = `/org/farms/${farmId}/weanings${qs ? `?${qs}` : ''}`;
      const result = await api.get<WeaningsResponse>(path);
      setWeanings(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar desmamas';
      setError(message);
      setWeanings([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, search]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { weanings, meta, isLoading, error, refetch: fetch };
}

/* ─── useWeaningConfig ───────────────────────────────────────────── */

interface UseWeaningConfigResult {
  config: WeaningConfig | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWeaningConfig(): UseWeaningConfigResult {
  const [config, setConfig] = useState<WeaningConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<WeaningConfig>('/org/weaning-config');
      setConfig(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar configuração';
      setError(message);
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { config, isLoading, error, refetch: fetch };
}

/* ─── useUnweanedAnimals ─────────────────────────────────────────── */

interface UseUnweanedAnimalsParams {
  farmId: string | null;
}

interface UseUnweanedAnimalsResult {
  animals: UnweanedAnimal[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUnweanedAnimals(params: UseUnweanedAnimalsParams): UseUnweanedAnimalsResult {
  const [animals, setAnimals] = useState<UnweanedAnimal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId } = params;

  const fetch = useCallback(async () => {
    if (!farmId) {
      setAnimals([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<UnweanedAnimal[]>(`/org/farms/${farmId}/weanings/unweaned`);
      setAnimals(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar animais';
      setError(message);
      setAnimals([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { animals, isLoading, error, refetch: fetch };
}
