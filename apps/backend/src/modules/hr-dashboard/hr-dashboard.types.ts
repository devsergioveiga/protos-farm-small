// ─── HR Dashboard Types ───────────────────────────────────────────────
// INTEGR-03: HR KPI Dashboard response shape and query params

export interface HrDashboardQuery {
  farmId?: string;
  year: number;
  month: number;
}

export interface HrDashboardResponse {
  headcount: {
    total: number;
    byStatus: Record<string, number>; // ATIVO, AFASTADO, FERIAS, DESLIGADO
    byContractType: Record<string, number>; // CLT_INDETERMINATE, SEASONAL, etc.
  };
  currentMonthCost: {
    gross: number;
    net: number;
    charges: number;
    avgPerEmployee: number;
    costPerHectare: number | null;
  };
  trend12Months: Array<{
    yearMonth: string; // "YYYY-MM"
    gross: number;
    net: number;
    charges: number;
  }>;
  composition: Array<{
    label: string;
    amount: number;
    percentage: number;
  }>;
  costByActivity: Array<{
    activityType: string;
    totalCost: number;
  }>;
  turnover: {
    last12MonthsRate: number;
    terminationsLast12: number;
    admissionsLast12: number;
  };
  upcomingContractExpirations: Array<{
    days: number; // 30 | 60 | 90
    count: number;
    employees: Array<{
      id: string;
      name: string;
      endDate: string;
      contractType: string;
    }>;
  }>;
  alerts: {
    overduePayablesPayroll: number;
    pendingTimesheets: number;
    expiredContracts: number;
  };
}

export class HrDashboardError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'HrDashboardError';
  }
}
