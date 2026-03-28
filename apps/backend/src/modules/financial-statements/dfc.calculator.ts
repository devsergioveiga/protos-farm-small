// ─── DFC Calculator ────────────────────────────────────────────────────────────
// Pure functions: calculateDfcDireto and calculateDfcIndireto.
// CPC 03 R2 compliant — three sections: Operacional, Investimento, Financiamento.
// NO Prisma imports — fully testable.

import Decimal from 'decimal.js';
import { PAYABLE_DFC_MAP, RECEIVABLE_DFC_MAP } from '../cashflow/cashflow.types';
import type {
  DfcDiretoInput,
  DfcDiretoOutput,
  DfcIndiretoInput,
  DfcIndiretoOutput,
  DfcPaidItem,
  DfcSection,
  DfcSectionRow,
  DfcCashSummary,
} from './dfc.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Period = 'currentMonth' | 'ytd' | 'priorYear';

const PERIODS: Period[] = ['currentMonth', 'ytd', 'priorYear'];

function sumRow(rows: DfcSectionRow[]): {
  currentMonth: Decimal;
  ytd: Decimal;
  priorYear: Decimal;
} {
  return {
    currentMonth: rows.reduce((s, r) => s.plus(new Decimal(r.currentMonth)), new Decimal(0)),
    ytd: rows.reduce((s, r) => s.plus(new Decimal(r.ytd)), new Decimal(0)),
    priorYear: rows.reduce((s, r) => s.plus(new Decimal(r.priorYear)), new Decimal(0)),
  };
}

// ─── Direto: line-item grouping config ────────────────────────────────────────

interface OperacionalLineConfig {
  id: string;
  label: string;
  categories: string[];
  type: 'inflow' | 'outflow';
}

const OPERACIONAL_LINES: OperacionalLineConfig[] = [
  {
    id: 'recebimentos-clientes',
    label: 'Recebimentos de clientes',
    categories: ['GRAIN_SALE', 'CATTLE_SALE', 'MILK_SALE', 'LEASE', 'SERVICES'],
    type: 'inflow',
  },
  {
    id: 'outros-recebimentos-operacionais',
    label: 'Outros recebimentos operacionais',
    categories: ['OTHER'],
    type: 'inflow',
  },
  {
    id: 'pagamento-fornecedores',
    label: 'Pagamentos a fornecedores',
    categories: ['INPUTS', 'MAINTENANCE'],
    type: 'outflow',
  },
  {
    id: 'salarios-encargos',
    label: 'Salarios e encargos sociais',
    categories: ['PAYROLL'],
    type: 'outflow',
  },
  { id: 'impostos-pagos', label: 'Impostos pagos', categories: ['TAXES'], type: 'outflow' },
  {
    id: 'alugueis-servicos',
    label: 'Alugueis e servicos',
    categories: ['RENT', 'SERVICES'],
    type: 'outflow',
  },
  {
    id: 'outros-pagamentos-operacionais',
    label: 'Outros pagamentos operacionais',
    categories: ['OTHER', 'CARTAO_CREDITO'],
    type: 'outflow',
  },
];

// ─── buildSection ─────────────────────────────────────────────────────────────

function buildOperacionalSection(itemsByPeriod: Record<Period, DfcPaidItem[]>): DfcSection {
  const rows: DfcSectionRow[] = [];

  for (const lineConfig of OPERACIONAL_LINES) {
    // Gather amounts per period
    const amounts: Record<Period, Decimal> = {
      currentMonth: new Decimal(0),
      ytd: new Decimal(0),
      priorYear: new Decimal(0),
    };

    for (const period of PERIODS) {
      for (const item of itemsByPeriod[period]) {
        const dfcClass =
          item.type === 'outflow'
            ? PAYABLE_DFC_MAP[item.category]
            : RECEIVABLE_DFC_MAP[item.category];

        if (dfcClass !== 'OPERACIONAL') continue;
        if (!lineConfig.categories.includes(item.category)) continue;
        if (item.type !== lineConfig.type) continue;

        const amount = new Decimal(item.amount);
        // Inflows are positive, outflows are negative
        const signed = item.type === 'outflow' ? amount.neg() : amount;
        amounts[period] = amounts[period].plus(signed);
      }
    }

    // Only include non-zero rows (or always include key rows for presentation)
    const row: DfcSectionRow = {
      id: lineConfig.id,
      label: lineConfig.label,
      currentMonth: amounts.currentMonth.toFixed(2),
      ytd: amounts.ytd.toFixed(2),
      priorYear: amounts.priorYear.toFixed(2),
      isSubtotal: false,
    };
    rows.push(row);
  }

  const totals = sumRow(rows);
  const subtotal: DfcSectionRow = {
    id: 'subtotal-operacional',
    label: 'Caixa liquido das atividades operacionais',
    currentMonth: totals.currentMonth.toFixed(2),
    ytd: totals.ytd.toFixed(2),
    priorYear: totals.priorYear.toFixed(2),
    isSubtotal: true,
  };

  return {
    id: 'operacional',
    label: 'Atividades Operacionais',
    rows,
    subtotal,
  };
}

