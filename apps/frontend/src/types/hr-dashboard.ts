// HR Dashboard types — mirrors GET /org/hr-dashboard response shape

export interface HrDashboardQuery {
  farmId?: string;
  year: number;
  month: number;
}

// Sub-section types

export interface HrHeadcount {
  total: number;
  byStatus: Record<string, number>;
  byContractType: Record<string, number>;
}

export interface HrCurrentMonthCost {
  gross: number;
  net: number;
  charges: number;
  avgPerEmployee: number;
  costPerHectare: number | null;
}

export interface HrTrend12MonthItem {
  yearMonth: string;
  gross: number;
  net: number;
  charges: number;
}

export interface HrCompositionItem {
  label: string;
  amount: number;
  percentage: number;
}

export interface HrCostByActivityItem {
  activityType: string;
  totalCost: number;
}

export interface HrTurnover {
  last12MonthsRate: number;
  terminationsLast12: number;
  admissionsLast12: number;
}

export interface HrContractExpirationEmployee {
  id: string;
  name: string;
  endDate: string;
  contractType: string;
}

export interface HrContractExpirationBucket {
  days: number;
  count: number;
  employees: HrContractExpirationEmployee[];
}

export interface HrAlerts {
  overduePayablesPayroll: number;
  pendingTimesheets: number;
  expiredContracts: number;
}

// Full response

export interface HrDashboardResponse {
  headcount: HrHeadcount;
  currentMonthCost: HrCurrentMonthCost;
  trend12Months: HrTrend12MonthItem[];
  composition: HrCompositionItem[];
  costByActivity: HrCostByActivityItem[];
  turnover: HrTurnover;
  upcomingContractExpirations: HrContractExpirationBucket[];
  alerts: HrAlerts;
}
