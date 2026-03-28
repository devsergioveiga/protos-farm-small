export type VacationPeriodStatus = 'ACCRUING' | 'AVAILABLE' | 'SCHEDULED' | 'EXPIRED';
export type VacationScheduleStatus = 'SCHEDULED' | 'PAID' | 'CANCELLED';

export interface VacationAcquisitivePeriod {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  daysEarned: number;
  daysTaken: number;
  daysLost: number;
  balance: number;
  status: VacationPeriodStatus;
  doublingDeadline: string;
  isNearDoubling: boolean;
}

export interface VacationSchedule {
  id: string;
  employeeId: string;
  employeeName: string;
  acquisitivePeriodId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  abono: number;
  grossAmount: number;
  inssAmount: number;
  irrfAmount: number;
  netAmount: number;
  fgtsAmount: number;
  paymentDueDate: string;
  status: VacationScheduleStatus;
  processedAt: string | null;
}

export interface ScheduleVacationInput {
  employeeId: string;
  acquisitivePeriodId: string;
  startDate: string;
  totalDays: number;
  abono: number;
}

export interface VacationCalculationPreview {
  baseSalary: number;
  oneThirdBonus: number;
  abonoAmount: number;
  grossAmount: number;
  inssAmount: number;
  irrfAmount: number;
  netAmount: number;
  fgtsAmount: number;
  paymentDueDate: string;
}
