// ─── Payroll Runs Types ────────────────────────────────────────────────

import Decimal from 'decimal.js';
import type { AbsencePayrollImpact } from '../employee-absences/employee-absences.types';

// ─── Error class ──────────────────────────────────────────────────────

export class PayrollRunError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = 'PayrollRunError';
  }
}

// ─── State machine ────────────────────────────────────────────────────

export const VALID_PAYROLL_TRANSITIONS: Record<string, Record<string, string>> = {
  START: { PENDING: 'PROCESSING' },
  CALCULATE: { PROCESSING: 'CALCULATED' },
  RECALC: { CALCULATED: 'PROCESSING' },
  CLOSE: { CALCULATED: 'COMPLETED' },
  REVERT: { COMPLETED: 'REVERTED' },
  ERROR: { PROCESSING: 'ERROR', CALCULATED: 'ERROR' },
};

// ─── Input / Output interfaces ────────────────────────────────────────

export interface EmployeePayrollInput {
  employeeId: string;
  baseSalary: Decimal;
  admissionDate: Date;
  dependentsCount: number;
  dependentsUnder14: number;
  alimonyAmount: Decimal;
  housingProvided: boolean;
  foodProvided: boolean;
  requestedHousing: Decimal;
  requestedFood: Decimal;
  regionalMinWage: Decimal;
  vtPercent: Decimal;
  timesheetData: {
    totalOvertime50: number;
    totalOvertime100: number;
    totalNightMinutes: number;
    totalAbsences: number;
  } | null;
  absenceData?: AbsencePayrollImpact | null;
  pendingAdvances: Decimal;
  customRubricas: Array<{
    code: string;
    description: string;
    type: 'PROVENTO' | 'DESCONTO';
    value: Decimal;
  }>;
}

export interface EmployeePayrollResult {
  baseSalary: Decimal;
  proRataDays: number | null;
  overtime50: Decimal;
  overtime100: Decimal;
  dsrValue: Decimal;
  nightPremium: Decimal;
  salaryFamily: Decimal;
  otherProvisions: Decimal;
  grossSalary: Decimal;
  inssAmount: Decimal;
  irrfAmount: Decimal;
  vtDeduction: Decimal;
  housingDeduction: Decimal;
  foodDeduction: Decimal;
  advanceDeduction: Decimal;
  otherDeductions: Decimal;
  netSalary: Decimal;
  fgtsAmount: Decimal;
  absenceInssDeduction: Decimal;
  suspensionDeduction: Decimal;
  fgtsBase: Decimal;
  inssPatronal: Decimal;
  lineItems: Array<{
    code: string;
    description: string;
    reference: string;
    type: 'PROVENTO' | 'DESCONTO';
    value: Decimal;
  }>;
}

export interface ThirteenthSalaryInput {
  parcel: 'FIRST' | 'SECOND';
  employeeId: string;
  baseSalary: Decimal;
  admissionDate: Date;
  monthsWorked: number;
  dependentsCount: number;
  alimonyAmount: Decimal;
  avgOvertime50: Decimal;
  avgOvertime100: Decimal;
  avgNightPremium: Decimal;
  firstParcelAmount?: Decimal;
}

// ─── CP Preview Types ─────────────────────────────────────────────────

export interface CpPreviewItem {
  type: string; // "Salario Liquido", "INSS Patronal", "FGTS", "IRRF", "VT", "Pensao", "Sindical"
  employeeName?: string;
  amount: number;
  dueDate: string; // ISO date
  costCenterItems: Array<{ costCenterName: string; percentage: number }>;
}

export interface TaxGuidePreviewItem {
  type: string; // "FUNRURAL", "SENAR", etc.
  amount: number;
  dueDate: string;
  referenceMonth: string;
}

export interface CpPreviewResponse {
  items: CpPreviewItem[];
  taxGuideItems: TaxGuidePreviewItem[];
  totalAmount: number;
  totalTaxGuides: number;
  runTotalNet: number;
  reconciled: boolean; // abs(totalAmount - runTotalNet) < 0.01
}

export interface EngineParams {
  inssBrackets: Array<{ from: Decimal; upTo: Decimal | null; rate: Decimal }>;
  irrfBrackets: Array<{ upTo: Decimal | null; rate: Decimal; deduction: Decimal }>;
  inssCeiling: Decimal;
  dependentDeduction: Decimal;
  irrfExemptionLimit: Decimal;
  redutorUpperLimit: Decimal;
  redutorA: Decimal;
  redutorB: Decimal;
  salaryFamilyValuePerChild: Decimal;
  salaryFamilyIncomeLimit: Decimal;
  ratPercent: Decimal;
}
