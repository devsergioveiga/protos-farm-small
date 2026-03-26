// ─── Payroll Calculation Service ──────────────────────────────────────
// Per-employee calculation: gross salary, deductions, net, and employer charges.
// Orchestrates engine functions from payroll-engine.service.

import Decimal from 'decimal.js';
import Holidays from 'date-holidays';
import {
  calculateINSS,
  calculateIRRF,
  calculateFGTS,
  calculateSalaryFamily,
  calculateRuralNightPremium,
  calculateRuralUtilityDeductions,
} from '../payroll-engine/payroll-engine.service';
import type {
  EmployeePayrollInput,
  EmployeePayrollResult,
  ThirteenthSalaryInput,
  EngineParams,
} from './payroll-runs.types';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

// ─── Holiday cache (per locale) ───────────────────────────────────────

const holidaysCache = new Map<string, Holidays>();

function getHolidays(stateCode?: string): Holidays {
  const key = `BR-${stateCode ?? ''}`;
  if (!holidaysCache.has(key)) {
    const hd = stateCode ? new Holidays('BR', stateCode) : new Holidays('BR');
    holidaysCache.set(key, hd);
  }
  return holidaysCache.get(key)!;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Returns the number of Sundays and public holidays in a given month.
 */
function countRestDays(year: number, month: number, stateCode?: string): number {
  const hd = getHolidays(stateCode);
  const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-based
  let restDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getDay() === 0 || hd.isHoliday(d) !== false) {
      restDays++;
    }
  }
  return restDays;
}

/**
 * Returns the number of days in the given month (1-based).
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ─── Main calculation ─────────────────────────────────────────────────

/**
 * Calculates the full payroll for one employee in a given reference month.
 *
 * @param input - Employee-specific payroll data
 * @param referenceMonth - First day of the reference month
 * @param params - Legal engine parameters (INSS/IRRF brackets, etc.)
 */
