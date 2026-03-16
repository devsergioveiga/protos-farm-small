// ─── Query ───────────────────────────────────────────────────────────

export interface FinancialDashboardQuery {
  farmId?: string; // undefined = all farms
  year: number;
  month: number; // 1-12
}

// ─── Output ──────────────────────────────────────────────────────────

export interface FinancialDashboardOutput {
  totalBankBalance: number;
  totalBankBalancePrevYear: number | null;
  payablesDue30d: number;
  payablesDue30dPrevYear: number | null;
  receivablesDue30d: number;
  receivablesDue30dPrevYear: number | null;
  monthResult: number;
  monthResultPrevYear: number | null;
  monthlyTrend: Array<{
    yearMonth: string;
    revenues: number;
    expenses: number;
  }>;
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
}

// ─── Error ───────────────────────────────────────────────────────────

export class FinancialDashboardError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'FinancialDashboardError';
  }
}
