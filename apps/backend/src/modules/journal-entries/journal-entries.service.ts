// ─── Journal Entries Service ──────────────────────────────────────────────────
// Core double-entry bookkeeping posting engine.
// Handles: draft creation, posting (atomic with AccountBalance update),
// reversal, templates, CSV import (LANC-03).

import { prisma } from '../../database/prisma';
import {
  assertBalanced,
  assertPeriodOpen,
  UnbalancedEntryError,
  PeriodNotOpenError,
} from '@protos-farm/shared';
import type {
  CreateJournalEntryInput,
  SaveTemplateInput,
  JournalEntryOutput,
  CsvImportPreview,
  ListEntriesFilters,
} from './journal-entries.types';
import { JournalEntryError } from './journal-entries.types';
import type { JournalEntryStatus, JournalEntryType } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────

const LINE_SELECT = {
  id: true,
  accountId: true,
  side: true,
  amount: true,
  description: true,
  costCenterId: true,
  lineOrder: true,
  account: {
    select: { code: true, name: true, nature: true },
  },
} as const;

const ENTRY_SELECT = {
  id: true,
  entryNumber: true,
  entryDate: true,
  periodId: true,
  description: true,
  entryType: true,
  status: true,
  reversedById: true,
  reversalOf: true,
  reversalReason: true,
  templateName: true,
  costCenterId: true,
  createdBy: true,
  postedAt: true,
  createdAt: true,
  lines: { select: LINE_SELECT, orderBy: { lineOrder: 'asc' as const } },
} as const;

function formatEntry(entry: {
  id: string;
  entryNumber: number;
  entryDate: Date;
  periodId: string;
  description: string;
  entryType: JournalEntryType;
  status: JournalEntryStatus;
  reversedById: string | null;
  reversalOf: string | null;
  reversalReason: string | null;
  templateName: string | null;
  costCenterId: string | null;
  createdBy: string;
  postedAt: Date | null;
  createdAt: Date;
  lines: Array<{
    id: string;
    accountId: string;
    side: string;
    amount: { toString(): string };
    description: string | null;
    costCenterId: string | null;
    lineOrder: number;
    account: { code: string; name: string; nature: string };
  }>;
}): JournalEntryOutput {
  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    entryDate: entry.entryDate.toISOString().slice(0, 10),
    periodId: entry.periodId,
    description: entry.description,
    entryType: entry.entryType,
    status: entry.status,
    reversedById: entry.reversedById,
    reversalOf: entry.reversalOf,
    reversalReason: entry.reversalReason,
    templateName: entry.templateName,
    costCenterId: entry.costCenterId,
    createdBy: entry.createdBy,
    postedAt: entry.postedAt ? entry.postedAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
    lines: entry.lines.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      side: l.side,
      amount: l.amount.toString(),
      description: l.description,
      costCenterId: l.costCenterId,
      lineOrder: l.lineOrder,
      account: l.account,
    })),
  };
}

// ─── Account validation helper ────────────────────────────────────────

async function validateAccountsForManualEntry(
  organizationId: string,
  accountIds: string[],
): Promise<void> {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { id: { in: accountIds }, organizationId },
    select: { id: true, isActive: true, isSynthetic: true, allowManualEntry: true },
  });

  // Check all accounts were found
  const foundIds = new Set(accounts.map((a) => a.id));
  for (const accountId of accountIds) {
    if (!foundIds.has(accountId)) {
      throw new JournalEntryError(`Conta não encontrada: ${accountId}`, 'ACCOUNT_NOT_FOUND', 404);
    }
  }

  for (const account of accounts) {
    if (!account.isActive) {
      throw new JournalEntryError('Conta inativa não pode receber lançamentos', 'ACCOUNT_INACTIVE');
    }
    if (account.isSynthetic) {
      throw new JournalEntryError(
        'Conta sintética não permite lançamentos diretos',
        'SYNTHETIC_ACCOUNT',
      );
    }
    if (!account.allowManualEntry) {
      throw new JournalEntryError('Conta não permite lançamento manual', 'MANUAL_ENTRY_DISALLOWED');
    }
  }
}

