import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { OrangeHarvestItem, OrangeHarvestsResponse } from '@/types/orange-harvest';
import type { PaginationMeta } from '@/types/admin';

interface UseOrangeHarvestsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  fieldPlotId?: string;
  destination?: string;
  saleContractRef?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseOrangeHarvestsResult {
  harvests: OrangeHarvestItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrangeHarvests(params: UseOrangeHarvestsParams): UseOrangeHarvestsResult {
  const [harvests, setHarvests] = useState<OrangeHarvestItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    farmId,
    page,
    limit,
    fieldPlotId,
    destination,
    saleContractRef,
    search,
    dateFrom,
    dateTo,
  } = params;

  const fetchHarvests = useCallback(async () => {
    if (!farmId) {
      setHarvests([]);
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
      if (fieldPlotId) query.set('fieldPlotId', fieldPlotId);
      if (destination) query.set('destination', destination);
      if (saleContractRef) query.set('saleContractRef', saleContractRef);
      if (search) query.set('search', search);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/orange-harvests${qs ? `?${qs}` : ''}`;
      const result = await api.get<OrangeHarvestsResponse>(path);
      setHarvests(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar colheitas de laranja';
      setError(message);
      setHarvests([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, fieldPlotId, destination, saleContractRef, search, dateFrom, dateTo]);

  useEffect(() => {
    void fetchHarvests();
  }, [fetchHarvests]);

  return { harvests, meta, isLoading, error, refetch: fetchHarvests };
}
