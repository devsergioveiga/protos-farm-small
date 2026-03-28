import Decimal from 'decimal.js';
import Holidays from 'date-holidays';
import { differenceInMinutes } from 'date-fns';
import type {
  DailyWorkInput,
  DailyWorkResult,
  RuralNightResult,
  MonthlyTotals,
} from './time-calculations.types';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

// Rural night premium factor: 1 real hour = 60/52.5 contractual hours
const HORA_REDUZIDA_FATOR = new Decimal(60).div(new Decimal('52.5'));

// Night premium rate: 25% per Lei 5.889/73 (rural, not urban 20%)
const NIGHT_PREMIUM_RATE = new Decimal('0.25');

// Minimum interjornada gap: 11 hours = 660 minutes (CLT art. 66)
const INTERJORNADA_MIN_MINUTES = 660;

// Lazy-initialized holiday checker cache by locale key
const holidaysCache = new Map<string, Holidays>();

function getHolidays(state?: string, city?: string): Holidays {
  const key = `BR-${state ?? ''}-${city ?? ''}`;
  if (!holidaysCache.has(key)) {
    const hd = state
      ? city
        ? new Holidays('BR', state, city)
        : new Holidays('BR', state)
      : new Holidays('BR');
    holidaysCache.set(key, hd);
  }
  return holidaysCache.get(key)!;
}

/**
 * Determines if a given date is a Sunday or Brazilian public holiday.
 *
 * @param date - The date to check (timezone-aware; uses local date components)
 * @param state - Optional two-letter Brazilian state code (e.g. 'SP', 'MG')
 * @param city - Optional city name for municipal holidays
 */
export function isHolidayOrSunday(date: Date, state?: string, city?: string): boolean {
  // Sunday check (getDay() returns 0 for Sunday in local time)
  if (date.getDay() === 0) return true;

  const hd = getHolidays(state, city);
  return hd.isHoliday(date) !== false;
}

/**
 * Calculates interjornada gap between previous clock-out and current clock-in.
 *
 * @returns { gapMinutes: Decimal | null, alert: boolean }
 */
export function calcInterjornada(
  previousClockOut: Date | null,
  currentClockIn: Date,
): { gapMinutes: Decimal | null; alert: boolean } {
  if (!previousClockOut) {
    return { gapMinutes: null, alert: false };
  }

  const gapMinutes = new Decimal(differenceInMinutes(currentClockIn, previousClockOut));
  const alert = gapMinutes.lessThan(INTERJORNADA_MIN_MINUTES);

  return { gapMinutes, alert };
}

/**
 * Calculates daily work breakdown: regular, overtime50, overtime100, night premium, interjornada.
 *
 * @param input - Worked and scheduled minutes, day-off flag, night minutes
 * @param previousClockOut - Optional previous day clock-out for interjornada check
 * @param clockIn - Optional current day clock-in for interjornada check
 */
export function calcDailyWork(
  input: DailyWorkInput,
  previousClockOut?: Date | null,
  clockIn?: Date,
): DailyWorkResult {
  const { workedMinutes, scheduledMinutes, isDayOff, nightMinutes } = input;

  let regularMinutes: Decimal;
  let overtime50Minutes: Decimal;
  let overtime100Minutes: Decimal;

  if (isDayOff) {
    // On Sundays/holidays: all worked time is 100% overtime, no regular time
    regularMinutes = new Decimal(0);
    overtime50Minutes = new Decimal(0);
    overtime100Minutes = workedMinutes;
  } else {
    // Normal day: up to scheduled = regular, excess = 50% overtime
    regularMinutes = Decimal.min(workedMinutes, scheduledMinutes);
    overtime50Minutes = Decimal.max(new Decimal(0), workedMinutes.minus(scheduledMinutes));
    overtime100Minutes = new Decimal(0);
  }

  // Interjornada check
  let interjornada: Decimal | null = null;
  let interjornadaAlert = false;

  if (previousClockOut && clockIn) {
    const result = calcInterjornada(previousClockOut, clockIn);
    interjornada = result.gapMinutes;
    interjornadaAlert = result.alert;
  }

  return {
    regularMinutes,
    overtime50Minutes,
    overtime100Minutes,
    nightPremiumMinutes: nightMinutes,
    interjornada,
    interjornadaAlert,
  };
}

/**
 * Calculates the rural night premium for a given number of night minutes.
 *
 * Rural night period: 21h–5h (Lei 5.889/73)
 * Premium: 25% on contracted hours (hora reduzida: 52m30s = 60/52.5 factor)
 *
 * @param nightMinutes - Real minutes worked during the night period
 * @param hourlyRate - Employee's hourly rate in any monetary unit
 */
export function calcRuralNightPremium(
  nightMinutes: Decimal,
  hourlyRate: Decimal,
): RuralNightResult {
  if (nightMinutes.isZero()) {
    return {
      nightHours: new Decimal(0),
      premium: new Decimal(0),
    };
  }

  // Convert real minutes to contractual hours: (nightMinutes / 60) * (60 / 52.5)
  const nightHours = nightMinutes.div(60).mul(HORA_REDUZIDA_FATOR);

  // Premium = contractualHours * hourlyRate * 25%
  const premium = nightHours.mul(hourlyRate).mul(NIGHT_PREMIUM_RATE);

  return { nightHours, premium };
}

/**
 * Aggregates an array of daily results into monthly totals.
 *
 * An absence is defined as a day where all worked minutes are zero.
 */
export function calcMonthlyTotals(dailyResults: DailyWorkResult[]): MonthlyTotals {
  return dailyResults.reduce<MonthlyTotals>(
    (acc, day) => {
      const dayTotal = day.regularMinutes.plus(day.overtime50Minutes).plus(day.overtime100Minutes);

      const isAbsence = dayTotal.isZero();

      return {
        totalWorked: acc.totalWorked.plus(dayTotal),
        totalOvertime50: acc.totalOvertime50.plus(day.overtime50Minutes),
        totalOvertime100: acc.totalOvertime100.plus(day.overtime100Minutes),
        totalNightMinutes: acc.totalNightMinutes.plus(day.nightPremiumMinutes),
        totalAbsences: acc.totalAbsences + (isAbsence ? 1 : 0),
      };
    },
    {
      totalWorked: new Decimal(0),
      totalOvertime50: new Decimal(0),
      totalOvertime100: new Decimal(0),
      totalNightMinutes: new Decimal(0),
      totalAbsences: 0,
    },
  );
}
