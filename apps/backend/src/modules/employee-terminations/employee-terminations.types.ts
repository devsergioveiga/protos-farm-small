// ─── Employee Terminations Types ──────────────────────────────────────

import Decimal from 'decimal.js';

// ─── Error class ──────────────────────────────────────────────────────

export class TerminationError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = 'TERMINATION_ERROR',
  ) {
    super(message);
    this.name = 'TerminationError';
  }
}

// ─── Termination types ────────────────────────────────────────────────

export type TerminationType =
  | 'WITHOUT_CAUSE'
  | 'WITH_CAUSE'
  | 'VOLUNTARY'
  | 'SEASONAL_END'
  | 'MUTUAL_AGREEMENT';

export type NoticePeriodType = 'WORKED' | 'COMPENSATED' | 'WAIVED';

export type TerminationStatus = 'DRAFT' | 'PROCESSED' | 'PAID';

// ─── Calculation interfaces ───────────────────────────────────────────

/**
 * Pure input for termination calculation (no DB access).
 * All dates should be ISO date strings or Date objects.
 */
export interface TerminationInput {
  admissionDate: Date;
  terminationDate: Date;
  terminationType: TerminationType;
  noticeType: NoticePeriodType;
  lastSalary: Decimal;
  fgtsBalance: Decimal; // estimated: sum of 8% deposits over employment
  vacationVestedDays: number; // unpaid vested vacation days from past acquisitive periods
  vacationPropDays: number; // proportional days in current acquisitive period
  monthsThirteenth: number; // months worked in current year (>=15 days = 1 month)
  avgOvertime: Decimal; // average overtime 50% + 100% from last 12 months
  avgNight: Decimal; // average night premium from last 12 months
  dependentCount: number;
}

export interface TerminationResult {
  balanceSalary: Decimal;
  noticePay: Decimal;
  noticePeriodDays: number;
  thirteenthProp: Decimal;
  vacationVested: Decimal;
  vacationProp: Decimal;
  vacationBonus: Decimal; // 1/3 constitutional bonus on (vested + prop)
  fgtsBalance: Decimal;
  fgtsPenalty: Decimal;
  fgtsPenaltyRate: Decimal; // 0.40, 0.20, or 0.00
  totalGross: Decimal;
  inssAmount: Decimal;
  irrfAmount: Decimal;
  totalNet: Decimal;
  paymentDeadline: Date; // terminationDate + 10 calendar days
}

// ─── Service interfaces ───────────────────────────────────────────────

export interface CreateTerminationInput {
  organizationId: string;
  employeeId: string;
  terminationType: string;
  terminationDate: string; // "YYYY-MM-DD"
  noticePeriodType: string;
  fgtsBalanceOverride?: string; // optional manual override for FGTS balance
  createdBy: string;
}

export interface ListTerminationsInput {
  organizationId: string;
  terminationType?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface TerminationOutput {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName: string;
  terminationType: string;
  terminationDate: string;
  noticePeriodDays: number;
  noticePeriodType: string;
  balanceSalary: string;
  thirteenthProp: string;
  vacationVested: string;
  vacationProp: string;
  vacationBonus: string;
  noticePay: string;
  fgtsBalance: string;
  fgtsPenalty: string;
  totalGross: string;
  inssAmount: string;
  irrfAmount: string;
  totalNet: string;
  paymentDeadline: string;
  trctPdfUrl: string | null;
  grfPdfUrl: string | null;
  status: string;
  processedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface EmployeeData {
  id: string;
  name: string;
  cpf: string;
  admissionDate: Date;
  cargo?: string;
}
