// ─── DFC Calculator Tests ──────────────────────────────────────────────────────
// Unit tests for calculateDfcDireto and calculateDfcIndireto pure functions.
// CPC 03 R2 compliant — three sections: Operacional, Investimento, Financiamento.

import { calculateDfcDireto, calculateDfcIndireto } from './dfc.calculator';
import type { DfcDiretoInput, DfcIndiretoInput, DfcSection } from './dfc.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDiretoInput(overrides: Partial<DfcDiretoInput> = {}): DfcDiretoInput {
  return {
    currentMonthItems: [],
    ytdItems: [],
    priorYearItems: [],
    cashBalances: {
      currentMonthOpening: '10000.00',
      currentMonthClosing: '10000.00',
      ytdOpening: '9000.00',
      ytdClosing: '10000.00',
      priorYearOpening: '8000.00',
      priorYearClosing: '8500.00',
    },
    ...overrides,
  };
}

function makeSectionStub(id: 'investimento' | 'financiamento'): DfcSection {
  return {
    id,
    label: id === 'investimento' ? 'Atividades de Investimento' : 'Atividades de Financiamento',
    rows: [],
    subtotal: {
      id: `subtotal-${id}`,
      label: 'Subtotal',
      currentMonth: '0.00',
      ytd: '0.00',
      priorYear: '0.00',
      isSubtotal: true,
    },
  };
}

// ─── calculateDfcDireto ────────────────────────────────────────────────────────

describe('calculateDfcDireto', () => {
  it('returns three sections with correct ids', () => {
    const input = makeDiretoInput();
    const result = calculateDfcDireto(input);

    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].id).toBe('operacional');
    expect(result.sections[1].id).toBe('investimento');
    expect(result.sections[2].id).toBe('financiamento');
  });

  it('classifies GRAIN_SALE inflow into operacional section', () => {
    const input = makeDiretoInput({
      currentMonthItems: [
        { category: 'GRAIN_SALE', amount: '5000.00', type: 'inflow' as const },
      ],
    });
    const result = calculateDfcDireto(input);
    const operacional = result.sections.find((s) => s.id === 'operacional')!;

    // recebimentos-clientes row should contain GRAIN_SALE amount
    const recebimentos = operacional.rows.find((r) => r.id === 'recebimentos-clientes');
    expect(recebimentos).toBeDefined();
    expect(recebimentos!.currentMonth).toBe('5000.00');
  });

  it('classifies ASSET_ACQUISITION outflow into investimento section', () => {
    const input = makeDiretoInput({
      currentMonthItems: [
        { category: 'ASSET_ACQUISITION', amount: '20000.00', type: 'outflow' as const },
      ],
    });
    const result = calculateDfcDireto(input);
    const investimento = result.sections.find((s) => s.id === 'investimento')!;

    const aquisicao = investimento.rows.find((r) => r.id === 'aquisicao-ativos');
    expect(aquisicao).toBeDefined();
    // Outflows shown as negative
    expect(aquisicao!.currentMonth).toBe('-20000.00');
  });

  it('classifies ASSET_SALE inflow into investimento section', () => {
    const input = makeDiretoInput({
      currentMonthItems: [
        { category: 'ASSET_SALE', amount: '8000.00', type: 'inflow' as const },
      ],
    });
    const result = calculateDfcDireto(input);
    const investimento = result.sections.find((s) => s.id === 'investimento')!;

    const venda = investimento.rows.find((r) => r.id === 'venda-ativos');
    expect(venda).toBeDefined();
    expect(venda!.currentMonth).toBe('8000.00');
  });

  it('classifies FINANCING outflow into financiamento section', () => {
    const input = makeDiretoInput({
      currentMonthItems: [
        { category: 'FINANCING', amount: '3000.00', type: 'outflow' as const },
      ],
    });
    const result = calculateDfcDireto(input);
    const financiamento = result.sections.find((s) => s.id === 'financiamento')!;

    const pagamento = financiamento.rows.find((r) => r.id === 'pagamento-financiamentos');
    expect(pagamento).toBeDefined();
    expect(pagamento!.currentMonth).toBe('-3000.00');
  });

  it('computes variacaoLiquida as sum of all 3 sections subtotals', () => {
    const input = makeDiretoInput({
      currentMonthItems: [
        { category: 'GRAIN_SALE', amount: '5000.00', type: 'inflow' as const },
        { category: 'INPUTS', amount: '1000.00', type: 'outflow' as const },
        { category: 'ASSET_ACQUISITION', amount: '2000.00', type: 'outflow' as const },
        { category: 'FINANCING', amount: '500.00', type: 'outflow' as const },
      ],
      cashBalances: {
        currentMonthOpening: '10000.00',
        currentMonthClosing: '11500.00',
        ytdOpening: '10000.00',
        ytdClosing: '11500.00',
        priorYearOpening: '0.00',
        priorYearClosing: '0.00',
      },
    });
    const result = calculateDfcDireto(input);

    // operacional net: 5000 - 1000 = 4000; investimento net: -2000; financiamento net: -500
    // total variacaoLiquida = 4000 - 2000 - 500 = 1500
    expect(result.cash.variacaoLiquida.currentMonth).toBe('1500.00');
  });

  it('computes saldoFinal = saldoInicial + variacaoLiquida', () => {
    const input = makeDiretoInput({
      currentMonthItems: [
        { category: 'GRAIN_SALE', amount: '5000.00', type: 'inflow' as const },
      ],
      cashBalances: {
        currentMonthOpening: '10000.00',
        currentMonthClosing: '15000.00',
        ytdOpening: '10000.00',
        ytdClosing: '15000.00',
        priorYearOpening: '0.00',
        priorYearClosing: '0.00',
      },
    });
    const result = calculateDfcDireto(input);

    // saldoInicial = 10000, variacaoLiquida = 5000, saldoFinal = 15000
    expect(result.cash.saldoInicial.currentMonth).toBe('10000.00');
    expect(result.cash.variacaoLiquida.currentMonth).toBe('5000.00');
    expect(result.cash.saldoFinal.currentMonth).toBe('15000.00');
  });

  it('returns zeros when no items provided', () => {
    const input = makeDiretoInput({
      cashBalances: {
        currentMonthOpening: '0.00',
        currentMonthClosing: '0.00',
        ytdOpening: '0.00',
        ytdClosing: '0.00',
        priorYearOpening: '0.00',
        priorYearClosing: '0.00',
      },
    });
    const result = calculateDfcDireto(input);

    expect(result.cash.variacaoLiquida.currentMonth).toBe('0.00');
    expect(result.cash.saldoFinal.currentMonth).toBe('0.00');
    result.sections.forEach((section) => {
      expect(section.subtotal.currentMonth).toBe('0.00');
    });
  });

  it('classifies PAYROLL outflow into operacional section as salarios-encargos', () => {
    const input = makeDiretoInput({
      currentMonthItems: [
        { category: 'PAYROLL', amount: '4500.00', type: 'outflow' as const },
      ],
    });
    const result = calculateDfcDireto(input);
    const operacional = result.sections.find((s) => s.id === 'operacional')!;

    const salarios = operacional.rows.find((r) => r.id === 'salarios-encargos');
    expect(salarios).toBeDefined();
    expect(salarios!.currentMonth).toBe('-4500.00');
  });
});

