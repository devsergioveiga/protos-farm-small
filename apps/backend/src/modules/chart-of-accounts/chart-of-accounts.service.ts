// ─── Chart of Accounts Service ────────────────────────────────────────────────
// COA-01: CRUD with recursive tree query using WITH RECURSIVE CTE
// COA-02: Rural CFC/Embrapa template seed (idempotent upsert)
// COA-03: SPED L300R unmapped report
//
// Key design decisions:
// - getAccountTree uses prisma.$queryRaw WITH RECURSIVE for correct ordering
// - isSynthetic=true forces allowManualEntry=false (business rule enforced here)
// - level computed from code.split('.').length — must be <= 5
// - deactivation blocked when active children or AccountBalance rows exist

import { prisma } from '../../database/prisma';
import {
  ChartOfAccountError,
  type CreateAccountInput,
  type UpdateAccountInput,
  type ChartOfAccountOutput,
  type ChartOfAccountNode,
  type SeedResult,
} from './chart-of-accounts.types';
import { RURAL_COA_TEMPLATE } from './coa-rural-template';
import { seedAccountingRules } from '../auto-posting/auto-posting.service';
import type { AccountType, AccountNature } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ──────────────────────────────────────────────────────────

function toOutput(row: any): ChartOfAccountOutput {
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    parentId: (row.parentId as string | null) ?? null,
    code: row.code as string,
    name: row.name as string,
    accountType: row.accountType as AccountType,
    nature: row.nature as AccountNature,
    isSynthetic: Boolean(row.isSynthetic),
    allowManualEntry: Boolean(row.allowManualEntry),
    isActive: Boolean(row.isActive),
    isFairValueAdj: Boolean(row.isFairValueAdj),
    spedRefCode: (row.spedRefCode as string | null) ?? null,
    level: Number(row.level),
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toNode(row: any): ChartOfAccountNode {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    parentId: (row.parentId as string | null) ?? null,
    level: Number(row.level),
    accountType: row.accountType as AccountType,
    nature: row.nature as AccountNature,
    isSynthetic: Boolean(row.isSynthetic),
    allowManualEntry: Boolean(row.allowManualEntry),
    isActive: Boolean(row.isActive),
    isFairValueAdj: Boolean(row.isFairValueAdj),
    spedRefCode: (row.spedRefCode as string | null) ?? null,
  };
}

// ─── getAccountTree ────────────────────────────────────────────────────
// Returns flat array ordered by code — frontend builds tree from parentId.
// Uses WITH RECURSIVE CTE to fetch the entire hierarchy in one query.

export async function getAccountTree(
  organizationId: string,
): Promise<ChartOfAccountNode[]> {
  const rows = await (prisma as any).$queryRaw`
    WITH RECURSIVE coa_tree AS (
      -- Base case: root accounts (no parent)
      SELECT
        id, "organizationId", "parentId", code, name,
        "accountType", nature, "isSynthetic", "allowManualEntry",
        "isActive", "isFairValueAdj", "spedRefCode", level,
        "createdAt", "updatedAt"
      FROM chart_of_accounts
      WHERE "organizationId" = ${organizationId}
        AND "parentId" IS NULL

      UNION ALL

      -- Recursive case: children
      SELECT
        c.id, c."organizationId", c."parentId", c.code, c.name,
        c."accountType", c.nature, c."isSynthetic", c."allowManualEntry",
        c."isActive", c."isFairValueAdj", c."spedRefCode", c.level,
        c."createdAt", c."updatedAt"
      FROM chart_of_accounts c
      INNER JOIN coa_tree p ON c."parentId" = p.id
      WHERE c."organizationId" = ${organizationId}
    )
    SELECT * FROM coa_tree
    ORDER BY code
  `;

  return (rows as any[]).map(toNode);
}

// ─── getAccountById ────────────────────────────────────────────────────

export async function getAccountById(
  organizationId: string,
  id: string,
): Promise<ChartOfAccountOutput> {
  const row = await (prisma as any).chartOfAccount.findFirst({
    where: { id, organizationId },
  });

  if (!row) {
    throw new ChartOfAccountError('Conta não encontrada', 'ACCOUNT_NOT_FOUND', 404);
  }

  return toOutput(row);
}

// ─── createAccount ─────────────────────────────────────────────────────

