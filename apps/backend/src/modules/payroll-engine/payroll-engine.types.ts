import Decimal from 'decimal.js';

export interface INSSBracket {
  from: Decimal;
  upTo: Decimal | null; // null = sem limite (última faixa até o teto)
  rate: Decimal;
}

export interface INSSResult {
  grossBase: Decimal;
  effectiveBase: Decimal; // min(grossSalary, ceiling)
  contribution: Decimal;
  effectiveRate: Decimal; // contribution / grossBase
}

export interface IRRFBracket {
  upTo: Decimal | null;
  rate: Decimal;
  deduction: Decimal;
}

export interface IRRFInput {
  grossSalary: Decimal;
  inssContribution: Decimal;
  dependents: number;
  alimony: Decimal; // pensão alimentícia
  brackets: IRRFBracket[];
  dependentDeduction: Decimal; // R$ 189,59 em 2026
  exemptionLimit: Decimal;
  redutorUpperLimit: Decimal;
  redutorA: Decimal;
  redutorB: Decimal;
}

export interface IRRFResult {
  taxableBase: Decimal;
  grossTax: Decimal; // após tabela progressiva
  redutor: Decimal; // redutor 2026 (zero se fora da faixa)
  finalTax: Decimal; // max(0, grossTax - redutor)
}

export interface FGTSResult {
  base: Decimal;
  contribution: Decimal;
}

export interface SalaryFamilyInput {
  grossSalary: Decimal;
  eligibleDependents: number;
  valuePerChild: Decimal;
  incomeLimit: Decimal;
}

export interface SalaryFamilyResult {
  benefit: Decimal;
  eligible: boolean;
}

export interface RuralNightInput {
  nightHours: Decimal;
  hourlyRate: Decimal;
  premiumRate: Decimal; // 0.25 for rural
}

export interface RuralNightResult {
  premium: Decimal;
  nightHours: Decimal;
}

export interface RuralUtilityInput {
  requestedHousing: Decimal;
  requestedFood: Decimal;
  regionalMinWage: Decimal;
}

export interface RuralUtilityResult {
  housing: Decimal;
  food: Decimal;
  housingCapped: boolean;
  foodCapped: boolean;
}

export interface RubricaContext {
  SALARIO_BASE: number;
  HORA_NORMAL: number;
  HORAS_EXTRAS_50: number;
  HORAS_EXTRAS_100: number;
  SALARIO_MINIMO: number;
  PISO_REGIONAL: number;
  DIAS_TRABALHADOS: number;
  DIAS_UTEIS_MES: number;
  [key: string]: number;
}
