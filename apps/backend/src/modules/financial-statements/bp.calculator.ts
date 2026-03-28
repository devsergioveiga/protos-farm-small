// ─── BP Calculator ────────────────────────────────────────────────────────────
// Pure function: calculates Balanco Patrimonial (Balance Sheet) from pre-loaded
// account balance data. NO Prisma imports — fully testable.
//
// COA code mapping:
//   1.1.xx → AC (Ativo Circulante)
//   1.2.xx → ANC (Ativo Nao Circulante)
//   2.1.xx → PC (Passivo Circulante)
//   2.2.xx → PNC (Passivo Nao Circulante)
//   3.xx   → PL (Patrimonio Liquido)
//
// Indicators:
//   Liquidez Corrente:      AC / PC
//   Liquidez Seca:          (AC - Estoques) / PC  [estoques = 1.1.02.xx]
//   Endividamento Geral:    (PC + PNC) / AT
//   Composicao Endividamento: PC / (PC + PNC)
//   ROE:                    Resultado Liquido / PL
//   PL/ha:                  PL / totalAreaHa

import Decimal from 'decimal.js';
import type {
  BpInput,
  BpOutput,
  BpGroup,
  BpGroupId,
  BpGroupRow,
  BpAccountData,
  BpIndicators,
  BpSparklineMonth,
} from './financial-statements.types';

// ─── Section mapping ─────────────────────────────────────────────────────────

function getBpGroupId(account: BpAccountData): BpGroupId | null {
  const code = account.code;

  if (code.startsWith('1.1.')) return 'ac';
  if (code.startsWith('1.2.')) return 'anc';
  if (code.startsWith('2.1.')) return 'pc';
  if (code.startsWith('2.2.')) return 'pnc';
  if (code.startsWith('3.')) return 'pl';

  return null; // unknown — skip
}

// ─── Build a group row from an account ───────────────────────────────────────

function buildGroupRow(account: BpAccountData): BpGroupRow {
  return {
    accountId: account.accountId,
    code: account.code,
    name: account.name,
    currentBalance: account.currentBalance,
    priorBalance: account.priorBalance,
    isSubtotal: false,
    level: 1,
  };
}

// ─── Build a subtotal row ─────────────────────────────────────────────────────

function buildSubtotalRow(
  name: string,
  code: string,
  currentBalance: Decimal,
  priorBalance: Decimal,
  level = 0,
): BpGroupRow {
  return {
    accountId: null,
    code,
    name,
    currentBalance: currentBalance.toFixed(2),
    priorBalance: priorBalance.toFixed(2),
    isSubtotal: true,
    level,
  };
}

// ─── Sum rows ─────────────────────────────────────────────────────────────────

function sumGroupRows(rows: BpGroupRow[]): { current: Decimal; prior: Decimal } {
  return rows.reduce(
    (acc, row) => ({
      current: acc.current.plus(new Decimal(row.currentBalance)),
      prior: acc.prior.plus(new Decimal(row.priorBalance)),
    }),
    { current: new Decimal(0), prior: new Decimal(0) },
  );
}

// ─── Group metadata ───────────────────────────────────────────────────────────

const GROUP_LABELS: Record<BpGroupId, string> = {
  ac: 'Ativo Circulante',
  anc: 'Ativo Nao Circulante',
  pc: 'Passivo Circulante',
  pnc: 'Passivo Nao Circulante',
  pl: 'Patrimonio Liquido',
};

// ─── Compute single-period indicators ────────────────────────────────────────

function computeIndicators(
  acTotal: Decimal,
  pncTotal: Decimal,
  pcTotal: Decimal,
  plTotal: Decimal,
  ativoTotal: Decimal,
  estoquesBalance: Decimal,
  resultadoLiquido: Decimal,
  totalAreaHa: number,
): Omit<BpIndicators, 'sparklines'> {
  const peTotal = pcTotal.plus(pncTotal);

  const liquidezCorrente = pcTotal.isZero() ? null : acTotal.div(pcTotal).toFixed(2);

  const liquidezSeca = pcTotal.isZero()
    ? null
    : acTotal.minus(estoquesBalance).div(pcTotal).toFixed(2);

  const endividamentoGeral = ativoTotal.isZero() ? null : peTotal.div(ativoTotal).toFixed(2);

  const composicaoEndividamento = peTotal.isZero() ? null : pcTotal.div(peTotal).toFixed(2);

  const roe = plTotal.isZero() ? null : resultadoLiquido.div(plTotal).toFixed(2);

  const plPorHectare = totalAreaHa === 0 ? null : plTotal.div(new Decimal(totalAreaHa)).toFixed(2);

  return {
    liquidezCorrente,
    liquidezSeca,
    endividamentoGeral,
    composicaoEndividamento,
    roe,
    plPorHectare,
  };
}

// ─── Compute sparklines from historical months ────────────────────────────────

