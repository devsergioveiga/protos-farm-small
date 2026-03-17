import { Money } from '../../types/money';
import {
  computeMonthlyRate,
  capitalizeGracePeriod,
  generateSchedule,
  computeDueDate,
  type ScheduleInput,
  type ScheduleRow,
} from '../rural-credit-schedule';

// ---------------------------------------------------------------------------
// computeMonthlyRate
// ---------------------------------------------------------------------------

describe('computeMonthlyRate', () => {
  it('uses compound formula (not simple division)', () => {
    const annualRate = 0.065;
    const expected = Math.pow(1.065, 1 / 12) - 1;
    expect(computeMonthlyRate(annualRate)).toBeCloseTo(expected, 10);
  });

  it('returns 0 for zero annual rate', () => {
    expect(computeMonthlyRate(0)).toBe(0);
  });

  it('returns correct value for 12% annual rate', () => {
    const expected = Math.pow(1.12, 1 / 12) - 1;
    expect(computeMonthlyRate(0.12)).toBeCloseTo(expected, 10);
  });
});

// ---------------------------------------------------------------------------
// capitalizeGracePeriod
// ---------------------------------------------------------------------------

describe('capitalizeGracePeriod', () => {
  const monthlyRate = computeMonthlyRate(0.065);

  it('capitalizes principal over grace period months', () => {
    const principal = Money(100000);
    const result = capitalizeGracePeriod(principal, monthlyRate, 6);
    const expected = Money(100000).multiply(Math.pow(1 + monthlyRate, 6));
    expect(result.toNumber()).toBeCloseTo(expected.toNumber(), 4);
  });

  it('returns original principal when grace period is 0', () => {
    const principal = Money(100000);
    const result = capitalizeGracePeriod(principal, monthlyRate, 0);
    expect(result.toNumber()).toBe(100000);
  });

  it('capitalized principal is greater than original', () => {
    const principal = Money(100000);
    const result = capitalizeGracePeriod(principal, monthlyRate, 6);
    expect(result.toNumber()).toBeGreaterThan(100000);
  });
});

// ---------------------------------------------------------------------------
// computeDueDate
// ---------------------------------------------------------------------------

describe('computeDueDate', () => {
  it('returns UTC date with no offset', () => {
    const date = computeDueDate(2026, 7, 15, 0);
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(6); // July = month index 6
    expect(date.getUTCDate()).toBe(15);
  });

  it('clamps day overflow (day 31 in a 30-day month)', () => {
    // June has 30 days — day 31 should clamp to June 30
    const date = computeDueDate(2026, 6, 31, 0);
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(5); // June = month index 5
    expect(date.getUTCDate()).toBe(30);
  });

  it('produces 12 dates from Jan to Dec 2026 for 11 offsets', () => {
    const dates: Date[] = [];
    for (let i = 0; i < 12; i++) {
      dates.push(computeDueDate(2026, 1, 15, i));
    }
    expect(dates[0].getUTCMonth()).toBe(0); // January
    expect(dates[11].getUTCMonth()).toBe(11); // December
  });

  it('advances year when offset crosses December', () => {
    const date = computeDueDate(2026, 11, 15, 2); // Nov + 2 months = Jan 2027
    expect(date.getUTCFullYear()).toBe(2027);
    expect(date.getUTCMonth()).toBe(0); // January
  });
});

// ---------------------------------------------------------------------------
// generateSchedule — SAC
// ---------------------------------------------------------------------------

describe('generateSchedule — SAC', () => {
  const sacInput: ScheduleInput = {
    principalAmount: 100000,
    annualRate: 0.065,
    termMonths: 12,
    gracePeriodMonths: 0,
    firstPaymentYear: 2026,
    firstPaymentMonth: 7,
    paymentDayOfMonth: 15,
    amortizationSystem: 'SAC',
  };

  let rows: ScheduleRow[];

  beforeEach(() => {
    rows = generateSchedule(sacInput);
  });

  it('produces exactly 12 rows', () => {
    expect(rows).toHaveLength(12);
  });

  it('sum of all principal fields equals adjustedPrincipal', () => {
    const sum = rows.reduce((acc, r) => acc.add(r.principal), Money(0));
    // No grace period, so adjustedPrincipal = 100000
    expect(sum.toNumber()).toBeCloseTo(100000, 1);
  });

  it('outstanding balance after last row is zero', () => {
    const last = rows[rows.length - 1];
    expect(last.outstandingBalance.toNumber()).toBeCloseTo(0, 2);
  });

  it('interest decreases monotonically (each row <= previous)', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].interest.toNumber()).toBeLessThanOrEqual(rows[i - 1].interest.toNumber());
    }
  });

  it('first total payment > last total payment (decreasing payments)', () => {
    const firstTotal = rows[0].totalPayment.toNumber();
    const lastTotal = rows[rows.length - 1].totalPayment.toNumber();
    expect(firstTotal).toBeGreaterThan(lastTotal);
  });

  it('all principal payments are approximately equal (within 0.02)', () => {
    // SAC has constant principal; residual on first installment may differ slightly
    const principals = rows.map((r) => r.principal.toNumber());
    const min = Math.min(...principals);
    const max = Math.max(...principals);
    expect(max - min).toBeLessThan(0.02);
  });

  it('installment numbers are sequential starting at 1', () => {
    rows.forEach((r, i) => {
      expect(r.installmentNumber).toBe(i + 1);
    });
  });

  it('total payment = principal + interest for each row', () => {
    rows.forEach((r) => {
      const expected = r.principal.add(r.interest).toNumber();
      expect(r.totalPayment.toNumber()).toBeCloseTo(expected, 2);
    });
  });
});