function buildInvestimentoSection(itemsByPeriod: Record<Period, DfcPaidItem[]>): DfcSection {
  const aquisicaoAmounts: Record<Period, Decimal> = {
    currentMonth: new Decimal(0),
    ytd: new Decimal(0),
    priorYear: new Decimal(0),
  };
  const vendaAmounts: Record<Period, Decimal> = {
    currentMonth: new Decimal(0),
    ytd: new Decimal(0),
    priorYear: new Decimal(0),
  };

  for (const period of PERIODS) {
    for (const item of itemsByPeriod[period]) {
      const dfcClass =
        item.type === 'outflow'
          ? PAYABLE_DFC_MAP[item.category]
          : RECEIVABLE_DFC_MAP[item.category];

      if (dfcClass !== 'INVESTIMENTO') continue;

      const amount = new Decimal(item.amount);
      if (item.type === 'outflow') {
        aquisicaoAmounts[period] = aquisicaoAmounts[period].plus(amount.neg());
      } else {
        vendaAmounts[period] = vendaAmounts[period].plus(amount);
      }
    }
  }

  const rows: DfcSectionRow[] = [
    {
      id: 'aquisicao-ativos',
      label: 'Aquisicao de ativos',
      currentMonth: aquisicaoAmounts.currentMonth.toFixed(2),
      ytd: aquisicaoAmounts.ytd.toFixed(2),
      priorYear: aquisicaoAmounts.priorYear.toFixed(2),
      isSubtotal: false,
    },
    {
      id: 'venda-ativos',
      label: 'Venda de ativos',
      currentMonth: vendaAmounts.currentMonth.toFixed(2),
      ytd: vendaAmounts.ytd.toFixed(2),
      priorYear: vendaAmounts.priorYear.toFixed(2),
      isSubtotal: false,
    },
  ];

  const totals = sumRow(rows);
  const subtotal: DfcSectionRow = {
    id: 'subtotal-investimento',
    label: 'Caixa liquido das atividades de investimento',
    currentMonth: totals.currentMonth.toFixed(2),
    ytd: totals.ytd.toFixed(2),
    priorYear: totals.priorYear.toFixed(2),
    isSubtotal: true,
  };

  return {
    id: 'investimento',
    label: 'Atividades de Investimento',
    rows,
    subtotal,
  };
}

function buildFinanciamentoSection(itemsByPeriod: Record<Period, DfcPaidItem[]>): DfcSection {
  const pagamentoAmounts: Record<Period, Decimal> = {
    currentMonth: new Decimal(0),
    ytd: new Decimal(0),
    priorYear: new Decimal(0),
  };

  for (const period of PERIODS) {
    for (const item of itemsByPeriod[period]) {
      const dfcClass =
        item.type === 'outflow'
          ? PAYABLE_DFC_MAP[item.category]
          : RECEIVABLE_DFC_MAP[item.category];

      if (dfcClass !== 'FINANCIAMENTO') continue;

      const amount = new Decimal(item.amount);
      pagamentoAmounts[period] = pagamentoAmounts[period].plus(amount.neg());
    }
  }

  const rows: DfcSectionRow[] = [
    {
      id: 'pagamento-financiamentos',
      label: 'Pagamento de financiamentos',
      currentMonth: pagamentoAmounts.currentMonth.toFixed(2),
      ytd: pagamentoAmounts.ytd.toFixed(2),
      priorYear: pagamentoAmounts.priorYear.toFixed(2),
      isSubtotal: false,
    },
  ];

  const totals = sumRow(rows);
  const subtotal: DfcSectionRow = {
    id: 'subtotal-financiamento',
    label: 'Caixa liquido das atividades de financiamento',
    currentMonth: totals.currentMonth.toFixed(2),
    ytd: totals.ytd.toFixed(2),
    priorYear: totals.priorYear.toFixed(2),
    isSubtotal: true,
  };

  return {
    id: 'financiamento',
    label: 'Atividades de Financiamento',
    rows,
    subtotal,
  };
}

