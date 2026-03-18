import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { MatingPlanItem, MatingPlansResponse } from '@/types/mating-plan';

interface UseMatingPlansParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  status?: string;
}

interface UseMatingPlansResult {
  plans: MatingPlanItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMatingPlans(params: UseMatingPlansParams): UseMatingPlansResult {
  const [plans, setPlans] = useState<MatingPlanItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, status } = params;

  const fetchPlans = useCallback(async () => {
    if (!farmId) {
      setPlans([]);
      setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (status) query.set('status', status);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/mating-plans${qs ? `?${qs}` : ''}`;
      const result = await api.get<MatingPlansResponse>(path);
      setPlans(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar planos de acasalamento';
      setError(message);
      setPlans([]);
      setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, status]);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  return { plans, meta, isLoading, error, refetch: fetchPlans };
}
