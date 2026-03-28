// ─── Enums / union types ──────────────────────────────────────────────────────

export type AutoPostingSourceType =
  | 'PAYROLL_RUN_CLOSE'
  | 'PAYROLL_PROVISION_VACATION'
  | 'PAYROLL_PROVISION_THIRTEENTH'
  | 'PAYABLE_SETTLEMENT'
  | 'RECEIVABLE_SETTLEMENT'
  | 'DEPRECIATION_RUN'
  | 'STOCK_ENTRY'
  | 'STOCK_OUTPUT_CONSUMPTION'
  | 'STOCK_OUTPUT_TRANSFER'
  | 'STOCK_OUTPUT_DISPOSAL'
  | 'PAYABLE_REVERSAL'
  | 'RECEIVABLE_REVERSAL';

export type PendingPostingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

// ─── Rule types ───────────────────────────────────────────────────────────────

export interface AccountingRuleLine {
  id: string;
  lineOrder: number;
  side: 'DEBIT' | 'CREDIT';
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string | null;
}

export interface AccountingRule {
  id: string;
  sourceType: AutoPostingSourceType;
  isActive: boolean;
  historyTemplate: string;
  requireCostCenter: boolean;
  lines: AccountingRuleLine[];
}

// ─── Pending posting types ────────────────────────────────────────────────────

export interface PendingJournalPosting {
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

export interface PendingCounts {
  error: number;
  pending: number;
}

// ─── Preview types ────────────────────────────────────────────────────────────

export interface RulePreview {
  entryDate: string;
  description: string;
  lines: {
    lineOrder: number;
    side: 'DEBIT' | 'CREDIT';
    accountCode: string;
    accountName: string;
    amount: string;
    description: string | null;
  }[];
  costCenterName: string | null;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface UpdateRuleInput {
  isActive?: boolean;
  historyTemplate?: string;
  requireCostCenter?: boolean;
  lines?: {
    lineOrder: number;
    side: 'DEBIT' | 'CREDIT';
    accountId: string;
    description?: string;
  }[];
}

// ─── Label maps ───────────────────────────────────────────────────────────────

export const SOURCE_TYPE_LABELS: Record<AutoPostingSourceType, string> = {
  PAYROLL_RUN_CLOSE: 'Fechamento de Folha',
  PAYROLL_PROVISION_VACATION: 'Provisão de Férias',
  PAYROLL_PROVISION_THIRTEENTH: 'Provisão de 13º Salário',
  PAYABLE_SETTLEMENT: 'Liquidação de CP',
  RECEIVABLE_SETTLEMENT: 'Recebimento de CR',
  DEPRECIATION_RUN: 'Depreciação Mensal',
  STOCK_ENTRY: 'Entrada de Estoque',
  STOCK_OUTPUT_CONSUMPTION: 'Saída Estoque - Consumo',
  STOCK_OUTPUT_TRANSFER: 'Saída Estoque - Transferência',
  STOCK_OUTPUT_DISPOSAL: 'Saída Estoque - Descarte',
  PAYABLE_REVERSAL: 'Estorno de CP',
  RECEIVABLE_REVERSAL: 'Estorno de CR',
};

// Source type to route mapping for origin links (per UI-SPEC)
export const SOURCE_TYPE_ROUTES: Record<AutoPostingSourceType, string> = {
  PAYABLE_SETTLEMENT: '/payables',
  RECEIVABLE_SETTLEMENT: '/receivables',
  PAYROLL_RUN_CLOSE: '/payroll-runs',
  DEPRECIATION_RUN: '/depreciation',
  STOCK_ENTRY: '/stock-entries',
  STOCK_OUTPUT_CONSUMPTION: '/stock-outputs',
  STOCK_OUTPUT_TRANSFER: '/stock-outputs',
  STOCK_OUTPUT_DISPOSAL: '/stock-outputs',
  PAYROLL_PROVISION_VACATION: '/payroll-provisions',
  PAYROLL_PROVISION_THIRTEENTH: '/payroll-provisions',
  PAYABLE_REVERSAL: '/payables',
  RECEIVABLE_REVERSAL: '/receivables',
};

export const PENDING_STATUS_LABELS: Record<PendingPostingStatus, string> = {
  PENDING: 'PENDENTE',
  PROCESSING: 'PROCESSANDO',
  COMPLETED: 'CONCLUÍDO',
  ERROR: 'ERRO',
};
