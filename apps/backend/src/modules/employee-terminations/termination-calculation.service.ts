// ─── Termination Calculation Service ─────────────────────────────────
// Pure functions for employee termination calculation.
// No DB access — all computation from inputs.
// References:
//   Lei 12.506/2011 — proportional notice period
//   Lei 13.467/2017 — mutual agreement (50% aviso previo, 20% FGTS penalty)
//   Lei 5.889/73 — safra termination (no FGTS penalty)
//   CLT Art. 477 — 10-day payment deadline

import Decimal from 'decimal.js';
import { calculateINSS, calculateIRRF } from '../payroll-engine/payroll-engine.service';
import type { EngineParams } from '../payroll-runs/payroll-runs.types';
import type {
  TerminationInput,
  TerminationResult,
  TerminationType,
} from './employee-terminations.types';

// ─── FGTS Penalty Rates ───────────────────────────────────────────────

/**
 * FGTS penalty rates per termination type.
 * WITHOUT_CAUSE: 40% (CLT Art. 18 §1º)
 * MUTUAL_AGREEMENT: 20% (Lei 13.467/2017 — metade da multa rescisória)
 * WITH_CAUSE / VOLUNTARY / SEASONAL_END: 0%
 */
export const FGTS_PENALTY: Record<TerminationType, Decimal> = {
  WITHOUT_CAUSE: new Decimal('0.40'),
  MUTUAL_AGREEMENT: new Decimal('0.20'),
  WITH_CAUSE: new Decimal('0.00'),
  VOLUNTARY: new Decimal('0.00'),
  SEASONAL_END: new Decimal('0.00'),
};

// ─── Notice Period Calculation ────────────────────────────────────────

/**
 * Calculates notice period days per Lei 12.506/2011.
 * Base: 30 days for up to 1 year.
 * Additional: +3 days per completed year after the first, capped at 90 days total.
 *
 * @param admissionDate - Employee admission date
 * @param terminationDate - Termination date
 * @returns Number of notice period days (30–90)
 */
export function calcNoticePeriodDays(admissionDate: Date, terminationDate: Date): number {
  // Use UTC dates to avoid timezone off-by-one (Phase 28 decision)
  const admissionMs = Date.UTC(
    admissionDate.getUTCFullYear(),
    admissionDate.getUTCMonth(),
    admissionDate.getUTCDate(),
  );
  const terminationMs = Date.UTC(
    terminationDate.getUTCFullYear(),
    terminationDate.getUTCMonth(),
    terminationDate.getUTCDate(),
  );

  const diffDays = (terminationMs - admissionMs) / (1000 * 60 * 60 * 24);
  const yearsCompleted = Math.floor(diffDays / 365.25);

  // 30 days base + 3 days per year after the first, max 90
  return Math.min(30 + Math.max(0, yearsCompleted - 1) * 3, 90);
}

// ─── Helper: days in month (UTC-safe) ────────────────────────────────

