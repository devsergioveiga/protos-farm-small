import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export interface StockEntryItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchNumber: string | null;
  manufacturingDate: string | null;
  expirationDate: string | null;
  apportionedExpenses: number;
  finalUnitCost: number;
  finalTotalCost: number;
  weightKg: number | null;
}

export interface StockEntryExpense {
  id: string;
  expenseType: string;
  expenseTypeLabel: string;
  description: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  amount: number;
  apportionmentMethod: string;
  isRetroactive: boolean;
}

export interface StockEntry {
  id: string;
  entryDate: string;
  status: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  storageFarmId: string | null;
  storageFarmName: string | null;
  storageLocation: string | null;
  storageSublocation: string | null;
  notes: string | null;
  totalMerchandiseCost: number;
  totalExpensesCost: number;
  totalCost: number;
  items: StockEntryItem[];
  expenses: StockEntryExpense[];
  createdAt: string;
  updatedAt: string;
}

export interface CostAlert {
  productId: string;
  productName: string;
  currentAvgCost: number;
  newUnitCost: number;
  divergencePct: number;
}

export interface StockBalance {
  id: string;
  productId: string;
  productName: string;
  productType: string;
  measurementUnit: string | null;
  currentQuantity: number;
  averageCost: number;
  totalValue: number;
  lastEntryDate: string | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface StockEntriesResponse {
  data: StockEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface StockBalancesResponse {
  data: StockBalance[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── useStockEntries ────────────────────────────────────────────────

interface UseStockEntriesParams {
  page?: number;
  limit?: number;
  status?: string;
  supplierName?: string;
  dateFrom?: string;
  dateTo?: string;
  productId?: string;
}

export function useStockEntries(params: UseStockEntriesParams) {
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page = 1, limit = 20, status, supplierName, dateFrom, dateTo, productId } = params;

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      if (status) qs.set('status', status);
      if (supplierName) qs.set('supplierName', supplierName);
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      if (productId) qs.set('productId', productId);

      const result = await api.get<StockEntriesResponse>(`/org/stock-entries?${qs}`);
      setEntries(result.data);
      setMeta({
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch {
      setError('Não foi possível carregar as entradas de estoque.');
      setEntries([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, status, supplierName, dateFrom, dateTo, productId]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  return { entries, meta, isLoading, error, refetch: fetchEntries };
}

// ─── useStockBalances ───────────────────────────────────────────────

interface UseStockBalancesParams {
  page?: number;
  limit?: number;
  search?: string;
}

export function useStockBalances(params: UseStockBalancesParams) {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page = 1, limit = 20, search } = params;

  const fetchBalances = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      if (search) qs.set('search', search);

      const result = await api.get<StockBalancesResponse>(`/org/stock-balances?${qs}`);
      setBalances(result.data);
      setMeta({
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch {
      setError('Não foi possível carregar os saldos de estoque.');
      setBalances([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  return { balances, meta, isLoading, error, refetch: fetchBalances };
}
