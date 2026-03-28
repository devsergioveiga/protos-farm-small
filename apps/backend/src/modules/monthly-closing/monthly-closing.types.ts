// ─── Monthly Closing Types ────────────────────────────────────────────────────
// Types for 6-step monthly closing checklist and period lock.

export class MonthlyClosingError extends Error {
  readonly code: string;
  readonly statusCode: number;
  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'MonthlyClosingError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, MonthlyClosingError.prototype);
  }
}

export type StepStatus = 'OK' | 'FAILED' | 'PENDING';

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

export interface MonthlyClosingOutput {
  id: string;
  organizationId: string;
  periodId: string;
  status: string;
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

export const STEP_LABELS: Record<number, string> = {
  1: 'Ponto Aprovado',
  2: 'Folha Fechada',
  3: 'Depreciacao Processada',
  4: 'Lancamentos Pendentes',
  5: 'Conciliacao Bancaria',
  6: 'Balancete Equilibrado',
};