// ─── calculateDfcDireto ────────────────────────────────────────────────────────

export function calculateDfcDireto(input: DfcDiretoInput): DfcDiretoOutput {
  const itemsByPeriod: Record<Period, DfcPaidItem[]> = {
    currentMonth: input.currentMonthItems,
    ytd: input.ytdItems,
    priorYear: input.priorYearItems,
  };

  const operacionalSection = buildOperacionalSection(itemsByPeriod);
  const investimentoSection = buildInvestimentoSection(itemsByPeriod);
  const financiamentoSection = buildFinanciamentoSection(itemsByPeriod);

  const sections = [operacionalSection, investimentoSection, financiamentoSection];

  // variacaoLiquida = sum of all 3 section subtotals per period
  const variacaoLiquidaCurrentMonth = new Decimal(operacionalSection.subtotal.currentMonth)
    .plus(new Decimal(investimentoSection.subtotal.currentMonth))
    .plus(new Decimal(financiamentoSection.subtotal.currentMonth));
  const variacaoLiquidaYtd = new Decimal(operacionalSection.subtotal.ytd)
    .plus(new Decimal(investimentoSection.subtotal.ytd))
    .plus(new Decimal(financiamentoSection.subtotal.ytd));
  const variacaoLiquidaPriorYear = new Decimal(operacionalSection.subtotal.priorYear)
    .plus(new Decimal(investimentoSection.subtotal.priorYear))
    .plus(new Decimal(financiamentoSection.subtotal.priorYear));

  // saldoInicial from cash balances
  const saldoInicialCurrentMonth = new Decimal(input.cashBalances.currentMonthOpening);
  const saldoInicialYtd = new Decimal(input.cashBalances.ytdOpening);
  const saldoInicialPriorYear = new Decimal(input.cashBalances.priorYearOpening);

  // saldoFinal = saldoInicial + variacaoLiquida
  const saldoFinalCurrentMonth = saldoInicialCurrentMonth.plus(variacaoLiquidaCurrentMonth);
  const saldoFinalYtd = saldoInicialYtd.plus(variacaoLiquidaYtd);
  const saldoFinalPriorYear = saldoInicialPriorYear.plus(variacaoLiquidaPriorYear);

  const cash: DfcCashSummary = {
    saldoInicial: {
      currentMonth: saldoInicialCurrentMonth.toFixed(2),
      ytd: saldoInicialYtd.toFixed(2),
      priorYear: saldoInicialPriorYear.toFixed(2),
    },
    variacaoLiquida: {
      currentMonth: variacaoLiquidaCurrentMonth.toFixed(2),
      ytd: variacaoLiquidaYtd.toFixed(2),
      priorYear: variacaoLiquidaPriorYear.toFixed(2),
    },
    saldoFinal: {
      currentMonth: saldoFinalCurrentMonth.toFixed(2),
      ytd: saldoFinalYtd.toFixed(2),
      priorYear: saldoFinalPriorYear.toFixed(2),
    },
  };

  return { sections, cash };
}

// ─── calculateDfcIndireto ──────────────────────────────────────────────────────

