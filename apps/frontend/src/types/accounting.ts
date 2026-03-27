// ─── Enums ─────────────────────────────────────────────────────────────────

export type AccountType = 'ATIVO' | 'PASSIVO' | 'PL' | 'RECEITA' | 'DESPESA';
export type AccountNature = 'DEVEDORA' | 'CREDORA';
export type PeriodStatus = 'OPEN' | 'CLOSED' | 'BLOCKED';

// ─── Chart of Accounts ──────────────────────────────────────────────────────

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  accountType: AccountType;
  nature: AccountNature;
  isSynthetic: boolean;
  allowManualEntry: boolean;
  isActive: boolean;
  isFairValueAdj: boolean;
  spedRefCode: string | null;
  children?: ChartOfAccount[];
}

export interface CreateAccountInput {
  code: string;
  name: string;
  parentId?: string;
  accountType: AccountType;
  nature: AccountNature;
  isSynthetic?: boolean;
  allowManualEntry?: boolean;
  isFairValueAdj?: boolean;
  spedRefCode?: string;
}

export interface UpdateAccountInput {
  code?: string;
  name?: string;
  parentId?: string;
  accountType?: AccountType;
  nature?: AccountNature;
  isSynthetic?: boolean;
  allowManualEntry?: boolean;
  isFairValueAdj?: boolean;
  spedRefCode?: string;
  isActive?: boolean;
}

// ─── Fiscal Periods ─────────────────────────────────────────────────────────

export interface AccountingPeriod {
  id: string;
  month: number;
  year: number;
  status: PeriodStatus;
  closedAt?: string | null;
  closedBy?: string | null;
  reopenedAt?: string | null;
  reopenedBy?: string | null;
  reopenReason?: string | null;
}

export interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  periods: AccountingPeriod[];
}

export interface CreateFiscalYearInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface SeedResult {
  created: number;
  updated: number;
}
