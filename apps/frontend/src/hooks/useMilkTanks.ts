import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  TankItem,
  CollectionItem,
  CollectionsResponse,
  ReconciliationItem,
  MonthlyReportItem,
} from '@/types/milk-tank';
import type { PaginationMeta } from '@/types/admin';

/* ─── Tanks ──────────────────────────────────────────────────────────── */

interface UseTanksParams {
  farmId: string | null;
}

interface UseTanksResult {
  tanks: TankItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTanks({ farmId }: UseTanksParams): UseTanksResult {
  const [tanks, setTanks] = useState<TankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTanks = useCallback(async () => {
    if (!farmId) {
      setTanks([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<TankItem[]>(`/org/farms/${farmId}/milk-tanks`);
      setTanks(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar tanques';
      setError(message);
      setTanks([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetchTanks();
  }, [fetchTanks]);

  return { tanks, isLoading, error, refetch: fetchTanks };
}

/* ─── Collections ────────────────────────────────────────────────────── */

interface UseCollectionsParams {
  farmId: string | null;
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

interface UseCollectionsResult {
  collections: CollectionItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCollections(params: UseCollectionsParams): UseCollectionsResult {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, page, limit, dateFrom, dateTo } = params;

  const fetchCollections = useCallback(async () => {
    if (!farmId) {
      setCollections([]);
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
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/milk-collections${qs ? `?${qs}` : ''}`;
      const result = await api.get<CollectionsResponse>(path);
      setCollections(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar coletas';
      setError(message);
      setCollections([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, page, limit, dateFrom, dateTo]);

  useEffect(() => {
    void fetchCollections();
  }, [fetchCollections]);

  return { collections, meta, isLoading, error, refetch: fetchCollections };
}

/* ─── Reconciliation ─────────────────────────────────────────────────── */

interface UseReconciliationParams {
  farmId: string | null;
  dateFrom?: string;
  dateTo?: string;
}

interface UseReconciliationResult {
  rows: ReconciliationItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useReconciliation(params: UseReconciliationParams): UseReconciliationResult {
  const [rows, setRows] = useState<ReconciliationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, dateFrom, dateTo } = params;

  const fetchReconciliation = useCallback(async () => {
    if (!farmId || !dateFrom || !dateTo) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);

      const qs = query.toString();
      const path = `/org/farms/${farmId}/milk-collections/reconciliation${qs ? `?${qs}` : ''}`;
      const result = await api.get<ReconciliationItem[]>(path);
      setRows(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar conciliação';
      setError(message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchReconciliation();
  }, [fetchReconciliation]);

  return { rows, isLoading, error, refetch: fetchReconciliation };
}

/* ─── Monthly Report ─────────────────────────────────────────────────── */

interface UseMonthlyReportParams {
  farmId: string | null;
  month: string; // YYYY-MM
}

interface UseMonthlyReportResult {
  report: MonthlyReportItem | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMonthlyReport(params: UseMonthlyReportParams): UseMonthlyReportResult {
  const [report, setReport] = useState<MonthlyReportItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, month } = params;

  const fetchReport = useCallback(async () => {
    if (!farmId || !month) {
      setReport(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const path = `/org/farms/${farmId}/milk-collections/monthly-report?month=${month}`;
      const result = await api.get<MonthlyReportItem>(path);
      setReport(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar relatório mensal';
      setError(message);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, month]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  return { report, isLoading, error, refetch: fetchReport };
}