export function calculateDfcIndireto(input: DfcIndiretoInput): DfcIndiretoOutput {
  // Build operacional section via indirect method (CPC 03 R2):
  // Start from net income and adjust for non-cash items and working capital changes.

  const operacionalRows: DfcSectionRow[] = [];

  // 1. Lucro liquido do exercicio
  operacionalRows.push({
    id: 'lucro-liquido',
    label: 'Lucro liquido do exercicio',
    currentMonth: new Decimal(input.lucroLiquido.currentMonth).toFixed(2),
    ytd: new Decimal(input.lucroLiquido.ytd).toFixed(2),
    priorYear: new Decimal(input.lucroLiquido.priorYear).toFixed(2),
    isSubtotal: false,
  });

  // 2. (+) Depreciacao e amortizacao (positive add-back)
  operacionalRows.push({
    id: 'depreciacao-amortizacao',
    label: '(+) Depreciacao e amortizacao',
    currentMonth: new Decimal(input.depreciacao.currentMonth).toFixed(2),
    ytd: new Decimal(input.depreciacao.ytd).toFixed(2),
    priorYear: new Decimal(input.depreciacao.priorYear).toFixed(2),
    isSubtotal: false,
  });

  // 3. (+/-) Variacao de provisoes (delta provisoes)
  operacionalRows.push({
    id: 'variacao-provisoes',
    label: '(+/-) Variacao de provisoes',
    currentMonth: new Decimal(input.provisoes.currentMonth).toFixed(2),
    ytd: new Decimal(input.provisoes.ytd).toFixed(2),
    priorYear: new Decimal(input.provisoes.priorYear).toFixed(2),
    isSubtotal: false,
  });

  // 4. (-) Variacao valor justo ativo biologico (CPC 29 — subtract if gain)
  // cpc29FairValue is treated as a gain (reduces cash flow from operations if positive)
  operacionalRows.push({
    id: 'variacao-valor-justo-cpc29',
    label: '(-) Variacao valor justo ativo biologico (CPC 29)',
    currentMonth: new Decimal(input.cpc29FairValue.currentMonth).neg().toFixed(2),
    ytd: new Decimal(input.cpc29FairValue.ytd).neg().toFixed(2),
    priorYear: new Decimal(input.cpc29FairValue.priorYear).neg().toFixed(2),
    isSubtotal: false,
  });

  // 5. Working capital: deltaContasReceber (increase = negative, sign flip)
  const deltaContasReceber = input.workingCapitalDeltas.deltaContasReceber;
  operacionalRows.push({
    id: 'variacao-contas-receber',
    label: '(+/-) Variacao em contas a receber',
    currentMonth: new Decimal(deltaContasReceber.currentMonth).neg().toFixed(2),
    ytd: new Decimal(deltaContasReceber.ytd).neg().toFixed(2),
    priorYear: new Decimal(deltaContasReceber.priorYear).neg().toFixed(2),
    isSubtotal: false,
  });

  // 6. deltaEstoques (increase = negative, sign flip)
  const deltaEstoques = input.workingCapitalDeltas.deltaEstoques;
  operacionalRows.push({
    id: 'variacao-estoques',
    label: '(+/-) Variacao em estoques',
    currentMonth: new Decimal(deltaEstoques.currentMonth).neg().toFixed(2),
    ytd: new Decimal(deltaEstoques.ytd).neg().toFixed(2),
    priorYear: new Decimal(deltaEstoques.priorYear).neg().toFixed(2),
    isSubtotal: false,
  });

  // 7. deltaContasPagar (increase = positive, same sign)
  const deltaContasPagar = input.workingCapitalDeltas.deltaContasPagar;
  operacionalRows.push({
    id: 'variacao-contas-pagar',
    label: '(+/-) Variacao em contas a pagar',
    currentMonth: new Decimal(deltaContasPagar.currentMonth).toFixed(2),
    ytd: new Decimal(deltaContasPagar.ytd).toFixed(2),
    priorYear: new Decimal(deltaContasPagar.priorYear).toFixed(2),
    isSubtotal: false,
  });

  // 8. deltaObrigacoes (increase = positive, same sign)
  const deltaObrigacoes = input.workingCapitalDeltas.deltaObrigacoes;
  operacionalRows.push({
    id: 'variacao-obrigacoes',
    label: '(+/-) Variacao em obrigacoes trabalhistas/tributarias',
    currentMonth: new Decimal(deltaObrigacoes.currentMonth).toFixed(2),
    ytd: new Decimal(deltaObrigacoes.ytd).toFixed(2),
    priorYear: new Decimal(deltaObrigacoes.priorYear).toFixed(2),
    isSubtotal: false,
  });

  // Subtotal = sum of all operacional rows
  const operacionalTotals = sumRow(operacionalRows);
  const operacionalSubtotal: DfcSectionRow = {
    id: 'subtotal-operacional',
    label: 'Caixa liquido das atividades operacionais',
    currentMonth: operacionalTotals.currentMonth.toFixed(2),
    ytd: operacionalTotals.ytd.toFixed(2),
    priorYear: operacionalTotals.priorYear.toFixed(2),
    isSubtotal: true,
  };

  const operacionalSection: DfcSection = {
    id: 'operacional',
    label: 'Atividades Operacionais',
    rows: operacionalRows,
    subtotal: operacionalSubtotal,
  };

  // Investimento and financiamento sections reuse direto data
  const sections: DfcSection[] = [
    operacionalSection,
    input.investimentoSection,
    input.financiamentoSection,
  ];

  return { sections, cash: input.cash };
}
