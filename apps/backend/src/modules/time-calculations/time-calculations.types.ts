import Decimal from 'decimal.js';

export interface DailyWorkInput {
  workedMinutes: Decimal;
  scheduledMinutes: Decimal;
  isDayOff: boolean;
  nightMinutes: Decimal;
}

export interface DailyWorkResult {
  regularMinutes: Decimal;
  overtime50Minutes: Decimal;
  overtime100Minutes: Decimal;
  nightPremiumMinutes: Decimal;
  interjornada: Decimal | null;
  interjornadaAlert: boolean;
}

export interface RuralNightResult {
  premium: Decimal;
  nightHours: Decimal;
}

export interface OvertimeConfig {
  overtimeBase: 'DAILY' | 'WEEKLY';
  toleranceMinutes: number;
  nightStartHour: number; // default 21
  nightEndHour: number; // default 5
}

export interface HolidayInfo {
  date: string;
  name: string;
  type: string;
}

export interface MonthlyCalculationInput {
  employeeId: string;
  referenceMonth: string; // YYYY-MM-DD (first day of month)
  dailyEntries: DailyWorkInput[];
  previousClockOut?: string; // for interjornada check
}

// Used by time-calculations.service calcMonthlyTotals
export interface MonthlyTotals {
  totalWorked: Decimal;
  totalOvertime50: Decimal;
  totalOvertime100: Decimal;
  totalNightMinutes: Decimal;
  totalAbsences: number;
}

export interface MonthlyCalculationResult {
  totalWorkedMinutes: Decimal;
  totalOvertime50: Decimal;
  totalOvertime100: Decimal;
  totalNightMinutes: Decimal;
  totalAbsences: number;
  dailyResults: DailyWorkResult[];
  inconsistencies: Inconsistency[];
}

export interface Inconsistency {
  date: string;
  type: 'MISSING_CLOCK_OUT' | 'INTERJORNADA_VIOLATION' | 'OUT_OF_RANGE' | 'NO_BOUNDARY';
  description: string;
  severity: 'WARNING' | 'ERROR';
}
