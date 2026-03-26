// ─── Accounting Entries Types ────────────────────────────────────────────────
// INTEGR-02: Canonical accounting entries for payroll close and payment reversal.
// sourceType uses AccountingSourceType enum (never plain string) per CLAUDE.md.

import type { AccountingEntryType, AccountingSourceType } from '@prisma/client';

// Re-export enums so callers import from types, not @prisma/client directly
export type { AccountingEntryType, AccountingSourceType };

// ─── Error class ──────────────────────────────────────────────────────

export class AccountingEntryError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = 'AccountingEntryError';
  }
}

// ─── Account codes ────────────────────────────────────────────────────
// Hardcoded chart-of-accounts per REQUIREMENTS.md v1.4 scope (no dynamic COA management).

export const ACCOUNT_CODES = {
  PAYROLL_SALARY: {
    debit: '6.1.01',
    debitLabel: 'Despesa com Salarios',
    credit: '2.1.01',
    creditLabel: 'Salarios a Pagar',
  },
  PAYROLL_CHARGES: {
    debit: '6.1.02',
    debitLabel: 'Despesa Encargos Sociais',
    credit: '2.1.02',
    creditLabel: 'Encargos a Recolher',
  },
  VACATION_PROVISION: {
    debit: '6.1.03',
    debitLabel: 'Desp. Prov. Ferias',
    credit: '2.2.01',
    creditLabel: 'Provisao Ferias a Pagar',
  },
  THIRTEENTH_PROVISION: {
    debit: '6.1.04',
    debitLabel: 'Desp. Prov. 13o',
    credit: '2.2.02',
    creditLabel: 'Provisao 13o a Pagar',
  },
  TAX_LIABILITY: {
    debit: '6.1.05',
    debitLabel: 'Despesa INSS/IRRF',
    credit: '2.1.03',
    creditLabel: 'INSS/IRRF a Recolher',
  },
  SALARY_REVERSAL: {
    debit: '2.1.01',
    debitLabel: 'Salarios a Pagar',
    credit: '1.1.01',
    creditLabel: 'Caixa/Bancos',
  },
} as const;

// ─── Output interfaces ────────────────────────────────────────────────

export interface AccountingEntryOutput {
  id: string;
  organizationId: string;
  referenceMonth: string;
  entryType: AccountingEntryType;
  debitAccount: string;
  debitLabel: string;
  creditAccount: string;
  creditLabel: string;
  amount: number;
  costCenterId: string | null;
  farmId: string | null;
  sourceType: AccountingSourceType;
  sourceId: string;
  reversedByEntryId: string | null;
  notes: string | null;
  createdAt: string;
}

// ─── Input interfaces ─────────────────────────────────────────────────

export interface AccountingEntryListInput {
  referenceMonth?: string; // "YYYY-MM"
  farmId?: string;
  entryType?: AccountingEntryType;
  page?: number;
  limit?: number;
}

export interface PaginatedAccountingEntriesOutput {
  data: AccountingEntryOutput[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
