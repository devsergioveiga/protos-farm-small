import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface FinancialDashboardData {
  totalBankBalance: number;
  totalBankBalancePrevYear: number | null;
  payablesDue30d: number;
  payablesDue30dPrevYear: number | null;
  receivablesDue30d: number;
  receivablesDue30dPrevYear: number | null;
  monthResult: number;
  monthResultPrevYear: number | null;
  monthlyTrend: Array<{ yearMonth: string; revenues: number; expenses: number }>;
  topExpenseCategories: Array<{
    category: string;
    categoryLabel: string;
    total: number;
    percentage: number;
  }>;
  topPayablesByCategory: Array<{
    rank: number;
    category: string;
    categoryLabel: string;
    total: number;
    relativePercent: number;
  }>;
  topReceivablesByClient: Array<{
    rank: number;
    clientName: string;
    total: number;
    relativePercent: number;
  }>;
  alerts: {
    overduePayablesCount: number;
    overduePayablesTotal: number;
    projectedBalanceNegative: boolean;
  };
  accountingBalance: number;
  pendingEmitidos: number;
  pendingRecebidos: number;
  openBillsCount: number;
  checksNearCompensation: number;
  ruralCredit?: {
    totalContracted: number;
    outstandingBalance: number;
    activeContracts: number;
    nextPaymentDate: string | null;
    nextPaymentAmount: number | null;
  };
}

export interface FinancialDashboardPeriod {
  year: number;
  month: number;
}

interface UseFinancialDashboardParams {
  farmId: string | null;
  period: FinancialDashboardPeriod;
}

interface UseFinancialDashboardResult {
  data: FinancialDashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFinancialDashboard(
  params: UseFinancialDashboardParams,
): UseFinancialDashboardResult {
  const [data, setData] = useState<FinancialDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, period } = params;

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.set('year', String(period.year));
      query.set('month', String(period.month));
      if (farmId) query.set('farmId', farmId);

      const qs = query.toString();
      const path = `/org/financial-dashboard${qs ? `?${qs}` : ''}`;
      const result = await api.get<FinancialDashboardData>(path);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dashboard financeiro';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, period.year, period.month]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  return { data, isLoading, error, refetch: fetchDashboard };
}