// ─── createJournalEntryDraft ──────────────────────────────────────────

export async function createJournalEntryDraft(
  organizationId: string,
  input: CreateJournalEntryInput,
  createdBy: string,
): Promise<JournalEntryOutput> {
  // Validate accounts
  const accountIds = input.lines.map((l) => l.accountId);
  await validateAccountsForManualEntry(organizationId, accountIds);

  // Assert balanced
  assertBalanced(input.lines.map((l) => ({ side: l.side, amount: l.amount })));

  // Assert period open
  const period = await prisma.accountingPeriod.findFirst({
    where: { id: input.periodId, organizationId },
    select: { id: true, month: true, year: true, status: true },
  });
  if (!period) {
    throw new JournalEntryError('Período contábil não encontrado', 'PERIOD_NOT_FOUND', 404);
  }
  assertPeriodOpen(period);

  const entry = await prisma.journalEntry.create({
    data: {
      organizationId,
      entryNumber: 0,
      entryDate: new Date(input.entryDate),
      periodId: input.periodId,
      description: input.description,
      entryType: 'MANUAL' as const,
      status: 'DRAFT' as const,
      costCenterId: input.costCenterId ?? null,
      createdBy,
      lines: {
        create: input.lines.map((l, idx) => ({
          accountId: l.accountId,
          side: l.side,
          amount: l.amount,
          description: l.description ?? null,
          costCenterId: l.costCenterId ?? null,
          lineOrder: idx + 1,
        })),
      },
    },
    select: ENTRY_SELECT,
  });

  return formatEntry(entry);
}

// ─── postJournalEntry ─────────────────────────────────────────────────

export async function postJournalEntry(
  organizationId: string,
  entryId: string,
  postedBy: string,
): Promise<JournalEntryOutput> {
  return prisma.$transaction(
    async (tx) => {
      // Fetch entry with lines + period
      const entry = await tx.journalEntry.findFirst({
        where: { id: entryId, organizationId },
        include: {
          lines: {
            select: {
              id: true,
              accountId: true,
              side: true,
              amount: true,
              description: true,
              costCenterId: true,
              lineOrder: true,
            },
          },
          period: {
            select: { id: true, month: true, year: true, status: true, fiscalYearId: true },
          },
        },
      });

      if (!entry) {
        throw new JournalEntryError('Lançamento não encontrado', 'NOT_FOUND', 404);
      }
      if (entry.status === 'POSTED') {
        throw new JournalEntryError('Lançamento já foi contabilizado', 'ALREADY_POSTED', 409);
      }
      if (entry.status === 'REVERSED') {
        throw new JournalEntryError('Lançamento já foi estornado', 'ALREADY_REVERSED', 409);
      }

      assertPeriodOpen(entry.period);
      assertBalanced(
        entry.lines.map((l) => ({
          side: l.side as 'DEBIT' | 'CREDIT',
          amount: l.amount.toString(),
        })),
      );

      // Assign sequential entry number (within org)
      const agg = await tx.journalEntry.aggregate({
        where: { organizationId, status: { in: ['POSTED', 'REVERSED'] } },
        _max: { entryNumber: true },
      });
      const nextNumber = (agg._max.entryNumber ?? 0) + 1;

      // Update AccountBalance for each line
      const period = entry.period;
      for (const line of entry.lines) {
        await tx.accountBalance.upsert({
          where: {
            organizationId_accountId_fiscalYearId_month: {
              organizationId,
              accountId: line.accountId,
              fiscalYearId: period.fiscalYearId,
              month: period.month,
            },
          },
          create: {
            organizationId,
            accountId: line.accountId,
            fiscalYearId: period.fiscalYearId,
            month: period.month,
            openingBalance: 0,
            debitTotal: line.side === 'DEBIT' ? line.amount : 0,
            creditTotal: line.side === 'CREDIT' ? line.amount : 0,
            closingBalance: 0,
          },
          update: {
            debitTotal: line.side === 'DEBIT' ? { increment: line.amount } : undefined,
            creditTotal: line.side === 'CREDIT' ? { increment: line.amount } : undefined,
          },
        });
      }

      // Recompute closingBalance for affected accounts using raw SQL
      const accountIds = [...new Set(entry.lines.map((l) => l.accountId))];
      await tx.$executeRaw`
        UPDATE account_balances ab
        SET "closingBalance" = ab."openingBalance" +
          CASE WHEN coa.nature = 'DEVEDORA' THEN ab."debitTotal" - ab."creditTotal"
               ELSE ab."creditTotal" - ab."debitTotal" END
        FROM chart_of_accounts coa
        WHERE coa.id = ab."accountId"
          AND ab."organizationId" = ${organizationId}
          AND ab."fiscalYearId" = ${period.fiscalYearId}
          AND ab.month = ${period.month}
          AND ab."accountId" = ANY(${accountIds}::text[])
      `;

      // Mark entry as POSTED
      const posted = await tx.journalEntry.update({
        where: { id: entryId },
        data: {
          status: 'POSTED' as const,
          entryNumber: nextNumber,
          postedAt: new Date(),
          updatedAt: new Date(),
        },
        select: ENTRY_SELECT,
      });

      void postedBy; // tracked via createdBy on entry
      return formatEntry(posted);
    },
    { isolationLevel: 'Serializable' },
  );
}

