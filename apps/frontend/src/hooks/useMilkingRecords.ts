import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  MilkingRecordItem,
  MilkingRecordsResponse,
  LactatingAnimalItem,
  DailyProductionSummary,
  ProductionTrendItem,
  BulkMilkingInput,
  BulkMilkingResult,
  CreateMilkingRecordInput,
  UpdateMilkingRecordInput,
} from '@/types/milking-record';
import type { PaginationMeta } from '@/types/admin';

/* ─── List hook ─────────────────────────────────────────────────────── */

interface UseMilkingRecordsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  animalId?: string;
  shift?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface UseMilkingRecordsResult {
  records: MilkingRecordItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMilkingRecords(params: UseMilkingRecordsParams): UseMilkingRecordsResult {
  const [records, setRecords] = useState<MilkingRecordItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, animalId, shift, dateFrom, dateTo, search } = params;

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
      if (animalId) query.set('animalId', animalId);
      if (shift) query.set('shift', shift);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      if (search) query.set('search', search);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/milking-records${qs ? `?${qs}` : ''}`;
      const result = await api.get<MilkingRecordsResponse>(path);
      setRecords(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar registros de ordenha';
      setError(message);
      setRecords([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, animalId, shift, dateFrom, dateTo, search]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  return { records, meta, isLoading, error, refetch: fetchRecords };
}

/* ─── Lactating animals hook ────────────────────────────────────────── */

interface UseLactatingAnimalsResult {
  animals: LactatingAnimalItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLactatingAnimals(farmId: string | null): UseLactatingAnimalsResult {
  const [animals, setAnimals] = useState<LactatingAnimalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnimals = useCallback(async () => {
    if (!farmId) {
      setAnimals([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<LactatingAnimalItem[]>(
        `/org/farms/${farmId}/milking-records/lactating-animals`,
      );
      setAnimals(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar animais em lactação';
      setError(message);
      setAnimals([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchAnimals();
  }, [fetchAnimals]);

  return { animals, isLoading, error, refetch: fetchAnimals };
}

/* ─── Daily summary hook ────────────────────────────────────────────── */

interface UseDailySummaryResult {
  summary: DailyProductionSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDailySummary(farmId: string | null): UseDailySummaryResult {
  const [summary, setSummary] = useState<DailyProductionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!farmId) {
      setSummary(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<DailyProductionSummary>(
        `/org/farms/${farmId}/milking-records/daily-summary`,
      );
      setSummary(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar resumo de produção';
      setError(message);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return { summary, isLoading, error, refetch: fetchSummary };
}

/* ─── Production trend hook ─────────────────────────────────────────── */

interface UseProductionTrendResult {
  trend: ProductionTrendItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProductionTrend(farmId: string | null): UseProductionTrendResult {
  const [trend, setTrend] = useState<ProductionTrendItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrend = useCallback(async () => {
    if (!farmId) {
      setTrend([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<ProductionTrendItem[]>(
        `/org/farms/${farmId}/milking-records/trend`,
      );
      setTrend(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar tendência de produção';
      setError(message);
      setTrend([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchTrend();
  }, [fetchTrend]);

  return { trend, isLoading, error, refetch: fetchTrend };
}

/* ─── Mutation helpers ──────────────────────────────────────────────── */

export async function createMilkingRecord(
  farmId: string,
  data: CreateMilkingRecordInput,
): Promise<MilkingRecordItem> {
  return api.post<MilkingRecordItem>(`/org/farms/${farmId}/milking-records`, data);
}

export async function updateMilkingRecord(
  farmId: string,
  milkingId: string,
  data: UpdateMilkingRecordInput,
): Promise<MilkingRecordItem> {
  return api.patch<MilkingRecordItem>(`/org/farms/${farmId}/milking-records/${milkingId}`, data);
}

export async function deleteMilkingRecord(farmId: string, milkingId: string): Promise<void> {
  await api.delete(`/org/farms/${farmId}/milking-records/${milkingId}`);
}

export async function bulkCreateMilking(
  farmId: string,
  data: BulkMilkingInput,
): Promise<BulkMilkingResult> {
  return api.post<BulkMilkingResult>(`/org/farms/${farmId}/milking-records/bulk`, data);
}

export function exportMilkingCsv(farmId: string): Promise<Blob> {
  return api.getBlob(`/org/farms/${farmId}/milking-records/export`);
}
