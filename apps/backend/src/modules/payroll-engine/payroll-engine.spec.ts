import Decimal from 'decimal.js';
import type { INSSBracket, IRRFBracket, SalaryFamilyInput, RuralNightInput, RuralUtilityInput, RubricaContext } from './payroll-engine.types';
import {
  calculateINSS,
  calculateIRRF,
  calculateFGTS,
  calculateSalaryFamily,
  calculateRuralNightPremium,
  calculateRuralUtilityDeductions,
  evaluateFormula,
} from './payroll-engine.service';

// 2026 INSS brackets — Portaria Interministerial MPS/MF nº 13/2026
const INSS_BRACKETS_2026: INSSBracket[] = [
  { from: new Decimal('0'), upTo: new Decimal('1621.00'), rate: new Decimal('0.075') },
  { from: new Decimal('1621.01'), upTo: new Decimal('2902.84'), rate: new Decimal('0.09') },
  { from: new Decimal('2902.85'), upTo: new Decimal('4354.27'), rate: new Decimal('0.12') },
  { from: new Decimal('4354.28'), upTo: new Decimal('8475.55'), rate: new Decimal('0.14') },
];

const INSS_CEILING_2026 = new Decimal('8475.55');

// 2026 IRRF brackets — Receita Federal
const IRRF_BRACKETS_2026: IRRFBracket[] = [
  { upTo: new Decimal('2259.20'), rate: new Decimal('0'), deduction: new Decimal('0') },
  { upTo: new Decimal('2826.65'), rate: new Decimal('0.075'), deduction: new Decimal('169.44') },
  { upTo: new Decimal('3751.05'), rate: new Decimal('0.15'), deduction: new Decimal('381.44') },
  { upTo: new Decimal('4664.68'), rate: new Decimal('0.225'), deduction: new Decimal('662.77') },
  { upTo: null, rate: new Decimal('0.275'), deduction: new Decimal('896.00') },
];

const DEPENDENT_DEDUCTION_2026 = new Decimal('189.59');

beforeAll(() => {
  Decimal.set({ rounding: Decimal.ROUND_HALF_UP });
});

describe('calculateINSS', () => {
  it('salary R$ 1.621,00 (exactly minimum wage): INSS = R$ 121,58', () => {
    const result = calculateINSS(new Decimal('1621.00'), INSS_BRACKETS_2026, INSS_CEILING_2026);
    expect(result.contribution.toFixed(2)).toBe('121.58');
    expect(result.effectiveBase.toFixed(2)).toBe('1621.00');
  });

  it('salary R$ 2.000,00: INSS = R$ 155,69', () => {
    const result = calculateINSS(new Decimal('2000.00'), INSS_BRACKETS_2026, INSS_CEILING_2026);
    expect(result.contribution.toFixed(2)).toBe('155.69');
  });

  it('salary R$ 3.500,00: INSS = R$ 308,61', () => {
    const result = calculateINSS(new Decimal('3500.00'), INSS_BRACKETS_2026, INSS_CEILING_2026);
    expect(result.contribution.toFixed(2)).toBe('308.61');
  });

  it('salary R$ 5.000,00: INSS = R$ 501,52', () => {
    const result = calculateINSS(new Decimal('5000.00'), INSS_BRACKETS_2026, INSS_CEILING_2026);
    expect(result.contribution.toFixed(2)).toBe('501.52');
  });

  it('salary R$ 10.000,00 (above ceiling 8475.55): INSS = R$ 988,09', () => {
    const result = calculateINSS(new Decimal('10000.00'), INSS_BRACKETS_2026, INSS_CEILING_2026);
    expect(result.contribution.toFixed(2)).toBe('988.09');
    expect(result.effectiveBase.toFixed(2)).toBe('8475.55');
  });

  it('salary R$ 1.000,00: INSS = R$ 75,00', () => {
    const result = calculateINSS(new Decimal('1000.00'), INSS_BRACKETS_2026, INSS_CEILING_2026);
    expect(result.contribution.toFixed(2)).toBe('75.00');
  });

  it('salary R$ 0,00: INSS = R$ 0,00', () => {
    const result = calculateINSS(new Decimal('0'), INSS_BRACKETS_2026, INSS_CEILING_2026);
    expect(result.contribution.toFixed(2)).toBe('0.00');
  });

  it('returns grossBase equal to input salary', () => {
    const result = calculateINSS(new Decimal('5000.00'), INSS_BRACKETS_2026, INSS_CEILING_2026);
    expect(result.grossBase.toFixed(2)).toBe('5000.00');
  });

  it('effectiveBase is capped at ceiling for salary above ceiling', () => {
    const result = calculateINSS(new Decimal('15000.00'), INSS_BRACKETS_2026, INSS_CEILING_2026);
    expect(result.effectiveBase.toFixed(2)).toBe('8475.55');
    expect(result.contribution.toFixed(2)).toBe('988.09');
  });
});