function computeSparklines(
  sparklineMonths: BpSparklineMonth[],
  totalAreaHa: number,
): BpIndicators['sparklines'] {
  const result: BpIndicators['sparklines'] = {
    liquidezCorrente: [],
    liquidezSeca: [],
    endividamentoGeral: [],
    composicaoEndividamento: [],
    roe: [],
    plPorHectare: [],
  };

  for (const m of sparklineMonths) {
    const ac = new Decimal(m.acTotal);
    const pc = new Decimal(m.pcTotal);
    const pnc = new Decimal(m.pncTotal);
    const pl = new Decimal(m.plTotal);
    const ativo = new Decimal(m.ativoTotal);
    const estoques = new Decimal(m.estoquesBalance);
    const rl = new Decimal(m.resultadoLiquido);
    const pe = pc.plus(pnc);

    if (!pc.isZero()) {
      result.liquidezCorrente.push({ month: m.month, value: ac.div(pc).toNumber() });
      result.liquidezSeca.push({ month: m.month, value: ac.minus(estoques).div(pc).toNumber() });
    }

    if (!ativo.isZero()) {
      result.endividamentoGeral.push({ month: m.month, value: pe.div(ativo).toNumber() });
    }

    if (!pe.isZero()) {
      result.composicaoEndividamento.push({ month: m.month, value: pc.div(pe).toNumber() });
    }

    if (!pl.isZero()) {
      result.roe.push({ month: m.month, value: rl.div(pl).toNumber() });
    }

    if (totalAreaHa !== 0) {
      result.plPorHectare.push({
        month: m.month,
        value: pl.div(new Decimal(totalAreaHa)).toNumber(),
      });
    }
  }

  return result;
}

// ─── Main calculator ─────────────────────────────────────────────────────────

export function calculateBp(input: BpInput): BpOutput {
  // Only analytic accounts (isSynthetic=false)
  const analytic = input.accounts.filter((a) => !a.isSynthetic);

  // Group by BP section
  const groupAccounts = new Map<BpGroupId, BpAccountData[]>();
  const groupIds: BpGroupId[] = ['ac', 'anc', 'pc', 'pnc', 'pl'];

  for (const id of groupIds) {
    groupAccounts.set(id, []);
  }

  for (const account of analytic) {
    const groupId = getBpGroupId(account);
    if (!groupId) continue;
    groupAccounts.get(groupId)!.push(account);
  }

  // Build rows per group
  function buildGroup(id: BpGroupId): BpGroup {
    const accounts = groupAccounts.get(id) ?? [];
    const rows = accounts.map(buildGroupRow);
    const totals = sumGroupRows(rows);
    const total = buildSubtotalRow(GROUP_LABELS[id], id, totals.current, totals.prior);
    return {
      id,
      label: GROUP_LABELS[id],
      rows,
      total,
    };
  }

  const acGroup = buildGroup('ac');
  const ancGroup = buildGroup('anc');
  const pcGroup = buildGroup('pc');
  const pncGroup = buildGroup('pnc');
  const plGroup = buildGroup('pl');

  // Group totals as Decimal
  const acTotal = new Decimal(acGroup.total.currentBalance);
  const ancTotal = new Decimal(ancGroup.total.currentBalance);
  const pcTotal = new Decimal(pcGroup.total.currentBalance);
  const pncTotal = new Decimal(pncGroup.total.currentBalance);
  const plTotal = new Decimal(plGroup.total.currentBalance);

  const ativoTotal = acTotal.plus(ancTotal);
  const passivoTotal = pcTotal.plus(pncTotal).plus(plTotal);

  // Estoques = accounts under 1.1.02 prefix
  const estoquesBalance = analytic
    .filter((a) => a.code.startsWith('1.1.02'))
    .reduce((sum, a) => sum.plus(new Decimal(a.currentBalance)), new Decimal(0));

  const resultadoLiquido = new Decimal(input.resultadoLiquido);

  // Compute indicators
  const indicatorValues = computeIndicators(
    acTotal,
    pncTotal,
    pcTotal,
    plTotal,
    ativoTotal,
    estoquesBalance,
    resultadoLiquido,
    input.totalAreaHa,
  );

  // Sparklines
  const sparklines = computeSparklines(input.sparklineMonths ?? [], input.totalAreaHa);

  const indicators: BpIndicators = {
    ...indicatorValues,
    sparklines,
  };

  const totalAtivoRow = buildSubtotalRow(
    'Total Ativo',
    'total-ativo',
    ativoTotal,
    new Decimal(ancGroup.total.priorBalance).plus(new Decimal(acGroup.total.priorBalance)),
  );
  const totalPassivoRow = buildSubtotalRow(
    'Total Passivo + PL',
    'total-passivo',
    passivoTotal,
    new Decimal(pcGroup.total.priorBalance)
      .plus(new Decimal(pncGroup.total.priorBalance))
      .plus(new Decimal(plGroup.total.priorBalance)),
  );

  return {
    ativo: [acGroup, ancGroup],
    passivo: [pcGroup, pncGroup, plGroup],
    totalAtivo: totalAtivoRow,
    totalPassivo: totalPassivoRow,
    indicators,
  };
}
