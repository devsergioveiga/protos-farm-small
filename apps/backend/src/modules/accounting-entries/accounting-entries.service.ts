// ─── Accounting Entries Service ───────────────────────────────────────────────
// INTEGR-02: Creates and manages canonical accounting entries.
//
// Key design decisions:
// - createPayrollEntries is ALWAYS called OUTSIDE and AFTER closeRun transaction
//   (non-blocking -- failure must not abort payroll close)
// - sourceType uses AccountingSourceType enum from @prisma/client (never plain string)
// - 5 entry types created at payroll close; SALARY_REVERSAL only on payment settling
// - Decimal.js used for all amount arithmetic

import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import { AccountingSourceType, AccountingEntryType } from '@prisma/client';
import {
  ACCOUNT_CODES,
  AccountingEntryError,
  type AccountingEntryOutput,
  type AccountingEntryListInput,
  type PaginatedAccountingEntriesOutput,
} from './accounting-entries.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ──────────────────────────────────────────────────────────

function toOutput(row: any): AccountingEntryOutput {
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    referenceMonth: (row.referenceMonth as Date).toISOString().slice(0, 10),
    entryType: row.entryType as AccountingEntryType,
    debitAccount: row.debitAccount as string,
    debitLabel: row.debitLabel as string,
    creditAccount: row.creditAccount as string,
    creditLabel: row.creditLabel as string,
    amount: new Decimal(row.amount.toString()).toNumber(),
    costCenterId: (row.costCenterId as string | null) ?? null,
    farmId: (row.farmId as string | null) ?? null,
    sourceType: row.sourceType as AccountingSourceType,
    sourceId: row.sourceId as string,
    reversedByEntryId: (row.reversedByEntryId as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// ─── createPayrollEntries ─────────────────────────────────────────────
// Creates 5 canonical accounting entries when a payroll run is closed.
// MUST be called OUTSIDE the closeRun transaction (non-blocking).

export async function createPayrollEntries(
  organizationId: string,
  runId: string,
): Promise<void> {
  // Load PayrollRun with items and employee farm links
  const run = await (prisma as any).payrollRun.findFirst({
    where: { id: runId, organizationId },
    select: {
      id: true,
      referenceMonth: true,
    },
  });

  if (!run) {
    throw new AccountingEntryError('Folha de pagamento não encontrada', 'RUN_NOT_FOUND', 404);
  }

  // Sum item-level values
  const items = await (prisma as any).payrollRunItem.findMany({
    where: { payrollRunId: runId },
    select: {
      grossSalary: true,
      inssPatronal: true,
      fgtsAmount: true,
      inssAmount: true,
      irrfAmount: true,
      employee: {
        select: {
          farms: {
            where: { status: 'ATIVO' },
            select: { farmId: true },
            orderBy: { startDate: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  let totalGrossSalary = new Decimal(0);
  let totalCharges = new Decimal(0); // inssPatronal + fgtsAmount
  let totalTaxLiability = new Decimal(0); // inssAmount + irrfAmount
  let farmId: string | null = null;

  for (const item of items) {
    totalGrossSalary = totalGrossSalary.plus(new Decimal(item.grossSalary.toString()));
    totalCharges = totalCharges
      .plus(new Decimal(item.inssPatronal.toString()))
      .plus(new Decimal(item.fgtsAmount.toString()));
    totalTaxLiability = totalTaxLiability
      .plus(new Decimal(item.inssAmount.toString()))
      .plus(new Decimal(item.irrfAmount.toString()));
    // Capture first farm from employee's active assignment
    if (!farmId && item.employee?.farms?.[0]?.farmId) {
      farmId = item.employee.farms[0].farmId as string;
    }
  }

  // Load PayrollProvisions for this referenceMonth (VACATION and THIRTEENTH types)
  const provisions = await (prisma as any).payrollProvision.findMany({
    where: {
      organizationId,
      referenceMonth: run.referenceMonth,
      provisionType: { in: ['VACATION', 'THIRTEENTH'] },
    },
    select: {
      provisionType: true,
      totalAmount: true,
      costCenterId: true,
      accountingEntryJson: true,
    },
  });

  // Aggregate provision totals by type
  let vacationTotal = new Decimal(0);
  let thirteenthTotal = new Decimal(0);

  for (const prov of provisions) {
    const amount = new Decimal(prov.totalAmount.toString());
    if ((prov.provisionType as string) === 'VACATION') {
      vacationTotal = vacationTotal.plus(amount);
    } else if ((prov.provisionType as string) === 'THIRTEENTH') {
      thirteenthTotal = thirteenthTotal.plus(amount);
    }
  }

  // Build entries array for batch insert
  const entries: Array<{
    organizationId: string;
    referenceMonth: Date;
    entryType: AccountingEntryType;
    debitAccount: string;
    debitLabel: string;
    creditAccount: string;
    creditLabel: string;
    amount: Decimal;
    costCenterId: string | null;
    farmId: string | null;
    sourceType: AccountingSourceType;
    sourceId: string;
    reversedByEntryId: null;
    notes: string | null;
  }> = [];

  const baseEntry = {
    organizationId,
    referenceMonth: run.referenceMonth,
    costCenterId: null as string | null,
    farmId,
    reversedByEntryId: null as null,
    notes: null as string | null,
  };

  // 1. PAYROLL_SALARY
  if (totalGrossSalary.greaterThan(0)) {
    const codes = ACCOUNT_CODES.PAYROLL_SALARY;
    entries.push({
      ...baseEntry,
      entryType: AccountingEntryType.PAYROLL_SALARY,
      debitAccount: codes.debit,
      debitLabel: codes.debitLabel,
      creditAccount: codes.credit,
      creditLabel: codes.creditLabel,
      amount: totalGrossSalary,
      sourceType: AccountingSourceType.PAYROLL_RUN,
      sourceId: runId,
    });
  }

  // 2. PAYROLL_CHARGES
  if (totalCharges.greaterThan(0)) {
    const codes = ACCOUNT_CODES.PAYROLL_CHARGES;
    entries.push({
      ...baseEntry,
      entryType: AccountingEntryType.PAYROLL_CHARGES,
      debitAccount: codes.debit,
      debitLabel: codes.debitLabel,
      creditAccount: codes.credit,
      creditLabel: codes.creditLabel,
      amount: totalCharges,
      sourceType: AccountingSourceType.PAYROLL_RUN,
      sourceId: runId,
    });
  }

  // 3. VACATION_PROVISION
  if (vacationTotal.greaterThan(0)) {
    const codes = ACCOUNT_CODES.VACATION_PROVISION;
    entries.push({
      ...baseEntry,
      entryType: AccountingEntryType.VACATION_PROVISION,
      debitAccount: codes.debit,
      debitLabel: codes.debitLabel,
      creditAccount: codes.credit,
      creditLabel: codes.creditLabel,
      amount: vacationTotal,
      sourceType: AccountingSourceType.PAYROLL_PROVISION,
      sourceId: runId,
    });
  }

  // 4. THIRTEENTH_PROVISION
  if (thirteenthTotal.greaterThan(0)) {
    const codes = ACCOUNT_CODES.THIRTEENTH_PROVISION;
    entries.push({
      ...baseEntry,
      entryType: AccountingEntryType.THIRTEENTH_PROVISION,
      debitAccount: codes.debit,
      debitLabel: codes.debitLabel,
      creditAccount: codes.credit,
      creditLabel: codes.creditLabel,
      amount: thirteenthTotal,
      sourceType: AccountingSourceType.PAYROLL_PROVISION,
      sourceId: runId,
    });
  }

  // 5. TAX_LIABILITY
  if (totalTaxLiability.greaterThan(0)) {
    const codes = ACCOUNT_CODES.TAX_LIABILITY;
    entries.push({
      ...baseEntry,
      entryType: AccountingEntryType.TAX_LIABILITY,
      debitAccount: codes.debit,
      debitLabel: codes.debitLabel,
      creditAccount: codes.credit,
      creditLabel: codes.creditLabel,
      amount: totalTaxLiability,
      sourceType: AccountingSourceType.PAYROLL_RUN,
      sourceId: runId,
    });
  }

  if (entries.length === 0) {
    return; // Nothing to record (all-zero run — unusual but valid)
  }

  // Batch insert all entries
  await (prisma as any).accountingEntry.createMany({
    data: entries.map((e) => ({
      ...e,
      amount: e.amount.toDecimalPlaces(2),
    })),
  });
}

// ─── createReversalEntry ──────────────────────────────────────────────
// Creates a SALARY_REVERSAL entry when a payroll-origin payable is settled.
// MUST be called AFTER settlePayment (non-blocking try/catch at call site).

export async function createReversalEntry(
  organizationId: string,
  payableId: string,
  amount: any, // Prisma Decimal or number
  farmId: string | null,
): Promise<void> {
  const codes = ACCOUNT_CODES.SALARY_REVERSAL;
  const amountDecimal = new Decimal(amount.toString()).toDecimalPlaces(2);

  await (prisma as any).accountingEntry.create({
    data: {
      organizationId,
      referenceMonth: new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
      ),
      entryType: AccountingEntryType.SALARY_REVERSAL,
      debitAccount: codes.debit,
      debitLabel: codes.debitLabel,
      creditAccount: codes.credit,
      creditLabel: codes.creditLabel,
      amount: amountDecimal,
      costCenterId: null,
      farmId: farmId ?? null,
      sourceType: AccountingSourceType.PAYABLE_SETTLEMENT,
      sourceId: payableId,
      reversedByEntryId: null,
      notes: null,
    },
  });
}

// ─── revertPayrollEntries ─────────────────────────────────────────────
// Deletes all AccountingEntry records linked to a payroll run.
// Called non-blocking from revertRun after the main revert transaction.

export async function revertPayrollEntries(
  organizationId: string,
  runId: string,
): Promise<void> {
  await (prisma as any).accountingEntry.deleteMany({
    where: {
      organizationId,
      sourceType: AccountingSourceType.PAYROLL_RUN,
      sourceId: runId,
    },
  });

  // Also delete PAYROLL_PROVISION entries linked to same runId
  await (prisma as any).accountingEntry.deleteMany({
    where: {
      organizationId,
      sourceType: AccountingSourceType.PAYROLL_PROVISION,
      sourceId: runId,
    },
  });
}

// ─── list ─────────────────────────────────────────────────────────────

export async function list(
  rls: RlsContext,
  filters: AccountingEntryListInput,
): Promise<PaginatedAccountingEntriesOutput> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: any = { organizationId: rls.organizationId };

  if (filters.referenceMonth) {
    const [year, month] = filters.referenceMonth.split('-').map(Number);
    where.referenceMonth = new Date(Date.UTC(year, month - 1, 1));
  }

  if (filters.farmId) {
    where.farmId = filters.farmId;
  }

  if (filters.entryType) {
    where.entryType = filters.entryType;
  }

  const [rows, total] = await Promise.all([
    (prisma as any).accountingEntry.findMany({
      where,
      orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    (prisma as any).accountingEntry.count({ where }),
  ]);

  return {
    data: rows.map(toOutput),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── getById ──────────────────────────────────────────────────────────

export async function getById(
  rls: RlsContext,
  entryId: string,
): Promise<AccountingEntryOutput> {
  const row = await (prisma as any).accountingEntry.findFirst({
    where: { id: entryId, organizationId: rls.organizationId },
  });

  if (!row) {
    throw new AccountingEntryError('Lançamento contábil não encontrado', 'ENTRY_NOT_FOUND', 404);
  }

  return toOutput(row);
}

// ─── exportCsv ────────────────────────────────────────────────────────

export async function exportCsv(
  rls: RlsContext,
  filters: AccountingEntryListInput,
): Promise<string> {
  const where: any = { organizationId: rls.organizationId };

  if (filters.referenceMonth) {
    const [year, month] = filters.referenceMonth.split('-').map(Number);
    where.referenceMonth = new Date(Date.UTC(year, month - 1, 1));
  }

  if (filters.farmId) {
    where.farmId = filters.farmId;
  }

  if (filters.entryType) {
    where.entryType = filters.entryType;
  }

  const rows = await (prisma as any).accountingEntry.findMany({
    where,
    orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
  });

  const headers = [
    'id',
    'referenceMonth',
    'entryType',
    'debitAccount',
    'debitLabel',
    'creditAccount',
    'creditLabel',
    'amount',
    'costCenterId',
    'farmId',
    'sourceType',
    'sourceId',
    'notes',
    'createdAt',
  ];

  const csvRows = rows.map((row: any) => {
    const out = toOutput(row);
    return [
      out.id,
      out.referenceMonth,
      out.entryType,
      out.debitAccount,
      `"${out.debitLabel}"`,
      out.creditAccount,
      `"${out.creditLabel}"`,
      out.amount.toFixed(2),
      out.costCenterId ?? '',
      out.farmId ?? '',
      out.sourceType,
      out.sourceId,
      out.notes ? `"${out.notes}"` : '',
      out.createdAt,
    ].join(',');
  });

  return [headers.join(','), ...csvRows].join('\n');
}
