// ─── Enum Constants ───────────────────────────────────────────────────────────

export const BUDGET_PERIOD_TYPES = ['MENSAL', 'TRIMESTRAL', 'SAFRA'] as const;
export type BudgetPeriodTypeValue = (typeof BUDGET_PERIOD_TYPES)[number];

// ─── Label Maps (pt-BR) ──────────────────────────────────────────────────────

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriodTypeValue, string> = {
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  SAFRA: 'Safra',
};

export const SUPPLIER_CATEGORY_LABELS: Record<string, string> = {
  INSUMO_AGRICOLA: 'Insumos Agricolas',
  PECUARIO: 'Pecuario',
  PECAS: 'Pecas e Equipamentos',
  COMBUSTIVEL: 'Combustivel',
  EPI: 'EPI',
  SERVICOS: 'Servicos',
  OUTROS: 'Outros',
};

// ─── Error Class ─────────────────────────────────────────────────────────────

export class PurchaseBudgetError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PurchaseBudgetError';
  }
}

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CreatePurchaseBudgetInput {
  farmId?: string;
  costCenterId?: string;
  category: string;
  periodType: BudgetPeriodTypeValue;
  periodStart: string;
  periodEnd: string;
  budgetedAmount: number;
  notes?: string;
}

export interface UpdatePurchaseBudgetInput {
  budgetedAmount?: number;
  notes?: string;
  periodEnd?: string;
}

export interface ListPurchaseBudgetsQuery {
  page?: number;
  limit?: number;
  farmId?: string;
  category?: string;
  periodType?: string;
  periodStart?: string;
  periodEnd?: string;
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface PurchaseBudgetOutput {
  id: string;
  organizationId: string;
  farmId: string | null;
  costCenterId: string | null;
  category: string;
  categoryLabel: string;
  periodType: BudgetPeriodTypeValue;
  periodTypeLabel: string;
  periodStart: string;
  periodEnd: string;
  budgetedAmount: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListPurchaseBudgetsResult {
  data: PurchaseBudgetOutput[];
  total: number;
  page: number;
  limit: number;
}

export interface BudgetExecutionRow {
  budgetId: string;
  category: string;
  categoryLabel: string;
  farmId: string | null;
  farmName: string | null;
  periodStart: string;
  periodEnd: string;
  budgetedAmount: string;
  requisitado: string;
  comprado: string;
  pago: string;
  percentUsed: number;
}

export interface BudgetExecutionResult {
  rows: BudgetExecutionRow[];
  totals: {
    budgeted: string;
    requisitado: string;
    comprado: string;
    pago: string;
  };
}

export interface BudgetCheckResult {
  exceeded: boolean;
  budgetId?: string;
  budgetedAmount?: string;
  currentSpent?: string;
  percentUsed?: number;
}