// ─── reverseJournalEntry ──────────────────────────────────────────────

export async function reverseJournalEntry(
  organizationId: string,
  entryId: string,
  reason: string,
  reversedBy: string,
): Promise<JournalEntryOutput> {
  if (!reason || !reason.trim()) {
    throw new JournalEntryError('Motivo do estorno é obrigatório', 'REASON_REQUIRED');
  }

  return prisma.$transaction(
    async (tx) => {
      const original = await tx.journalEntry.findFirst({
        where: { id: entryId, organizationId },
        include: {
          lines: {
            select: {
              accountId: true,
              side: true,
              amount: true,
              description: true,
              costCenterId: true,
              lineOrder: true,
            },
          },
          period: {
            select: { id: true, month: true, year: true, status: true, fiscalYearId: true },
          },
        },
      });

      if (!original) {
        throw new JournalEntryError('Lançamento não encontrado', 'NOT_FOUND', 404);
      }
      if (original.status === 'REVERSED') {
        throw new JournalEntryError('Lançamento já foi estornado', 'ALREADY_REVERSED', 409);
      }
      if (original.status !== 'POSTED') {
        throw new JournalEntryError(
          'Apenas lançamentos contabilizados podem ser estornados',
          'NOT_POSTED',
          422,
        );
      }

      assertPeriodOpen(original.period);

      // Create reversal entry as DRAFT first
      const reversalDraft = await tx.journalEntry.create({
        data: {
          organizationId,
          entryNumber: 0,
          entryDate: original.entryDate,
          periodId: original.periodId,
          description: `Estorno: ${original.description}`,
          entryType: 'REVERSAL' as const,
          status: 'DRAFT' as const,
          reversalOf: original.id,
          reversalReason: reason.trim(),
          costCenterId: original.costCenterId,
          createdBy: reversedBy,
          // Invert sides
          lines: {
            create: original.lines.map((l) => ({
              accountId: l.accountId,
              side: (l.side === 'DEBIT' ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT',
              amount: l.amount,
              description: l.description,
              costCenterId: l.costCenterId,
              lineOrder: l.lineOrder,
            })),
          },
        },
        select: { id: true },
      });

      // Mark original as REVERSED
      await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: 'REVERSED' as const,
          reversedById: reversalDraft.id,
          updatedAt: new Date(),
        },
      });

      // Post the reversal entry (reuse posting logic inline)
      const agg = await tx.journalEntry.aggregate({
        where: { organizationId, status: { in: ['POSTED', 'REVERSED'] } },
        _max: { entryNumber: true },
      });
      const nextNumber = (agg._max.entryNumber ?? 0) + 1;

      const period = original.period;

      // Update balances for reversal lines (inverted)
      for (const line of original.lines) {
        const reversalSide = line.side === 'DEBIT' ? 'CREDIT' : 'DEBIT';
        await tx.accountBalance.upsert({
          where: {
            organizationId_accountId_fiscalYearId_month: {
              organizationId,
              accountId: line.accountId,
              fiscalYearId: period.fiscalYearId,
              month: period.month,
            },
          },
          create: {
            organizationId,
            accountId: line.accountId,
            fiscalYearId: period.fiscalYearId,
            month: period.month,
            openingBalance: 0,
            debitTotal: reversalSide === 'DEBIT' ? line.amount : 0,
            creditTotal: reversalSide === 'CREDIT' ? line.amount : 0,
            closingBalance: 0,
          },
          update: {
            debitTotal: reversalSide === 'DEBIT' ? { increment: line.amount } : undefined,
            creditTotal: reversalSide === 'CREDIT' ? { increment: line.amount } : undefined,
          },
        });
      }

      // Recompute closing balances
      const accountIds = [...new Set(original.lines.map((l) => l.accountId))];
      await tx.$executeRaw`
        UPDATE account_balances ab
        SET "closingBalance" = ab."openingBalance" +
          CASE WHEN coa.nature = 'DEVEDORA' THEN ab."debitTotal" - ab."creditTotal"
               ELSE ab."creditTotal" - ab."debitTotal" END
        FROM chart_of_accounts coa
        WHERE coa.id = ab."accountId"
          AND ab."organizationId" = ${organizationId}
          AND ab."fiscalYearId" = ${period.fiscalYearId}
          AND ab.month = ${period.month}
          AND ab."accountId" = ANY(${accountIds}::text[])
      `;

      // Mark reversal as POSTED
      const reversalPosted = await tx.journalEntry.update({
        where: { id: reversalDraft.id },
        data: {
          status: 'POSTED' as const,
          entryNumber: nextNumber,
          postedAt: new Date(),
          updatedAt: new Date(),
        },
        select: ENTRY_SELECT,
      });

      return formatEntry(reversalPosted);
    },
    { isolationLevel: 'Serializable' },
  );
}

