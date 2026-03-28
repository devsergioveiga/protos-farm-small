// ─── Salary Advances Types ────────────────────────────────────────────

export class SalaryAdvanceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = 'SalaryAdvanceError';
  }
}

export interface CreateAdvanceInput {
  employeeId: string;
  referenceMonth: string; // "2026-03"
  amount: number;
  advanceDate: string; // "2026-03-15"
  notes?: string;
}

export interface BatchAdvanceInput {
  referenceMonth: string;
  advanceDate: string;
  percentOfSalary?: number; // default 40
}