export async function createAccount(
  organizationId: string,
  input: CreateAccountInput,
): Promise<ChartOfAccountOutput> {
  // Compute level from code
  const level = input.code.split('.').length;

  if (level > 5) {
    throw new ChartOfAccountError(
      'Nível máximo de profundidade é 5',
      'MAX_DEPTH_EXCEEDED',
      422,
    );
  }

  // Enforce: synthetic accounts cannot allow manual entry
  const isSynthetic = input.isSynthetic ?? false;
  const allowManualEntry = isSynthetic ? false : (input.allowManualEntry ?? true);

  if (input.isSynthetic === true && input.allowManualEntry === true) {
    // We set it to false silently per plan spec — no error thrown, just forced
    // (plan says "service forces allowManualEntry = false")
  }

  // Validate parent if provided
  let parentLevel: number | null = null;
  if (input.parentId) {
    const parent = await (prisma as any).chartOfAccount.findFirst({
      where: { id: input.parentId, organizationId },
      select: { id: true, level: true },
    });

    if (!parent) {
      throw new ChartOfAccountError(
        'Conta pai não encontrada',
        'PARENT_NOT_FOUND',
        404,
      );
    }
    parentLevel = Number(parent.level);

    // Level must be parent.level + 1
    if (level !== parentLevel + 1) {
      throw new ChartOfAccountError(
        `Nível da conta (${level}) deve ser o nível da conta pai (${parentLevel}) + 1`,
        'MAX_DEPTH_EXCEEDED',
        422,
      );
    }
  }

  try {
    const row = await (prisma as any).chartOfAccount.create({
      data: {
        organizationId,
        parentId: input.parentId ?? null,
        code: input.code,
        name: input.name,
        accountType: input.accountType,
        nature: input.nature,
        isSynthetic,
        allowManualEntry,
        isActive: true,
        isFairValueAdj: input.isFairValueAdj ?? false,
        spedRefCode: input.spedRefCode ?? null,
        level,
      },
    });

    return toOutput(row);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new ChartOfAccountError(
        `Código de conta '${input.code}' já existe nesta organização`,
        'DUPLICATE_CODE',
        409,
      );
    }
    throw err;
  }
}

// ─── updateAccount ─────────────────────────────────────────────────────

export async function updateAccount(
  organizationId: string,
  id: string,
  input: UpdateAccountInput,
): Promise<ChartOfAccountOutput> {
  const account = await (prisma as any).chartOfAccount.findFirst({
    where: { id, organizationId },
  });

  if (!account) {
    throw new ChartOfAccountError('Conta não encontrada', 'ACCOUNT_NOT_FOUND', 404);
  }

  // If deactivating, check no active children
  if (input.isActive === false) {
    const activeChildren = await (prisma as any).chartOfAccount.count({
      where: { parentId: id, organizationId, isActive: true },
    });

    if (activeChildren > 0) {
      throw new ChartOfAccountError(
        'Não é possível desativar uma conta com subcontas ativas',
        'HAS_CHILDREN',
        409,
      );
    }
  }

  // Enforce synthetic blocks manual entry
  const isSynthetic = input.isSynthetic !== undefined
    ? input.isSynthetic
    : Boolean(account.isSynthetic);

  const allowManualEntry = isSynthetic
    ? false
    : (input.allowManualEntry !== undefined
        ? input.allowManualEntry
        : Boolean(account.allowManualEntry));

  try {
    const updated = await (prisma as any).chartOfAccount.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.accountType !== undefined && { accountType: input.accountType }),
        ...(input.nature !== undefined && { nature: input.nature }),
        ...(input.isSynthetic !== undefined && { isSynthetic }),
        ...(input.allowManualEntry !== undefined || input.isSynthetic !== undefined
          ? { allowManualEntry }
          : {}),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.isFairValueAdj !== undefined && { isFairValueAdj: input.isFairValueAdj }),
        ...(input.spedRefCode !== undefined && { spedRefCode: input.spedRefCode }),
      },
    });

    return toOutput(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new ChartOfAccountError(
        `Código de conta já existe nesta organização`,
        'DUPLICATE_CODE',
        409,
      );
    }
    throw err;
  }
}

// ─── deactivateAccount ─────────────────────────────────────────────────
// Soft-delete: sets isActive = false.
// Blocked if account has active children or AccountBalance rows.

