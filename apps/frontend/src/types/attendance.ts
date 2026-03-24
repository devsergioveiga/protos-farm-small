export type TimeEntrySource = 'MOBILE' | 'WEB' | 'MANAGER';
export type TimesheetStatus =
  | 'DRAFT'
  | 'PENDING_MANAGER'
  | 'MANAGER_APPROVED'
  | 'PENDING_RH'
  | 'APPROVED'
  | 'LOCKED'
  | 'REJECTED';
export type OvertimeBankType = 'CREDIT' | 'COMPENSATION' | 'EXPIRATION';

export interface TimeEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  farmId: string;
  farmName: string;
  date: string;
  clockIn: string;
  breakStart: string | null;
  breakEnd: string | null;
  clockOut: string | null;
  workedMinutes: number | null;
  nightMinutes: number | null;
  outOfRange: boolean;
  noBoundary: boolean;
  source: TimeEntrySource;
  managerNote: string | null;
  activities: TimeEntryActivity[];
  createdAt: string;
}

export interface TimeEntryActivity {
  id: string;
  operationType: string;
  minutes: number;
  hourlyRate: string;
  costAmount: string;
  notes: string | null;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  employeeName: string;
  referenceMonth: string;
  status: TimesheetStatus;
  totalWorked: number;
  totalOvertime50: number;
  totalOvertime100: number;
  totalNightMinutes: number;
  totalAbsences: number;
  closingDeadline: string | null;
  managerApprovedBy: string | null;
  managerApprovedAt: string | null;
  rhApprovedBy: string | null;
  rhApprovedAt: string | null;
  employeeAcceptedAt: string | null;
  corrections: TimesheetCorrection[];
  inconsistencies: TimesheetInconsistency[];
}

export interface TimesheetCorrection {
  id: string;
  timeEntryId: string | null;
  correctedBy: string;
  justification: string;
  beforeJson: Record<string, unknown>;
  afterJson: Record<string, unknown>;
  createdAt: string;
}

export interface TimesheetInconsistency {
  timeEntryId: string;
  date: string;
  type: string;
  description: string;
  severity: 'WARNING' | 'ERROR';
}

export interface OvertimeBankSummary {
  employeeId: string;
  employeeName: string;
  totalCredits: number;
  totalCompensations: number;
  totalExpirations: number;
  currentBalance: number;
  expiringIn30Days: number;
  expiringIn7Days: number;
  entries: OvertimeBankEntry[];
}

export interface OvertimeBankEntry {
  id: string;
  referenceMonth: string;
  minutes: number;
  balanceType: OvertimeBankType;
  expiresAt: string;
}

export interface CreateTimeEntryInput {
  date: string;
  clockIn: string;
  clockOut?: string;
  breakStart?: string;
  breakEnd?: string;
  source: TimeEntrySource;
  managerNote?: string;
  farmId: string;
}

export interface AddActivityInput {
  operationType: string;
  fieldOperationId?: string;
  fieldPlotId?: string;
  costCenterId?: string;
  minutes: number;
  notes?: string;
}
