// ─── Employee Absences Types ──────────────────────────────────────────

export type AbsenceTypeValue =
  | 'MEDICAL_CERTIFICATE'
  | 'INSS_LEAVE'
  | 'WORK_ACCIDENT'
  | 'MATERNITY'
  | 'PATERNITY'
  | 'MARRIAGE'
  | 'BEREAVEMENT'
  | 'MILITARY'
  | 'OTHER';

// ─── Input ───────────────────────────────────────────────────────────

export interface CreateAbsenceInput {
  organizationId: string;
  employeeId: string;
  absenceType: AbsenceTypeValue;
  startDate: string; // ISO date
  endDate?: string; // ISO date, optional for open-ended INSS
  catNumber?: string; // required for WORK_ACCIDENT
  notes?: string;
  createdBy: string;
}

export interface UpdateAbsenceInput {
  notes?: string;
  endDate?: string; // Only for open-ended absences
}

export interface RegisterReturnInput {
  returnDate: string; // ISO date
}

// ─── Output ──────────────────────────────────────────────────────────

export interface AbsencePayrollImpact {
  companyPaidDays: number;
  inssPaidDays: number;
  suspendedDays: number;
  fgtsFullMonth: boolean; // true for WORK_ACCIDENT + INSS_LEAVE
}

export interface AbsenceOutput {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName: string;
  absenceType: string;
  startDate: Date;
  endDate: Date | null;
  totalDays: number | null;
  catNumber: string | null;
  inssStartDate: Date | null;
  stabilityEndsAt: Date | null;
  returnDate: Date | null;
  asoRequired: boolean;
  asoDocumentId: string | null;
  payrollImpact: AbsencePayrollImpact | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface ListAbsenceFilters {
  employeeId?: string;
  absenceType?: string;
  from?: string;
  to?: string;
}

// ─── Custom Error ────────────────────────────────────────────────────

export class AbsenceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'ABSENCE_ERROR',
  ) {
    super(message);
    this.name = 'AbsenceError';
  }
}