describe('calculateIRRF', () => {
  it('base tributavel below exemption limit: IRRF = R$ 0,00', () => {
    // taxableBase = 2000 - 0 - 0 - 0 = 2000 (below 2259.20 first bracket)
    const result = calculateIRRF({
      grossSalary: new Decimal('2000.00'),
      inssContribution: new Decimal('0'),
      dependents: 0,
      alimony: new Decimal('0'),
      brackets: IRRF_BRACKETS_2026,
      dependentDeduction: DEPENDENT_DEDUCTION_2026,
      exemptionLimit: new Decimal('5000.00'),
      redutorUpperLimit: new Decimal('7350.00'),
      redutorA: new Decimal('978.62'),
      redutorB: new Decimal('0.133145'),
    });
    expect(result.finalTax.toFixed(2)).toBe('0.00');
  });

  it('salary R$ 5.000,00, 2 dependents — base <= 5000 so IRRF = R$ 0,00 (2026 exemption)', () => {
    // INSS = 501.52, base = 5000 - 501.52 - (2 * 189.59) = 4119.30
    // 4119.30 <= 5000 → finalTax = 0
    const result = calculateIRRF({
      grossSalary: new Decimal('5000.00'),
      inssContribution: new Decimal('501.52'),
      dependents: 2,
      alimony: new Decimal('0'),
      brackets: IRRF_BRACKETS_2026,
      dependentDeduction: DEPENDENT_DEDUCTION_2026,
      exemptionLimit: new Decimal('5000.00'),
      redutorUpperLimit: new Decimal('7350.00'),
      redutorA: new Decimal('978.62'),
      redutorB: new Decimal('0.133145'),
    });
    expect(result.finalTax.toFixed(2)).toBe('0.00');
    expect(result.taxableBase.toFixed(2)).toBe('4119.30');
  });

  it('salary R$ 8.000,00, 0 dependents — IRRF applies partial redutor', () => {
    // INSS = 711.34, base = 8000 - 711.34 = 7288.66
    // grossTax = 7288.66 * 27.5% - 896.00 = 2004.38 - 896.00 = 1108.38
    // Wait, need to use correct bracket: upTo=null, rate=0.275, deduction=896.00
    // Wait, 7288.66 > 4664.68, so last bracket: 7288.66 * 0.275 - 896.00 = 2004.38 - 896.00 = 1108.38
    // redutor: 7288.66 <= 7350? Yes, so redutor = 978.62 - (0.133145 * 7288.66) = 978.62 - 970.46 = 8.16
    // finalTax = 1108.38 - 8.16 = 1100.22
    const result = calculateIRRF({
      grossSalary: new Decimal('8000.00'),
      inssContribution: new Decimal('711.34'),
      dependents: 0,
      alimony: new Decimal('0'),
      brackets: IRRF_BRACKETS_2026,
      dependentDeduction: DEPENDENT_DEDUCTION_2026,
      exemptionLimit: new Decimal('5000.00'),
      redutorUpperLimit: new Decimal('7350.00'),
      redutorA: new Decimal('978.62'),
      redutorB: new Decimal('0.133145'),
    });
    expect(result.taxableBase.toFixed(2)).toBe('7288.66');
    // finalTax = grossTax - redutor (redutor > 0 because taxableBase <= 7350)
    expect(result.redutor.greaterThan(0)).toBe(true);
    expect(result.finalTax.greaterThan(0)).toBe(true);
    // Verify it's less than grossTax
    expect(result.finalTax.lessThan(result.grossTax)).toBe(true);
  });

  it('salary R$ 15.000,00, 0 dependents — above redutor limit, full tax applies', () => {
    // INSS=988.09, base=15000-988.09=14011.91
    // grossTax = 14011.91 * 0.275 - 896.00 = 3853.27 - 896.00 = 2957.27
    // base > 7350 → no redutor
    const result = calculateIRRF({
      grossSalary: new Decimal('15000.00'),
      inssContribution: new Decimal('988.09'),
      dependents: 0,
      alimony: new Decimal('0'),
      brackets: IRRF_BRACKETS_2026,
      dependentDeduction: DEPENDENT_DEDUCTION_2026,
      exemptionLimit: new Decimal('5000.00'),
      redutorUpperLimit: new Decimal('7350.00'),
      redutorA: new Decimal('978.62'),
      redutorB: new Decimal('0.133145'),
    });
    expect(result.taxableBase.toFixed(2)).toBe('14011.91');
    expect(result.redutor.toFixed(2)).toBe('0.00');
    expect(result.finalTax.equals(result.grossTax)).toBe(true);
    expect(result.finalTax.greaterThan(0)).toBe(true);
  });

  it('salary R$ 3.000,00, 1 dependent — verifies correct bracket', () => {
    // INSS bracket 1: 1621 * 7.5% = 121.58, bracket 2: (2902.84-1621)*9% = 115.34, bracket 3: (3000-2902.84)*12% = 11.66, total ~248.58
    // Let's use simplified INSS for this test
    const result = calculateIRRF({
      grossSalary: new Decimal('3000.00'),
      inssContribution: new Decimal('248.58'),
      dependents: 1,
      alimony: new Decimal('0'),
      brackets: IRRF_BRACKETS_2026,
      dependentDeduction: DEPENDENT_DEDUCTION_2026,
      exemptionLimit: new Decimal('5000.00'),
      redutorUpperLimit: new Decimal('7350.00'),
      redutorA: new Decimal('978.62'),
      redutorB: new Decimal('0.133145'),
    });
    // taxableBase = 3000 - 248.58 - 189.59 = 2561.83
    expect(result.taxableBase.toFixed(2)).toBe('2561.83');
    // 2561.83 <= 5000, so finalTax = 0
    expect(result.finalTax.toFixed(2)).toBe('0.00');
  });

  it('returns zeros when taxableBase is negative', () => {
    const result = calculateIRRF({
      grossSalary: new Decimal('500.00'),
      inssContribution: new Decimal('37.50'),
      dependents: 5,
      alimony: new Decimal('0'),
      brackets: IRRF_BRACKETS_2026,
      dependentDeduction: DEPENDENT_DEDUCTION_2026,
      exemptionLimit: new Decimal('5000.00'),
      redutorUpperLimit: new Decimal('7350.00'),
      redutorA: new Decimal('978.62'),
      redutorB: new Decimal('0.133145'),
    });
    expect(result.finalTax.toFixed(2)).toBe('0.00');
    expect(result.grossTax.toFixed(2)).toBe('0.00');
  });
});

