// ─── DRE Calculator ───────────────────────────────────────────────────────────
// Pure function: calculates DRE (Demonstrativo de Resultado do Exercicio) from
// pre-loaded account movement data. NO Prisma imports — fully testable.
//
// COA code mapping (from coa-rural-template.ts):
//   4.1.01.xx → receita-bruta-agricola (Venda Graos)
//   4.1.02.xx → receita-bruta-pecuaria (Venda Animais)
//   4.1.04.xx → receita-bruta-industrializacao
//   4.2.xx    → outras-receitas
//   4.3.xx    → receita-financeira
//   isFairValueAdj=true → cpc29
//   5.1.01.xx → cpv-agricola
//   5.1.02.xx → cpv-pecuario
//   5.2.01.xx → despesas-admin
//   5.2.02.xx + 6.1.xx → despesas-pessoal
//   5.2.03.xx → despesas-depreciacao
//   5.3.xx    → despesas-financeiras
//   (deducoes and ir-csll sections empty unless matching accounts exist)

import Decimal from 'decimal.js';
import type {
  DreInput,
  DreOutput,
  DreSection,
  DreSectionId,
  DreSectionRow,
  DreAccountData,
} from './financial-statements.types';

// ─── Section mapping ─────────────────────────────────────────────────────────

function getSectionId(account: DreAccountData): DreSectionId | null {
  const code = account.code;

  // CPC 29 — fair value adjustment (any code) takes priority
  if (account.isFairValueAdj) {
    return 'cpc29';
  }

  // Revenue accounts (4.x)
  if (code.startsWith('4.1.01')) return 'receita-bruta-agricola';
  if (code.startsWith('4.1.02')) return 'receita-bruta-pecuaria';
  if (code.startsWith('4.1.04')) return 'receita-bruta-industrializacao';
  if (code.startsWith('4.2.')) return 'outras-receitas';
  if (code.startsWith('4.3.')) return 'receita-financeira';
  // 4.1.03 is isFairValueAdj, handled above
  // 4.4.x = deducoes (if exists)
  if (code.startsWith('4.4.')) return 'deducoes';

  // Cost accounts (5.x)
  if (code.startsWith('5.1.01')) return 'cpv-agricola';
  if (code.startsWith('5.1.02')) return 'cpv-pecuario';
  if (code.startsWith('5.2.01')) return 'despesas-admin';
  if (code.startsWith('5.2.02')) return 'despesas-pessoal';
  if (code.startsWith('5.2.03')) return 'despesas-depreciacao';
  if (code.startsWith('5.3.')) return 'despesas-financeiras';
  // 5.2.04.xx = commercial expenses
  if (code.startsWith('5.2.04')) return 'despesas-comerciais';
  // IR/CSLL typically under 5.4 or similar
  if (code.startsWith('5.4.') || code.startsWith('5.5.')) return 'ir-csll';

  // Legacy payroll group (6.x)
  if (code.startsWith('6.1.')) return 'despesas-pessoal';
  if (code.startsWith('6.')) return 'despesas-pessoal';

  return null; // unknown — skip
}

// ─── Net movement for a single column ────────────────────────────────────────

function netMovement(
  accountType: 'RECEITA' | 'DESPESA',
  nature: 'DEVEDORA' | 'CREDORA',
  debit: Decimal,
  credit: Decimal,
): Decimal {
  // For RECEITA (CREDORA nature): net = credit - debit (positive = revenue earned)
  // For DESPESA (DEVEDORA nature): net = debit - credit (positive = expense incurred)
  if (accountType === 'RECEITA') {
    return credit.minus(debit);
  }
  return debit.minus(credit);
}

// ─── Build a section row from an account ─────────────────────────────────────

function buildAccountRow(account: DreAccountData): DreSectionRow {
  const currentMonth = netMovement(
    account.accountType,
    account.nature,
    new Decimal(account.currentMonthDebit),
    new Decimal(account.currentMonthCredit),
  );
  const ytd = netMovement(
    account.accountType,
    account.nature,
    new Decimal(account.ytdDebit),
    new Decimal(account.ytdCredit),
  );
  const priorYear = netMovement(
    account.accountType,
    account.nature,
    new Decimal(account.priorYearDebit),
    new Decimal(account.priorYearCredit),
  );

  return {
    accountId: account.accountId,
    code: account.code,
    name: account.name,
    currentMonth: currentMonth.toFixed(2),
    ytd: ytd.toFixed(2),
    priorYear: priorYear.toFixed(2),
    avPercent: null, // computed later
    ahPercent: null, // computed later
    isSubtotal: false,
    isCpc29: account.isFairValueAdj,
    level: 1,
  };
}

