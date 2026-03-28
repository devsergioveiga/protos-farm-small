// ─── Enums / union types ──────────────────────────────────────────────────────

export type StepStatus = 'OK' | 'FAILED' | 'PENDING';

// ─── Step types ───────────────────────────────────────────────────────────────

export interface StepResult {
  status: StepStatus;
  summary: string;
  details?: Record<string, unknown>;
  validatedAt: string;
}

export type StepResults = {
  step1?: StepResult;
  step2?: StepResult;
  step3?: StepResult;
  step4?: StepResult;
  step5?: StepResult;
  step6?: StepResult;
};

// ─── Main output type ─────────────────────────────────────────────────────────

export interface MonthlyClosingOutput {
  id: string;
  organizationId: string;
  periodId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'REOPENED';
  stepResults: StepResults;
  periodMonth: number;
  periodYear: number;
  completedAt: string | null;
  completedBy: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  createdAt: string;
}

// ─── Label maps ───────────────────────────────────────────────────────────────

export const STEP_LABELS: Record<number, string> = {
  1: 'Ponto Aprovado',
  2: 'Folha Fechada',
  3: 'Depreciacao Processada',
  4: 'Lancamentos Pendentes',
  5: 'Conciliacao Bancaria',
  6: 'Balancete Equilibrado',
};

export const STEP_MODULE_LINKS: Record<number, { path: string; label: string }> = {
  1: { path: '/timesheets', label: 'Ir para Espelhos de Ponto' },
  2: { path: '/payroll-runs', label: 'Ir para Folha de Pagamento' },
  3: { path: '/depreciation', label: 'Ir para Depreciacao' },
  4: { path: '/accounting-entries', label: 'Ir para Lancamentos Pendentes' },
  5: { path: '/reconciliation', label: 'Ir para Conciliacao Bancaria' },
  6: { path: '/trial-balance', label: 'Ir para Balancete' },
};
