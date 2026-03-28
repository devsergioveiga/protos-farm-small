// ─── DFC Types ─────────────────────────────────────────────────────────────────
// Type definitions for DFC (Demonstracao do Fluxo de Caixa) — direct and indirect methods.
// CPC 03 R2 compliant.

export interface DfcFilters {
  fiscalYearId: string;
  month: number;
}

export interface DfcSectionRow {
  id: string;           // e.g. 'recebimentos-clientes', 'pagamento-fornecedores'
  label: string;        // Human-readable pt-BR label
  currentMonth: string; // Decimal string
  ytd: string;
  priorYear: string;
  isSubtotal: boolean;
}

export interface DfcSection {
  id: 'operacional' | 'investimento' | 'financiamento';
  label: string;        // 'Atividades Operacionais' etc.
  rows: DfcSectionRow[];
  subtotal: DfcSectionRow;
}

export interface DfcCashSummary {
  saldoInicial: { currentMonth: string; ytd: string; priorYear: string };
  variacaoLiquida: { currentMonth: string; ytd: string; priorYear: string };
  saldoFinal: { currentMonth: string; ytd: string; priorYear: string };
}

// Input for direto: paid CP/CR grouped by category
export interface DfcPaidItem {
  category: string;          // PayableCategory or ReceivableCategory
  amount: string;            // Decimal string (positive)
  type: 'outflow' | 'inflow';
}

export interface DfcDiretoInput {
  currentMonthItems: DfcPaidItem[];
  ytdItems: DfcPaidItem[];
  priorYearItems: DfcPaidItem[];
  cashBalances: {
    currentMonthOpening: string;
    currentMonthClosing: string;
    ytdOpening: string;       // month 1 opening
    ytdClosing: string;       // current month closing
    priorYearOpening: string;
    priorYearClosing: string;
  };
}

export interface DfcDiretoOutput {
  sections: DfcSection[];
  cash: DfcCashSummary;
}

// Input for indireto: adjustments to net income
export interface DfcIndiretoInput {
  lucroLiquido: { currentMonth: string; ytd: string; priorYear: string };
  depreciacao: { currentMonth: string; ytd: string; priorYear: string };
  provisoes: { currentMonth: string; ytd: string; priorYear: string };     // delta provisoes (ferias+13o)
  cpc29FairValue: { currentMonth: string; ytd: string; priorYear: string }; // variacao valor justo
  workingCapitalDeltas: {
    deltaContasReceber: { currentMonth: string; ytd: string; priorYear: string };
    deltaEstoques: { currentMonth: string; ytd: string; priorYear: string };
    deltaContasPagar: { currentMonth: string; ytd: string; priorYear: string };
    deltaObrigacoes: { currentMonth: string; ytd: string; priorYear: string };
  };
  // Investimento and financiamento sections reuse direto data
  investimentoSection: DfcSection;
  financiamentoSection: DfcSection;
  cash: DfcCashSummary;
}

export interface DfcIndiretoOutput {
  sections: DfcSection[];  // operacional (adjustments) + investimento + financiamento
  cash: DfcCashSummary;
}

export interface DfcOutput {
  direto: DfcDiretoOutput;
  indireto: DfcIndiretoOutput;
}
