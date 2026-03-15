import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { DiseaseItem, DiseasesResponse } from '@/types/disease';
import type { PaginationMeta } from '@/types/admin';

interface UseDiseasesParams {
  page?: number;
  limit?: number;
  category?: string;
  severity?: string;
  isNotifiable?: boolean;
  search?: string;
}

interface UseDiseasesResult {
  diseases: DiseaseItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDiseases(params: UseDiseasesParams): UseDiseasesResult {
  const [diseases, setDiseases] = useState<DiseaseItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page, limit, category, severity, isNotifiable, search } = params;

  const fetchDiseases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));
      if (category) query.set('category', category);
      if (severity) query.set('severity', severity);
      if (isNotifiable !== undefined) query.set('isNotifiable', String(isNotifiable));

      const qs = query.toString();
      const path = `/org/diseases${qs ? `?${qs}` : ''}`;
      const result = await api.get<DiseasesResponse>(path);
      setDiseases(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar doenças';
      setError(message);
      setDiseases([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, category, severity, isNotifiable, search]);

  useEffect(() => {
    void fetchDiseases();
  }, [fetchDiseases]);

  return { diseases, meta, isLoading, error, refetch: fetchDiseases };
}
