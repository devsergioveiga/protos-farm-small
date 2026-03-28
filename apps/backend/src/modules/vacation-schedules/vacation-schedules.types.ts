import Decimal from 'decimal.js';

// ─── Vacation Calculation ─────────────────────────────────────────────

export interface VacationCalcInput {
  baseSalary: Decimal;
  daysScheduled: number;
  abonoDays: number; // 0 or 10 days sold (pecuniary bonus, OJ 386)
  avgOvertime: Decimal; // 12-month avg from PayrollRunItem
  avgNight: Decimal; // 12-month avg from PayrollRunItem
  dependentCount: number;
}

export interface VacationCalcResult {
  vacationBase: Decimal; // dailyRate * daysScheduled
  bonusThird: Decimal; // 1/3 constitutional bonus
  abonoValue: Decimal; // NOT subject to INSS/IRRF (OJ 386)
  grossTaxable: Decimal; // vacationBase + bonusThird + averages
  inssAmount: Decimal;
  irrfAmount: Decimal;
  fgtsAmount: Decimal;
  netAmount: Decimal; // grossTaxable - inss - irrf + abonoValue
}

// ─── Schedule Inputs ─────────────────────────────────────────────────

export interface ScheduleVacationInput {
  organizationId: string;
  employeeId: string;
  acquisitivePeriodId: string;
  startDate: string; // ISO date
  totalDays: number; // 5-30
  abono: number; // 0 or 10
  createdBy: string;
}

// ─── Output Shapes ───────────────────────────────────────────────────

export interface VacationPeriodOutput {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  daysEarned: number;
  daysTaken: number;
  daysLost: number;
  balance: number; // daysEarned - daysTaken
  status: string;
  doublingDeadline: Date; // endDate + 12 months
  isNearDoubling: boolean; // doublingDeadline - 60 days <= today
}

export interface VacationScheduleOutput {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName: string;
  acquisitivePeriodId: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  abono: number;
  grossAmount: Decimal;
  inssAmount: Decimal;
  irrfAmount: Decimal;
  netAmount: Decimal;
  fgtsAmount: Decimal;
  paymentDueDate: Date;
  status: string;
  receiptUrl: string | null;
  processedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface ListScheduleFilters {
  employeeId?: string;
  status?: string;
  from?: string;
  to?: string;
}

// ─── Custom Error ────────────────────────────────────────────────────

export class VacationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'VACATION_ERROR',
  ) {
    super(message);
    this.name = 'VacationError';
  }
}
