import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { WorkSchedule, WorkSchedulesResponse } from '@/types/work-schedule';

interface UseWorkSchedulesParams {
  search?: string;
  page?: number;
  limit?: number;
}

interface UseWorkSchedulesResult {
  workSchedules: WorkSchedule[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWorkSchedules(params: UseWorkSchedulesParams = {}): UseWorkSchedulesResult {
  const { user } = useAuth();
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, page, limit } = params;

  const fetchWorkSchedules = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId) {
      setWorkSchedules([]);
      setTotal(0);
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

      const qs = query.toString();
      const path = `/org/${orgId}/work-schedules${qs ? `?${qs}` : ''}`;
      const result = await api.get<WorkSchedulesResponse>(path);
      setWorkSchedules(result.data);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar escalas de trabalho';
      setError(message);
      setWorkSchedules([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId, search, page, limit]);

  useEffect(() => {
    void fetchWorkSchedules();
  }, [fetchWorkSchedules]);

  return { workSchedules, total, isLoading, error, refetch: fetchWorkSchedules };
}
