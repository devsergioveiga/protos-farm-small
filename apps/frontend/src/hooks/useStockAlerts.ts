import { useState, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Types ──────────────────────────────────────────────────────────

export type StockLevel = 'CRITICAL' | 'WARNING' | 'OK';

export interface StockLevelAlert {
  productId: string;
  productName: string;
  productType: string;
  measurementUnit: string | null;
  currentQuantity: number;
  reorderPoint: number | null;
  safetyStock: number | null;
  averageCost: number;
  totalValue: number;
  level: StockLevel;
}

export interface ExpiryAlert {
  productId: string;
  productName: string;
  productType: string;
  measurementUnit: string | null;
  batchNumber: string | null;
  expirationDate: string;
  daysUntilExpiry: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  isExpired: boolean;
  isPesticide: boolean;
  inpevRequired: boolean;
}

export interface StockDashboardSummary {
  totalProducts: number;
  criticalCount: number;
  warningCount: number;
  okCount: number;
  noThresholdCount: number;
  expiredCount: number;
  expiringCount: number;
  totalStockValue: number;
}

export interface StockLevelDashboard {
  summary: StockDashboardSummary;
  alerts: StockLevelAlert[];
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useStockAlerts() {
  const [dashboard, setDashboard] = useState<StockLevelDashboard | null>(null);
  const [levelAlerts, setLevelAlerts] = useState<PaginatedResult<StockLevelAlert> | null>(null);
  const [expiryAlerts, setExpiryAlerts] = useState<PaginatedResult<ExpiryAlert> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Dashboard ──────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<StockLevelDashboard>('/org/stock-alerts/dashboard');
      setDashboard(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard de estoque');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Stock Level Alerts ─────────────────────────────────────────

  const fetchLevelAlerts = useCallback(
    async (params?: {
      level?: StockLevel;
      productType?: string;
      search?: string;
      page?: number;
      limit?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const searchParams = new URLSearchParams();
        if (params?.level) searchParams.set('level', params.level);
        if (params?.productType) searchParams.set('productType', params.productType);
        if (params?.search) searchParams.set('search', params.search);
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));

        const qs = searchParams.toString();
        const data = await api.get<PaginatedResult<StockLevelAlert>>(
          `/org/stock-alerts/levels${qs ? `?${qs}` : ''}`,
        );
        setLevelAlerts(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar alertas de nível');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ─── Expiry Alerts ──────────────────────────────────────────────

  const fetchExpiryAlerts = useCallback(
    async (params?: {
      daysAhead?: number;
      includeExpired?: boolean;
      productType?: string;
      isPesticide?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const searchParams = new URLSearchParams();
        if (params?.daysAhead != null) searchParams.set('daysAhead', String(params.daysAhead));
        if (params?.includeExpired === false) searchParams.set('includeExpired', 'false');
        if (params?.productType) searchParams.set('productType', params.productType);
        if (params?.isPesticide) searchParams.set('isPesticide', 'true');
        if (params?.search) searchParams.set('search', params.search);
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));

        const qs = searchParams.toString();
        const data = await api.get<PaginatedResult<ExpiryAlert>>(
          `/org/stock-alerts/expiry${qs ? `?${qs}` : ''}`,
        );
        setExpiryAlerts(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar alertas de validade');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ─── Export CSV ─────────────────────────────────────────────────

  const exportExpiryCSV = useCallback(
    async (params?: { daysAhead?: number; includeExpired?: boolean; productType?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.daysAhead != null) searchParams.set('daysAhead', String(params.daysAhead));
      if (params?.includeExpired === false) searchParams.set('includeExpired', 'false');
      if (params?.productType) searchParams.set('productType', params.productType);

      const qs = searchParams.toString();
      const url = `/api/org/stock-alerts/expiry/export${qs ? `?${qs}` : ''}`;

      const token = localStorage.getItem('accessToken');
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Erro ao exportar relatório');

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `relatorio-validade-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    },
    [],
  );

  return {
    dashboard,
    levelAlerts,
    expiryAlerts,
    loading,
    error,
    fetchDashboard,
    fetchLevelAlerts,
    fetchExpiryAlerts,
    exportExpiryCSV,
  };
}
