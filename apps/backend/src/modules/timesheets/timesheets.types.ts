import type { TimesheetStatus } from '@prisma/client';

export class TimesheetError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TimesheetError';
  }
}

export interface CreateTimesheetInput {
  employeeId: string;
  referenceMonth: string;
  closingDeadline?: string;
}

export interface TimesheetApprovalInput {
  action: 'APPROVE_MANAGER' | 'APPROVE_RH' | 'REJECT' | 'EMPLOYEE_ACCEPT' | 'EMPLOYEE_DISPUTE';
  justification?: string; // required for REJECT and EMPLOYEE_DISPUTE
}

export interface TimesheetCorrectionInput {
  timeEntryId: string;
  justification: string;
  corrections: {
    clockIn?: string;
    breakStart?: string | null;
    breakEnd?: string | null;
    clockOut?: string | null;
  };
}

export interface TimesheetListQuery {
  farmId?: string;
  employeeId?: string;
  referenceMonth?: string;
  status?: TimesheetStatus;
  page?: number;
  limit?: number;
}

export interface TimesheetOutput {
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
  employeeDisputeNote: string | null;
  payrollRunId: string | null;
  notes: string | null;
  corrections: TimesheetCorrectionOutput[];
  inconsistencies: TimesheetInconsistency[];
  createdAt: string;
}

export interface TimesheetCorrectionOutput {
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
  type: 'MISSING_CLOCK_OUT' | 'INTERJORNADA_VIOLATION' | 'OUT_OF_RANGE' | 'NO_BOUNDARY';
  description: string;
  severity: 'WARNING' | 'ERROR';
}
