// ─── Journal Entries Types ─────────────────────────────────────────────────
// Types, interfaces, and custom error class for the journal entries module.

// ─── Error class ──────────────────────────────────────────────────────

export class JournalEntryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 422,
  ) {
    super(message);
    this.name = 'JournalEntryError';
    Object.setPrototypeOf(this, JournalEntryError.prototype);
  }
}

// ─── Input types ──────────────────────────────────────────────────────

export interface CreateJournalEntryLineInput {
  accountId: string;
  side: 'DEBIT' | 'CREDIT';
  amount: string; // decimal string e.g. "1500.00"
  description?: string;
  costCenterId?: string;
}

export interface CreateJournalEntryInput {
  entryDate: string; // ISO date string
  periodId: string;
  description: string;
  costCenterId?: string;
  lines: CreateJournalEntryLineInput[];
}

export interface SaveTemplateInput extends CreateJournalEntryInput {
  templateName: string;
}

// ─── Output types ─────────────────────────────────────────────────────

export interface JournalEntryLineOutput {
  id: string;
  accountId: string;
  side: string;
  amount: string;
  description: string | null;
  costCenterId: string | null;
  lineOrder: number;
  account: { code: string; name: string; nature: string };
}

export interface JournalEntryOutput {
  id: string;
  entryNumber: number;
  entryDate: string;
  periodId: string;
  description: string;
  entryType: string;
  status: string;
  reversedById: string | null;
  reversalOf: string | null;
  reversalReason: string | null;
  templateName: string | null;
  costCenterId: string | null;
  createdBy: string;
  postedAt: string | null;
  createdAt: string;
  lines: JournalEntryLineOutput[];
}

// ─── Filter types ─────────────────────────────────────────────────────

export interface ListEntriesFilters {
  periodId?: string;
  status?: string;
  entryType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ─── CSV import types (per LANC-03) ───────────────────────────────────

export interface CsvImportRow {
  rowNumber: number;
  entryDate: string;
  periodId: string;
  description: string;
  accountCode: string;
  side: 'DEBIT' | 'CREDIT';
  amount: string;
  costCenterId?: string;
}

export interface CsvImportPreview {
  entries: CreateJournalEntryInput[];
  errors: Array<{ rowNumber: number; field: string; reason: string }>;
  totalEntries: number;
  totalErrors: number;
}
