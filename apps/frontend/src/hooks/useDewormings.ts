import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { DewormingItem, DewormingsResponse } from '@/types/deworming';
import type { PaginationMeta } from '@/types/admin';

interface UseDewormingsParams {
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

interface UseDewormingsResult {
  dewormings: DewormingItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDewormings(params: UseDewormingsParams): UseDewormingsResult {
  const [dewormings, setDewormings] = useState<DewormingItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, animalId, campaignId, productId, dateFrom, dateTo, search } = params;

  const fetchDewormings = useCallback(async () => {
    if (!farmId) {
      setDewormings([]);
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
      const path = `/org/farms/${farmId}/dewormings${qs ? `?${qs}` : ''}`;
      const result = await api.get<DewormingsResponse>(path);
      setDewormings(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar vermifugações';
      setError(message);
      setDewormings([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, animalId, campaignId, productId, dateFrom, dateTo, search]);

  useEffect(() => {
    void fetchDewormings();
  }, [fetchDewormings]);

  return { dewormings, meta, isLoading, error, refetch: fetchDewormings };
}
