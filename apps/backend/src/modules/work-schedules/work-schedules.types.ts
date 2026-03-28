export interface CreateWorkScheduleInput {
  name: string;
  type: 'FIXED' | 'SHIFT' | 'CUSTOM';
  workDays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  breakMinutes?: number; // default 60
  isTemplate?: boolean;
  notes?: string;
}

export interface UpdateWorkScheduleInput {
  name?: string;
  type?: 'FIXED' | 'SHIFT' | 'CUSTOM';
  workDays?: number[];
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  isTemplate?: boolean;
  notes?: string;
}

export interface ListWorkSchedulesParams {
  type?: string;
  isTemplate?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface WorkScheduleOutput {
  id: string;
  organizationId: string;
  name: string;
  type: 'FIXED' | 'SHIFT' | 'CUSTOM';
  workDays: number[];
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isTemplate: boolean;
  notes: string | null;
  contractsCount: number;
  createdAt: string;
  updatedAt: string;
}

export class WorkScheduleError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'WorkScheduleError';
    this.statusCode = statusCode;
  }
}
