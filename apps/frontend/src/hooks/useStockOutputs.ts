import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export interface StockOutputItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchNumber: string | null;
  availableBalance: number | null;
}

export interface StockOutput {
  id: string;
  outputDate: string;
  type: string;
  status: string;
  responsibleName: string | null;
  notes: string | null;
  fieldOperationRef: string | null;
  fieldPlotId: string | null;
  fieldPlotName: string | null;
  sourceFarmId: string | null;
  sourceFarmName: string | null;
  sourceLocation: string | null;
  destinationFarmId: string | null;
  destinationFarmName: string | null;
  destinationLocation: string | null;
  disposalReason: string | null;
  disposalJustification: string | null;
  authorizedBy: string | null;
  forceInsufficient: boolean;
  insufficientJustification: string | null;
  totalCost: number;
  items: StockOutputItem[];
  createdAt: string;
  updatedAt: string;
}

export interface MovementRecord {
  id: string;
  date: string;
  direction: 'IN' | 'OUT';
  type: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchNumber: string | null;
  reference: string | null;
  balanceAfter: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface StockOutputsResponse {
  data: StockOutput[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MovementHistoryResponse {
  data: MovementRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── useStockOutputs ────────────────────────────────────────────────

interface UseStockOutputsParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
  responsibleName?: string;
}

export function useStockOutputs(params: UseStockOutputsParams) {
  const [outputs, setOutputs] = useState<StockOutput[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    page = 1,
    limit = 20,
    type,
    status,
    productId,
    dateFrom,
    dateTo,
    responsibleName,
  } = params;

  const fetchOutputs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      if (type) qs.set('type', type);
      if (status) qs.set('status', status);
      if (productId) qs.set('productId', productId);
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      if (responsibleName) qs.set('responsibleName', responsibleName);

      const result = await api.get<StockOutputsResponse>(`/org/stock-outputs?${qs}`);
      setOutputs(result.data);
      setMeta({
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch {
      setError('Não foi possível carregar as saídas de estoque.');
      setOutputs([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, type, status, productId, dateFrom, dateTo, responsibleName]);

  useEffect(() => {
    void fetchOutputs();
  }, [fetchOutputs]);

  return { outputs, meta, isLoading, error, refetch: fetchOutputs };
}

// ─── useCreateStockOutput ───────────────────────────────────────────

export function useCreateStockOutput() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const result = await api.post<StockOutput>('/org/stock-outputs', body);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível registrar a saída.';
      setError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return { create, saving, error, setError };
}

// ─── useCancelStockOutput ───────────────────────────────────────────

export function useCancelStockOutput() {
  const [cancelling, setCancelling] = useState(false);

  const cancel = useCallback(async (id: string) => {
    setCancelling(true);
    try {
      await api.post(`/org/stock-outputs/${id}/cancel`);
    } finally {
      setCancelling(false);
    }
  }, []);

  return { cancel, cancelling };
}

// ─── useMovementHistory ─────────────────────────────────────────────

interface UseMovementHistoryParams {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

export function useMovementHistory(productId: string | null, params: UseMovementHistoryParams) {
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { page = 1, limit = 20, dateFrom, dateTo } = params;

  const fetchMovements = useCallback(async () => {
    if (!productId) {
      setMovements([]);
      setMeta(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);

      const result = await api.get<MovementHistoryResponse>(
        `/org/stock-outputs/products/${productId}/movements?${qs}`,
      );
      setMovements(result.data);
      setMeta({
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch {
      setError('Não foi possível carregar o histórico de movimentações.');
      setMovements([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [productId, page, limit, dateFrom, dateTo]);

  useEffect(() => {
    void fetchMovements();
  }, [fetchMovements]);

  return { movements, meta, isLoading, error, refetch: fetchMovements };
}

// ─── useExportMovementsCSV ──────────────────────────────────────────

export function useExportMovementsCSV() {
  const [exporting, setExporting] = useState(false);

  const exportCSV = useCallback(async (productId: string, dateFrom?: string, dateTo?: string) => {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);

      const blob = await api.getBlob(
        `/org/stock-outputs/products/${productId}/movements/export?${qs}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `movimentacoes-${productId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportCSV, exporting };
}