// ─── calculateDfcIndireto ──────────────────────────────────────────────────────

describe('calculateDfcIndireto', () => {
  function makeIndiretoInput(overrides: Partial<DfcIndiretoInput> = {}): DfcIndiretoInput {
    return {
      lucroLiquido: { currentMonth: '10000.00', ytd: '10000.00', priorYear: '8000.00' },
      depreciacao: { currentMonth: '500.00', ytd: '500.00', priorYear: '400.00' },
      provisoes: { currentMonth: '200.00', ytd: '200.00', priorYear: '150.00' },
      cpc29FairValue: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
      workingCapitalDeltas: {
        deltaContasReceber: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
        deltaEstoques: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
        deltaContasPagar: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
        deltaObrigacoes: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
      },
      investimentoSection: makeSectionStub('investimento'),
      financiamentoSection: makeSectionStub('financiamento'),
      cash: {
        saldoInicial: { currentMonth: '5000.00', ytd: '5000.00', priorYear: '4000.00' },
        variacaoLiquida: { currentMonth: '10700.00', ytd: '10700.00', priorYear: '8550.00' },
        saldoFinal: { currentMonth: '15700.00', ytd: '15700.00', priorYear: '12550.00' },
      },
      ...overrides,
    };
  }

  it('returns three sections with operacional first', () => {
    const result = calculateDfcIndireto(makeIndiretoInput());

    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].id).toBe('operacional');
    expect(result.sections[1].id).toBe('investimento');
    expect(result.sections[2].id).toBe('financiamento');
  });

  it('applies depreciacao as positive adjustment (non-cash expense add-back)', () => {
    const input = makeIndiretoInput({
      lucroLiquido: { currentMonth: '1000.00', ytd: '1000.00', priorYear: '0.00' },
      depreciacao: { currentMonth: '300.00', ytd: '300.00', priorYear: '0.00' },
      provisoes: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
    });
    const result = calculateDfcIndireto(input);
    const operacional = result.sections[0];

    const depRow = operacional.rows.find((r) => r.id === 'depreciacao-amortizacao');
    expect(depRow).toBeDefined();
    // depreciacao is positive (add-back)
    expect(depRow!.currentMonth).toBe('300.00');
  });

  it('delta CR positive (increase in receivables) → negative cash impact', () => {
    const input = makeIndiretoInput({
      lucroLiquido: { currentMonth: '1000.00', ytd: '0.00', priorYear: '0.00' },
      depreciacao: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
      provisoes: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
      workingCapitalDeltas: {
        deltaContasReceber: { currentMonth: '500.00', ytd: '0.00', priorYear: '0.00' }, // CR increased
        deltaEstoques: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
        deltaContasPagar: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
        deltaObrigacoes: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
      },
    });
    const result = calculateDfcIndireto(input);
    const operacional = result.sections[0];

    const crRow = operacional.rows.find((r) => r.id === 'variacao-contas-receber');
    expect(crRow).toBeDefined();
    // When CR increased by 500, cash impact is -500 (sign flip)
    expect(crRow!.currentMonth).toBe('-500.00');
  });

  it('delta CP positive (increase in payables) → positive cash impact', () => {
    const input = makeIndiretoInput({
      lucroLiquido: { currentMonth: '1000.00', ytd: '0.00', priorYear: '0.00' },
      depreciacao: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
      provisoes: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
      workingCapitalDeltas: {
        deltaContasReceber: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
        deltaEstoques: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
        deltaContasPagar: { currentMonth: '300.00', ytd: '0.00', priorYear: '0.00' }, // CP increased
        deltaObrigacoes: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
      },
    });
    const result = calculateDfcIndireto(input);
    const operacional = result.sections[0];

    const cpRow = operacional.rows.find((r) => r.id === 'variacao-contas-pagar');
    expect(cpRow).toBeDefined();
    // When CP increased by 300, cash impact is +300 (same sign)
    expect(cpRow!.currentMonth).toBe('300.00');
  });

  it('operacional subtotal = lucroLiquido + all adjustments', () => {
    const input = makeIndiretoInput({
      lucroLiquido: { currentMonth: '10000.00', ytd: '0.00', priorYear: '0.00' },
      depreciacao: { currentMonth: '500.00', ytd: '0.00', priorYear: '0.00' },
      provisoes: { currentMonth: '200.00', ytd: '0.00', priorYear: '0.00' },
      cpc29FairValue: { currentMonth: '100.00', ytd: '0.00', priorYear: '0.00' },
      workingCapitalDeltas: {
        deltaContasReceber: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
        deltaEstoques: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
        deltaContasPagar: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
        deltaObrigacoes: { currentMonth: '0.00', ytd: '0.00', priorYear: '0.00' },
      },
    });
    const result = calculateDfcIndireto(input);
    const operacional = result.sections[0];

    // 10000 + 500 + 200 - 100 (cpc29 gain subtracted) = 10600
    expect(operacional.subtotal.currentMonth).toBe('10600.00');
  });

  it('passes investimento and financiamento sections from input unchanged', () => {
    const investimentoSection: DfcSection = {
      id: 'investimento',
      label: 'Atividades de Investimento',
      rows: [
        {
          id: 'aquisicao-ativos',
          label: 'Aquisicao de ativos',
          currentMonth: '-5000.00',
          ytd: '-5000.00',
          priorYear: '0.00',
          isSubtotal: false,
        },
      ],
      subtotal: {
        id: 'subtotal-investimento',
        label: 'Total Investimento',
        currentMonth: '-5000.00',
        ytd: '-5000.00',
        priorYear: '0.00',
        isSubtotal: true,
      },
    };
    const input = makeIndiretoInput({ investimentoSection });
    const result = calculateDfcIndireto(input);

    const invSection = result.sections.find((s) => s.id === 'investimento')!;
    expect(invSection.subtotal.currentMonth).toBe('-5000.00');
    expect(invSection.rows).toHaveLength(1);
  });
});
