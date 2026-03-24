export type WorkScheduleType = 'FIXED' | 'SHIFT' | 'CUSTOM';

export interface WorkSchedule {
  id: string;
  organizationId: string;
  name: string;
  type: WorkScheduleType;
  workDays: number[];
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isTemplate: boolean;
  notes?: string;
  _count?: { contracts: number };
}

export interface WorkSchedulesResponse {
  data: WorkSchedule[];
  total: number;
}

export const WORK_SCHEDULE_TYPE_LABELS: Record<WorkScheduleType, string> = {
  FIXED: 'Fixo',
  SHIFT: 'Turno',
  CUSTOM: 'Personalizado',
};

export const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