function getDaysInMonth(date: Date): number {
  // Get days in the month of the given date using UTC
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

// ─── Main Calculation Function ────────────────────────────────────────

/**
 * Calculates all termination amounts following Brazilian labor law.
 * Pure function — no DB access.
 *
 * Steps (following RESEARCH.md Pattern 2):
 * 1. Balance salary: proportional days worked in termination month
 * 2. Notice period: per type (WITH_CAUSE/VOLUNTARY/SEASONAL_END = 0)
 * 3. Notice pay: only for COMPENSATED notice + applicable types
 * 4. 13th proportional: monthsWorkedInYear / 12 * (salary + overtime + night)
 * 5. Vacation vested: dailyRate * vestedDays
 * 6. Vacation prop: dailyRate * propDays
 * 7. Vacation bonus: (vested + prop) / 3 (constitutional 1/3)
 * 8. FGTS penalty: fgtsBalance * penaltyRate
 * 9. Total gross
 * 10. INSS on total gross
 * 11. IRRF on total gross minus INSS
 * 12. Net total = gross - INSS - IRRF + fgtsPenalty
 * 13. Payment deadline = terminationDate + 10 calendar days
 */
export function calculateTermination(
  input: TerminationInput,
  params: EngineParams,
): TerminationResult {
  const {
    admissionDate,
    terminationDate,
    terminationType,
    noticeType,
    lastSalary,
    fgtsBalance,
    vacationVestedDays,
    vacationPropDays,
    monthsThirteenth,
    avgOvertime,
    avgNight,
    dependentCount,
  } = input;

  // ── Step 1: Balance salary (pro-rata for days worked in termination month) ──
  const daysWorked = terminationDate.getUTCDate();
  const daysInMonth = getDaysInMonth(terminationDate);
  const balanceSalary = lastSalary
    .mul(new Decimal(daysWorked))
    .div(new Decimal(daysInMonth))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ── Step 2: Notice period days ────────────────────────────────────────
  let noticePeriodDays = 0;
  if (terminationType === 'WITHOUT_CAUSE') {
    noticePeriodDays = calcNoticePeriodDays(admissionDate, terminationDate);
  } else if (terminationType === 'MUTUAL_AGREEMENT') {
    // Lei 13.467/2017: half of full notice period, rounded up
    const fullDays = calcNoticePeriodDays(admissionDate, terminationDate);
    noticePeriodDays = Math.ceil(fullDays / 2);
  }
  // WITH_CAUSE, VOLUNTARY, SEASONAL_END → 0 days

  // ── Step 3: Notice pay ────────────────────────────────────────────────
  let noticePay = new Decimal(0);
  if (
    noticeType === 'COMPENSATED' &&
    (terminationType === 'WITHOUT_CAUSE' || terminationType === 'MUTUAL_AGREEMENT')
  ) {
    noticePay = lastSalary
      .mul(new Decimal(noticePeriodDays))
      .div(new Decimal(30))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  // ── Step 4: 13th proportional ─────────────────────────────────────────
  const thirteenthBase = lastSalary.plus(avgOvertime).plus(avgNight);
  const thirteenthProp = thirteenthBase
    .mul(new Decimal(monthsThirteenth))
    .div(new Decimal(12))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ── Step 5 & 6: Vacation vested and proportional ──────────────────────
  const dailyRate = lastSalary.div(new Decimal(30)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  const vacationVested = dailyRate
    .mul(new Decimal(vacationVestedDays))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const vacationProp = dailyRate
    .mul(new Decimal(vacationPropDays))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ── Step 7: Vacation bonus (1/3 constitutional) ───────────────────────
  const vacationBonus = vacationVested
    .plus(vacationProp)
    .div(new Decimal(3))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ── Step 8: FGTS penalty ──────────────────────────────────────────────
  const penaltyRate = FGTS_PENALTY[terminationType];
  const fgtsPenalty = fgtsBalance.mul(penaltyRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ── Step 9: Total gross ───────────────────────────────────────────────
  const totalGross = balanceSalary
    .plus(noticePay)
    .plus(thirteenthProp)
    .plus(vacationVested)
    .plus(vacationProp)
    .plus(vacationBonus)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ── Step 10: INSS ─────────────────────────────────────────────────────
  const inssResult = calculateINSS(totalGross, params.inssBrackets, params.inssCeiling);

  // ── Step 11: IRRF ─────────────────────────────────────────────────────
  const irrfResult = calculateIRRF({
    grossSalary: totalGross,
    inssContribution: inssResult.contribution,
    dependents: dependentCount,
    alimony: new Decimal(0),
    brackets: params.irrfBrackets,
    dependentDeduction: params.dependentDeduction,
    exemptionLimit: params.irrfExemptionLimit,
    redutorUpperLimit: params.redutorUpperLimit,
    redutorA: params.redutorA,
    redutorB: params.redutorB,
  });

  const inssAmount = inssResult.contribution;
  const irrfAmount = irrfResult.finalTax;

  // ── Step 12: Net total ────────────────────────────────────────────────
  // FGTS penalty is not taxable income — added after deductions
  const totalNet = totalGross
    .minus(inssAmount)
    .minus(irrfAmount)
    .plus(fgtsPenalty)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ── Step 13: Payment deadline ─────────────────────────────────────────
  // CLT Art. 477 — 10 calendar days from termination date
  const paymentDeadline = new Date(terminationDate);
  paymentDeadline.setUTCDate(paymentDeadline.getUTCDate() + 10);

  return {
    balanceSalary,
    noticePay,
    noticePeriodDays,
    thirteenthProp,
    vacationVested,
    vacationProp,
    vacationBonus,
    fgtsBalance,
    fgtsPenalty,
    fgtsPenaltyRate: penaltyRate,
    totalGross,
    inssAmount,
    irrfAmount,
    totalNet,
    paymentDeadline,
  };
}
