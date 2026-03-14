import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { ExamTypeItem, ExamTypesResponse } from '@/types/animal-exam';
import type { PaginationMeta } from '@/types/admin';

interface UseExamTypesParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

interface UseExamTypesResult {
  examTypes: ExamTypeItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useExamTypes(params: UseExamTypesParams): UseExamTypesResult {
  const [examTypes, setExamTypes] = useState<ExamTypeItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, category, search } = params;

  const fetchExamTypes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (category) query.set('category', category);
      if (search) query.set('search', search);

      const qs = query.toString();
      const path = `/org/exam-types${qs ? `?${qs}` : ''}`;
      const result = await api.get<ExamTypesResponse>(path);
      setExamTypes(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar tipos de exame';
      setError(message);
      setExamTypes([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, category, search]);

  useEffect(() => {
    void fetchExamTypes();
  }, [fetchExamTypes]);

  return { examTypes, meta, isLoading, error, refetch: fetchExamTypes };
}
