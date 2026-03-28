import Decimal from 'decimal.js';
import type { EngineInput, EngineOutput } from './depreciation.types';

// Set global rounding mode for all Decimal operations in this module
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

/**
 * Returns the number of days in a given month.
 * @param year - Full calendar year (e.g. 2025)
 * @param month - 1-based month (1 = January, 12 = December)
 */
export function daysInMonth(year: number, month: number): number {
  // new Date(year, month, 0) gives the last day of the previous month
  // e.g. new Date(2025, 2, 0) = last day of January 2025 = 31
  // So new Date(year, month, 0) where month is 1-based gives us the last day of that month
  return new Date(year, month, 0).getDate();
}

/**
 * Normalizes a Date to a UTC-safe date object preserving the calendar date
 * regardless of timezone. Dates from Prisma DateTime fields are UTC midnight,
 * so we read them as UTC to get the correct calendar day.
 */
function toCalendarDate(d: Date): { year: number; month: number; day: number } {
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * Computes the effective number of depreciable days in a period,
 * applying pro-rata-die when the acquisition or disposal falls within the month.
 *
 * @returns { days, totalDays } where days <= totalDays
 */
export function getProRataDays(
  periodYear: number,
  periodMonth: number,
  acquisitionDate: Date,
  disposalDate: Date | null | undefined,
): { days: number; totalDays: number } {
  const total = daysInMonth(periodYear, periodMonth);

  let startDay = 1;
  let endDay = total;

  // Pro-rata for acquisition: if asset was acquired within this period
  const acq = toCalendarDate(acquisitionDate);
  if (acq.year === periodYear && acq.month === periodMonth) {
    startDay = acq.day;
  }

  // Pro-rata for disposal: if asset was disposed within this period
  if (disposalDate) {
    const disp = toCalendarDate(disposalDate);
    if (disp.year === periodYear && disp.month === periodMonth) {
      endDay = disp.day;
    }
  }

  // If acquisition and disposal cancel out to nothing
  if (endDay < startDay) {
    return { days: 0, totalDays: total };
  }

  const days = endDay - startDay + 1;
  return { days, totalDays: total };
}

/**
 * Pure arithmetic depreciation computation — no database access.
 * Dispatches by method and applies pro-rata-die and residual value clamping.
 */
export function computeDepreciation(input: EngineInput): EngineOutput {
  const {
    acquisitionValue,
    residualValue,
    openingBookValue,
    config,
    period,
    acquisitionDate,
    disposalDate,
    periodicHours,
    periodicUnits,
  } = input;

  const total = daysInMonth(period.year, period.month);
  const { days, totalDays } = getProRataDays(
    period.year,
    period.month,
    acquisitionDate,
    disposalDate,
  );

  const isProRata = days < totalDays;
  const proRataDays = isProRata ? days : null;

  // Check residual value — if nothing left to depreciate, skip
  const remaining = openingBookValue.minus(residualValue);
  if (remaining.lessThanOrEqualTo(0)) {
    return {
      depreciationAmount: new Decimal(0),
      closingBookValue: openingBookValue,
      proRataDays,
      daysInMonth: total,
      skipped: true,
      skipReason: 'Valor residual atingido',
    };
  }

  const depreciableValue = acquisitionValue.minus(residualValue);

  let monthlyAmount: Decimal;

  switch (config.method) {
    case 'STRAIGHT_LINE': {
      const annualRate =
        config.track === 'MANAGERIAL' && config.managerialAnnualRate != null
          ? config.managerialAnnualRate
          : config.fiscalAnnualRate;

      if (annualRate != null) {
        // depreciableBase * annualRate / 12
        monthlyAmount = depreciableValue.mul(annualRate).div(12);
      } else if (config.usefulLifeMonths != null && config.usefulLifeMonths > 0) {
        monthlyAmount = depreciableValue.div(config.usefulLifeMonths);
      } else {
        return {
          depreciationAmount: new Decimal(0),
          closingBookValue: openingBookValue,
          proRataDays,
          daysInMonth: total,
          skipped: true,
          skipReason: 'Configuração insuficiente: rate ou usefulLifeMonths necessário',
        };
      }
      break;
    }

    case 'ACCELERATED': {
      const annualRate =
        config.track === 'MANAGERIAL' && config.managerialAnnualRate != null
          ? config.managerialAnnualRate
          : config.fiscalAnnualRate;

      if (annualRate == null) {
        return {
          depreciationAmount: new Decimal(0),
          closingBookValue: openingBookValue,
          proRataDays,
          daysInMonth: total,
          skipped: true,
          skipReason: 'ACCELERATED requer fiscalAnnualRate ou managerialAnnualRate',
        };
      }
      const factor = config.accelerationFactor ?? new Decimal(1);
      // openingBookValue * annualRate * factor / 12
      monthlyAmount = openingBookValue.mul(annualRate).mul(factor).div(12);
      break;
    }

    case 'HOURS_OF_USE': {
      if (periodicHours == null) {
        return {
          depreciationAmount: new Decimal(0),
          closingBookValue: openingBookValue,
          proRataDays,
          daysInMonth: total,
          skipped: true,
          skipReason: 'HOURS_OF_USE requires periodicHours',
        };
      }
      if (!config.totalHours || config.totalHours.isZero()) {
        return {
          depreciationAmount: new Decimal(0),
          closingBookValue: openingBookValue,
          proRataDays,
          daysInMonth: total,
          skipped: true,
          skipReason: 'HOURS_OF_USE requer totalHours > 0',
        };
      }
      // depreciableValue / totalHours * periodicHours (no pro-rata-die — hours drive it)
      const amount = depreciableValue.div(config.totalHours).mul(periodicHours);
      const clamped = Decimal.min(amount, remaining);
      const finalAmount = clamped.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      return {
        depreciationAmount: finalAmount,
        closingBookValue: openingBookValue.minus(finalAmount),
        proRataDays,
        daysInMonth: total,
        skipped: false,
      };
    }

    case 'UNITS_OF_PRODUCTION': {
      if (periodicUnits == null) {
        return {
          depreciationAmount: new Decimal(0),
          closingBookValue: openingBookValue,
          proRataDays,
          daysInMonth: total,
          skipped: true,
          skipReason: 'UNITS_OF_PRODUCTION requires periodicUnits',
        };
      }
      if (!config.totalUnits || config.totalUnits.isZero()) {
        return {
          depreciationAmount: new Decimal(0),
          closingBookValue: openingBookValue,
          proRataDays,
          daysInMonth: total,
          skipped: true,
          skipReason: 'UNITS_OF_PRODUCTION requer totalUnits > 0',
        };
      }
      // depreciableValue / totalUnits * periodicUnits (no pro-rata-die — units drive it)
      const amount = depreciableValue.div(config.totalUnits).mul(periodicUnits);
      const clamped = Decimal.min(amount, remaining);
      const finalAmount = clamped.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      return {
        depreciationAmount: finalAmount,
        closingBookValue: openingBookValue.minus(finalAmount),
        proRataDays,
        daysInMonth: total,
        skipped: false,
      };
    }

    default:
      return {
        depreciationAmount: new Decimal(0),
        closingBookValue: openingBookValue,
        proRataDays,
        daysInMonth: total,
        skipped: true,
        skipReason: `Método desconhecido: ${(config as { method: string }).method}`,
      };
  }

  // Apply pro-rata-die adjustment for STRAIGHT_LINE and ACCELERATED
  let proRatedAmount: Decimal;
  if (isProRata && days > 0) {
    proRatedAmount = monthlyAmount.mul(days).div(totalDays);
  } else if (days === 0) {
    proRatedAmount = new Decimal(0);
  } else {
    proRatedAmount = monthlyAmount;
  }

  // Clamp to remaining depreciable amount (never depreciate below residual)
  const clampedAmount = Decimal.min(proRatedAmount, remaining);
  const finalAmount = clampedAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    depreciationAmount: finalAmount,
    closingBookValue: openingBookValue.minus(finalAmount),
    proRataDays,
    daysInMonth: total,
    skipped: false,
  };
}