// ─── saveTemplate ─────────────────────────────────────────────────────

export async function saveTemplate(
  organizationId: string,
  input: SaveTemplateInput,
  createdBy: string,
): Promise<JournalEntryOutput> {
  // Validate accounts but allow non-manual-entry accounts in templates
  // (templates may be used for automated flows)
  const period = await prisma.accountingPeriod.findFirst({
    where: { id: input.periodId, organizationId },
    select: { id: true, month: true, year: true, status: true },
  });
  if (!period) {
    throw new JournalEntryError('Período contábil não encontrado', 'PERIOD_NOT_FOUND', 404);
  }

  assertBalanced(input.lines.map((l) => ({ side: l.side, amount: l.amount })));

  const entry = await prisma.journalEntry.create({
    data: {
      organizationId,
      entryNumber: 0,
      entryDate: new Date(input.entryDate),
      periodId: input.periodId,
      description: input.description,
      entryType: 'MANUAL' as const,
      status: 'DRAFT' as const,
      templateName: input.templateName,
      costCenterId: input.costCenterId ?? null,
      createdBy,
      lines: {
        create: input.lines.map((l, idx) => ({
          accountId: l.accountId,
          side: l.side,
          amount: l.amount,
          description: l.description ?? null,
          costCenterId: l.costCenterId ?? null,
          lineOrder: idx + 1,
        })),
      },
    },
    select: ENTRY_SELECT,
  });

  return formatEntry(entry);
}

// ─── listTemplates ────────────────────────────────────────────────────

export async function listTemplates(organizationId: string): Promise<JournalEntryOutput[]> {
  const templates = await prisma.journalEntry.findMany({
    where: { organizationId, templateName: { not: null } },
    select: ENTRY_SELECT,
    orderBy: { templateName: 'asc' },
  });
  return templates.map(formatEntry);
}

