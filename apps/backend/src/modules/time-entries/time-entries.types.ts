import type { TimeEntrySource } from '@prisma/client';

export class TimeEntryError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TimeEntryError';
  }
}

export interface CreateTimeEntryInput {
  employeeId: string;
  farmId: string;
  date: string; // ISO date YYYY-MM-DD
  clockIn: string; // ISO datetime
  breakStart?: string;
  breakEnd?: string;
  clockOut?: string;
  latitude?: number;
  longitude?: number;
  source: TimeEntrySource;
  managerNote?: string; // required when source = MANAGER
}

export interface UpdateTimeEntryInput {
  clockIn?: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  clockOut?: string | null;
  managerNote?: string;
}

export interface TimeEntryListQuery {
  farmId?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: TimeEntrySource;
  page?: number;
  limit?: number;
}

export interface TimeEntryOutput {
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
  latitude: number | null;
  longitude: number | null;
  source: TimeEntrySource;
  managerNote: string | null;
  timesheetId: string | null;
  payrollRunId: string | null;
  activities: TimeEntryActivityOutput[];
  createdBy: string;
  createdAt: string;
}

export interface CreateTimeEntryActivityInput {
  timeEntryId: string;
  operationType: string;
  fieldOperationId?: string;
  fieldPlotId?: string;
  farmLocationId?: string;
  costCenterId?: string;
  minutes: number;
  notes?: string;
}

export interface TimeEntryActivityOutput {
  id: string;
  timeEntryId: string;
  operationType: string;
  fieldOperationId: string | null;
  fieldPlotId: string | null;
  farmLocationId: string | null;
  costCenterId: string | null;
  minutes: number;
  hourlyRate: string; // Decimal as string
  costAmount: string; // Decimal as string
  notes: string | null;
}
