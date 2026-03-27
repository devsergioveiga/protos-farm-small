// ─── Ledger Types ─────────────────────────────────────────────────────────────
// Types for ledger (razao contabil), trial balance (balancete), and daily book (livro diario)

export interface LedgerLine {
  entryId: string;
  entryNumber: number;
  entryDate: string;
  description: string;
  side: 'DEBIT' | 'CREDIT';
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

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  nature: string;
  level: number;
  isSynthetic: boolean;
  previousBalance: string; // signed: positive for normal side, negative for opposite
  debitMovement: string;
  creditMovement: string;
  currentBalance: string; // signed
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

export interface DailyBookEntry {
  entryId: string;
  entryNumber: number;
  entryDate: string;
  description: string;
  entryType: string;
  lines: Array<{
    accountCode: string;
    accountName: string;
    side: string;
    amount: string;
    description: string | null;
  }>;
}

export interface DailyBookOutput {
  periodStart: string;
  periodEnd: string;
  entries: DailyBookEntry[];
  totalEntries: number;
}

export interface LedgerFilters {
  accountId: string;
  startDate: string;
  endDate: string;
  costCenterId?: string;
}

export interface TrialBalanceFilters {
  fiscalYearId: string;
  month: number;
  comparePreviousPeriod?: boolean;
}

export interface DailyBookFilters {
  startDate: string;
  endDate: string;
  entryType?: string;
  minAmount?: string;
  maxAmount?: string;
}

export class LedgerError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 422,
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}
