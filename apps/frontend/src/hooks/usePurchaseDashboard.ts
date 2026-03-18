import { useState, useEffect } from 'react';
import { api } from '@/services/api';

// ─── Types (mirroring backend purchase-dashboard.types.ts) ────────────────────

export interface KpiValue {
  current: number;
  previous: number;
  changePercent: number;
}

export interface DashboardMetrics {
  totalVolume: KpiValue;
  requestCount: KpiValue;
  avgCycleTimeDays: KpiValue;
  onTimeDeliveryPct: KpiValue;
  accumulatedSaving: KpiValue;
}

export interface CategoryChartPoint {
  category: string;
  label: string;
  value: number;
}

export interface SavingChartPoint {
  month: string;
  saving: number;
}

export interface BudgetVsActualPoint {
  category: string;
  label: string;
  budget: number;
  actual: number;
}

export interface DashboardCharts {
  purchasesByCategory: CategoryChartPoint[];
  savingEvolution: SavingChartPoint[];
  budgetVsActual: BudgetVsActualPoint[];
}

export interface DashboardAlert {
  type: string;
  message: string;
  count: number;
  referenceIds: string[];
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  farmId?: string;
  category?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UsePurchaseDashboardResult {
  metrics: DashboardMetrics | null;
  charts: DashboardCharts | null;
  alerts: DashboardAlert[];
  isLoading: boolean;
  error: string | null;
}

export function usePurchaseDashboard(filters: DashboardFilters): UsePurchaseDashboardResult {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      const p = new URLSearchParams();
      p.set('startDate', filters.startDate);
      p.set('endDate', filters.endDate);
      if (filters.farmId) p.set('farmId', filters.farmId);
      if (filters.category) p.set('category', filters.category);
      const qs = p.toString();

      const alertParams = new URLSearchParams();
      if (filters.farmId) alertParams.set('farmId', filters.farmId);
      const alertQs = alertParams.toString();

      try {
        const [dashboardData, alertsData] = await Promise.all([
          api.get<{ metrics: DashboardMetrics; charts: DashboardCharts }>(
            `/org/purchase-dashboard${qs ? `?${qs}` : ''}`,
          ),
          api.get<DashboardAlert[]>(
            `/org/purchase-dashboard/alerts${alertQs ? `?${alertQs}` : ''}`,
          ),
        ]);

        if (!cancelled) {
          setMetrics(dashboardData.metrics);
          setCharts(dashboardData.charts);
          setAlerts(alertsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard de compras');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [filtersKey]);

  return { metrics, charts, alerts, isLoading, error };
}