// ---------------------------------------------------------------------------
// generateSchedule — PRICE
// ---------------------------------------------------------------------------

describe('generateSchedule — PRICE', () => {
  const priceInput: ScheduleInput = {
    principalAmount: 100000,
    annualRate: 0.065,
    termMonths: 12,
    gracePeriodMonths: 0,
    firstPaymentYear: 2026,
    firstPaymentMonth: 7,
    paymentDayOfMonth: 15,
    amortizationSystem: 'PRICE',
  };

  let rows: ScheduleRow[];

  beforeEach(() => {
    rows = generateSchedule(priceInput);
  });

  it('produces exactly 12 rows', () => {
    expect(rows).toHaveLength(12);
  });

  it('sum of all principal fields equals adjustedPrincipal', () => {
    const sum = rows.reduce((acc, r) => acc.add(r.principal), Money(0));
    expect(sum.toNumber()).toBeCloseTo(100000, 1);
  });

  it('outstanding balance after last row is zero', () => {
    const last = rows[rows.length - 1];
    expect(last.outstandingBalance.toNumber()).toBeCloseTo(0, 2);
  });

  it('all total payments are approximately equal (PMT constant, within 0.01 for last residual)', () => {
    const totals = rows.map((r) => r.totalPayment.toNumber());
    const first = totals[0];
    // All except last must be exactly equal to first
    for (let i = 1; i < totals.length - 1; i++) {
      expect(totals[i]).toBeCloseTo(first, 2);
    }
    // Last installment may differ by residual but within 0.02
    expect(Math.abs(totals[totals.length - 1] - first)).toBeLessThan(0.02);
  });

  it('principal increases monotonically', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].principal.toNumber()).toBeGreaterThanOrEqual(rows[i - 1].principal.toNumber());
    }
  });

  it('interest decreases monotonically', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].interest.toNumber()).toBeLessThanOrEqual(rows[i - 1].interest.toNumber());
    }
  });

  it('total payment = principal + interest for each row', () => {
    rows.forEach((r) => {
      const expected = r.principal.add(r.interest).toNumber();
      expect(r.totalPayment.toNumber()).toBeCloseTo(expected, 2);
    });
  });
});

// ---------------------------------------------------------------------------
// generateSchedule — BULLET
// ---------------------------------------------------------------------------

describe('generateSchedule — BULLET', () => {
  const bulletInput: ScheduleInput = {
    principalAmount: 100000,
    annualRate: 0.065,
    termMonths: 12,
    gracePeriodMonths: 0,
    firstPaymentYear: 2026,
    firstPaymentMonth: 7,
    paymentDayOfMonth: 15,
    amortizationSystem: 'BULLET',
  };

  let rows: ScheduleRow[];

  beforeEach(() => {
    rows = generateSchedule(bulletInput);
  });

  it('produces exactly 12 rows', () => {
    expect(rows).toHaveLength(12);
  });

  it('first 11 rows have principal = 0', () => {
    for (let i = 0; i < 11; i++) {
      expect(rows[i].principal.toNumber()).toBe(0);
    }
  });

  it('last row has full principal repayment', () => {
    const last = rows[rows.length - 1];
    expect(last.principal.toNumber()).toBeCloseTo(100000, 1);
  });

  it('outstanding balance after last row is zero', () => {
    const last = rows[rows.length - 1];
    expect(last.outstandingBalance.toNumber()).toBeCloseTo(0, 2);
  });

  it('first 11 rows have interest = balance * monthlyRate', () => {
    const monthlyRate = computeMonthlyRate(0.065);
    for (let i = 0; i < 11; i++) {
      const balance = 100000; // balance stays constant for bullet
      const expectedInterest = balance * monthlyRate;
      expect(rows[i].interest.toNumber()).toBeCloseTo(expectedInterest, 2);
    }
  });

  it('total payment = principal + interest for each row', () => {
    rows.forEach((r) => {
      const expected = r.principal.add(r.interest).toNumber();
      expect(r.totalPayment.toNumber()).toBeCloseTo(expected, 2);
    });
  });
});

