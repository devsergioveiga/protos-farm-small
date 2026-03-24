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

export interface MonthlyTotals {
  totalWorked: Decimal;
  totalOvertime50: Decimal;
  totalOvertime100: Decimal;
  totalNightMinutes: Decimal;
  totalAbsences: number;
}