export async function deactivateAccount(
  organizationId: string,
  id: string,
): Promise<ChartOfAccountOutput> {
  const account = await (prisma as any).chartOfAccount.findFirst({
    where: { id, organizationId },
  });

  if (!account) {
    throw new ChartOfAccountError('Conta não encontrada', 'ACCOUNT_NOT_FOUND', 404);
  }

  // Check active children
  const activeChildren = await (prisma as any).chartOfAccount.count({
    where: { parentId: id, organizationId, isActive: true },
  });

  if (activeChildren > 0) {
    throw new ChartOfAccountError(
      'Não é possível desativar uma conta com subcontas ativas',
      'HAS_CHILDREN',
      409,
    );
  }

  // Check AccountBalance rows
  const balanceCount = await (prisma as any).accountBalance.count({
    where: { accountId: id, organizationId },
  });

  if (balanceCount > 0) {
    throw new ChartOfAccountError(
      'Não é possível desativar uma conta com saldos registrados',
      'HAS_BALANCES',
      409,
    );
  }

  const updated = await (prisma as any).chartOfAccount.update({
    where: { id },
    data: { isActive: false },
  });

  return toOutput(updated);
}

// ─── getUnmappedSpedAccounts ───────────────────────────────────────────
// Returns analytic (non-synthetic) active accounts without SPED L300R mapping.

export async function getUnmappedSpedAccounts(
  organizationId: string,
): Promise<ChartOfAccountOutput[]> {
  const rows = await (prisma as any).chartOfAccount.findMany({
    where: {
      organizationId,
      isSynthetic: false,
      isActive: true,
      spedRefCode: null,
    },
    orderBy: { code: 'asc' },
  });

  return rows.map(toOutput);
}

// ─── seedRuralTemplate ─────────────────────────────────────────────────
// Loads the rural CFC/Embrapa template into the organization's chart of accounts.
// Idempotent: safe to run multiple times (upsert by org+code).

export async function seedRuralTemplate(
  organizationId: string,
): Promise<SeedResult> {
  // Process in level order to ensure parents exist before children
  const byLevel = [...RURAL_COA_TEMPLATE].sort((a, b) => a.level - b.level);

  // Build map of code → id for resolving parentCode → parentId
  const codeToId = new Map<string, string>();

  let created = 0;
  let updated = 0;

  for (const def of byLevel) {
    const isSynthetic = def.isSynthetic;
    const allowManualEntry = isSynthetic ? false : (def.allowManualEntry ?? true);

    // Resolve parentCode to parentId
    let parentId: string | null = null;
    if (def.parentCode) {
      parentId = codeToId.get(def.parentCode) ?? null;
    }

    const result = await (prisma as any).chartOfAccount.upsert({
      where: {
        organizationId_code: {
          organizationId,
          code: def.code,
        },
      },
      update: {
        name: def.name,
        accountType: def.accountType,
        nature: def.nature,
        isSynthetic,
        allowManualEntry,
        level: def.level,
        spedRefCode: def.spedRefCode ?? null,
        isFairValueAdj: def.isFairValueAdj ?? false,
        ...(parentId !== null && { parentId }),
      },
      create: {
        organizationId,
        parentId,
        code: def.code,
        name: def.name,
        accountType: def.accountType,
        nature: def.nature,
        isSynthetic,
        allowManualEntry,
        isActive: true,
        isFairValueAdj: def.isFairValueAdj ?? false,
        spedRefCode: def.spedRefCode ?? null,
        level: def.level,
      },
      select: {
        id: true,
        // Prisma upsert doesn't directly tell us if it created or updated,
        // we use createdAt/updatedAt timestamps to differentiate
        createdAt: true,
        updatedAt: true,
      },
    });

    codeToId.set(def.code, result.id as string);

    // Heuristic: if createdAt ≈ updatedAt (within 1 second), it was just created
    const wasCreated =
      Math.abs(
        (result.createdAt as Date).getTime() - (result.updatedAt as Date).getTime(),
      ) < 1000;

    if (wasCreated) {
      created++;
    } else {
      updated++;
    }
  }

  // Seed default AccountingRules alongside the COA template (per D-02/D-13 — LANC-02)
  // seedAccountingRules resolves accounts by code prefix — silently skips missing accounts
  await seedAccountingRules(organizationId);

  return { created, updated };
}
