// ─── Cross-Validation Calculator ─────────────────────────────────────────────
// Pure function: checks 4 accounting invariants to validate DRE ↔ BP ↔ Balancete.
// NO Prisma imports — fully testable.
//
// Invariants:
//   1. Resultado Liquido DRE = Variacao Lucros Acumulados BP
//   2. Variacao Caixa DFC = Variacao Caixa/Bancos BP — PENDING (Phase 40)
//   3. Ativo Total = Passivo Total + PL
//   4. Total Debitos = Total Creditos (Balancete)

import Decimal from 'decimal.js';
import type {
  CrossValidationInput,
  CrossValidationOutput,
  InvariantResult,
  InvariantStatus,
} from './financial-statements.types';

const TOLERANCE = new Decimal('0.01'); // rounding tolerance

function computeStatus(difference: Decimal): InvariantStatus {
  return difference.abs().lte(TOLERANCE) ? 'PASSED' : 'FAILED';
}

function buildInvariant(
  id: string,
  title: string,
  expected: Decimal,
  found: Decimal,
  investigateUrl: string | null,
): InvariantResult {
  const difference = found.minus(expected);
  const status = computeStatus(difference);
  return {
    id,
    title,
    status,
    expected: expected.toFixed(2),
    found: found.toFixed(2),
    difference: difference.toFixed(2),
    investigateUrl: status === 'FAILED' ? investigateUrl : null,
  };
}

export function calculateCrossValidation(input: CrossValidationInput): CrossValidationOutput {
  const resultadoLiquido = new Decimal(input.resultadoLiquido);
  const deltaLucrosAcumulados = new Decimal(input.deltaLucrosAcumulados);
  const ativoTotal = new Decimal(input.ativoTotal);
  const passivoTotal = new Decimal(input.passivoTotal);
  const plTotal = new Decimal(input.plTotal);
  const totalDebitos = new Decimal(input.totalDebitos);
  const totalCreditos = new Decimal(input.totalCreditos);

  // Invariant 1: Resultado Liquido DRE = Variacao Lucros Acumulados BP
  const invariant1 = buildInvariant(
    'dre-lucros-acumulados',
    'Resultado Liquido DRE = Variacao Lucros Acumulados BP',
    resultadoLiquido,
    deltaLucrosAcumulados,
    '/ledger?account=lucros-acumulados',
  );

  // Invariant 2: Variacao Caixa DFC = Variacao Caixa/Bancos BP — PENDING until Phase 40
  const invariant2: InvariantResult = {
    id: 'dfc-caixa-bp',
    title: 'Variacao Caixa DFC = Variacao Caixa/Bancos BP',
    status: 'PENDING',
    expected: null,
    found: null,
    difference: null,
    investigateUrl: null,
  };

  // Invariant 3: Ativo Total = Passivo Total + PL
  const passivoMaisPl = passivoTotal.plus(plTotal);
  const invariant3 = buildInvariant(
    'ativo-passivo-pl',
    'Ativo Total = Passivo Total + Patrimonio Liquido',
    ativoTotal,
    passivoMaisPl,
    '/trial-balance',
  );

  // Invariant 4: Total Debitos = Total Creditos (Balancete)
  const invariant4 = buildInvariant(
    'debitos-creditos',
    'Total Debitos = Total Creditos (Balancete)',
    totalDebitos,
    totalCreditos,
    '/trial-balance',
  );

  const invariants: InvariantResult[] = [invariant1, invariant2, invariant3, invariant4];

  // allPassed: PENDING counts as non-failing (only FAILED breaks it)
  const allPassed = invariants.every((inv) => inv.status !== 'FAILED');

  return { invariants, allPassed };
}
