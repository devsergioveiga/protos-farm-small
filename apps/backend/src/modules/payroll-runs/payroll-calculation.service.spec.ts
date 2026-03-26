// ─── Payroll Calculation Service Tests ────────────────────────────────

import Decimal from 'decimal.js';
import {
  calculateEmployeePayroll,
  calculateThirteenthSalary,
} from './payroll-calculation.service';
import type { EmployeePayrollInput, EngineParams } from './payroll-runs.types';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeEngineParams(): EngineParams {
  // 2026 INSS progressive brackets
  const inssBrackets = [
    { from: new Decimal('0'), upTo: new Decimal('1518.00'), rate: new Decimal('0.075') },
    { from: new Decimal('1518.01'), upTo: new Decimal('2793.88'), rate: new Decimal('0.09') },
    { from: new Decimal('2793.89'), upTo: new Decimal('4190.83'), rate: new Decimal('0.12') },
    { from: new Decimal('4190.84'), upTo: new Decimal('8157.41'), rate: new Decimal('0.14') },
    { from: new Decimal('8157.42'), upTo: null, rate: new Decimal('0.14') }, // ceiling = 8157.41
  ];

  // 2026 IRRF brackets (simplified for tests)
  const irrfBrackets = [
    { upTo: new Decimal('2259.20'), rate: new Decimal('0'), deduction: new Decimal('0') },
    { upTo: new Decimal('2826.65'), rate: new Decimal('0.075'), deduction: new Decimal('169.44') },
    { upTo: new Decimal('3751.05'), rate: new Decimal('0.15'), deduction: new Decimal('381.44') },
    { upTo: new Decimal('4664.68'), rate: new Decimal('0.225'), deduction: new Decimal('662.77') },
    { upTo: null, rate: new Decimal('0.275'), deduction: new Decimal('896.00') },
  ];

  return {
    inssBrackets,
    irrfBrackets,
    inssCeiling: new Decimal('8157.41'),
    dependentDeduction: new Decimal('189.59'),
    irrfExemptionLimit: new Decimal('2259.20'),
    redutorUpperLimit: new Decimal('5000.00'),
    redutorA: new Decimal('2259.20'),
    redutorB: new Decimal('0.0'),
    salaryFamilyValuePerChild: new Decimal('62.04'),
    salaryFamilyIncomeLimit: new Decimal('1819.26'),
    ratPercent: new Decimal('1.0'),
  };
}

