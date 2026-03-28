// ─── Auto-Posting Types ────────────────────────────────────────────────────
// Types for the auto-posting engine: AccountingRule CRUD, PendingJournalPosting
// state machine, data extractors, and preview output.

import type { AutoPostingSourceType, LedgerSide, PendingPostingStatus } from '@prisma/client';

export interface AccountingRuleLineInput {
  lineOrder: number;
  side: LedgerSide;
  accountId: string;
  description?: string;
}

export interface UpdateRuleInput {
  isActive?: boolean;
  historyTemplate?: string;
  requireCostCenter?: boolean;
  lines?: AccountingRuleLineInput[];
}

export interface AccountingRuleOutput {
  id: string;
  sourceType: AutoPostingSourceType;
  isActive: boolean;
  historyTemplate: string;
  requireCostCenter: boolean;
  lines: {
    id: string;
    lineOrder: number;
    side: LedgerSide;
    accountId: string;
    accountCode: string;
    accountName: string;
    description: string | null;
  }[];
}

export interface PendingPostingOutput {
  id: string;
  sourceType: AutoPostingSourceType;
  sourceId: string;
  status: PendingPostingStatus;
  accountingRuleId: string | null;
  journalEntryId: string | null;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface PendingPostingFilters {
  status?: PendingPostingStatus;
  sourceType?: AutoPostingSourceType;
}

export interface ExtractedData {
  entryDate: Date;
  description: string;
  templateVars: Record<string, string>;
  amounts: { lineOrder: number; amount: string }[];
  farmId?: string;
}

export type DataExtractor = (sourceId: string, organizationId: string) => Promise<ExtractedData>;

export interface PreviewOutput {
  entryDate: string;
  description: string;
  lines: {
    lineOrder: number;
    side: LedgerSide;
    accountCode: string;
    accountName: string;
    amount: string;
    description: string | null;
  }[];
  costCenterName: string | null;
}

export interface PendingCountsOutput {
  error: number;
  pending: number;
}

export interface RetryBatchOutput {
  succeeded: number;
  failed: number;
}

// Labels for frontend display
export const SOURCE_TYPE_LABELS: Record<AutoPostingSourceType, string> = {
  PAYROLL_RUN_CLOSE: 'Fechamento de Folha',
  PAYROLL_PROVISION_VACATION: 'Provisao de Ferias',
  PAYROLL_PROVISION_THIRTEENTH: 'Provisao de 13o Salario',
  PAYABLE_SETTLEMENT: 'Liquidacao de CP',
  RECEIVABLE_SETTLEMENT: 'Recebimento de CR',
  DEPRECIATION_RUN: 'Depreciacao Mensal',
  STOCK_ENTRY: 'Entrada de Estoque',
  STOCK_OUTPUT_CONSUMPTION: 'Saida Estoque — Consumo',
  STOCK_OUTPUT_TRANSFER: 'Saida Estoque — Transferencia',
  STOCK_OUTPUT_DISPOSAL: 'Saida Estoque — Descarte',
  PAYABLE_REVERSAL: 'Estorno de CP',
  RECEIVABLE_REVERSAL: 'Estorno de CR',
};
