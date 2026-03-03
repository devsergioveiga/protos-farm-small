import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { UserLimitInfo } from '@/types/org-user';

interface UseUserLimitResult {
  limit: UserLimitInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserLimit(): UseUserLimitResult {
  const [limit, setLimit] = useState<UserLimitInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLimit = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<UserLimitInfo>('/org/users/limit');
      setLimit(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar limite de usuários';
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