describe('calculateFGTS', () => {
  it('salary R$ 5.000,00: FGTS = R$ 400,00', () => {
    const result = calculateFGTS(new Decimal('5000.00'));
    expect(result.contribution.toFixed(2)).toBe('400.00');
  });

  it('salary R$ 1.621,00: FGTS = R$ 129,68', () => {
    const result = calculateFGTS(new Decimal('1621.00'));
    expect(result.contribution.toFixed(2)).toBe('129.68');
  });

  it('no ceiling: salary R$ 50.000,00: FGTS = R$ 4.000,00', () => {
    const result = calculateFGTS(new Decimal('50000.00'));
    expect(result.contribution.toFixed(2)).toBe('4000.00');
  });

  it('returns base equal to input salary', () => {
    const result = calculateFGTS(new Decimal('3000.00'));
    expect(result.base.toFixed(2)).toBe('3000.00');
  });
});

describe('calculateSalaryFamily', () => {
  const BASE_INPUT: SalaryFamilyInput = {
    grossSalary: new Decimal('1800.00'),
    eligibleDependents: 2,
    valuePerChild: new Decimal('67.54'),
    incomeLimit: new Decimal('1980.38'),
  };

  it('salary R$ 1.800,00, 2 children — under limit: benefit = R$ 135,08', () => {
    const result = calculateSalaryFamily(BASE_INPUT);
    expect(result.benefit.toFixed(2)).toBe('135.08');
    expect(result.eligible).toBe(true);
  });

  it('salary R$ 2.000,00, 2 children — above limit: benefit = R$ 0,00', () => {
    const result = calculateSalaryFamily({
      ...BASE_INPUT,
      grossSalary: new Decimal('2000.00'),
    });
    expect(result.benefit.toFixed(2)).toBe('0.00');
    expect(result.eligible).toBe(false);
  });

  it('salary R$ 1.980,38, 1 child — exactly at limit: benefit = R$ 67,54', () => {
    const result = calculateSalaryFamily({
      ...BASE_INPUT,
      grossSalary: new Decimal('1980.38'),
      eligibleDependents: 1,
    });
    expect(result.benefit.toFixed(2)).toBe('67.54');
    expect(result.eligible).toBe(true);
  });

  it('0 dependents — benefit = R$ 0,00', () => {
    const result = calculateSalaryFamily({
      ...BASE_INPUT,
      eligibleDependents: 0,
    });
    expect(result.benefit.toFixed(2)).toBe('0.00');
  });
});

