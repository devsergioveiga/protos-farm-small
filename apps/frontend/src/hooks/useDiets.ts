import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { DietItem, DietsResponse } from '@/types/diet';
import type { PaginationMeta } from '@/types/admin';

interface UseDietsParams {
  page?: number;
  limit?: number;
  targetCategory?: string;
  isActive?: boolean;
  search?: string;
}

interface UseDietsResult {
  diets: DietItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDiets(params: UseDietsParams): UseDietsResult {
  const [diets, setDiets] = useState<DietItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, targetCategory, isActive, search } = params;

  const fetchDiets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (targetCategory) query.set('targetCategory', targetCategory);
      if (isActive !== undefined) query.set('isActive', String(isActive));
      if (search) query.set('search', search);

      const qs = query.toString();
      const path = `/org/diets${qs ? `?${qs}` : ''}`;
      const result = await api.get<DietsResponse>(path);
      setDiets(result.data);
      setMeta({
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dietas';
      setError(message);
      setDiets([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, targetCategory, isActive, search]);

  useEffect(() => {
    void fetchDiets();
  }, [fetchDiets]);

  return { diets, meta, isLoading, error, refetch: fetchDiets };
}