// ─── Compute totals for a set of rows ────────────────────────────────────────

function sumRows(rows: DreSectionRow[]): {
  currentMonth: Decimal;
  ytd: Decimal;
  priorYear: Decimal;
} {
  return rows.reduce(
    (acc, row) => ({
      currentMonth: acc.currentMonth.plus(new Decimal(row.currentMonth)),
      ytd: acc.ytd.plus(new Decimal(row.ytd)),
      priorYear: acc.priorYear.plus(new Decimal(row.priorYear)),
    }),
    { currentMonth: new Decimal(0), ytd: new Decimal(0), priorYear: new Decimal(0) },
  );
}

// ─── Build a subtotal row ─────────────────────────────────────────────────────

function buildSubtotalRow(
  name: string,
  code: string,
  currentMonth: Decimal,
  ytd: Decimal,
  priorYear: Decimal,
  level = 0,
): DreSectionRow {
  return {
    accountId: null,
    code,
    name,
    currentMonth: currentMonth.toFixed(2),
    ytd: ytd.toFixed(2),
    priorYear: priorYear.toFixed(2),
    avPercent: null,
    ahPercent: null,
    isSubtotal: true,
    isCpc29: false,
    level,
  };
}

// ─── Apply AV% and AH% to a row ──────────────────────────────────────────────

function applyAnalysis(row: DreSectionRow, receitaLiquida: Decimal): DreSectionRow {
  const current = new Decimal(row.currentMonth);
  const prior = new Decimal(row.priorYear);

  let avPercent: string | null = null;
  let ahPercent: string | null = null;

  if (!receitaLiquida.isZero()) {
    avPercent = current.div(receitaLiquida).times(100).toFixed(2);
  }

  if (!prior.isZero()) {
    ahPercent = current.minus(prior).div(prior.abs()).times(100).toFixed(2);
  }

  return { ...row, avPercent, ahPercent };
}

// ─── Section metadata ─────────────────────────────────────────────────────────

const SECTION_LABELS: Record<DreSectionId, string> = {
  'receita-bruta-agricola': 'Receita Bruta Agricola',
  'receita-bruta-pecuaria': 'Receita Bruta Pecuaria',
  'receita-bruta-industrializacao': 'Receita Bruta Industrializacao',
  'receita-financeira': 'Receita Financeira',
  'outras-receitas': 'Outras Receitas',
  deducoes: 'Deducoes da Receita',
  'receita-liquida': 'Receita Liquida',
  'cpv-agricola': 'CPV Agricola',
  'cpv-pecuario': 'CPV Pecuario',
  'lucro-bruto': 'Lucro Bruto',
  'despesas-admin': 'Despesas Administrativas',
  'despesas-comerciais': 'Despesas Comerciais',
  'despesas-financeiras': 'Despesas Financeiras',
  'despesas-depreciacao': 'Depreciacao e Amortizacao',
  'despesas-pessoal': 'Despesas com Pessoal',
  cpc29: 'Variacao Valor Justo (CPC 29)',
  'resultado-antes-ir': 'Resultado Antes do IR/CSLL',
  'ir-csll': 'IR e CSLL',
  'resultado-liquido': 'Resultado Liquido do Exercicio',
};

// ─── Main calculator ─────────────────────────────────────────────────────────

