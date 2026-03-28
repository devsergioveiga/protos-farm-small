// ─── Termination Calculation Tests ────────────────────────────────────
// Tests for pure calculation functions covering all 5 termination types,
// notice period proportionality (Lei 12.506/2011), and FGTS penalty rules.

import Decimal from 'decimal.js';
import type { IRRFBracket } from '../payroll-engine/payroll-engine.types';
import type { INSSBracket } from '../payroll-engine/payroll-engine.types';
import type { EngineParams } from '../payroll-runs/payroll-runs.types';
import { calcNoticePeriodDays, calculateTermination, FGTS_PENALTY } from './termination-calculation.service';
import type { TerminationInput } from './employee-terminations.types';

beforeAll(() => {
  Decimal.set({ rounding: Decimal.ROUND_HALF_UP });
});

// ─── Mock EngineParams ────────────────────────────────────────────────

const INSS_BRACKETS: INSSBracket[] = [
  { from: new Decimal('0'), upTo: new Decimal('1621.00'), rate: new Decimal('0.075') },
  { from: new Decimal('1621.01'), upTo: new Decimal('2902.84'), rate: new Decimal('0.09') },
  { from: new Decimal('2902.85'), upTo: new Decimal('4354.27'), rate: new Decimal('0.12') },
  { from: new Decimal('4354.28'), upTo: new Decimal('8475.55'), rate: new Decimal('0.14') },
];
const INSS_CEILING = new Decimal('8475.55');

const IRRF_BRACKETS: IRRFBracket[] = [
  { upTo: new Decimal('2259.20'), rate: new Decimal('0'), deduction: new Decimal('0') },
  { upTo: new Decimal('2826.65'), rate: new Decimal('0.075'), deduction: new Decimal('169.44') },
  { upTo: new Decimal('3751.05'), rate: new Decimal('0.15'), deduction: new Decimal('381.44') },
  { upTo: new Decimal('4664.68'), rate: new Decimal('0.225'), deduction: new Decimal('662.77') },
  { upTo: null, rate: new Decimal('0.275'), deduction: new Decimal('896.00') },
];

const ENGINE_PARAMS: EngineParams = {
  inssBrackets: INSS_BRACKETS,
  irrfBrackets: IRRF_BRACKETS,
  inssCeiling: INSS_CEILING,
  dependentDeduction: new Decimal('189.59'),
  irrfExemptionLimit: new Decimal('2824.00'),
  redutorUpperLimit: new Decimal('7351.00'),
  redutorA: new Decimal('1033.30'),
  redutorB: new Decimal('0.14'),
  salaryFamilyValuePerChild: new Decimal('62.04'),
  salaryFamilyIncomeLimit: new Decimal('1751.81'),
  ratPercent: new Decimal('0.03'),
};

// ─── calcNoticePeriodDays ─────────────────────────────────────────────

describe('calcNoticePeriodDays', () => {
  it('Test 1: 1 year employment → 30 days', () => {
    const admission = new Date('2025-01-01');
    const termination = new Date('2026-01-01');
    expect(calcNoticePeriodDays(admission, termination)).toBe(30);
  });

  it('Test 2: 5 years employment → 30 + (4 * 3) = 42 days', () => {
    const admission = new Date('2020-01-01');
    const termination = new Date('2025-01-01');
    expect(calcNoticePeriodDays(admission, termination)).toBe(42);
  });

  it('Test 3: 25 years employment → capped at 90 days', () => {
    const admission = new Date('2001-01-01');
    const termination = new Date('2026-01-01');
    expect(calcNoticePeriodDays(admission, termination)).toBe(90);
  });

  it('Less than 1 year → 30 days minimum', () => {
    const admission = new Date('2025-07-01');
    const termination = new Date('2026-01-01');
    expect(calcNoticePeriodDays(admission, termination)).toBe(30);
  });

  it('Exactly 20 years → 30 + (19 * 3) = 87 days', () => {
    const admission = new Date('2006-01-01');
    const termination = new Date('2026-01-01');
    expect(calcNoticePeriodDays(admission, termination)).toBe(87);
  });
});

