import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuotationSavingItem {
  productName: string;
  maxPrice: number;
  winnerPrice: number;
  quantity: number;
  unit: string;
  saving: number;
  savingPercent: number;
}

export interface QuotationSaving {
  quotationId: string;
  sequentialNumber: string;
  date: string;
  supplierCount: number;
  totalSaving: number;
  savingPercent: number;
  items: QuotationSavingItem[];
}

export interface SavingSummary {
  totalSaving: number;
  quotationCount: number;
  avgSavingPercent: number;
  savings: QuotationSaving[];
}

export interface CycleIndicators {
  percentFormal: number;
  percentEmergency: number;
  avgCycleDays: number;
  totalOrders: number;
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
  poNumber: string;
  supplierName: string;
}

export interface PriceHistoryResult {
  productId: string;
  productName: string;
  points: PriceHistoryPoint[];
}

export interface TopProduct {
  rank: number;
  productId: string;
  productName: string;
  totalSpent: number;
  orderCount: number;
}

export interface TopSupplier {
  rank: number;
  supplierId: string;
  supplierName: string;
  totalVolume: number;
  orderCount: number;
}

export interface SavingDashboard {
  saving: SavingSummary;
  indicators: CycleIndicators;
  topProducts: TopProduct[];
  topSuppliers: TopSupplier[];
}

// ─── Filter params ────────────────────────────────────────────────────────────

export interface SavingAnalysisParams {
  startDate?: string;
  endDate?: string;
  category?: string;
  supplierId?: string;
}

// ─── useSavingDashboard ───────────────────────────────────────────────────────

interface UseSavingDashboardResult {
  dashboard: SavingDashboard | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSavingDashboard(params: SavingAnalysisParams = {}): UseSavingDashboardResult {
  const [dashboard, setDashboard] = useState<SavingDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { startDate, endDate, category, supplierId } = params;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const p = new URLSearchParams();
        if (startDate) p.set('startDate', startDate);
        if (endDate) p.set('endDate', endDate);
        if (category) p.set('category', category);
        if (supplierId) p.set('supplierId', supplierId);

        const qs = p.toString();
        const data = await api.get<SavingDashboard>(
          `/org/saving-analysis/dashboard${qs ? `?${qs}` : ''}`,
        );
        if (!cancelled) setDashboard(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard de saving');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, category, supplierId, refetchCounter]);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  return { dashboard, isLoading, error, refetch };
}

// ─── useSavingByQuotation ─────────────────────────────────────────────────────

interface UseSavingByQuotationResult {
  summary: SavingSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSavingByQuotation(
  params: SavingAnalysisParams = {},
): UseSavingByQuotationResult {
  const [summary, setSummary] = useState<SavingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { startDate, endDate, category, supplierId } = params;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const p = new URLSearchParams();
        if (startDate) p.set('startDate', startDate);
        if (endDate) p.set('endDate', endDate);
        if (category) p.set('category', category);
        if (supplierId) p.set('supplierId', supplierId);

        const qs = p.toString();
        const data = await api.get<SavingSummary>(
          `/org/saving-analysis/saving${qs ? `?${qs}` : ''}`,
        );
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erro ao carregar saving por cotação');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, category, supplierId, refetchCounter]);

  const refetch = useCallback(() => setRefetchCounter((c) => c + 1), []);

  return { summary, isLoading, error, refetch };
}

// ─── usePriceHistory ──────────────────────────────────────────────────────────

interface UsePriceHistoryResult {
  history: PriceHistoryResult | null;
  isLoading: boolean;
  error: string | null;
}

export function usePriceHistory(
  productId: string | null,
  params: SavingAnalysisParams = {},
): UsePriceHistoryResult {
  const [history, setHistory] = useState<PriceHistoryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = params;

  useEffect(() => {
    if (!productId) {
      setHistory(null);
      return;
    }

    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const p = new URLSearchParams();
        if (startDate) p.set('startDate', startDate);
        if (endDate) p.set('endDate', endDate);

        const qs = p.toString();
        const data = await api.get<PriceHistoryResult>(
          `/org/saving-analysis/price-history/${productId}${qs ? `?${qs}` : ''}`,
        );
        if (!cancelled) setHistory(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erro ao carregar histórico de preços');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [productId, startDate, endDate]);

  return { history, isLoading, error };
}

// ─── useCycleIndicators ───────────────────────────────────────────────────────

interface UseCycleIndicatorsResult {
  indicators: CycleIndicators | null;
  isLoading: boolean;
  error: string | null;
}

export function useCycleIndicators(params: SavingAnalysisParams = {}): UseCycleIndicatorsResult {
  const [indicators, setIndicators] = useState<CycleIndicators | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = params;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const p = new URLSearchParams();
        if (startDate) p.set('startDate', startDate);
        if (endDate) p.set('endDate', endDate);

        const qs = p.toString();
        const data = await api.get<CycleIndicators>(
          `/org/saving-analysis/indicators${qs ? `?${qs}` : ''}`,
        );
        if (!cancelled) setIndicators(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erro ao carregar indicadores de ciclo');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return { indicators, isLoading, error };
}

// ─── useTopProducts ───────────────────────────────────────────────────────────

interface UseTopProductsResult {
  products: TopProduct[];
  isLoading: boolean;
  error: string | null;
}

export function useTopProducts(params: SavingAnalysisParams = {}): UseTopProductsResult {
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = params;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const p = new URLSearchParams();
        if (startDate) p.set('startDate', startDate);
        if (endDate) p.set('endDate', endDate);

        const qs = p.toString();
        const data = await api.get<TopProduct[]>(
          `/org/saving-analysis/top-products${qs ? `?${qs}` : ''}`,
        );
        if (!cancelled) setProducts(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erro ao carregar top produtos');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return { products, isLoading, error };
}

// ─── useTopSuppliers ──────────────────────────────────────────────────────────

interface UseTopSuppliersResult {
  suppliers: TopSupplier[];
  isLoading: boolean;
  error: string | null;
}

export function useTopSuppliers(params: SavingAnalysisParams = {}): UseTopSuppliersResult {
  const [suppliers, setSuppliers] = useState<TopSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = params;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const p = new URLSearchParams();
        if (startDate) p.set('startDate', startDate);
        if (endDate) p.set('endDate', endDate);

        const qs = p.toString();
        const data = await api.get<TopSupplier[]>(
          `/org/saving-analysis/top-suppliers${qs ? `?${qs}` : ''}`,
        );
        if (!cancelled) setSuppliers(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erro ao carregar top fornecedores');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return { suppliers, isLoading, error };
}
