// ─── Payroll Provisions Types ────────────────────────────────────────────────

import Decimal from 'decimal.js';

// ─── Error class ──────────────────────────────────────────────────────

export class PayrollProvisionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = 'PayrollProvisionError';
  }
}

// ─── Calculation interfaces ───────────────────────────────────────────

export interface ProvisionCalcResult {
  vacationProvision: Decimal;
  vacationCharges: Decimal;
  vacationTotal: Decimal;
  thirteenthProvision: Decimal;
  thirteenthCharges: Decimal;
  thirteenthTotal: Decimal;
}

export interface CalculateProvisionsInput {
  organizationId: string;
  referenceMonth: string; // "YYYY-MM" format
  createdBy: string;
}

// ─── Output interfaces ────────────────────────────────────────────────

export interface ProvisionOutput {
  id: string;
  employeeId: string;
  employeeName: string;
  referenceMonth: string;
  provisionType: string;
  baseSalary: number;
  provisionAmount: number;
  chargesAmount: number;
  totalAmount: number;
  costCenterId: string | null;
  costCenterName: string | null;
  accountingEntryJson: object | null;
  reversedAt: string | null;
  reversedBy: string | null;
  createdAt: string;
}

export interface ProvisionReportRow {
  costCenterId: string | null;
  costCenterName: string;
  vacationTotal: number;
  thirteenthTotal: number;
  chargesTotal: number;
  grandTotal: number;
}

export interface CalculateProvisionsSummary {
  processedCount: number;
  totalVacation: number;
  totalThirteenth: number;
  totalCharges: number;
}

// ─── Accounting entry JSON structure (stub for Phase 32 GL integration) ─

export interface AccountingEntryStub {
  debitAccount: string; // "6.1.01" (vacation) or "6.1.02" (13th)
  debitLabel: string; // "Despesa com Ferias" or "Despesa com 13o"
  creditAccount: string; // "2.2.01" (vacation) or "2.2.02" (13th)
  creditLabel: string; // "Provisao de Ferias a Pagar" or "Provisao de 13o a Pagar"
  amount: number;
  referenceMonth: string;
  employeeId: string;
}
