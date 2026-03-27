// ─── Enums ──────────────────────────────────────────────────────────────────

export type JournalEntryType = 'MANUAL' | 'OPENING_BALANCE' | 'REVERSAL' | 'TEMPLATE_INSTANCE' | 'AUTOMATIC';
export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type LedgerSide = 'DEBIT' | 'CREDIT';

// ─── Journal Entry Lines ─────────────────────────────────────────────────────

export interface JournalEntryLine {
  id: string;
  accountId: string;
  side: LedgerSide;
  amount: string;
  description: string | null;
  costCenterId: string | null;
  lineOrder: number;
  account: { code: string; name: string; nature: string };
}

// ─── Journal Entry ───────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  entryNumber: number;
  entryDate: string;
  periodId: string;
  description: string;
  entryType: JournalEntryType;
  status: JournalEntryStatus;
  reversedById: string | null;
  reversalOf: string | null;
  reversalReason: string | null;
  templateName: string | null;
  costCenterId: string | null;
  createdBy: string;
  postedAt: string | null;
  createdAt: string;
  lines: JournalEntryLine[];
}

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CreateJournalEntryLineInput {
  accountId: string;
  side: LedgerSide;
  amount: string;
  description?: string;
  costCenterId?: string;
}

export interface CreateJournalEntryInput {
  entryDate: string;
  periodId: string;
  description: string;
  costCenterId?: string;
  lines: CreateJournalEntryLineInput[];
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface JournalEntryFilters {
  periodId?: string;
  status?: JournalEntryStatus;
  entryType?: JournalEntryType;
  page?: number;
  limit?: number;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface JournalEntryTemplate {
  id: string;
  name: string;
  description: string;
  lines: CreateJournalEntryLineInput[];
  createdAt: string;
}

export interface SaveTemplateInput {
  name: string;
  description: string;
  lines: CreateJournalEntryLineInput[];
}

// ─── Opening Balance ─────────────────────────────────────────────────────────

export interface OpeningBalanceLinePreview {
  accountId: string;
  accountCode: string;
  accountName: string;
  side: LedgerSide;
  amount: string;
  source: string;
  description: string;
}

export interface PostOpeningBalanceInput {
  fiscalYearId: string;
  entryDate: string;
  lines: Array<{
    accountId: string;
    side: LedgerSide;
    amount: string;
  }>;
}

// ─── CSV Import (per LANC-03) ─────────────────────────────────────────────────

export interface CsvImportError {
  rowNumber: number;
  field: string;
  reason: string;
}

export interface CsvImportPreview {
  entries: CreateJournalEntryInput[];
  errors: CsvImportError[];
  totalEntries: number;
  totalErrors: number;
}

// ─── Ledger Types (for Plan 05) ───────────────────────────────────────────────

export interface LedgerLine {
  entryId: string;
  entryNumber: number;
  entryDate: string;
  description: string;
  side: LedgerSide;
  amount: string;
  runningBalance: string;
}

export interface LedgerOutput {
  accountId: string;
  accountCode: string;
  accountName: string;
  nature: string;
  periodStart: string;
  periodEnd: string;
  previousBalance: string;
  lines: LedgerLine[];
  finalBalance: string;
}

// ─── Trial Balance Types (for Plan 05) ───────────────────────────────────────

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  nature: string;
  level: number;
  isSynthetic: boolean;
  previousBalance: string;
  debitMovement: string;
  creditMovement: string;
  currentBalance: string;
}

export interface TrialBalanceOutput {
  periodId: string;
  periodMonth: number;
  periodYear: number;
  rows: TrialBalanceRow[];
  grandTotals: {
    previousBalanceDebit: string;
    previousBalanceCredit: string;
    movementDebit: string;
    movementCredit: string;
    currentBalanceDebit: string;
    currentBalanceCredit: string;
  };
  isBalanced: boolean;
}