// ─── deleteTemplate ───────────────────────────────────────────────────

export async function deleteTemplate(organizationId: string, templateId: string): Promise<void> {
  const template = await prisma.journalEntry.findFirst({
    where: { id: templateId, organizationId, templateName: { not: null } },
    select: { id: true },
  });
  if (!template) {
    throw new JournalEntryError('Template não encontrado', 'NOT_FOUND', 404);
  }
  await prisma.journalEntry.delete({ where: { id: templateId } });
}

// ─── deleteDraft ──────────────────────────────────────────────────────

export async function deleteDraft(organizationId: string, entryId: string): Promise<void> {
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, organizationId },
    select: { id: true, status: true, templateName: true },
  });
  if (!entry) {
    throw new JournalEntryError('Lançamento não encontrado', 'NOT_FOUND', 404);
  }
  if (entry.status === 'POSTED') {
    throw new JournalEntryError(
      'Lançamentos contabilizados não podem ser excluídos',
      'CANNOT_DELETE_POSTED',
    );
  }
  if (entry.status === 'REVERSED') {
    throw new JournalEntryError(
      'Lançamentos estornados não podem ser excluídos',
      'CANNOT_DELETE_REVERSED',
    );
  }
  if (entry.templateName !== null) {
    throw new JournalEntryError('Use deleteTemplate para remover templates', 'USE_DELETE_TEMPLATE');
  }
  await prisma.journalEntry.delete({ where: { id: entryId } });
}

// ─── listEntries ──────────────────────────────────────────────────────

export async function listEntries(
  organizationId: string,
  filters: ListEntriesFilters,
): Promise<{ data: JournalEntryOutput[]; total: number }> {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where = {
    organizationId,
    ...(filters.periodId ? { periodId: filters.periodId } : {}),
    ...(filters.status ? { status: filters.status as JournalEntryStatus } : {}),
    ...(filters.entryType ? { entryType: filters.entryType as JournalEntryType } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          entryDate: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
          },
        }
      : {}),
    templateName: null, // Exclude templates from regular list
  };

  const [entries, total] = await prisma.$transaction([
    prisma.journalEntry.findMany({
      where,
      select: ENTRY_SELECT,
      orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.journalEntry.count({ where }),
  ]);

  return { data: entries.map(formatEntry), total };
}

// ─── getEntry ─────────────────────────────────────────────────────────

export async function getEntry(
  organizationId: string,
  entryId: string,
): Promise<JournalEntryOutput | null> {
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, organizationId },
    select: ENTRY_SELECT,
  });
  if (!entry) return null;
  return formatEntry(entry);
}

// ─── importCsvJournalEntries (LANC-03) ────────────────────────────────

