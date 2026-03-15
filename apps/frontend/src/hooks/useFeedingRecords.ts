import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  FeedingRecordListItem,
  FeedingRecordsApiResponse,
  ConsumptionIndicators,
} from '@/types/feeding-record';
import type { PaginationMeta } from '@/types/admin';

// ─── List Hook ──────────────────────────────────────────────────────

interface UseFeedingRecordsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  lotId?: string;
  shift?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseFeedingRecordsResult {
  records: FeedingRecordListItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFeedingRecords(params: UseFeedingRecordsParams): UseFeedingRecordsResult {
  const [records, setRecords] = useState<FeedingRecordListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, lotId, shift, dateFrom, dateTo } = params;

  const fetchRecords = useCallback(async () => {
    if (!farmId) {
      setRecords([]);
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
      if (lotId) query.set('lotId', lotId);
      if (shift) query.set('shift', shift);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/feeding-records${qs ? `?${qs}` : ''}`;
      const result = await api.get<FeedingRecordsApiResponse>(path);
      setRecords(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar registros de trato';
      setError(message);
      setRecords([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, lotId, shift, dateFrom, dateTo]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  return { records, meta, isLoading, error, refetch: fetchRecords };
}

// ─── Indicators Hook ────────────────────────────────────────────────

interface UseIndicatorsParams {
  farmId: string | null;
  lotId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseIndicatorsResult {
  indicators: ConsumptionIndicators | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useConsumptionIndicators(params: UseIndicatorsParams): UseIndicatorsResult {
  const [indicators, setIndicators] = useState<ConsumptionIndicators | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, lotId, dateFrom, dateTo } = params;

  const fetchIndicators = useCallback(async () => {
    if (!farmId) {
      setIndicators(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (lotId) query.set('lotId', lotId);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/feeding-records/indicators${qs ? `?${qs}` : ''}`;
      const result = await api.get<ConsumptionIndicators>(path);
      setIndicators(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar indicadores';
      setError(message);
      setIndicators(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, lotId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchIndicators();
  }, [fetchIndicators]);

  return { indicators, isLoading, error, refetch: fetchIndicators };
}
