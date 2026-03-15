import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { TreatmentListItem, TreatmentsResponse } from '@/types/therapeutic-treatment';

interface UseTherapeuticTreatmentsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  animalId?: string;
  diseaseId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseTherapeuticTreatmentsResult {
  treatments: TreatmentListItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTherapeuticTreatments(
  params: UseTherapeuticTreatmentsParams,
): UseTherapeuticTreatmentsResult {
  const [treatments, setTreatments] = useState<TreatmentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, animalId, diseaseId, status, dateFrom, dateTo } = params;

  const fetchTreatments = useCallback(async () => {
    if (!farmId) {
      setTreatments([]);
      setTotal(0);
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
      if (diseaseId) query.set('diseaseId', diseaseId);
      if (status) query.set('status', status);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/therapeutic-treatments${qs ? `?${qs}` : ''}`;
      const result = await api.get<TreatmentsResponse>(path);
      setTreatments(result.data);
      setTotal(result.total);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao carregar tratamentos terapêuticos';
      setError(message);
      setTreatments([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, animalId, diseaseId, status, dateFrom, dateTo]);

  useEffect(() => {
    void fetchTreatments();
  }, [fetchTreatments]);

  return { treatments, total, isLoading, error, refetch: fetchTreatments };
}
