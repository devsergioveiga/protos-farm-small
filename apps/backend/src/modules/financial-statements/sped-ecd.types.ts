// ─── SPED ECD Types ──────────────────────────────────────────────────────────
// Types for SPED Contabil (ECD) file generation and pre-validation.
// Used by sped-ecd.writer.ts (pure) and sped-ecd.service.ts (DB orchestration).

export interface SpedOrgData {
  name: string;
  cnpj: string;            // digits only, 14 chars
  uf: string;              // state code or blank
  ie: string;              // state registration or blank
  codMun: string;          // IBGE code or blank
  im: string;              // municipal registration or blank
  accountantName: string | null;
  accountantCrc: string | null;
  accountantCpf: string | null;
}

export interface SpedAccountData {
  code: string;            // COA code
  name: string;
  accountType: 'ATIVO' | 'PASSIVO' | 'PL' | 'RECEITA' | 'DESPESA';
  accountNature: 'DEVEDORA' | 'CREDORA';
  isSynthetic: boolean;
  level: number;
  parentCode: string | null;    // parent COA code
  spedRefCode: string | null;   // L300R referential code
}

export interface SpedMonthlyBalance {
  accountCode: string;
  month: number;           // 1-12
  year: number;
  openingBalance: string;  // Decimal as string
  totalDebits: string;
  totalCredits: string;
  closingBalance: string;
}

export interface SpedJournalLine {
  accountCode: string;
  amount: string;          // Decimal as string
  isDebit: boolean;
  description: string;
}

export interface SpedJournalEntry {
  entryNumber: number;
  entryDate: Date;
  totalDebit: string;      // Decimal as string
  lines: SpedJournalLine[];
}

export interface SpedCostCenter {
  code: string;
  name: string;
}

export interface SpedDreRow {
  spedRefCode: string;
  name: string;
  amount: string;
  isDebit: boolean;
}

export interface SpedBpRow {
  spedRefCode: string;
  name: string;
  openingAmount: string;
  openingIsDebit: boolean;
  closingAmount: string;
  closingIsDebit: boolean;
  groupIndicator: 'A' | 'P';  // Ativo or Passivo+PL
}

export interface SpedDlpaRow {
  spedRefCode: string;
  name: string;
  openingAmount: string;
  openingIsDebit: boolean;
  closingAmount: string;
  closingIsDebit: boolean;
}

export interface SpedEcdInput {
  org: SpedOrgData;
  fiscalYearStart: Date;
  fiscalYearEnd: Date;
  accounts: SpedAccountData[];
  monthlyBalances: SpedMonthlyBalance[];
  journalEntries: SpedJournalEntry[];
  costCenters: SpedCostCenter[];
  dreRows: SpedDreRow[];
  bpRows: SpedBpRow[];
  dlpaRows: SpedDlpaRow[];
}

export interface SpedValidationItem {
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  navigateTo?: string;
}

export interface SpedValidationResult {
  items: SpedValidationItem[];
  hasErrors: boolean;
}