export function calculateDre(input: DreInput): DreOutput {
  // Only analytic accounts (isSynthetic=false) to avoid double-counting
  const analytic = input.accounts.filter((a) => !a.isSynthetic);

  // Group accounts by section
  const sectionAccounts = new Map<DreSectionId, DreAccountData[]>();

  for (const account of analytic) {
    const sectionId = getSectionId(account);
    if (!sectionId) continue;

    if (!sectionAccounts.has(sectionId)) {
      sectionAccounts.set(sectionId, []);
    }
    sectionAccounts.get(sectionId)!.push(account);
  }

  // Build account rows per section
  const sectionRows = new Map<DreSectionId, DreSectionRow[]>();
  for (const [id, accounts] of sectionAccounts) {
    sectionRows.set(id, accounts.map(buildAccountRow));
  }

  // Helper to get total for a section (zero if empty)
  function getSectionTotals(id: DreSectionId): {
    currentMonth: Decimal;
    ytd: Decimal;
    priorYear: Decimal;
  } {
    const rows = sectionRows.get(id) ?? [];
    return sumRows(rows);
  }

  // ─── Compute subtotals ───────────────────────────────────────────────

  // Receita Bruta = agricultural + livestock + industrialization + financial + other
  const receitaBruta = {
    currentMonth: getSectionTotals('receita-bruta-agricola')
      .currentMonth.plus(getSectionTotals('receita-bruta-pecuaria').currentMonth)
      .plus(getSectionTotals('receita-bruta-industrializacao').currentMonth)
      .plus(getSectionTotals('receita-financeira').currentMonth)
      .plus(getSectionTotals('outras-receitas').currentMonth),
    ytd: getSectionTotals('receita-bruta-agricola')
      .ytd.plus(getSectionTotals('receita-bruta-pecuaria').ytd)
      .plus(getSectionTotals('receita-bruta-industrializacao').ytd)
      .plus(getSectionTotals('receita-financeira').ytd)
      .plus(getSectionTotals('outras-receitas').ytd),
    priorYear: getSectionTotals('receita-bruta-agricola')
      .priorYear.plus(getSectionTotals('receita-bruta-pecuaria').priorYear)
      .plus(getSectionTotals('receita-bruta-industrializacao').priorYear)
      .plus(getSectionTotals('receita-financeira').priorYear)
      .plus(getSectionTotals('outras-receitas').priorYear),
  };

  // Deducoes (subtracted from gross revenue)
  const deducoes = getSectionTotals('deducoes');

  // Receita Liquida = Receita Bruta - Deducoes
  const receitaLiquida = {
    currentMonth: receitaBruta.currentMonth.minus(deducoes.currentMonth),
    ytd: receitaBruta.ytd.minus(deducoes.ytd),
    priorYear: receitaBruta.priorYear.minus(deducoes.priorYear),
  };

  // CPV total
  const cpvTotal = {
    currentMonth: getSectionTotals('cpv-agricola').currentMonth.plus(
      getSectionTotals('cpv-pecuario').currentMonth,
    ),
    ytd: getSectionTotals('cpv-agricola').ytd.plus(getSectionTotals('cpv-pecuario').ytd),
    priorYear: getSectionTotals('cpv-agricola').priorYear.plus(
      getSectionTotals('cpv-pecuario').priorYear,
    ),
  };

  // Lucro Bruto = Receita Liquida - CPV
  const lucroBruto = {
    currentMonth: receitaLiquida.currentMonth.minus(cpvTotal.currentMonth),
    ytd: receitaLiquida.ytd.minus(cpvTotal.ytd),
    priorYear: receitaLiquida.priorYear.minus(cpvTotal.priorYear),
  };

  // Total Despesas Operacionais
  const totalDespesas = {
    currentMonth: getSectionTotals('despesas-admin')
      .currentMonth.plus(getSectionTotals('despesas-comerciais').currentMonth)
      .plus(getSectionTotals('despesas-financeiras').currentMonth)
      .plus(getSectionTotals('despesas-depreciacao').currentMonth)
      .plus(getSectionTotals('despesas-pessoal').currentMonth),
    ytd: getSectionTotals('despesas-admin')
      .ytd.plus(getSectionTotals('despesas-comerciais').ytd)
      .plus(getSectionTotals('despesas-financeiras').ytd)
      .plus(getSectionTotals('despesas-depreciacao').ytd)
      .plus(getSectionTotals('despesas-pessoal').ytd),
    priorYear: getSectionTotals('despesas-admin')
      .priorYear.plus(getSectionTotals('despesas-comerciais').priorYear)
      .plus(getSectionTotals('despesas-financeiras').priorYear)
      .plus(getSectionTotals('despesas-depreciacao').priorYear)
      .plus(getSectionTotals('despesas-pessoal').priorYear),
  };

  // CPC 29 adjustment (can be positive or negative)
  const cpc29 = getSectionTotals('cpc29');

  // Resultado Antes IR = Lucro Bruto - Despesas +/- CPC29
  const resultadoAntesIr = {
    currentMonth: lucroBruto.currentMonth
      .minus(totalDespesas.currentMonth)
      .plus(cpc29.currentMonth),
    ytd: lucroBruto.ytd.minus(totalDespesas.ytd).plus(cpc29.ytd),
    priorYear: lucroBruto.priorYear.minus(totalDespesas.priorYear).plus(cpc29.priorYear),
  };

  // IR/CSLL
  const irCsll = getSectionTotals('ir-csll');

  // Resultado Liquido = Resultado Antes IR - IR/CSLL
  const resultadoLiquido = {
    currentMonth: resultadoAntesIr.currentMonth.minus(irCsll.currentMonth),
    ytd: resultadoAntesIr.ytd.minus(irCsll.ytd),
    priorYear: resultadoAntesIr.priorYear.minus(irCsll.priorYear),
  };

  // ─── Build sections array ────────────────────────────────────────────────────

  const receitaLiquidaDecimal = receitaLiquida.currentMonth;

  function buildSection(id: DreSectionId): DreSection {
    const rows = (sectionRows.get(id) ?? []).map((row) =>
      applyAnalysis(row, receitaLiquidaDecimal),
    );
    const totals = sumRows(rows);
    const total = applyAnalysis(
      buildSubtotalRow(SECTION_LABELS[id], id, totals.currentMonth, totals.ytd, totals.priorYear),
      receitaLiquidaDecimal,
    );
    return {
      id,
      label: SECTION_LABELS[id],
      rows,
      total,
    };
  }

  const sections: DreSection[] = [
    buildSection('receita-bruta-agricola'),
    buildSection('receita-bruta-pecuaria'),
    buildSection('receita-bruta-industrializacao'),
    buildSection('receita-financeira'),
    buildSection('outras-receitas'),
    buildSection('deducoes'),
    // Computed subtotal section: Receita Liquida
    {
      id: 'receita-liquida',
      label: SECTION_LABELS['receita-liquida'],
      rows: [],
      total: applyAnalysis(
        buildSubtotalRow(
          'Receita Liquida',
          'receita-liquida',
          receitaLiquida.currentMonth,
          receitaLiquida.ytd,
          receitaLiquida.priorYear,
        ),
        receitaLiquidaDecimal,
      ),
    },
    buildSection('cpv-agricola'),
    buildSection('cpv-pecuario'),
    // Lucro Bruto subtotal
    {
      id: 'lucro-bruto',
      label: SECTION_LABELS['lucro-bruto'],
      rows: [],
      total: applyAnalysis(
        buildSubtotalRow(
          'Lucro Bruto',
          'lucro-bruto',
          lucroBruto.currentMonth,
          lucroBruto.ytd,
          lucroBruto.priorYear,
        ),
        receitaLiquidaDecimal,
      ),
    },
    buildSection('despesas-admin'),
    buildSection('despesas-comerciais'),
    buildSection('despesas-financeiras'),
    buildSection('despesas-depreciacao'),
    buildSection('despesas-pessoal'),
    buildSection('cpc29'),
    // Resultado Antes IR subtotal
    {
      id: 'resultado-antes-ir',
      label: SECTION_LABELS['resultado-antes-ir'],
      rows: [],
      total: applyAnalysis(
        buildSubtotalRow(
          'Resultado Antes do IR/CSLL',
          'resultado-antes-ir',
          resultadoAntesIr.currentMonth,
          resultadoAntesIr.ytd,
          resultadoAntesIr.priorYear,
        ),
        receitaLiquidaDecimal,
      ),
    },
    buildSection('ir-csll'),
  ];

  const resultadoLiquidoRow = applyAnalysis(
    buildSubtotalRow(
      'Resultado Liquido do Exercicio',
      'resultado-liquido',
      resultadoLiquido.currentMonth,
      resultadoLiquido.ytd,
      resultadoLiquido.priorYear,
    ),
    receitaLiquidaDecimal,
  );

  return {
    sections,
    resultadoLiquido: resultadoLiquidoRow,
  };
}
