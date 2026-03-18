import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  HeatRecordItem,
  HeatRecordsResponse,
  HeatIndicators,
  DailyHeatGroup,
  DailyHeatsResponse,
} from '@/types/heat-record';
import type { PaginationMeta } from '@/types/admin';

interface UseHeatRecordsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseHeatRecordsResult {
  heats: HeatRecordItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useHeatRecords(params: UseHeatRecordsParams): UseHeatRecordsResult {
  const [heats, setHeats] = useState<HeatRecordItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, search, status, animalId, dateFrom, dateTo } = params;

  const fetchHeats = useCallback(async () => {
    if (!farmId) {
      setHeats([]);
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
      if (search) query.set('search', search);
      if (status) query.set('status', status);
      if (animalId) query.set('animalId', animalId);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/heat-records${qs ? `?${qs}` : ''}`;
      const result = await api.get<HeatRecordsResponse>(path);
      setHeats(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar registros de cio';
      setError(message);
      setHeats([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, search, status, animalId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchHeats();
  }, [fetchHeats]);

  return { heats, meta, isLoading, error, refetch: fetchHeats };
}

interface UseDailyHeatsResult {
  groups: DailyHeatGroup[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDailyHeats(farmId: string | null): UseDailyHeatsResult {
  const [groups, setGroups] = useState<DailyHeatGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDaily = useCallback(async () => {
    if (!farmId) {
      setGroups([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<DailyHeatsResponse>(`/org/farms/${farmId}/heat-records/daily`);
      setGroups(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar cios do dia';
      setError(message);
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchDaily();
  }, [fetchDaily]);

  return { groups, isLoading, error, refetch: fetchDaily };
}

interface UseHeatIndicatorsResult {
  indicators: HeatIndicators | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useHeatIndicators(farmId: string | null): UseHeatIndicatorsResult {
  const [indicators, setIndicators] = useState<HeatIndicators | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIndicators = useCallback(async () => {
    if (!farmId) {
      setIndicators(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<HeatIndicators>(`/org/farms/${farmId}/heat-records/indicators`);
      setIndicators(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar indicadores';
      setError(message);
      setIndicators(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchIndicators();
  }, [fetchIndicators]);

  return { indicators, isLoading, error, refetch: fetchIndicators };
}
