import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface PurchasingDashboardData {
  pendingApprovalCount: number;
  pendingApprovalCountPrev: number;
  overduePoCount: number;
  overduePoCountPrev: number;
  avgCycleDays: number;
  avgCycleDaysPrev: number;
  lateDeliveriesCount: number;
  lateDeliveriesCountPrev: number;
  volumeByStage: { stage: string; count: number; totalValue: number }[];
  purchasesByCategory: { category: string; totalValue: number }[];
  monthlyEvolution: { month: string; totalValue: number }[];
  urgentVsPlanned: { month: string; urgent: number; planned: number }[];
  alerts: {
    overduePoCount: number;
    rcAboveSlaCount: number;
    budgetExceededCount: number;
    lateDeliveriesCount: number;
  };
}

export interface PurchasingDashboardPeriod {
  periodStart: string; // ISO date YYYY-MM-DD
  periodEnd: string; // ISO date YYYY-MM-DD
}

interface UsePurchasingDashboardResult {
  data: PurchasingDashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePurchasingDashboard(
  orgId: string,
  farmId?: string | null,
  period?: PurchasingDashboardPeriod,
): UsePurchasingDashboardResult {
  const [data, setData] = useState<PurchasingDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (farmId) query.set('farmId', farmId);
      if (period?.periodStart) query.set('periodStart', period.periodStart);
      if (period?.periodEnd) query.set('periodEnd', period.periodEnd);

      const qs = query.toString();
      const path = `/org/${orgId}/purchasing/dashboard${qs ? `?${qs}` : ''}`;
      const result = await api.get<PurchasingDashboardData>(path);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dashboard de compras';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, farmId, period?.periodStart, period?.periodEnd]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { data, isLoading, error, refetch: fetchDashboard };
}
