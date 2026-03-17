import Decimal from 'decimal.js';
import { Money } from '../types/money';
import type { IMoney } from '../types/money';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AmortizationSystem = 'SAC' | 'PRICE' | 'BULLET';

/**
 * Input parameters for generating an amortization schedule.
 */
export interface ScheduleInput {
  /** Principal loan amount in BRL. */
  principalAmount: number;
  /** Annual interest rate as a decimal (e.g. 0.065 for 6.5%). */
  annualRate: number;
  /** Number of amortization installments (after grace period). */
  termMonths: number;
  /** Months of grace period — interest is capitalized onto principal. */
  gracePeriodMonths: number;
  /** Year of the first payment (after grace period). */
  firstPaymentYear: number;
  /** Month of the first payment (1-12). */
  firstPaymentMonth: number;
  /** Day of month for all payment due dates (1-31, clamped to month end). */
  paymentDayOfMonth: number;
  /** Amortization system to use. */
  amortizationSystem: AmortizationSystem;
}

/**
 * A single row in the amortization schedule.
 */
export interface ScheduleRow {
  installmentNumber: number;
  dueDate: Date;
  principal: IMoney;
  interest: IMoney;
  totalPayment: IMoney;
  outstandingBalance: IMoney;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Converts an annual rate to a monthly compound rate.
 *
 * Uses geometric compounding: (1 + annualRate)^(1/12) - 1
 * NOT simple division by 12 — that would be incorrect for Brazilian rural credit.
 */
export function computeMonthlyRate(annualRate: number): number {
  if (annualRate === 0) return 0;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * Capitalizes interest onto the principal during a grace period.
 *
 * Returns: principal * (1 + monthlyRate)^gracePeriodMonths
 * If gracePeriodMonths === 0, returns the original principal unchanged.
 */
export function capitalizeGracePeriod(
  principal: IMoney,
  monthlyRate: number,
  gracePeriodMonths: number,
): IMoney {
  if (gracePeriodMonths === 0) return principal;
  const factor = Math.pow(1 + monthlyRate, gracePeriodMonths);
  return principal.multiply(factor);
}

/**
 * Computes a UTC due date for a given installment offset.
 *
 * Day overflow is clamped to the last day of the target month:
 * e.g. day 31 in June (30 days) => June 30.
 *
 * @param year - Base year (e.g. 2026)
 * @param month - Base month 1-12 (e.g. 7 = July)
 * @param dayOfMonth - Desired day (1-31)
 * @param offsetMonths - Number of months to advance from base (0 = first payment)
 */
export function computeDueDate(
  year: number,
  month: number,
  dayOfMonth: number,
  offsetMonths: number,
): Date {
  // Start from day 1 to avoid overflow when setting month
  const d = new Date(Date.UTC(year, month - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);

  // Attempt to set the desired day
  const targetYear = d.getUTCFullYear();
  const targetMonth = d.getUTCMonth();

  // Create candidate date with desired day
  const candidate = new Date(Date.UTC(targetYear, targetMonth, dayOfMonth));

  // If the month rolled over (day overflow), clamp to last day of target month
  // Setting day = 0 on a Date gives the last day of the previous month
  if (candidate.getUTCMonth() !== targetMonth) {
    return new Date(Date.UTC(targetYear, targetMonth + 1, 0));
  }

  return candidate;
}

// ---------------------------------------------------------------------------
// SAC — Sistema de Amortização Constante
// ---------------------------------------------------------------------------

function buildSacSchedule(
  adjustedPrincipal: IMoney,
  monthlyRate: number,
  termMonths: number,
  firstPaymentYear: number,
  firstPaymentMonth: number,
  paymentDayOfMonth: number,
): ScheduleRow[] {
  const n = termMonths;
  const pv = adjustedPrincipal.toDecimal();

  // Base principal per installment — truncated (ROUND_DOWN) to 2 decimal places
  const basePrincipalDecimal = pv.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const basePrincipal = Money(basePrincipalDecimal);

  // Residual = total - (base * n) => goes to installment #1
  const sumOfBase = basePrincipal.multiply(n);
  const residual = adjustedPrincipal.subtract(sumOfBase);

  const rows: ScheduleRow[] = [];
  let balance = adjustedPrincipal;

  for (let k = 0; k < n; k++) {
    const principal = k === 0 ? basePrincipal.add(residual) : basePrincipal;
    const interest = Money(balance.multiply(monthlyRate).toDecimal().toDecimalPlaces(2));
    const totalPayment = principal.add(interest);
    balance = balance.subtract(principal);

    // Clamp balance to zero to avoid tiny floating-point negatives on last row
    if (k === n - 1) {
      balance = Money(0);
    }

    const dueDate = computeDueDate(firstPaymentYear, firstPaymentMonth, paymentDayOfMonth, k);

    rows.push({
      installmentNumber: k + 1,
      dueDate,
      principal,
      interest,
      totalPayment,
      outstandingBalance: balance,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// PRICE — Tabela Price (PMT constante)
// ---------------------------------------------------------------------------

function buildPriceSchedule(
  adjustedPrincipal: IMoney,
  monthlyRate: number,
  termMonths: number,
  firstPaymentYear: number,
  firstPaymentMonth: number,
  paymentDayOfMonth: number,
): ScheduleRow[] {
  const n = termMonths;
  const pv = adjustedPrincipal.toDecimal();

  let pmt: Decimal;

  if (monthlyRate === 0) {
    // Zero rate: constant principal, no interest
    pmt = pv.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  } else {
    // PMT = PV * i * (1+i)^n / ((1+i)^n - 1)
    const i = new Decimal(monthlyRate);
    const onePlusI = new Decimal(1).plus(i);
    const onePlusIPowN = onePlusI.pow(n);
    const numerator = pv.times(i).times(onePlusIPowN);
    const denominator = onePlusIPowN.minus(1);
    pmt = numerator.dividedBy(denominator).toDecimalPlaces(2);
  }

  const rows: ScheduleRow[] = [];
  let balance = adjustedPrincipal;

  for (let k = 0; k < n; k++) {
    const isLastRow = k === n - 1;
    const interest = Money(balance.multiply(monthlyRate).toDecimal().toDecimalPlaces(2));

    let principal: IMoney;
    if (isLastRow) {
      // Last installment: principal = remaining balance (eliminates residual)
      principal = balance;
    } else {
      const principalDecimal = Money(pmt).subtract(interest).toDecimal().toDecimalPlaces(2);
      principal = Money(principalDecimal);
    }

    const totalPayment = isLastRow ? principal.add(interest) : Money(pmt);
    balance = isLastRow ? Money(0) : balance.subtract(principal);

    const dueDate = computeDueDate(firstPaymentYear, firstPaymentMonth, paymentDayOfMonth, k);

    rows.push({
      installmentNumber: k + 1,
      dueDate,
      principal,
      interest,
      totalPayment,
      outstandingBalance: balance,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// BULLET — Interesse apenas, principal no final
// ---------------------------------------------------------------------------

function buildBulletSchedule(
  adjustedPrincipal: IMoney,
  monthlyRate: number,
  termMonths: number,
  firstPaymentYear: number,
  firstPaymentMonth: number,
  paymentDayOfMonth: number,
): ScheduleRow[] {
  const n = termMonths;
  const rows: ScheduleRow[] = [];
  const balance = adjustedPrincipal;

  for (let k = 0; k < n; k++) {
    const isLastRow = k === n - 1;
    const interest = Money(balance.multiply(monthlyRate).toDecimal().toDecimalPlaces(2));
    const principal = isLastRow ? balance : Money(0);
    const totalPayment = principal.add(interest);
    const outstandingBalance = isLastRow ? Money(0) : balance;

    const dueDate = computeDueDate(firstPaymentYear, firstPaymentMonth, paymentDayOfMonth, k);

    rows.push({
      installmentNumber: k + 1,
      dueDate,
      principal,
      interest,
      totalPayment,
      outstandingBalance,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generates a full amortization schedule for a rural credit contract.
 *
 * Steps:
 * 1. Compute monthly compound rate from annual rate
 * 2. Capitalize grace period onto principal (adjustedPrincipal)
 * 3. Build installment rows according to the chosen amortization system
 *
 * @returns Array of ScheduleRow — one per installment
 */
export function generateSchedule(input: ScheduleInput): ScheduleRow[] {
  const {
    principalAmount,
    annualRate,
    termMonths,
    gracePeriodMonths,
    firstPaymentYear,
    firstPaymentMonth,
    paymentDayOfMonth,
    amortizationSystem,
  } = input;

  const monthlyRate = computeMonthlyRate(annualRate);
  const principal = Money(principalAmount);
  const adjustedPrincipal = capitalizeGracePeriod(principal, monthlyRate, gracePeriodMonths);

  switch (amortizationSystem) {
    case 'SAC':
      return buildSacSchedule(
        adjustedPrincipal,
        monthlyRate,
        termMonths,
        firstPaymentYear,
        firstPaymentMonth,
        paymentDayOfMonth,
      );

    case 'PRICE':
      return buildPriceSchedule(
        adjustedPrincipal,
        monthlyRate,
        termMonths,
        firstPaymentYear,
        firstPaymentMonth,
        paymentDayOfMonth,
      );

    case 'BULLET':
      return buildBulletSchedule(
        adjustedPrincipal,
        monthlyRate,
        termMonths,
        firstPaymentYear,
        firstPaymentMonth,
        paymentDayOfMonth,
      );

    default: {
      const _exhaustive: never = amortizationSystem;
      throw new Error(`Unknown amortization system: ${_exhaustive}`);
    }
  }
}
