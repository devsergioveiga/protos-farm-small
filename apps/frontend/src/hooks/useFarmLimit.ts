import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FarmLimitInfo } from '@/types/farm';

interface UseFarmLimitResult {
  limit: FarmLimitInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFarmLimit(): UseFarmLimitResult {
  const [limit, setLimit] = useState<FarmLimitInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLimit = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<FarmLimitInfo>('/org/farms/limit');
      setLimit(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar limite de fazendas';
      setError(message);
      setLimit(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLimit();
  }, [fetchLimit]);

  return { limit, isLoading, error, refetch: fetchLimit };
}