export async function importCsvJournalEntries(
  organizationId: string,
  csvBuffer: Buffer,
): Promise<CsvImportPreview> {
  const content = csvBuffer.toString('utf-8').trim();

  if (!content) {
    throw new JournalEntryError('Arquivo CSV vazio', 'EMPTY_CSV');
  }

  // Split lines, handle \r\n
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length <= 1) {
    throw new JournalEntryError('Arquivo CSV vazio', 'EMPTY_CSV');
  }

  // Detect separator
  const firstLine = lines[0];
  let sep = ',';
  if (firstLine.includes(';')) sep = ';';
  else if (firstLine.includes('\t')) sep = '\t';

  // Parse headers
  const headers = firstLine.split(sep).map((h) => h.trim().toLowerCase());
  const colIdx = (name: string) => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? idx : -1;
  };

  const entryDateCol = colIdx('entrydate');
  const periodIdCol = colIdx('periodid');
  const descriptionCol = colIdx('description');
  const accountCodeCol = colIdx('accountcode');
  const sideCol = colIdx('side');
  const amountCol = colIdx('amount');
  const costCenterIdCol = colIdx('costcenterid');

  // Validate required headers
  if (
    entryDateCol < 0 ||
    periodIdCol < 0 ||
    descriptionCol < 0 ||
    accountCodeCol < 0 ||
    sideCol < 0 ||
    amountCol < 0
  ) {
    throw new JournalEntryError(
      'CSV deve conter colunas: entryDate, periodId, description, accountCode, side, amount',
      'INVALID_HEADERS',
    );
  }

  // Preload account codes for org
  const allCodes = await prisma.chartOfAccount.findMany({
    where: { organizationId },
    select: { id: true, code: true },
  });
  const codeToId = new Map(allCodes.map((a) => [a.code, a.id]));

  type RowParsed = {
    rowNumber: number;
    entryDate: string;
    periodId: string;
    description: string;
    accountId: string;
    side: 'DEBIT' | 'CREDIT';
    amount: string;
    costCenterId?: string;
  };

  const validRows: RowParsed[] = [];
  const errors: Array<{ rowNumber: number; field: string; reason: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cols = lines[i].split(sep).map((c) => c.trim());

    const entryDate = cols[entryDateCol] ?? '';
    const periodId = cols[periodIdCol] ?? '';
    const description = cols[descriptionCol] ?? '';
    const accountCode = cols[accountCodeCol] ?? '';
    const rawSide = (cols[sideCol] ?? '').toUpperCase().trim();
    const amount = cols[amountCol] ?? '';
    const costCenterId =
      costCenterIdCol >= 0 && cols[costCenterIdCol] ? cols[costCenterIdCol] : undefined;

    // Normalize side
    let side: 'DEBIT' | 'CREDIT';
    if (['DEBIT', 'D', 'DEBITO', 'DÉ BIT'].includes(rawSide)) {
      side = 'DEBIT';
    } else if (['CREDIT', 'C', 'CREDITO', 'CRÉDITO'].includes(rawSide)) {
      side = 'CREDIT';
    } else {
      errors.push({ rowNumber, field: 'side', reason: 'INVALID_SIDE' });
      continue;
    }

    // Lookup account code
    const accountId = codeToId.get(accountCode);
    if (!accountId) {
      errors.push({ rowNumber, field: 'accountCode', reason: 'ACCOUNT_NOT_FOUND' });
      continue;
    }

    validRows.push({
      rowNumber,
      entryDate,
      periodId,
      description,
      accountId,
      side,
      amount,
      costCenterId,
    });
  }

  // Group valid rows by entryDate + description (natural grouping key)
  type GroupKey = string;
  const groups = new Map<
    GroupKey,
    {
      entryDate: string;
      periodId: string;
      description: string;
      costCenterId?: string;
      rows: RowParsed[];
    }
  >();

  for (const row of validRows) {
    const key = `${row.entryDate}||${row.description}`;
    if (!groups.has(key)) {
      groups.set(key, {
        entryDate: row.entryDate,
        periodId: row.periodId,
        description: row.description,
        costCenterId: row.costCenterId,
        rows: [],
      });
    }
    groups.get(key)!.rows.push(row);
  }

  // Validate each group is balanced
  const entries: import('./journal-entries.types').CreateJournalEntryInput[] = [];

  for (const group of groups.values()) {
    try {
      assertBalanced(group.rows.map((r) => ({ side: r.side, amount: r.amount })));
      entries.push({
        entryDate: group.entryDate,
        periodId: group.periodId,
        description: group.description,
        costCenterId: group.costCenterId,
        lines: group.rows.map((r) => ({
          accountId: r.accountId,
          side: r.side,
          amount: r.amount,
          costCenterId: r.costCenterId,
        })),
      });
    } catch (err) {
      if (err instanceof UnbalancedEntryError) {
        // Add all rows of this group to errors
        for (const row of group.rows) {
          errors.push({ rowNumber: row.rowNumber, field: 'lines', reason: 'UNBALANCED' });
        }
      } else {
        throw err;
      }
    }
  }

  return {
    entries,
    errors,
    totalEntries: entries.length,
    totalErrors: errors.length,
  };
}

// Re-export error types for convenience
export { UnbalancedEntryError, PeriodNotOpenError };
