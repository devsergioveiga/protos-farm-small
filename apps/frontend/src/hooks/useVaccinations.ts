import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { VaccinationItem, VaccinationsResponse } from '@/types/vaccination';
import type { PaginationMeta } from '@/types/admin';

interface UseVaccinationsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  animalId?: string;
  campaignId?: string;
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface UseVaccinationsResult {
  vaccinations: VaccinationItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useVaccinations(params: UseVaccinationsParams): UseVaccinationsResult {
  const [vaccinations, setVaccinations] = useState<VaccinationItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, animalId, campaignId, productId, dateFrom, dateTo, search } = params;

  const fetchVaccinations = useCallback(async () => {
    if (!farmId) {
      setVaccinations([]);
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
      if (campaignId) query.set('campaignId', campaignId);
      if (productId) query.set('productId', productId);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      if (search) query.set('search', search);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/vaccinations${qs ? `?${qs}` : ''}`;
      const result = await api.get<VaccinationsResponse>(path);
      setVaccinations(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar vacinações';
      setError(message);
      setVaccinations([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, animalId, campaignId, productId, dateFrom, dateTo, search]);

  useEffect(() => {
    void fetchVaccinations();
  }, [fetchVaccinations]);

  return { vaccinations, meta, isLoading, error, refetch: fetchVaccinations };
}
