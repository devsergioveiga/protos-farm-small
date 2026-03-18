// ─── Error ───────────────────────────────────────────────────────────

export class ReconciliationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ReconciliationError';
    this.statusCode = statusCode;
  }
}

// ─── OFX Types ───────────────────────────────────────────────────────

export interface OfxTransaction {
  trntype: string;
  dtposted: Date;
  trnamt: number;
  fitid: string;
  memo: string;
}

export interface OfxDocument {
  bankId: string | undefined;
  acctId: string | undefined;
  transactions: OfxTransaction[];
}

// ─── CSV Types ───────────────────────────────────────────────────────

export interface CsvColumnMapping {
  date: number;
  amount: number;
  description: number;
  type?: number;
}

export interface CsvDetectedColumns {
  headers: string[];
  suggestedMapping: CsvColumnMapping;
  previewRows: string[][];
}

// ─── Parsed Statement ─────────────────────────────────────────────────

export interface ParsedStatementLine {
  trnType: 'CREDIT' | 'DEBIT';
  amount: number;
  date: Date;
  memo: string;
  fitId?: string;
}

// ─── Import Types ─────────────────────────────────────────────────────

export interface ImportPreviewResponse {
  fileType: 'OFX' | 'CSV';
  bankAccountId?: string;
  bankAccountName?: string;
  detectedColumns?: CsvDetectedColumns;
  lines: ParsedStatementLine[];
  totalLines: number;
}

export interface ImportConfirmInput {
  bankAccountId: string;
  selectedLineIndices?: number[];
  columnMapping?: CsvColumnMapping;
}

export interface ImportResult {
  importId: string;
  totalLines: number;
  importedLines: number;
  skippedLines: number;
}

// ─── Matching Types ───────────────────────────────────────────────────

export type ConfidenceLevel = 'EXATO' | 'PROVAVEL' | 'SEM_MATCH';

export interface MatchCandidate {
  type: 'PAYABLE' | 'RECEIVABLE' | 'TRANSFER';
  referenceId: string;
  description: string;
  amount: number;
  date: Date;
  score: number;
  confidence: ConfidenceLevel;
}

export interface StatementLineWithMatches {
  id: string;
  trnType: string;
  amount: number;
  date: string;
  memo: string;
  status: string;
  matches: MatchCandidate[];
}

// ─── Query/Output Types ───────────────────────────────────────────────

export interface ListImportsQuery {
  bankAccountId?: string;
  page?: number;
  limit?: number;
}

export interface ImportOutput {
  id: string;
  bankAccountId: string;
  bankAccountName: string;
  fileName: string;
  fileType: string;
  importedBy: string;
  importedByName: string;
  totalLines: number;
  importedLines: number;
  skippedLines: number;
  pendingLines: number;
  reconciledLines: number;
  createdAt: string;
}