// ---------------------------------------------------------------------------
// generateSchedule — Grace Period
// ---------------------------------------------------------------------------

describe('generateSchedule — Grace Period', () => {
  it('capitalizes principal over grace period before amortization', () => {
    const inputWithGrace: ScheduleInput = {
      principalAmount: 100000,
      annualRate: 0.065,
      termMonths: 12,
      gracePeriodMonths: 6,
      firstPaymentYear: 2027,
      firstPaymentMonth: 1,
      paymentDayOfMonth: 15,
      amortizationSystem: 'SAC',
    };

    const rows = generateSchedule(inputWithGrace);

    // adjustedPrincipal should be greater than 100000
    const monthlyRate = computeMonthlyRate(0.065);
    const expectedAdjusted = 100000 * Math.pow(1 + monthlyRate, 6);
    const sumPrincipal = rows.reduce((acc, r) => acc + r.principal.toNumber(), 0);

    expect(sumPrincipal).toBeGreaterThan(100000);
    expect(sumPrincipal).toBeCloseTo(expectedAdjusted, 1);
  });

  it('sum of principals still equals adjustedPrincipal with grace', () => {
    const inputWithGrace: ScheduleInput = {
      principalAmount: 100000,
      annualRate: 0.065,
      termMonths: 12,
      gracePeriodMonths: 6,
      firstPaymentYear: 2027,
      firstPaymentMonth: 1,
      paymentDayOfMonth: 15,
      amortizationSystem: 'PRICE',
    };

    const rows = generateSchedule(inputWithGrace);
    const monthlyRate = computeMonthlyRate(0.065);
    const expectedAdjusted = 100000 * Math.pow(1 + monthlyRate, 6);
    const sumPrincipal = rows.reduce((acc, r) => acc + r.principal.toNumber(), 0);

    expect(sumPrincipal).toBeCloseTo(expectedAdjusted, 1);
  });

  it('grace period 0 returns original principal unchanged in sum', () => {
    const inputNoGrace: ScheduleInput = {
      principalAmount: 100000,
      annualRate: 0.065,
      termMonths: 12,
      gracePeriodMonths: 0,
      firstPaymentYear: 2026,
      firstPaymentMonth: 7,
      paymentDayOfMonth: 15,
      amortizationSystem: 'SAC',
    };

    const rows = generateSchedule(inputNoGrace);
    const sumPrincipal = rows.reduce((acc, r) => acc + r.principal.toNumber(), 0);
    expect(sumPrincipal).toBeCloseTo(100000, 1);
  });
});

// ---------------------------------------------------------------------------
// generateSchedule — Edge Cases
// ---------------------------------------------------------------------------

describe('generateSchedule — Edge Cases', () => {
  it('termMonths = 1 with SAC produces single installment = full principal + interest', () => {
    const input: ScheduleInput = {
      principalAmount: 100000,
      annualRate: 0.065,
      termMonths: 1,
      gracePeriodMonths: 0,
      firstPaymentYear: 2026,
      firstPaymentMonth: 7,
      paymentDayOfMonth: 15,
      amortizationSystem: 'SAC',
    };

    const rows = generateSchedule(input);
    expect(rows).toHaveLength(1);
    expect(rows[0].principal.toNumber()).toBeCloseTo(100000, 1);
    expect(rows[0].interest.toNumber()).toBeGreaterThan(0);
    expect(rows[0].outstandingBalance.toNumber()).toBeCloseTo(0, 2);
  });

  it('annualRate = 0 with SAC produces all zero interest', () => {
    const input: ScheduleInput = {
      principalAmount: 100000,
      annualRate: 0,
      termMonths: 12,
      gracePeriodMonths: 0,
      firstPaymentYear: 2026,
      firstPaymentMonth: 7,
      paymentDayOfMonth: 15,
      amortizationSystem: 'SAC',
    };

    const rows = generateSchedule(input);
    rows.forEach((r) => {
      expect(r.interest.toNumber()).toBe(0);
    });
    const sumPrincipal = rows.reduce((acc, r) => acc + r.principal.toNumber(), 0);
    expect(sumPrincipal).toBeCloseTo(100000, 2);
  });

  it('annualRate = 0 with SAC produces equal principal per installment', () => {
    const input: ScheduleInput = {
      principalAmount: 100000,
      annualRate: 0,
      termMonths: 12,
      gracePeriodMonths: 0,
      firstPaymentYear: 2026,
      firstPaymentMonth: 7,
      paymentDayOfMonth: 15,
      amortizationSystem: 'SAC',
    };

    const rows = generateSchedule(input);
    const principals = rows.map((r) => r.principal.toNumber());
    const min = Math.min(...principals);
    const max = Math.max(...principals);
    // All should be approx 100000/12 = 8333.33
    expect(max - min).toBeLessThan(0.02);
  });
});
