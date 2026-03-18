// ─── Filter Types ─────────────────────────────────────────────────────

export interface DashboardFilters {
  startDate: Date;
  endDate: Date;
  farmId?: string;
  category?: string;
}

// ─── KPI Types ────────────────────────────────────────────────────────

export interface KpiValue {
  current: number;
  previous: number;
  changePercent: number; // ((current - previous) / previous) * 100, 0 if previous is 0
}

export interface DashboardMetrics {
  totalVolume: KpiValue; // sum of PO totals in R$
  requestCount: KpiValue; // count of RCs created
  avgCycleTimeDays: KpiValue; // avg days from RC creation to Payable PAID
  onTimeDeliveryPct: KpiValue; // % of POs delivered by expectedDeliveryDate
  accumulatedSaving: KpiValue; // sum of saving from quotation comparisons
}

// ─── Chart Types ──────────────────────────────────────────────────────

export interface CategoryChartPoint {
  category: string;
  label: string; // pt-BR display label
  value: number; // R$ total
}

export interface SavingChartPoint {
  month: string; // YYYY-MM
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

// ─── Alert Types ──────────────────────────────────────────────────────

export interface DashboardAlert {
  type: 'PENDING_RC_AGING' | 'PO_OVERDUE' | 'BUDGET_OVERAGE';
  message: string;
  count: number;
  referenceIds: string[];
}

// ─── Error ────────────────────────────────────────────────────────────

export class PurchaseDashboardError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PurchaseDashboardError';
  }
}
