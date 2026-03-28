// ─── Financial Statements Types ───────────────────────────────────────────────
// Shared types for DRE (Income Statement), BP (Balance Sheet), and cross-validation.
// Used by calculators (pure) and service layer (DB queries).

// ─── DRE Types ────────────────────────────────────────────────────────────────

export interface DreFilters {
  fiscalYearId: string;
  month: number;
  costCenterId?: string; // undefined = consolidated
}

export interface DreAccountData {
  accountId: string;
  code: string;
  name: string;
  accountType: 'RECEITA' | 'DESPESA';
  nature: 'DEVEDORA' | 'CREDORA';
  isSynthetic: boolean;
  isFairValueAdj: boolean;
  currentMonthDebit: string;   // Decimal string
  currentMonthCredit: string;
  ytdDebit: string;            // Acumulado exercicio
  ytdCredit: string;
  priorYearDebit: string;      // Mesmo periodo ano anterior
  priorYearCredit: string;
}

export interface DreInput {
  accounts: DreAccountData[];
  // verticalBase derived from receita liquida internally
}

export interface DreSectionRow {
  accountId: string | null;    // null for computed subtotals
  code: string;
  name: string;
  currentMonth: string;        // Decimal string
  ytd: string;
  priorYear: string;
  avPercent: string | null;    // AV% (vertical analysis over receita liquida)
  ahPercent: string | null;    // AH% delta (horizontal vs prior year)
  isSubtotal: boolean;
  isCpc29: boolean;
  level: number;               // indent level: 0=section, 1=account, 2=subtotal
}

export type DreSectionId =
  | 'receita-bruta-agricola'
  | 'receita-bruta-pecuaria'
  | 'receita-bruta-industrializacao'
  | 'receita-financeira'
  | 'outras-receitas'
  | 'deducoes'
  | 'receita-liquida'
  | 'cpv-agricola'
  | 'cpv-pecuario'
  | 'lucro-bruto'
  | 'despesas-admin'
  | 'despesas-comerciais'
  | 'despesas-financeiras'
  | 'despesas-depreciacao'
  | 'despesas-pessoal'
  | 'cpc29'
  | 'resultado-antes-ir'
  | 'ir-csll'
  | 'resultado-liquido';

export interface DreSection {
  id: DreSectionId;
  label: string;
  rows: DreSectionRow[];
  total: DreSectionRow;        // section subtotal row
}

export interface DreOutput {
  sections: DreSection[];
  resultadoLiquido: DreSectionRow;
  marginRanking?: MarginRankingItem[];
}

export interface MarginRankingItem {
  costCenterId: string;
  costCenterName: string;
  revenue: string;
  cpv: string;
  grossMargin: string;
  marginPercent: string;
}

// ─── BP Types ─────────────────────────────────────────────────────────────────

export interface BpFilters {
  fiscalYearId: string;
  month: number;
}

export interface BpInput {
  accounts: BpAccountData[];
  totalAreaHa: number;
  resultadoLiquido: string;    // from DRE for ROE calculation
  sparklineMonths?: BpSparklineMonth[];
}

export interface BpAccountData {
  accountId: string;
  code: string;
  name: string;
  accountType: 'ATIVO' | 'PASSIVO' | 'PL';
  isSynthetic: boolean;
  currentBalance: string;      // closingBalance current month
  priorBalance: string;        // closingBalance prior month
}

export interface BpGroupRow {
  accountId: string | null;
  code: string;
  name: string;
  currentBalance: string;
  priorBalance: string;
  isSubtotal: boolean;
  level: number;
}

export type BpGroupId = 'ac' | 'anc' | 'pc' | 'pnc' | 'pl';

export interface BpGroup {
  id: BpGroupId;
  label: string;
  rows: BpGroupRow[];
  total: BpGroupRow;
}

export interface BpSparklineMonth {
  month: number;
  acTotal: string;
  pcTotal: string;
  pncTotal: string;
  plTotal: string;
  resultadoLiquido: string;
  ativoTotal: string;
  estoquesBalance: string;
}

export interface BpIndicators {
  liquidezCorrente: string | null;        // AC / PC — null if PC = 0
  liquidezSeca: string | null;            // (AC - Estoques) / PC
  endividamentoGeral: string | null;      // PE / AT — null if AT = 0
  composicaoEndividamento: string | null; // PC / PE — null if PE = 0
  roe: string | null;                     // RL / PL — null if PL = 0
  plPorHectare: string | null;            // PL / totalAreaHa — null if area = 0
  // Sparkline data: last 6 months of each indicator
  sparklines: Record<string, { month: number; value: number }[]>;
}

export interface BpOutput {
  ativo: BpGroup[];   // [AC, ANC]
  passivo: BpGroup[]; // [PC, PNC, PL]
  totalAtivo: BpGroupRow;
  totalPassivo: BpGroupRow; // passivo + PL
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
  investigateUrl: string | null; // frontend route to debug
}

export interface CrossValidationInput {
  resultadoLiquido: string;
  deltaLucrosAcumulados: string;
  ativoTotal: string;
  passivoTotal: string;
  plTotal: string;
  totalDebitos: string;
  totalCreditos: string;
  dfcNetCashFlow?: string;  // optional — null/undefined means PENDING
  bpCashDelta?: string;
}

export interface CrossValidationOutput {
  invariants: InvariantResult[];
  allPassed: boolean;
}

// ─── Service Error ─────────────────────────────────────────────────────────────

export class FinancialStatementsError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 422,
  ) {
    super(message);
    this.name = 'FinancialStatementsError';
  }
}
