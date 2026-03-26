export enum AccountingEntryType {
  PAYROLL_SALARY = 'PAYROLL_SALARY',
  PAYROLL_CHARGES = 'PAYROLL_CHARGES',
  VACATION_PROVISION = 'VACATION_PROVISION',
  THIRTEENTH_PROVISION = 'THIRTEENTH_PROVISION',
  TAX_LIABILITY = 'TAX_LIABILITY',
  SALARY_REVERSAL = 'SALARY_REVERSAL',
}

export enum AccountingSourceType {
  PAYROLL_RUN = 'PAYROLL_RUN',
  PAYROLL_PROVISION = 'PAYROLL_PROVISION',
  PAYABLE_SETTLEMENT = 'PAYABLE_SETTLEMENT',
}

export interface AccountingEntry {
  id: string;
  organizationId: string;
  farmId: string | null;
  farmName?: string | null;
  costCenterId: string | null;
  costCenterName?: string | null;
  referenceMonth: string;
  entryDate: string;
  entryType: AccountingEntryType;
  sourceType: AccountingSourceType;
  sourceId: string;
  debitAccount: string;
  debitLabel: string;
  creditAccount: string;
  creditLabel: string;
  amount: number;
  notes: string | null;
  reversedById: string | null;
  createdAt: string;
}

export interface PaginatedAccountingEntriesOutput {
  data: AccountingEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AccountingEntryListFilters {
  referenceMonth?: string;
  farmId?: string;
  entryType?: AccountingEntryType;
  page?: number;
  limit?: number;
}

export const ENTRY_TYPE_LABELS: Record<AccountingEntryType, string> = {
  [AccountingEntryType.PAYROLL_SALARY]: 'Folha — Salários',
  [AccountingEntryType.PAYROLL_CHARGES]: 'Folha — Encargos',
  [AccountingEntryType.VACATION_PROVISION]: 'Provisão Férias',
  [AccountingEntryType.THIRTEENTH_PROVISION]: 'Provisão 13º',
  [AccountingEntryType.TAX_LIABILITY]: 'Obrigações Tributárias',
  [AccountingEntryType.SALARY_REVERSAL]: 'Estorno de Salário',
};

export const ENTRY_TYPE_BADGE_COLORS: Record<AccountingEntryType, { bg: string; text: string }> = {
  [AccountingEntryType.PAYROLL_SALARY]: {
    bg: 'var(--color-primary-100, #C8E6C9)',
    text: 'var(--color-primary-700, #388E3C)',
  },
  [AccountingEntryType.PAYROLL_CHARGES]: {
    bg: 'var(--color-sky-100, #E1F5FE)',
    text: 'var(--color-sky-500, #0288D1)',
  },
  [AccountingEntryType.VACATION_PROVISION]: {
    bg: 'var(--color-sun-100, #FFF9C4)',
    text: 'var(--color-sun-500, #F9A825)',
  },
  [AccountingEntryType.THIRTEENTH_PROVISION]: {
    bg: 'var(--color-earth-100, #EFEBE9)',
    text: 'var(--color-earth-500, #8D6E63)',
  },
  [AccountingEntryType.TAX_LIABILITY]: {
    bg: 'var(--color-error-100, #FFCDD2)',
    text: 'var(--color-error-500, #C62828)',
  },
  [AccountingEntryType.SALARY_REVERSAL]: {
    bg: 'var(--color-neutral-100, #F5F3EF)',
    text: 'var(--color-neutral-600, #736D67)',
  },
};
