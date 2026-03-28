// ─── DRE Types ────────────────────────────────────────────────────────────────

export interface DreSectionRow {
  accountId: string | null;
  code: string;
  name: string;
  currentMonth: string;
  ytd: string;
  priorYear: string;
  avPercent: string | null;
  ahPercent: string | null;
  isSubtotal: boolean;
  isCpc29: boolean;
  level: number;
}

export interface DreSection {
  id: string;
  label: string;
  rows: DreSectionRow[];
  total: DreSectionRow;
}

export interface DreOutput {
  sections: DreSection[];
  resultadoLiquido: DreSectionRow;
}

export interface MarginRankingItem {
  costCenterId: string;
  costCenterName: string;
  revenue: string;
  cpv: string;
  grossMargin: string;
  marginPercent: string;
}

export interface DreResponse {
  dre: DreOutput;
  marginRanking?: MarginRankingItem[];
}

// ─── BP (Balanço Patrimonial) Types ──────────────────────────────────────────

export interface BpGroupRow {
  accountId: string | null;
  code: string;
  name: string;
  currentBalance: string;
  priorBalance: string;
  isSubtotal: boolean;
  level: number;
}

export interface BpGroup {
  id: string;
  label: string;
  rows: BpGroupRow[];
  total: BpGroupRow;
}

export interface BpIndicators {
  liquidezCorrente: string | null;
  liquidezSeca: string | null;
  endividamentoGeral: string | null;
  composicaoEndividamento: string | null;
  roe: string | null;
  plPorHectare: string | null;
  sparklines: Record<string, { month: number; value: number }[]>;
}

export interface BpOutput {
  ativo: BpGroup[];
  passivo: BpGroup[];
  totalAtivo: BpGroupRow;
  totalPassivo: BpGroupRow;
  indicators: BpIndicators;
}

// ─── Cross-Validation Types ───────────────────────────────────────────────────

export type InvariantStatus = 'PASSED' | 'FAILED' | 'PENDING';

export interface InvariantResult {
  id: string;
  title: string;
  status: InvariantStatus;
  expected: string | null;
  found: string | null;
  difference: string | null;
  investigateUrl: string | null;
}

export interface CrossValidationOutput {
  invariants: InvariantResult[];
  allPassed: boolean;
}
