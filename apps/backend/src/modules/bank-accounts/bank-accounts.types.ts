import { BankAccountType } from '@prisma/client';

// ─── Error ───────────────────────────────────────────────────────────

export class BankAccountError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'BankAccountError';
  }
}

// ─── Enums ───────────────────────────────────────────────────────────

export const BANK_ACCOUNT_TYPES: BankAccountType[] = [
  'CHECKING',
  'SAVINGS',
  'INVESTMENT',
  'RURAL_CREDIT',
];

export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  CHECKING: 'Conta Corrente',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimentos',
  RURAL_CREDIT: 'Crédito Rural',
};

// ─── Inputs ──────────────────────────────────────────────────────────

export interface CreateBankAccountInput {
  name: string;
  type: BankAccountType;
  bankCode: string;
  agency: string;
  agencyDigit?: string;
  accountNumber: string;
  accountDigit?: string;
  producerId?: string | null;
  farmIds?: string[];
  initialBalance: number;
  notes?: string;
}

export interface UpdateBankAccountInput {
  name?: string;
  agency?: string;
  agencyDigit?: string;
  accountNumber?: string;
  accountDigit?: string;
  producerId?: string | null;
  farmIds?: string[];
  notes?: string;
}

export interface ListBankAccountsQuery {
  farmId?: string;
  type?: BankAccountType;
  bankCode?: string;
  isActive?: boolean;
}

export interface StatementQuery {
  from?: string;
  to?: string;
  type?: 'CREDIT' | 'DEBIT';
}

// ─── Outputs ─────────────────────────────────────────────────────────

export interface BankAccountBalanceOutput {
  initialBalance: number;
  currentBalance: number;
}

export interface BankAccountOutput {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  bankCode: string;
  bankName: string;
  agency: string;
  agencyDigit: string | null;
  accountNumber: string;
  accountDigit: string | null;
  producerId: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  balance: BankAccountBalanceOutput;
  farms: { id: string; name: string }[];
  producer: { id: string; name: string } | null;
}

export interface StatementTransactionOutput {
  id: string;
  bankAccountId: string;
  type: string;
  amount: number;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  transactionDate: string;
  createdAt: string;
}

export interface DashboardByTypeOutput {
  type: string;
  typeLabel: string;
  totalBalance: number;
  count: number;
}

export interface DashboardOutput {
  totalBalance: number;
  accountCount: number;
  byType: DashboardByTypeOutput[];
}

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';