export function calculateEmployeePayroll(
  input: EmployeePayrollInput,
  referenceMonth: Date,
  params: EngineParams,
): EmployeePayrollResult {
  const {
    baseSalary,
    admissionDate,
    dependentsCount,
    dependentsUnder14,
    alimonyAmount,
    housingProvided,
    foodProvided,
    requestedHousing,
    requestedFood,
    regionalMinWage,
    vtPercent,
    timesheetData,
    pendingAdvances,
    customRubricas,
  } = input;

  const year = referenceMonth.getUTCFullYear();
  const month = referenceMonth.getUTCMonth() + 1; // 1-based
  const totalDays = daysInMonth(year, month);

  // ─── Step 1: Pro-rata calculation ─────────────────────────────────

  let proRataDays: number | null = null;
  let adjustedSalary = baseSalary;

  const admYear = admissionDate.getUTCFullYear();
  const admMonth = admissionDate.getUTCMonth() + 1;
  const admDay = admissionDate.getUTCDate();

  if (admYear === year && admMonth === month) {
    // Employee admitted within this reference month
    proRataDays = totalDays - admDay + 1;
    const proRataFactor = new Decimal(proRataDays).div(totalDays);
    adjustedSalary = baseSalary.mul(proRataFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  // ─── Step 2: Hourly rate ───────────────────────────────────────────

  const hourlyRate = adjustedSalary.div(220).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  // ─── Step 3: Overtime ─────────────────────────────────────────────

  const lineItems: EmployeePayrollResult['lineItems'] = [];

  let overtime50 = new Decimal(0);
  let overtime100 = new Decimal(0);
  let nightPremium = new Decimal(0);
  let salaryFamilyAmount = new Decimal(0);

  if (timesheetData) {
    const ot50Hours = new Decimal(timesheetData.totalOvertime50).div(60);
    const ot100Hours = new Decimal(timesheetData.totalOvertime100).div(60);

    overtime50 = ot50Hours.mul(hourlyRate).mul('1.5').toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    overtime100 = ot100Hours.mul(hourlyRate).mul('2.0').toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  // ─── Step 4: DSR on overtime ──────────────────────────────────────

  let dsrValue = new Decimal(0);
  const overtimeTotal = overtime50.plus(overtime100);

  if (overtimeTotal.greaterThan(0)) {
    const restDays = countRestDays(year, month);
    const workDays = totalDays - restDays;
    if (workDays > 0) {
      dsrValue = overtimeTotal
        .mul(new Decimal(restDays).div(workDays))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  }

  // ─── Step 5: Night premium ────────────────────────────────────────

  if (timesheetData && timesheetData.totalNightMinutes > 0) {
    const nightHours = new Decimal(timesheetData.totalNightMinutes).div(60);
    const nightResult = calculateRuralNightPremium({
      nightHours,
      hourlyRate,
      premiumRate: new Decimal('0.25'),
    });
    nightPremium = nightResult.premium;
  }

  // ─── Step 6: Salary family ────────────────────────────────────────

  const salaryFamilyResult = calculateSalaryFamily({
    grossSalary: adjustedSalary,
    eligibleDependents: dependentsUnder14,
    valuePerChild: params.salaryFamilyValuePerChild,
    incomeLimit: params.salaryFamilyIncomeLimit,
  });
  salaryFamilyAmount = salaryFamilyResult.benefit;

  // ─── Step 7: Custom rubricas provisions ───────────────────────────

  let otherProvisions = new Decimal(0);
  let otherDeductions = new Decimal(0);

  for (const rubrica of customRubricas) {
    if (rubrica.type === 'PROVENTO') {
      otherProvisions = otherProvisions.plus(rubrica.value);
      lineItems.push({
        code: rubrica.code,
        description: rubrica.description,
        reference: '',
        type: 'PROVENTO',
        value: rubrica.value,
      });
    } else {
      otherDeductions = otherDeductions.plus(rubrica.value);
      lineItems.push({
        code: rubrica.code,
        description: rubrica.description,
        reference: '',
        type: 'DESCONTO',
        value: rubrica.value,
      });
    }
  }

  // ─── Step 8: Gross salary ─────────────────────────────────────────

  const grossSalary = adjustedSalary
    .plus(overtime50)
    .plus(overtime100)
    .plus(dsrValue)
    .plus(nightPremium)
    .plus(salaryFamilyAmount)
    .plus(otherProvisions)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ─── Step 9: INSS ─────────────────────────────────────────────────

  const inssResult = calculateINSS(grossSalary, params.inssBrackets, params.inssCeiling);
  const inssAmount = inssResult.contribution;

  // ─── Step 10: IRRF ────────────────────────────────────────────────

  const irrfResult = calculateIRRF({
    grossSalary,
    inssContribution: inssAmount,
    dependents: dependentsCount,
    alimony: alimonyAmount,
    brackets: params.irrfBrackets,
    dependentDeduction: params.dependentDeduction,
    exemptionLimit: params.irrfExemptionLimit,
    redutorUpperLimit: params.redutorUpperLimit,
    redutorA: params.redutorA,
    redutorB: params.redutorB,
  });
  const irrfAmount = irrfResult.finalTax;

  // ─── Step 11: Utility deductions ──────────────────────────────────

  const utilityResult = calculateRuralUtilityDeductions({
    requestedHousing: housingProvided ? requestedHousing : new Decimal(0),
    requestedFood: foodProvided ? requestedFood : new Decimal(0),
    regionalMinWage,
  });
  const housingDeduction = utilityResult.housing;
  const foodDeduction = utilityResult.food;

  // ─── Step 12: VT deduction ────────────────────────────────────────

  let vtDeduction = new Decimal(0);
  if (vtPercent.greaterThan(0)) {
    // CLT cap: 6% of salary
    const vtRate = Decimal.min(vtPercent, new Decimal(6)).div(100);
    vtDeduction = adjustedSalary.mul(vtRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  // ─── Step 13: Net salary ──────────────────────────────────────────

  const netSalary = grossSalary
    .minus(inssAmount)
    .minus(irrfAmount)
    .minus(vtDeduction)
    .minus(housingDeduction)
    .minus(foodDeduction)
    .minus(pendingAdvances)
    .minus(otherDeductions)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ─── Step 14: FGTS ────────────────────────────────────────────────

  const fgtsResult = calculateFGTS(grossSalary);
  const fgtsAmount = fgtsResult.contribution;

  // ─── Step 15: INSS patronal ───────────────────────────────────────

  const inssPatronal = grossSalary
    .mul('0.20')
    .plus(grossSalary.mul(params.ratPercent).div(100))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // ─── Step 16: Build line items ────────────────────────────────────

  // Proventos
  lineItems.unshift({
    code: '0001',
    description: 'Salário Base',
    reference: proRataDays ? `${proRataDays}/${totalDays} dias` : `${totalDays} dias`,
    type: 'PROVENTO',
    value: adjustedSalary,
  });

  if (overtime50.greaterThan(0)) {
    lineItems.push({
      code: '0021',
      description: 'Horas Extras 50%',
      reference: `${new Decimal(timesheetData?.totalOvertime50 ?? 0).div(60).toFixed(2)}h`,
      type: 'PROVENTO',
      value: overtime50,
    });
  }

  if (overtime100.greaterThan(0)) {
    lineItems.push({
      code: '0022',
      description: 'Horas Extras 100%',
      reference: `${new Decimal(timesheetData?.totalOvertime100 ?? 0).div(60).toFixed(2)}h`,
      type: 'PROVENTO',
      value: overtime100,
    });
  }

  if (dsrValue.greaterThan(0)) {
    lineItems.push({
      code: '0030',
      description: 'DSR sobre Horas Extras',
      reference: '',
      type: 'PROVENTO',
      value: dsrValue,
    });
  }

  if (nightPremium.greaterThan(0)) {
    lineItems.push({
      code: '0041',
      description: 'Adicional Noturno Rural',
      reference: `${new Decimal(timesheetData?.totalNightMinutes ?? 0).div(60).toFixed(2)}h`,
      type: 'PROVENTO',
      value: nightPremium,
    });
  }

  if (salaryFamilyAmount.greaterThan(0)) {
    lineItems.push({
      code: '0050',
      description: 'Salário Família',
      reference: `${dependentsUnder14} dep.`,
      type: 'PROVENTO',
      value: salaryFamilyAmount,
    });
  }

  // Descontos
  if (inssAmount.greaterThan(0)) {
    lineItems.push({
      code: '0071',
      description: 'INSS',
      reference: `${inssResult.effectiveRate.mul(100).toFixed(2)}%`,
      type: 'DESCONTO',
      value: inssAmount,
    });
  }

  if (irrfAmount.greaterThan(0)) {
    lineItems.push({
      code: '0072',
      description: 'IRRF',
      reference: '',
      type: 'DESCONTO',
      value: irrfAmount,
    });
  }

  if (vtDeduction.greaterThan(0)) {
    lineItems.push({
      code: '0081',
      description: 'Vale Transporte',
      reference: `${vtPercent.toFixed(0)}%`,
      type: 'DESCONTO',
      value: vtDeduction,
    });
  }

  if (housingDeduction.greaterThan(0)) {
    lineItems.push({
      code: '0091',
      description: 'Desconto Moradia',
      reference: '20% piso regional',
      type: 'DESCONTO',
      value: housingDeduction,
    });
  }

  if (foodDeduction.greaterThan(0)) {
    lineItems.push({
      code: '0092',
      description: 'Desconto Alimentação',
      reference: '25% piso regional',
      type: 'DESCONTO',
      value: foodDeduction,
    });
  }

  if (pendingAdvances.greaterThan(0)) {
    lineItems.push({
      code: '0100',
      description: 'Desconto Adiantamento',
      reference: '',
      type: 'DESCONTO',
      value: pendingAdvances,
    });
  }

  return {
    baseSalary: adjustedSalary,
    proRataDays,
    overtime50,
    overtime100,
    dsrValue,
    nightPremium,
    salaryFamily: salaryFamilyAmount,
    otherProvisions,
    grossSalary,
    inssAmount,
    irrfAmount,
    vtDeduction,
    housingDeduction,
    foodDeduction,
    advanceDeduction: pendingAdvances,
    otherDeductions,
    netSalary,
    fgtsAmount,
    inssPatronal,
    lineItems,
  };
}

// ─── 13th salary calculation ──────────────────────────────────────────

/**
 * Calculates 13th salary (gratificação natalina) for first or second parcel.
 *
 * First parcel (until 30/Nov): half of proportional annual salary, no INSS/IRRF.
 * Second parcel (until 20/Dec): full proportional, with INSS and IRRF deducted,
 * minus first parcel paid.
 *
 * @param input - Thirteenth salary input data
 * @param params - Legal engine parameters
 */
export function calculateThirteenthSalary(
  input: ThirteenthSalaryInput,
  params: EngineParams,
): EmployeePayrollResult {
  const {
    parcel,
    baseSalary,
    monthsWorked,
    dependentsCount,
    alimonyAmount,
    avgOvertime50,
    avgOvertime100,
    avgNightPremium,
    firstParcelAmount,
  } = input;

  const lineItems: EmployeePayrollResult['lineItems'] = [];

  if (parcel === 'FIRST') {
    // proportional = baseSalary * monthsWorked / 12
    // gross = proportional / 2 (first half)
    const proportional = baseSalary
      .mul(monthsWorked)
      .div(12)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const gross = proportional.div(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    lineItems.push({
      code: '0002',
      description: '13º Salário — 1ª Parcela',
      reference: `${monthsWorked}/12 avos`,
      type: 'PROVENTO',
      value: gross,
    });

    return {
      baseSalary,
      proRataDays: null,
      overtime50: new Decimal(0),
      overtime100: new Decimal(0),
      dsrValue: new Decimal(0),
      nightPremium: new Decimal(0),
      salaryFamily: new Decimal(0),
      otherProvisions: new Decimal(0),
      grossSalary: gross,
      inssAmount: new Decimal(0),
      irrfAmount: new Decimal(0),
      vtDeduction: new Decimal(0),
      housingDeduction: new Decimal(0),
      foodDeduction: new Decimal(0),
      advanceDeduction: new Decimal(0),
      otherDeductions: new Decimal(0),
      netSalary: gross,
      fgtsAmount: calculateFGTS(gross).contribution,
      inssPatronal: gross
        .mul('0.20')
        .plus(gross.mul(params.ratPercent).div(100))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      lineItems,
    };
  }

  // SECOND parcel
  // grossBase = (baseSalary + avgOvertime50 + avgOvertime100 + avgNightPremium) * monthsWorked / 12
  const grossBase = baseSalary
    .plus(avgOvertime50)
    .plus(avgOvertime100)
    .plus(avgNightPremium)
    .mul(monthsWorked)
    .div(12)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  lineItems.push({
    code: '0003',
    description: '13º Salário — 2ª Parcela',
    reference: `${monthsWorked}/12 avos`,
    type: 'PROVENTO',
    value: grossBase,
  });

  // INSS on grossBase
  const inssResult = calculateINSS(grossBase, params.inssBrackets, params.inssCeiling);
  const inssAmount = inssResult.contribution;

  if (inssAmount.greaterThan(0)) {
    lineItems.push({
      code: '0071',
      description: 'INSS',
      reference: `13º`,
      type: 'DESCONTO',
      value: inssAmount,
    });
  }

  // IRRF on (grossBase - INSS - dependents * deduction - alimony)
  const irrfResult = calculateIRRF({
    grossSalary: grossBase,
    inssContribution: inssAmount,
    dependents: dependentsCount,
    alimony: alimonyAmount,
    brackets: params.irrfBrackets,
    dependentDeduction: params.dependentDeduction,
    exemptionLimit: params.irrfExemptionLimit,
    redutorUpperLimit: params.redutorUpperLimit,
    redutorA: params.redutorA,
    redutorB: params.redutorB,
  });
  const irrfAmount = irrfResult.finalTax;

  if (irrfAmount.greaterThan(0)) {
    lineItems.push({
      code: '0072',
      description: 'IRRF',
      reference: `13º`,
      type: 'DESCONTO',
      value: irrfAmount,
    });
  }

  // First parcel deduction from second parcel net
  const firstParcel = firstParcelAmount ?? new Decimal(0);
  if (firstParcel.greaterThan(0)) {
    lineItems.push({
      code: '0101',
      description: 'Desconto 1ª Parcela 13º',
      reference: '',
      type: 'DESCONTO',
      value: firstParcel,
    });
  }

  // net = grossBase - INSS - IRRF - firstParcel
  const netSalary = grossBase
    .minus(inssAmount)
    .minus(irrfAmount)
    .minus(firstParcel)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    baseSalary,
    proRataDays: null,
    overtime50: new Decimal(0),
    overtime100: new Decimal(0),
    dsrValue: new Decimal(0),
    nightPremium: new Decimal(0),
    salaryFamily: new Decimal(0),
    otherProvisions: new Decimal(0),
    grossSalary: grossBase,
    inssAmount,
    irrfAmount,
    vtDeduction: new Decimal(0),
    housingDeduction: new Decimal(0),
    foodDeduction: new Decimal(0),
    advanceDeduction: new Decimal(0),
    otherDeductions: new Decimal(0),
    netSalary,
    fgtsAmount: calculateFGTS(grossBase).contribution,
    inssPatronal: grossBase
      .mul('0.20')
      .plus(grossBase.mul(params.ratPercent).div(100))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    lineItems,
  };
}