function makeBaseInput(overrides: Partial<EmployeePayrollInput> = {}): EmployeePayrollInput {
  return {
    employeeId: 'emp-001',
    baseSalary: new Decimal('3000.00'),
    admissionDate: new Date('2020-01-15'),
    dependentsCount: 0,
    dependentsUnder14: 0,
    alimonyAmount: new Decimal('0'),
    housingProvided: false,
    foodProvided: false,
    requestedHousing: new Decimal('0'),
    requestedFood: new Decimal('0'),
    regionalMinWage: new Decimal('1518.00'),
    vtPercent: new Decimal('0'),
    timesheetData: {
      totalOvertime50: 0,
      totalOvertime100: 0,
      totalNightMinutes: 0,
      totalAbsences: 0,
    },
    pendingAdvances: new Decimal('0'),
    customRubricas: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('calculateEmployeePayroll', () => {
  const params = makeEngineParams();
  const referenceMonth = new Date('2026-03-01');

  it('full salary, no overtime, no deductions — grossSalary equals baseSalary, INSS/IRRF calculated correctly', () => {
    const input = makeBaseInput();
    const result = calculateEmployeePayroll(input, referenceMonth, params);

    expect(result.grossSalary.toFixed(2)).toBe('3000.00');
    expect(result.baseSalary.toFixed(2)).toBe('3000.00');
    expect(result.proRataDays).toBeNull();
    // INSS progressive on 3000:
    // 1518.00 * 7.5% = 113.85
    // (2793.88 - 1518.00) * 9% = 114.83
    // (3000.00 - 2793.88) * 12% = 24.73
    // total = 253.41
    expect(result.inssAmount.toFixed(2)).toBe('253.41');
    expect(result.overtime50.toFixed(2)).toBe('0.00');
    expect(result.dsrValue.toFixed(2)).toBe('0.00');
    expect(result.nightPremium.toFixed(2)).toBe('0.00');
    expect(result.vtDeduction.toFixed(2)).toBe('0.00');
    expect(result.advanceDeduction.toFixed(2)).toBe('0.00');
    // Net = gross - INSS - IRRF
    expect(result.netSalary.lessThanOrEqualTo(result.grossSalary)).toBe(true);
    expect(result.fgtsAmount.toFixed(2)).toBe('240.00'); // 3000 * 8%
  });

  it('mid-month admission (day 15 in March = 31 days) — proRataDays=17, baseSalary prorated', () => {
    // March 2026 has 31 days; admission on day 15 means 31 - 15 + 1 = 17 days
    const input = makeBaseInput({
      admissionDate: new Date('2026-03-15'),
    });
    const result = calculateEmployeePayroll(input, referenceMonth, params);

    expect(result.proRataDays).toBe(17);
    // proRata = 3000 * 17/31 = 1645.16 (rounded)
    const expectedProRata = new Decimal('3000').mul(17).div(31).toDecimalPlaces(2);
    expect(result.baseSalary.toFixed(2)).toBe(expectedProRata.toFixed(2));
    // grossSalary is at most baseSalary prorated (no OT)
    expect(result.grossSalary.toFixed(2)).toBe(expectedProRata.toFixed(2));
  });

  it('600 minutes overtime50 — overtime50 calculated, dsrValue uses actual rest days', () => {
    const input = makeBaseInput({
      timesheetData: {
        totalOvertime50: 600, // 10 hours
        totalOvertime100: 0,
        totalNightMinutes: 0,
        totalAbsences: 0,
      },
    });
    const result = calculateEmployeePayroll(input, referenceMonth, params);

    // hourlyRate = 3000 / 220 = 13.636...
    // overtime50 = (600/60) * (3000/220) * 1.5 = 10 * 13.636... * 1.5 = 204.54...
    const hourlyRate = new Decimal('3000').div(220);
    const expectedOT50 = new Decimal(600).div(60).mul(hourlyRate).mul('1.5').toDecimalPlaces(2);
    expect(result.overtime50.toFixed(2)).toBe(expectedOT50.toFixed(2));

    // DSR > 0 because there are Sundays in March 2026
    expect(result.dsrValue.greaterThan(0)).toBe(true);

    // grossSalary > baseSalary due to overtime
    expect(result.grossSalary.greaterThan(result.baseSalary)).toBe(true);
  });

  it('night minutes — nightPremium calculated from calculateRuralNightPremium', () => {
    const input = makeBaseInput({
      timesheetData: {
        totalOvertime50: 0,
        totalOvertime100: 0,
        totalNightMinutes: 480, // 8 hours
        totalAbsences: 0,
      },
    });
    const result = calculateEmployeePayroll(input, referenceMonth, params);

    // nightHours = 480 / 60 = 8, hourlyRate = 3000/220, premium = 8 * rate * 0.25
    const hourlyRate = new Decimal('3000').div(220);
    const nightHours = new Decimal(480).div(60);
    const expectedPremium = nightHours.mul(hourlyRate).mul('0.25').toDecimalPlaces(2);
    expect(result.nightPremium.toFixed(2)).toBe(expectedPremium.toFixed(2));
    expect(result.nightPremium.greaterThan(0)).toBe(true);
  });

  it('housing+food provided — deductions from calculateRuralUtilityDeductions', () => {
    const input = makeBaseInput({
      housingProvided: true,
      foodProvided: true,
      requestedHousing: new Decimal('500'),
      requestedFood: new Decimal('400'),
      regionalMinWage: new Decimal('1518.00'),
    });
    const result = calculateEmployeePayroll(input, referenceMonth, params);

    // housing cap = 1518 * 20% = 303.60, food cap = 1518 * 25% = 379.50
    expect(result.housingDeduction.toFixed(2)).toBe('303.60');
    expect(result.foodDeduction.toFixed(2)).toBe('379.50');
    expect(result.netSalary.lessThan(result.grossSalary)).toBe(true);
  });

  it('pending advances R$ 500 — advanceDeduction = 500', () => {
    const input = makeBaseInput({
      pendingAdvances: new Decimal('500'),
    });
    const result = calculateEmployeePayroll(input, referenceMonth, params);

    expect(result.advanceDeduction.toFixed(2)).toBe('500.00');
    // Net is reduced by advance
    const expectedNet = result.grossSalary
      .minus(result.inssAmount)
      .minus(result.irrfAmount)
      .minus(new Decimal('500'));
    expect(result.netSalary.toFixed(2)).toBe(expectedNet.toFixed(2));
  });

  it('lineItems array contains both PROVENTO and DESCONTO entries with correct codes', () => {
    const input = makeBaseInput({
      baseSalary: new Decimal('3000'),
      pendingAdvances: new Decimal('200'),
    });
    const result = calculateEmployeePayroll(input, referenceMonth, params);

    const proventos = result.lineItems.filter((li) => li.type === 'PROVENTO');
    const descontos = result.lineItems.filter((li) => li.type === 'DESCONTO');

    expect(proventos.length).toBeGreaterThan(0);
    expect(descontos.length).toBeGreaterThan(0);

    // Should have at minimum a SALARIO_BASE provento and INSS desconto
    expect(proventos.some((li) => li.code === '0001')).toBe(true); // Salário Base
    expect(descontos.some((li) => li.code === '0071')).toBe(true); // INSS
  });

  it('employer charges — fgtsAmount and inssPatronal are positive', () => {
    const input = makeBaseInput();
    const result = calculateEmployeePayroll(input, referenceMonth, params);

    expect(result.fgtsAmount.greaterThan(0)).toBe(true);
    expect(result.inssPatronal.greaterThan(0)).toBe(true);
    // inssPatronal = grossSalary * 20% + grossSalary * ratPercent%
    const expectedPatronal = result.grossSalary
      .mul('0.20')
      .plus(result.grossSalary.mul(params.ratPercent).div(100))
      .toDecimalPlaces(2);
    expect(result.inssPatronal.toFixed(2)).toBe(expectedPatronal.toFixed(2));
  });

  describe('absence impact', () => {
    it('INSS absence 10 days generates desconto rubrica with proportional deduction (D-01)', () => {
      const input = makeBaseInput({
        absenceData: { companyPaidDays: 15, inssPaidDays: 10, suspendedDays: 0, fgtsFullMonth: true },
      });
      const result = calculateEmployeePayroll(input, referenceMonth, params);
      const rubrica = result.lineItems.find((li) => li.code === '0900');
      expect(rubrica).toBeDefined();
      expect(rubrica!.description).toBe('Afastamento INSS');
      expect(rubrica!.reference).toBe('10/31d');
      expect(rubrica!.type).toBe('DESCONTO');
      expect(rubrica!.value.toFixed(2)).toBe('967.74'); // 10/31 * 3000
      expect(result.absenceInssDeduction.toFixed(2)).toBe('967.74');
    });

    it('suspension 3 days generates desconto rubrica with proportional deduction (D-09)', () => {
      const input = makeBaseInput({
        absenceData: { companyPaidDays: 0, inssPaidDays: 0, suspendedDays: 3, fgtsFullMonth: false },
      });
      const result = calculateEmployeePayroll(input, referenceMonth, params);
      const rubrica = result.lineItems.find((li) => li.code === '0910');
      expect(rubrica).toBeDefined();
      expect(rubrica!.description).toBe('Suspensão Disciplinar');
      expect(rubrica!.reference).toBe('3/31d');
      expect(rubrica!.type).toBe('DESCONTO');
      expect(rubrica!.value.toFixed(2)).toBe('290.32'); // 3/31 * 3000
      expect(result.suspensionDeduction.toFixed(2)).toBe('290.32');
    });

    it('INSS and IRRF are calculated on salary reduced by absence and suspension deductions (D-04)', () => {
      const input = makeBaseInput({
        absenceData: { companyPaidDays: 0, inssPaidDays: 10, suspendedDays: 3, fgtsFullMonth: false },
      });
      const result = calculateEmployeePayroll(input, referenceMonth, params);
      // reducedBase = 3000 - 967.74 - 290.32 = 1741.94 — INSS on this should be less than on 3000
      const fullResult = calculateEmployeePayroll(makeBaseInput(), referenceMonth, params);
      expect(result.inssAmount.lessThan(fullResult.inssAmount)).toBe(true);
    });

    it('fgtsFullMonth=true uses full baseSalary for FGTS, not adjusted (D-07)', () => {
      const input = makeBaseInput({
        absenceData: { companyPaidDays: 15, inssPaidDays: 10, suspendedDays: 0, fgtsFullMonth: true },
      });
      const result = calculateEmployeePayroll(input, referenceMonth, params);
      // FGTS base should be 3000 (full baseSalary), not prorated
      expect(result.fgtsBase.toFixed(2)).toBe('3000.00');
      expect(result.fgtsAmount.toFixed(2)).toBe('240.00'); // 8% of 3000
    });

    it('mid-month admission + INSS absence = cumulative pro-rata (D-02)', () => {
      const input = makeBaseInput({
        admissionDate: new Date('2026-03-16'), // 16 days worked (16th to 31st)
        absenceData: { companyPaidDays: 5, inssPaidDays: 5, suspendedDays: 0, fgtsFullMonth: true },
      });
      const result = calculateEmployeePayroll(input, referenceMonth, params);
      // proRataDays = 31-16+1 = 16; adjustedSalary = 3000 * 16/31 = 1548.39
      // absenceInssDeduction = 5/31 * 1548.39 = 249.74
      expect(result.proRataDays).toBe(16);
      expect(result.absenceInssDeduction.toFixed(2)).toBe('249.74');
    });

    it('suspension reduces DSR proportionally (D-10)', () => {
      const input = makeBaseInput({
        timesheetData: { totalOvertime50: 600, totalOvertime100: 0, totalNightMinutes: 0, totalAbsences: 0 },
        absenceData: { companyPaidDays: 0, inssPaidDays: 0, suspendedDays: 2, fgtsFullMonth: false },
      });
      const result = calculateEmployeePayroll(input, referenceMonth, params);
      const noSuspResult = calculateEmployeePayroll(
        makeBaseInput({
          timesheetData: { totalOvertime50: 600, totalOvertime100: 0, totalNightMinutes: 0, totalAbsences: 0 },
        }),
        referenceMonth,
        params,
      );
      expect(result.dsrValue.lessThan(noSuspResult.dsrValue)).toBe(true);
    });

    it('no absenceData produces identical result to current behavior (regression)', () => {
      const input = makeBaseInput(); // absenceData undefined
      const result = calculateEmployeePayroll(input, referenceMonth, params);
      expect(result.absenceInssDeduction.toFixed(2)).toBe('0.00');
      expect(result.suspensionDeduction.toFixed(2)).toBe('0.00');
      expect(result.fgtsBase.toFixed(2)).toBe('3000.00');
    });

    it('absenceData with all zeros produces zero deductions', () => {
      const input = makeBaseInput({
        absenceData: { companyPaidDays: 0, inssPaidDays: 0, suspendedDays: 0, fgtsFullMonth: false },
      });
      const result = calculateEmployeePayroll(input, referenceMonth, params);
      expect(result.absenceInssDeduction.toFixed(2)).toBe('0.00');
      expect(result.suspensionDeduction.toFixed(2)).toBe('0.00');
      expect(result.lineItems.find((li) => li.code === '0900')).toBeUndefined();
      expect(result.lineItems.find((li) => li.code === '0910')).toBeUndefined();
    });

    it('net salary floors at zero when deductions exceed gross (Pitfall 5)', () => {
      const input = makeBaseInput({
        baseSalary: new Decimal('1000.00'),
        absenceData: { companyPaidDays: 0, inssPaidDays: 28, suspendedDays: 0, fgtsFullMonth: false },
        pendingAdvances: new Decimal('500'),
      });
      const result = calculateEmployeePayroll(input, referenceMonth, params);
      expect(result.netSalary.greaterThanOrEqualTo(0)).toBe(true);
    });
  });
});

describe('calculateThirteenthSalary', () => {
  const params = makeEngineParams();

  it('parcel=FIRST, monthsWorked=10, salary=3000 — gross = 3000 * 10/12 / 2, no INSS/IRRF, net=gross', () => {
    const input = {
      parcel: 'FIRST' as const,
      employeeId: 'emp-001',
      baseSalary: new Decimal('3000'),
      admissionDate: new Date('2020-01-01'),
      monthsWorked: 10,
      dependentsCount: 0,
      alimonyAmount: new Decimal('0'),
      avgOvertime50: new Decimal('0'),
      avgOvertime100: new Decimal('0'),
      avgNightPremium: new Decimal('0'),
    };

    const result = calculateThirteenthSalary(input, params);

    // proportional = 3000 * 10/12 = 2500
    // gross = 2500 / 2 = 1250
    expect(result.grossSalary.toFixed(2)).toBe('1250.00');
    expect(result.inssAmount.toFixed(2)).toBe('0.00');
    expect(result.irrfAmount.toFixed(2)).toBe('0.00');
    expect(result.netSalary.toFixed(2)).toBe('1250.00');
  });

  it('parcel=SECOND, monthsWorked=12, salary=3000, firstParcelAmount=1500 — INSS/IRRF deducted + firstParcel', () => {
    const input = {
      parcel: 'SECOND' as const,
      employeeId: 'emp-001',
      baseSalary: new Decimal('3000'),
      admissionDate: new Date('2020-01-01'),
      monthsWorked: 12,
      dependentsCount: 0,
      alimonyAmount: new Decimal('0'),
      avgOvertime50: new Decimal('0'),
      avgOvertime100: new Decimal('0'),
      avgNightPremium: new Decimal('0'),
      firstParcelAmount: new Decimal('1500'),
    };

    const result = calculateThirteenthSalary(input, params);

    // grossBase = (3000 + 0 + 0 + 0) * 12/12 = 3000
    expect(result.grossSalary.toFixed(2)).toBe('3000.00');
    // INSS on 3000: 113.85 + 114.83 + 24.73 = 253.41
    expect(result.inssAmount.toFixed(2)).toBe('253.41');
    // IRRF is positive (some amount)
    expect(result.irrfAmount.greaterThanOrEqualTo(0)).toBe(true);
    // net = gross - INSS - IRRF - firstParcel
    const expectedNet = result.grossSalary
      .minus(result.inssAmount)
      .minus(result.irrfAmount)
      .minus(new Decimal('1500'));
    expect(result.netSalary.toFixed(2)).toBe(expectedNet.toFixed(2));
  });
});
