import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FarmListItem, FarmsListResponse } from '@/types/farm';

interface UseFarmsParams {
  search?: string;
  page?: number;
  state?: string;
}

interface UseFarmsResult {
  farms: FarmListItem[];
  meta: FarmsListResponse['meta'] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFarms(params: UseFarmsParams = {}): UseFarmsResult {
  const [farms, setFarms] = useState<FarmListItem[]>([]);
  const [meta, setMeta] = useState<FarmsListResponse['meta'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, page, state } = params;

  const fetchFarms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (state) query.set('state', state);

      const qs = query.toString();
      const path = `/org/farms${qs ? `?${qs}` : ''}`;
      const result = await api.get<FarmsListResponse>(path);
      setFarms(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar fazendas';
      setError(message);
      setFarms([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [search, page, state]);

  useEffect(() => {
    void fetchFarms();
  }, [fetchFarms]);

  return { farms, meta, isLoading, error, refetch: fetchFarms };
}