// ─── FGTS_PENALTY constant ────────────────────────────────────────────

describe('FGTS_PENALTY', () => {
  it('WITHOUT_CAUSE → 0.40', () => {
    expect(FGTS_PENALTY['WITHOUT_CAUSE'].toNumber()).toBe(0.40);
  });
  it('MUTUAL_AGREEMENT → 0.20', () => {
    expect(FGTS_PENALTY['MUTUAL_AGREEMENT'].toNumber()).toBe(0.20);
  });
  it('WITH_CAUSE → 0.00', () => {
    expect(FGTS_PENALTY['WITH_CAUSE'].toNumber()).toBe(0.00);
  });
  it('VOLUNTARY → 0.00', () => {
    expect(FGTS_PENALTY['VOLUNTARY'].toNumber()).toBe(0.00);
  });
  it('SEASONAL_END → 0.00 (Lei 5.889/73)', () => {
    expect(FGTS_PENALTY['SEASONAL_END'].toNumber()).toBe(0.00);
  });
});

// ─── Base termination input ───────────────────────────────────────────

function makeInput(overrides: Partial<TerminationInput> = {}): TerminationInput {
  return {
    admissionDate: new Date('2020-01-15'),
    terminationDate: new Date('2026-03-15'),
    terminationType: 'WITHOUT_CAUSE',
    noticeType: 'COMPENSATED',
    lastSalary: new Decimal('3000.00'),
    fgtsBalance: new Decimal('5000.00'),
    vacationVestedDays: 0,
    vacationPropDays: 5,
    monthsThirteenth: 3,
    avgOvertime: new Decimal('0'),
    avgNight: new Decimal('0'),
    dependentCount: 0,
    ...overrides,
  };
}

// ─── calculateTermination — Test 4: WITHOUT_CAUSE ────────────────────

describe('calculateTermination — WITHOUT_CAUSE', () => {
  it('Test 4: includes aviso previo, 40% FGTS penalty, 13o prop, ferias', () => {
    const input = makeInput({
      terminationType: 'WITHOUT_CAUSE',
      noticeType: 'COMPENSATED',
    });
    const result = calculateTermination(input, ENGINE_PARAMS);

    // FGTS penalty = 5000 * 40%
    expect(result.fgtsPenalty.toFixed(2)).toBe('2000.00');
    expect(result.fgtsPenaltyRate.toFixed(2)).toBe('0.40');

    // Notice pay should be > 0 (COMPENSATED WITH_CAUSE)
    expect(result.noticePay.toNumber()).toBeGreaterThan(0);
    expect(result.noticePeriodDays).toBeGreaterThan(0);

    // 13th prop: 3/12 * 3000 = 750
    expect(result.thirteenthProp.toFixed(2)).toBe('750.00');

    // paymentDeadline = terminationDate + 10 days
    const _deadline = new Date('2026-03-25');
    expect(result.paymentDeadline.toISOString().slice(0, 10)).toBe('2026-03-25');
  });
});

// ─── calculateTermination — Test 5: WITH_CAUSE ───────────────────────

describe('calculateTermination — WITH_CAUSE', () => {
  it('Test 5: no aviso previo, no FGTS penalty, only balance + ferias vencidas', () => {
    const input = makeInput({
      terminationType: 'WITH_CAUSE',
      noticeType: 'WAIVED',
      vacationVestedDays: 30,
      vacationPropDays: 0,
      monthsThirteenth: 0,
    });
    const result = calculateTermination(input, ENGINE_PARAMS);

    expect(result.fgtsPenalty.toFixed(2)).toBe('0.00');
    expect(result.fgtsPenaltyRate.toFixed(2)).toBe('0.00');
    expect(result.noticePay.toFixed(2)).toBe('0.00');
    expect(result.noticePeriodDays).toBe(0);

    // Vacation vested: dailyRate * 30, vacationBonus: vacationVested / 3
    expect(result.vacationVested.toNumber()).toBeGreaterThan(0);
    expect(result.vacationBonus.toNumber()).toBeGreaterThan(0);
  });
});

// ─── calculateTermination — Test 6: VOLUNTARY ────────────────────────

