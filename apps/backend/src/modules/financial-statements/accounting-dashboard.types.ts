// ─── Accounting Dashboard Types ──────────────────────────────────────────────
// Types for the executive accounting dashboard endpoint.
// Provides KPI cards, 12-month chart, cost composition, BP indicators, and alerts.

export interface AccountingDashboardFilters {
  fiscalYearId: string;
  month: number;
}

export interface DashboardKpiCard {
  label: string; // 'Resultado Acumulado', 'Receita Total', etc.
  value: string; // Decimal string BRL
  deltaPercent: string | null; // percent change vs prior period, e.g. '+12.30' or '-5.40'
  deltaDirection: 'up' | 'down' | 'neutral';
}

export interface MonthlyRevenueExpense {
  month: number; // 1-12
  receita: string; // Decimal string
  despesa: string; // Decimal string
}

export interface CostCompositionItem {
  label: string; // e.g. 'CPV', 'Despesas Administrativas', etc.
  value: string; // Decimal string
  percent: string; // e.g. '35.20'
}

export interface BpIndicatorCard {
  id: string; // 'liquidez-corrente', 'endividamento-geral', 'roe', 'pl-ha'
  label: string; // 'Liquidez Corrente', etc.
  value: string | null; // Decimal string or null
  sparkline: { month: number; value: number }[];
}

export interface AccountingAlert {
  id: string; // 'periodos-abertos', 'lancamentos-pendentes', 'contas-sem-sped'
  label: string; // Pt-BR alert text
  count: number; // number of items
  navigateTo: string; // frontend route
  severity: 'warning' | 'info';
}

export interface AccountingDashboardOutput {
  kpiCards: DashboardKpiCard[];
  monthlyChart: MonthlyRevenueExpense[];
  costComposition: CostCompositionItem[];
  bpIndicators: BpIndicatorCard[];
  alerts: AccountingAlert[];
}
