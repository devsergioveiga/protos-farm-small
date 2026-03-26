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
  accountingBalance: number; // saldo real - emitidos A_COMPENSAR + recebidos A_COMPENSAR
  pendingEmitidos: number; // sum of A_COMPENSAR EMITIDO checks
  pendingRecebidos: number; // sum of A_COMPENSAR RECEBIDO checks
  openBillsCount: number; // count of OPEN credit card bills
  checksNearCompensation: number; // count of checks A_COMPENSAR with expectedCompensationDate within 7 days
  ruralCredit?: {
    totalContracted: number;
    outstandingBalance: number;
    activeContracts: number;
    nextPaymentDate: string | null;
    nextPaymentAmount: number | null;
  };
}

// ─── Patrimony Dashboard ─────────────────────────────────────────────

export interface PatrimonyDashboardQuery {
  farmId?: string;
  year: number;
  month: number;
}

export interface PatrimonyDashboardOutput {
  totalActiveValue: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  acquisitionsInPeriod: {
    count: number;
    totalValue: number;
  };
  disposalsInPeriod: {
    count: number;
    totalSaleValue: number;
    totalGainLoss: number;
  };
  assetCountByType: Array<{ assetType: string; count: number }>;
  assetCountByStatus: Array<{ status: string; count: number }>;
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