describe('calculateRuralNightPremium', () => {
  it('4 rural night hours at R$ 10/h: premium = R$ 10,00 (4 * 10 * 25%)', () => {
    const result = calculateRuralNightPremium({
      nightHours: new Decimal('4'),
      hourlyRate: new Decimal('10.00'),
      premiumRate: new Decimal('0.25'),
    });
    expect(result.premium.toFixed(2)).toBe('10.00');
    expect(result.nightHours.toFixed(0)).toBe('4');
  });

  it('0 hours: premium = R$ 0,00', () => {
    const result = calculateRuralNightPremium({
      nightHours: new Decimal('0'),
      hourlyRate: new Decimal('10.00'),
      premiumRate: new Decimal('0.25'),
    });
    expect(result.premium.toFixed(2)).toBe('0.00');
  });

  it('8 hours at R$ 8,50/h: premium = R$ 17,00 (8 * 8.50 * 25%)', () => {
    const result = calculateRuralNightPremium({
      nightHours: new Decimal('8'),
      hourlyRate: new Decimal('8.50'),
      premiumRate: new Decimal('0.25'),
    });
    expect(result.premium.toFixed(2)).toBe('17.00');
  });

  it('uses 60-minute hour (caller passes hours directly, no conversion)', () => {
    // Rural hour = 60 minutes (not 52m30s urban)
    // The function simply multiplies nightHours * hourlyRate * premiumRate
    // Caller is responsible for passing the correct number of 60-min hours
    const result = calculateRuralNightPremium({
      nightHours: new Decimal('1'),
      hourlyRate: new Decimal('7.38'), // ~1621/220
      premiumRate: new Decimal('0.25'),
    });
    expect(result.premium.toFixed(2)).toBe('1.85');
  });
});

