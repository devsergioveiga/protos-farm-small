// ─── Fiscal Periods Types ─────────────────────────────────────────────────────
// COA-04: Fiscal year and accounting period management types.

import type { PeriodStatus } from '@prisma/client';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateFiscalYearInput {
  name: string;
  startDate: string; // ISO date string: YYYY-MM-DD
  endDate: string; // ISO date string: YYYY-MM-DD
}

export interface ClosePeriodInput {
  closedBy: string; // userId
}

export interface ReopenPeriodInput {
  reopenedBy: string; // userId
  reopenReason: string;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface AccountingPeriodOutput {
  id: string;
  organizationId: string;
  fiscalYearId: string;
  month: number;
  year: number;
  status: PeriodStatus;
  openedAt: Date;
  closedAt: Date | null;
  closedBy: string | null;
  reopenedAt: Date | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FiscalYearOutput {
  id: string;
  organizationId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  periods: AccountingPeriodOutput[];
}

// ─── Error codes ──────────────────────────────────────────────────────────────

export type FiscalPeriodErrorCode =
  | 'OVERLAPPING_YEAR'
  | 'INVALID_TRANSITION'
  | 'REASON_REQUIRED'
  | 'PERIOD_NOT_FOUND'
  | 'YEAR_NOT_FOUND';

export class FiscalPeriodError extends Error {
  readonly code: FiscalPeriodErrorCode;
  readonly statusCode: number;

  constructor(message: string, code: FiscalPeriodErrorCode, statusCode = 422) {
    super(message);
    this.name = 'FiscalPeriodError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, FiscalPeriodError.prototype);
  }
}
