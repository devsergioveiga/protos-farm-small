import Decimal from 'decimal.js';
import { Parser } from 'expr-eval';
import type {
  INSSBracket,
  INSSResult,
  IRRFInput,
  IRRFResult,
  FGTSResult,
  SalaryFamilyInput,
  SalaryFamilyResult,
  RuralNightInput,
  RuralNightResult,
  RuralUtilityInput,
  RuralUtilityResult,
  RubricaContext,
} from './payroll-engine.types';

// Set global rounding mode for all Decimal operations in this module
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

/**
 * Calculates INSS contribution using progressive bracket accumulation.
 * Source: Portaria Interministerial MPS/MF nº 13/2026
 *
 * @param grossSalary - Employee's gross salary
 * @param brackets - INSS progressive brackets for the reference year
 * @param ceiling - Maximum contribution base (teto do INSS)
 */
export function calculateINSS(
  grossSalary: Decimal,
  brackets: INSSBracket[],
  ceiling: Decimal,
): INSSResult {
  if (grossSalary.lessThanOrEqualTo(0)) {
    const zero = new Decimal(0);
    return { grossBase: zero, effectiveBase: zero, contribution: zero, effectiveRate: zero };
  }

  const effectiveBase = Decimal.min(grossSalary, ceiling);
  let contribution = new Decimal(0);
  let prevUpTo = new Decimal(0);

  for (const bracket of brackets) {
    const bracketCap = bracket.upTo ? Decimal.min(effectiveBase, bracket.upTo) : effectiveBase;
    if (bracketCap.lessThanOrEqualTo(prevUpTo)) break;
    const applicable = bracketCap.minus(prevUpTo);
    contribution = contribution.plus(applicable.mul(bracket.rate));
    prevUpTo = bracket.upTo ?? effectiveBase;
    if (!bracket.upTo || effectiveBase.lessThanOrEqualTo(bracket.upTo)) break;
  }

  const roundedContribution = contribution.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    grossBase: grossSalary,
    effectiveBase,
    contribution: roundedContribution,
    effectiveRate: roundedContribution.div(effectiveBase).toDecimalPlaces(4),
  };
}

/**
 * Calculates IRRF using two-step process:
 * Step 1: Progressive table (2026 Receita Federal brackets)
 * Step 2: 2026 redutor (Lei 15.079/2024) for incomes between 5k-7.35k
 *
 * @param input - IRRFInput with all required deduction parameters
 */
export function calculateIRRF(input: IRRFInput): IRRFResult {
  const {
    grossSalary,
    inssContribution,
    dependents,
    alimony,
    brackets,
    dependentDeduction,
    exemptionLimit,
    redutorUpperLimit,
    redutorA,
    redutorB,
  } = input;

  const zero = new Decimal(0);

  const taxableBase = grossSalary
    .minus(inssContribution)
    .minus(dependentDeduction.mul(dependents))
    .minus(alimony);

  if (taxableBase.lessThanOrEqualTo(0)) {
    return { taxableBase: zero, grossTax: zero, redutor: zero, finalTax: zero };
  }

  // Step 1: find correct bracket and compute gross tax
  let grossTax = new Decimal(0);
  for (const bracket of brackets) {
    if (bracket.upTo === null || taxableBase.lessThanOrEqualTo(bracket.upTo)) {
      grossTax = taxableBase.mul(bracket.rate).minus(bracket.deduction);
      grossTax = Decimal.max(grossTax, zero);
      break;
    }
  }

  // Step 2: 2026 redutor
  let redutor = zero;
  if (taxableBase.lessThanOrEqualTo(exemptionLimit)) {
    // Full exemption — redutor absorbs entire tax
    return {
      taxableBase,
      grossTax: grossTax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      redutor: grossTax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      finalTax: zero,
    };
  } else if (taxableBase.lessThanOrEqualTo(redutorUpperLimit)) {
    redutor = redutorA.minus(redutorB.mul(taxableBase));
    redutor = Decimal.max(redutor, zero);
  }

  const finalTax = Decimal.max(zero, grossTax.minus(redutor));

  return {
    taxableBase,
    grossTax: grossTax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    redutor: redutor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    finalTax: finalTax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  };
}

/**
 * Calculates FGTS contribution at 8% of gross salary.
 * No ceiling — applies to full gross salary.
 *
 * @param grossSalary - Employee's gross salary
 */
export function calculateFGTS(grossSalary: Decimal): FGTSResult {
  const contribution = grossSalary.mul(new Decimal('0.08')).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return { base: grossSalary, contribution };
}

/**
 * Calculates salário-família benefit.
 * Benefit is only paid when gross salary is at or below the income limit.
 *
 * @param input - SalaryFamilyInput with salary, dependents, and income limit
 */
export function calculateSalaryFamily(input: SalaryFamilyInput): SalaryFamilyResult {
  const { grossSalary, eligibleDependents, valuePerChild, incomeLimit } = input;

  if (grossSalary.greaterThan(incomeLimit)) {
    return { benefit: new Decimal(0), eligible: false };
  }

  const benefit = valuePerChild
    .mul(eligibleDependents)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return { benefit, eligible: true };
}

/**
 * Calculates rural night premium (adicional noturno rural).
 * Rural rules: 21h-5h range, 25% rate, 60-minute rural hour.
 * Caller is responsible for passing the correct count of 60-minute hours.
 *
 * @param input - RuralNightInput with night hours, hourly rate, and premium rate
 */
export function calculateRuralNightPremium(input: RuralNightInput): RuralNightResult {
  const { nightHours, hourlyRate, premiumRate } = input;

  const premium = nightHours
    .mul(hourlyRate)
    .mul(premiumRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return { premium, nightHours };
}

/**
 * Calculates rural utility deductions (moradia/alimentação).
 * Caps housing at 20% and food at 25% of regional minimum wage.
 * Source: Lei 5.889/1973, art. 9º e Decreto 73.626/1974
 *
 * @param input - RuralUtilityInput with requested amounts and regional minimum wage
 */
export function calculateRuralUtilityDeductions(input: RuralUtilityInput): RuralUtilityResult {
  const { requestedHousing, requestedFood, regionalMinWage } = input;

  const housingCap = regionalMinWage.mul(new Decimal('0.20'));
  const foodCap = regionalMinWage.mul(new Decimal('0.25'));

  const housing = Decimal.min(requestedHousing, housingCap).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  const food = Decimal.min(requestedFood, foodCap).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    housing,
    food,
    housingCapped: requestedHousing.greaterThan(housingCap),
    foodCapped: requestedFood.greaterThan(foodCap),
  };
}

/**
 * Evaluates a custom rubrica formula string against a context of variables.
 * Uses expr-eval for safe mathematical expression evaluation.
 * All variables in the formula must be present in the context.
 *
 * @param formula - Mathematical expression string (e.g. "SALARIO_BASE * 0.05")
 * @param context - Map of variable names to numeric values
 * @throws Error if the formula is invalid or references undefined variables
 */
export function evaluateFormula(formula: string, context: RubricaContext): Decimal {
  if (!formula || formula.trim() === '') {
    return new Decimal(0);
  }

  const parser = new Parser();

  try {
    const result = parser.evaluate(formula, context);
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error(`FormulaEvaluationError: formula "${formula}" did not return a finite number`);
    }
    return new Decimal(result.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('FormulaEvaluationError')) {
      throw err;
    }
    throw new Error(
      `FormulaEvaluationError: failed to evaluate formula "${formula}": ${(err as Error).message}`,
    );
  }
}