describe('calculateRuralUtilityDeductions', () => {
  const REGIONAL_MIN_2026 = new Decimal('1621.00');

  it('housing R$ 500 > cap (1621*20% = R$ 324,20): returns R$ 324,20', () => {
    const result = calculateRuralUtilityDeductions({
      requestedHousing: new Decimal('500.00'),
      requestedFood: new Decimal('0'),
      regionalMinWage: REGIONAL_MIN_2026,
    });
    expect(result.housing.toFixed(2)).toBe('324.20');
    expect(result.housingCapped).toBe(true);
  });

  it('food R$ 600 > cap (1621*25% = R$ 405,25): returns R$ 405,25', () => {
    const result = calculateRuralUtilityDeductions({
      requestedHousing: new Decimal('0'),
      requestedFood: new Decimal('600.00'),
      regionalMinWage: REGIONAL_MIN_2026,
    });
    expect(result.food.toFixed(2)).toBe('405.25');
    expect(result.foodCapped).toBe(true);
  });

  it('housing R$ 200 < cap: returns R$ 200,00 (not capped)', () => {
    const result = calculateRuralUtilityDeductions({
      requestedHousing: new Decimal('200.00'),
      requestedFood: new Decimal('0'),
      regionalMinWage: REGIONAL_MIN_2026,
    });
    expect(result.housing.toFixed(2)).toBe('200.00');
    expect(result.housingCapped).toBe(false);
  });

  it('food R$ 300 < cap: returns R$ 300,00 (not capped)', () => {
    const result = calculateRuralUtilityDeductions({
      requestedHousing: new Decimal('0'),
      requestedFood: new Decimal('300.00'),
      regionalMinWage: REGIONAL_MIN_2026,
    });
    expect(result.food.toFixed(2)).toBe('300.00');
    expect(result.foodCapped).toBe(false);
  });

  it('both housing and food provided simultaneously', () => {
    const result = calculateRuralUtilityDeductions({
      requestedHousing: new Decimal('500.00'),
      requestedFood: new Decimal('300.00'),
      regionalMinWage: REGIONAL_MIN_2026,
    });
    expect(result.housing.toFixed(2)).toBe('324.20');
    expect(result.food.toFixed(2)).toBe('300.00');
    expect(result.housingCapped).toBe(true);
    expect(result.foodCapped).toBe(false);
  });
});

describe('evaluateFormula', () => {
  const BASE_CONTEXT: RubricaContext = {
    SALARIO_BASE: 5000,
    HORA_NORMAL: 7.38,
    HORAS_EXTRAS_50: 10,
    HORAS_EXTRAS_100: 2,
    SALARIO_MINIMO: 1621,
    PISO_REGIONAL: 1621,
    DIAS_TRABALHADOS: 22,
    DIAS_UTEIS_MES: 22,
  };

  it('"SALARIO_BASE * 0.05" with SALARIO_BASE=5000: result = R$ 250,00', () => {
    const result = evaluateFormula('SALARIO_BASE * 0.05', BASE_CONTEXT);
    expect(result.toFixed(2)).toBe('250.00');
  });

  it('"SALARIO_BASE * HORAS_EXTRAS_50 / 220": verify correct calculation', () => {
    // 5000 * 10 / 220 = 227.27...
    const result = evaluateFormula('SALARIO_BASE * HORAS_EXTRAS_50 / 220', BASE_CONTEXT);
    expect(result.toFixed(2)).toBe('227.27');
  });

  it('empty formula returns R$ 0,00', () => {
    const result = evaluateFormula('', BASE_CONTEXT);
    expect(result.toFixed(2)).toBe('0.00');
  });

  it('invalid formula throws descriptive error', () => {
    expect(() => evaluateFormula('SALARIO_BASE + INVALID_VAR_THAT_DOESNT_EXIST', BASE_CONTEXT)).toThrow();
  });

  it('simple arithmetic: "100 + 50": result = R$ 150,00', () => {
    const result = evaluateFormula('100 + 50', BASE_CONTEXT);
    expect(result.toFixed(2)).toBe('150.00');
  });

  it('zero formula "0": result = R$ 0,00', () => {
    const result = evaluateFormula('0', BASE_CONTEXT);
    expect(result.toFixed(2)).toBe('0.00');
  });
});