describe('calculateTermination — VOLUNTARY', () => {
  it('Test 6: no aviso previo, no FGTS penalty, includes 13o prop + ferias prop', () => {
    const input = makeInput({
      terminationType: 'VOLUNTARY',
      noticeType: 'WAIVED',
      vacationVestedDays: 0,
      vacationPropDays: 10,
      monthsThirteenth: 2,
    });
    const result = calculateTermination(input, ENGINE_PARAMS);

    expect(result.fgtsPenalty.toFixed(2)).toBe('0.00');
    expect(result.noticePay.toFixed(2)).toBe('0.00');

    // 13th prop: 2/12 * 3000 = 500
    expect(result.thirteenthProp.toFixed(2)).toBe('500.00');

    // Vacation prop > 0
    expect(result.vacationProp.toNumber()).toBeGreaterThan(0);
  });
});

// ─── calculateTermination — Test 7: SEASONAL_END ─────────────────────

describe('calculateTermination — SEASONAL_END', () => {
  it('Test 7: no FGTS penalty (Lei 5.889/73), includes 13o prop + ferias prop', () => {
    const input = makeInput({
      terminationType: 'SEASONAL_END',
      noticeType: 'WAIVED',
      vacationVestedDays: 0,
      vacationPropDays: 15,
      monthsThirteenth: 6,
    });
    const result = calculateTermination(input, ENGINE_PARAMS);

    expect(result.fgtsPenalty.toFixed(2)).toBe('0.00');
    expect(result.fgtsPenaltyRate.toFixed(2)).toBe('0.00');

    // 13th prop: 6/12 * 3000 = 1500
    expect(result.thirteenthProp.toFixed(2)).toBe('1500.00');
    expect(result.vacationProp.toNumber()).toBeGreaterThan(0);
  });
});

// ─── calculateTermination — Test 8: MUTUAL_AGREEMENT ─────────────────

describe('calculateTermination — MUTUAL_AGREEMENT', () => {
  it('Test 8: 20% FGTS penalty, half aviso previo (Lei 13.467/2017)', () => {
    const input = makeInput({
      terminationType: 'MUTUAL_AGREEMENT',
      noticeType: 'COMPENSATED',
      admissionDate: new Date('2016-03-15'), // 10 years
      terminationDate: new Date('2026-03-15'),
    });
    const result = calculateTermination(input, ENGINE_PARAMS);

    expect(result.fgtsPenalty.toFixed(2)).toBe('1000.00'); // 5000 * 20%
    expect(result.fgtsPenaltyRate.toFixed(2)).toBe('0.20');

    // Notice period is half of full (10 years = 30+27=57, half = ceil(57/2) = 29)
    const fullDays = calcNoticePeriodDays(new Date('2016-03-15'), new Date('2026-03-15'));
    const expectedHalf = Math.ceil(fullDays / 2);
    expect(result.noticePeriodDays).toBe(expectedHalf);
  });
});

// ─── Test 9: balanceSalary ────────────────────────────────────────────

describe('balanceSalary', () => {
  it('Test 9: terminated on 15th of March (31-day month) → salary * 15/31', () => {
    const input = makeInput({
      terminationDate: new Date('2026-03-15'),
      lastSalary: new Decimal('3000.00'),
      vacationPropDays: 0,
      monthsThirteenth: 0,
      fgtsBalance: new Decimal('0'),
    });
    const result = calculateTermination(input, ENGINE_PARAMS);
    // balance = 3000 * 15/31 = 1451.6129... → 1451.61
    expect(result.balanceSalary.toFixed(2)).toBe('1451.61');
  });

  it('Last day of month → full salary', () => {
    const input = makeInput({
      terminationDate: new Date('2026-03-31'),
      lastSalary: new Decimal('3000.00'),
      vacationPropDays: 0,
      monthsThirteenth: 0,
      fgtsBalance: new Decimal('0'),
    });
    const result = calculateTermination(input, ENGINE_PARAMS);
    expect(result.balanceSalary.toFixed(2)).toBe('3000.00');
  });
});

