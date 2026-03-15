import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AnimalExamItem, AnimalExamsResponse } from '@/types/animal-exam';
import type { PaginationMeta } from '@/types/admin';

interface UseAnimalExamsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  animalId?: string;
  examTypeId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface UseAnimalExamsResult {
  exams: AnimalExamItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAnimalExams(params: UseAnimalExamsParams): UseAnimalExamsResult {
  const [exams, setExams] = useState<AnimalExamItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, animalId, examTypeId, status, dateFrom, dateTo, search } = params;

  const fetchExams = useCallback(async () => {
    if (!farmId) {
      setExams([]);
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
      if (animalId) query.set('animalId', animalId);
      if (examTypeId) query.set('examTypeId', examTypeId);
      if (status) query.set('status', status);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      if (search) query.set('search', search);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/animal-exams${qs ? `?${qs}` : ''}`;
      const result = await api.get<AnimalExamsResponse>(path);
      setExams(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar exames';
      setError(message);
      setExams([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, animalId, examTypeId, status, dateFrom, dateTo, search]);

  useEffect(() => {
    void fetchExams();
  }, [fetchExams]);

  return { exams, meta, isLoading, error, refetch: fetchExams };
}
