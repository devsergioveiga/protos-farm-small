// ─── Chart of Accounts Types ──────────────────────────────────────────────────
// COA-01/COA-02/COA-03: Hierarchical chart of accounts with CFC/Embrapa rural
// template and SPED L300R mapping for v1.4 contabilidade module.

import type { AccountType, AccountNature } from '@prisma/client';

// Re-export enums so callers import from types, not @prisma/client directly
export type { AccountType, AccountNature };

// ─── Error class ──────────────────────────────────────────────────────

export class ChartOfAccountError extends Error {
  constructor(
    message: string,
    public code: ChartOfAccountErrorCode,
    public statusCode = 400,
  ) {
    super(message);
    this.name = 'ChartOfAccountError';
  }
}

export type ChartOfAccountErrorCode =
  | 'DUPLICATE_CODE'
  | 'HAS_CHILDREN'
  | 'SYNTHETIC_MANUAL_ENTRY'
  | 'PARENT_NOT_FOUND'
  | 'MAX_DEPTH_EXCEEDED'
  | 'ACCOUNT_NOT_FOUND'
  | 'HAS_BALANCES'
  | 'CANNOT_CHANGE_TYPE';

// ─── Node types ────────────────────────────────────────────────────────

export interface ChartOfAccountNode {
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
  children?: ChartOfAccountNode[];
}

// ─── Input interfaces ──────────────────────────────────────────────────

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

export type UpdateAccountInput = Partial<CreateAccountInput> & {
  isActive?: boolean;
};

// ─── Output interfaces ─────────────────────────────────────────────────

export interface ChartOfAccountOutput {
  id: string;
  organizationId: string;
  parentId: string | null;
  code: string;
  name: string;
  accountType: AccountType;
  nature: AccountNature;
  isSynthetic: boolean;
  allowManualEntry: boolean;
  isActive: boolean;
  isFairValueAdj: boolean;
  spedRefCode: string | null;
  level: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Seed types ────────────────────────────────────────────────────────

export interface SeedAccountDef {
  code: string;
  name: string;
  accountType: AccountType;
  nature: AccountNature;
  isSynthetic: boolean;
  level: number;
  parentCode?: string;
  spedRefCode?: string;
  isFairValueAdj?: boolean;
  allowManualEntry?: boolean;
}

export interface SeedResult {
  created: number;
  updated: number;
}