// ─── Test 10: thirteenthProp ──────────────────────────────────────────

describe('thirteenthProp', () => {
  it('Test 10: 8 months worked → salary * 8/12 = 2000.00', () => {
    const input = makeInput({
      lastSalary: new Decimal('3000.00'),
      monthsThirteenth: 8,
      vacationPropDays: 0,
      fgtsBalance: new Decimal('0'),
    });
    const result = calculateTermination(input, ENGINE_PARAMS);
    expect(result.thirteenthProp.toFixed(2)).toBe('2000.00');
  });
});

// ─── Test 11: vacationVested ──────────────────────────────────────────

describe('vacationVested', () => {
  it('Test 11: 30 days vested vacation → dailyRate * 30, bonus = vested / 3', () => {
    const input = makeInput({
      lastSalary: new Decimal('3000.00'),
      vacationVestedDays: 30,
      vacationPropDays: 0,
      monthsThirteenth: 0,
      fgtsBalance: new Decimal('0'),
    });
    const result = calculateTermination(input, ENGINE_PARAMS);

    // dailyRate = 3000 / 30 = 100
    // vacationVested = 100 * 30 = 3000
    expect(result.vacationVested.toFixed(2)).toBe('3000.00');
    // vacationBonus = 3000 / 3 = 1000
    expect(result.vacationBonus.toFixed(2)).toBe('1000.00');
  });
});

// ─── Test 12: INSS and IRRF ───────────────────────────────────────────

describe('INSS and IRRF', () => {
  it('Test 12: INSS and IRRF deducted from totalGross', () => {
    const input = makeInput({
      terminationType: 'WITH_CAUSE',
      noticeType: 'WAIVED',
      lastSalary: new Decimal('5000.00'),
      vacationVestedDays: 0,
      vacationPropDays: 0,
      monthsThirteenth: 12, // full year: 5000
      fgtsBalance: new Decimal('0'),
    });
    const result = calculateTermination(input, ENGINE_PARAMS);

    // totalGross includes balanceSalary + thirteenthProp (5000)
    expect(result.inssAmount.toNumber()).toBeGreaterThan(0);
    // totalNet < totalGross (deductions applied)
    expect(result.totalNet.toNumber()).toBeLessThan(result.totalGross.toNumber());
  });
});

// ─── Test 13: netTotal formula ────────────────────────────────────────

describe('netTotal', () => {
  it('Test 13: totalNet = totalGross - INSS - IRRF + fgtsPenalty', () => {
    const input = makeInput({
      terminationType: 'WITHOUT_CAUSE',
      noticeType: 'COMPENSATED',
      fgtsBalance: new Decimal('10000.00'),
      vacationPropDays: 0,
      monthsThirteenth: 0,
    });
    const result = calculateTermination(input, ENGINE_PARAMS);

    const expectedNet = result.totalGross
      .minus(result.inssAmount)
      .minus(result.irrfAmount)
      .plus(result.fgtsPenalty);

    expect(result.totalNet.toFixed(2)).toBe(expectedNet.toFixed(2));
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('February 29 (leap year) termination date', () => {
    const input = makeInput({
      terminationDate: new Date('2024-02-29'),
      lastSalary: new Decimal('3333.33'),
      vacationPropDays: 0,
      monthsThirteenth: 0,
      fgtsBalance: new Decimal('0'),
    });
    // Should not throw
    const result = calculateTermination(input, ENGINE_PARAMS);
    expect(result.balanceSalary.toNumber()).toBeGreaterThan(0);
  });

  it('Salary R$3.333,33 — handles non-divisible amounts', () => {
    const input = makeInput({
      lastSalary: new Decimal('3333.33'),
      terminationDate: new Date('2026-03-15'),
      vacationPropDays: 0,
      monthsThirteenth: 0,
      fgtsBalance: new Decimal('0'),
    });
    const result = calculateTermination(input, ENGINE_PARAMS);
    // Should return a valid decimal, no NaN
    expect(isNaN(result.balanceSalary.toNumber())).toBe(false);
    expect(isFinite(result.balanceSalary.toNumber())).toBe(true);
  });
});
