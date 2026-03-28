import { prisma } from '../../database/prisma';
import type { OpeningBalanceLinePreview, PostOpeningBalanceInput } from './opening-balance.types';
import { OpeningBalanceError } from './opening-balance.types';
// postJournalEntry is imported from journal-entries module (created by Plan 01 — parallel build)

import { postJournalEntry } from '../journal-entries/journal-entries.service';
import Decimal from 'decimal.js';

// ─── Preview ─────────────────────────────────────────────────────────

/**
 * Aggregates balances from 5 source modules and returns suggested
 * opening balance lines for the wizard.
 *
 * Sources:
 *   1. BankAccountBalance  → DEBIT  lines under 1.1.01 Caixa/Bancos
 *   2. Payable (open)      → CREDIT lines under 2.x Passivo
 *   3. Receivable (open)   → DEBIT  lines under 1.x Ativo
 *   4. Asset (net book)    → DEBIT  line  under 1.2.x Imobilizado
 *   5. PayrollProvision    → CREDIT lines under 2.2.01, 2.2.02
 */
export async function getOpeningBalancePreview(
  organizationId: string,
  _fiscalYearId: string,
): Promise<OpeningBalanceLinePreview[]> {
  const lines: OpeningBalanceLinePreview[] = [];

  // Run all aggregate queries in parallel for performance

  // Define explicit types for each query result to avoid circular reference
  type BankBalanceItem = {
    currentBalance: Decimal;
    bankAccount: { name: string | null; bankName?: string };
  };
  type GroupByItem<K extends string> = { [key in K]: string } & {
    _sum: { totalAmount: Decimal | null };
  };
  type AssetItem = { acquisitionValue: Decimal | null; id: string };
  type ProvisionGroupItem = { provisionType: string; _sum: { totalAmount: Decimal | null } };

  const [bankBalances, payableGroups, receivableGroups, assets, provisionGroups] =
    (await Promise.all([
      // 1. Bank account balances
      prisma.bankAccountBalance.findMany({
        where: {
          organizationId,
          currentBalance: { gt: 0 },
        },
        include: { bankAccount: true },
      }),

      // 2. Open payables grouped by category
      prisma.payable.groupBy({
        by: ['category'],
        where: {
          organizationId,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        },
        _sum: { totalAmount: true },
      }),

      // 3. Open receivables grouped by category
      prisma.receivable.groupBy({
        by: ['category'],
        where: {
          organizationId,
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        },
        _sum: { totalAmount: true },
      }),

      // 4. Active assets: net book value = acquisitionValue - accumulated depreciation
      prisma.asset.findMany({
        where: { organizationId, status: 'ATIVO', deletedAt: null },
        select: { acquisitionValue: true, id: true },
      }),

      // 5. Payroll provisions grouped by provisionType (VACATION, THIRTEENTH)
      prisma.payrollProvision.groupBy({
        by: ['provisionType'],
        where: { organizationId },
        _sum: { totalAmount: true },
      }),
    ]).catch(() => {
      // If any of the parallel queries fail (e.g., model not yet migrated in some envs),
      // return empty arrays gracefully — the wizard will show what's available
      return [[], [], [], [], []] as [unknown[], unknown[], unknown[], unknown[], unknown[]];
    })) as [
      BankBalanceItem[],
      GroupByItem<'category'>[],
      GroupByItem<'category'>[],
      AssetItem[],
      ProvisionGroupItem[],
    ];

  // 1. Bank balances → DEBIT under 1.1.01
  const bankAccount = await findCoaAccount(organizationId, '1.1', ['Caixa', 'Banco']);
  if (bankAccount) {
    for (const bal of bankBalances) {
      const amount = new Decimal(bal.currentBalance.toString());
      if (amount.gt(0)) {
        lines.push({
          accountId: bankAccount.id,
          accountCode: bankAccount.code,
          accountName: bankAccount.name,
          side: 'DEBIT',
          amount: amount.toFixed(2),
          source: 'BANK_BALANCE',
          description: `Saldo bancario — ${bal.bankAccount.name ?? 'Banco'}`,
        });
      }
    }
  }

  // 2. Open payables → CREDIT under 2.x
  const payableAccount = await findCoaAccount(organizationId, '2.', ['Fornecedor', 'Passivo']);
  if (payableAccount) {
    for (const group of payableGroups) {
      const amount = new Decimal((group._sum.totalAmount ?? 0).toString());
      if (amount.gt(0)) {
        lines.push({
          accountId: payableAccount.id,
          accountCode: payableAccount.code,
          accountName: payableAccount.name,
          side: 'CREDIT',
          amount: amount.toFixed(2),
          source: 'PAYABLE',
          description: `Contas a pagar em aberto — ${group.category}`,
        });
      }
    }
  }

  // 3. Open receivables → DEBIT under 1.x
  const receivableAccount = await findCoaAccount(organizationId, '1.1', ['Cliente', 'Receb']);
  if (receivableAccount) {
    for (const group of receivableGroups) {
      const amount = new Decimal((group._sum.totalAmount ?? 0).toString());
      if (amount.gt(0)) {
        lines.push({
          accountId: receivableAccount.id,
          accountCode: receivableAccount.code,
          accountName: receivableAccount.name,
          side: 'DEBIT',
          amount: amount.toFixed(2),
          source: 'RECEIVABLE',
          description: `Contas a receber em aberto — ${group.category}`,
        });
      }
    }
  }

  // 4. Asset net book value → DEBIT under 1.2.x Imobilizado
  if (assets.length > 0) {
    // Get depreciation totals per asset from latest depreciation run
    const assetIds = assets.map((a) => a.id);
    const depreciationTotals = await getAssetDepreciationTotals(assetIds);

    let netBookValue = new Decimal(0);
    for (const asset of assets) {
      const acquisitionValue = new Decimal((asset.acquisitionValue ?? 0).toString());
      const accumulatedDepreciation = new Decimal((depreciationTotals[asset.id] ?? 0).toString());
      const nbv = acquisitionValue.minus(accumulatedDepreciation);
      if (nbv.gt(0)) {
        netBookValue = netBookValue.plus(nbv);
      }
    }

    if (netBookValue.gt(0)) {
      const imobilizadoAccount = await findCoaAccount(organizationId, '1.2', [
        'Imobilizado',
        'Ativo Fixo',
      ]);
      if (imobilizadoAccount) {
        lines.push({
          accountId: imobilizadoAccount.id,
          accountCode: imobilizadoAccount.code,
          accountName: imobilizadoAccount.name,
          side: 'DEBIT',
          amount: netBookValue.toFixed(2),
          source: 'ASSET_NBV',
          description: `Imobilizado — valor liquido contabil (${assets.length} ativo(s))`,
        });
      }
    }
  }

  // 5. Payroll provisions → CREDIT under 2.2.01 (VACATION) and 2.2.02 (THIRTEENTH)
  const provisionAccountCodes: Record<string, string> = {
    VACATION: '2.2.01',
    THIRTEENTH: '2.2.02',
  };

  for (const group of provisionGroups) {
    const amount = new Decimal((group._sum.totalAmount ?? 0).toString());
    if (amount.gt(0)) {
      const codePrefix = provisionAccountCodes[group.provisionType] ?? '2.2';
      const provisionAccount = await findCoaAccount(organizationId, codePrefix, [
        'Provisao',
        'Ferias',
        '13',
      ]);
      if (provisionAccount) {
        lines.push({
          accountId: provisionAccount.id,
          accountCode: provisionAccount.code,
          accountName: provisionAccount.name,
          side: 'CREDIT',
          amount: amount.toFixed(2),
          source: 'PAYROLL_PROVISION',
          description: `Provisao de ${group.provisionType === 'VACATION' ? 'ferias' : '13º salario'}`,
        });
      }
    }
  }

  return lines;
}

// ─── Post ─────────────────────────────────────────────────────────────

/**
 * Creates and posts an OPENING_BALANCE journal entry directly via Prisma,
 * then calls postJournalEntry to assign entryNumber and update AccountBalance.
 *
 * Automatically computes the contra-entry to "Lucros e Prejuizos Acumulados"
 * if the provided lines are not balanced.
 */
export async function postOpeningBalance(
  organizationId: string,
  input: PostOpeningBalanceInput,
  createdBy: string,
) {
  // Guard: only one opening balance per fiscal year
  const existing = await prisma.journalEntry.findFirst({
    where: {
      organizationId,
      entryType: 'OPENING_BALANCE' as const,
      period: { fiscalYearId: input.fiscalYearId },
    },
  });
  if (existing) {
    throw new OpeningBalanceError(
      'Ja existe saldo de abertura para este exercicio fiscal',
      'ALREADY_EXISTS',
      409,
    );
  }

  // Compute contra-entry to balance the lines
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);
  for (const line of input.lines) {
    const amount = new Decimal(line.amount);
    if (line.side === 'DEBIT') {
      totalDebits = totalDebits.plus(amount);
    } else {
      totalCredits = totalCredits.plus(amount);
    }
  }

  const allLines: Array<{
    accountId: string;
    side: 'DEBIT' | 'CREDIT';
    amount: string;
    description?: string;
    lineOrder: number;
  }> = input.lines.map((l, i) => ({
    accountId: l.accountId,
    side: l.side,
    amount: new Decimal(l.amount).toFixed(2),
    description: l.description,
    lineOrder: i + 1,
  }));

  // Add contra-entry to PL "Lucros e Prejuizos Acumulados" if needed
  const diff = totalDebits.minus(totalCredits).abs();
  if (!diff.isZero()) {
    const plAccount = await findCoaAccount(organizationId, '3.', [
      'Lucro',
      'Prejuizo',
      'Acumulado',
      'PL',
    ]);
    if (plAccount) {
      const contraSide: 'DEBIT' | 'CREDIT' = totalDebits.gt(totalCredits) ? 'CREDIT' : 'DEBIT';
      allLines.push({
        accountId: plAccount.id,
        side: contraSide,
        amount: diff.toFixed(2),
        description: 'Contra-partida — Lucros e Prejuizos Acumulados',
        lineOrder: allLines.length + 1,
      });
    }
  }

  // Get period start date to use as entry date
  const period = await prisma.accountingPeriod.findUnique({
    where: { id: input.periodId },
    select: { month: true, year: true, fiscalYearId: true },
  });
  if (!period) {
    throw new OpeningBalanceError('Periodo contabil nao encontrado', 'PERIOD_NOT_FOUND', 404);
  }

  const entryDate = new Date(period.year, period.month - 1, 1);
  const year = period.year;

  // Create the JournalEntry directly via Prisma with entryType OPENING_BALANCE
  const entry = await prisma.journalEntry.create({
    data: {
      organizationId,
      entryDate,
      periodId: input.periodId,
      description: `Saldo de Abertura — Exercicio ${year}`,
      entryType: 'OPENING_BALANCE' as const,
      status: 'DRAFT' as const,
      entryNumber: 0, // placeholder — postJournalEntry assigns the real number
      createdBy,
      lines: {
        create: allLines,
      },
    },
  });

  // Post via journal-entries service to assign entryNumber, update AccountBalance, set POSTED
  return postJournalEntry(organizationId, entry.id, createdBy);
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Finds a COA account matching a code prefix or name keywords.
 * Returns the first non-synthetic active account found.
 */
async function findCoaAccount(organizationId: string, codePrefix: string, nameKeywords: string[]) {
  // Try code prefix first
  const byCode = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      code: { startsWith: codePrefix },
      isSynthetic: false,
      isActive: true,
    },
    select: { id: true, code: true, name: true },
  });
  if (byCode) return byCode;

  // Fallback: search by name keywords
  for (const keyword of nameKeywords) {
    const byName = await prisma.chartOfAccount.findFirst({
      where: {
        organizationId,
        name: { contains: keyword, mode: 'insensitive' },
        isSynthetic: false,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (byName) return byName;
  }

  return null;
}

/**
 * Returns accumulated depreciation totals per asset from DepreciationRun records.
 * If the depreciation module is not available, returns an empty map.
 */
async function getAssetDepreciationTotals(assetIds: string[]): Promise<Record<string, Decimal>> {
  try {
    // Sum depreciation amounts per asset from DepreciationEntry records
    const entries = await prisma.depreciationEntry.groupBy({
      by: ['assetId'],
      where: { assetId: { in: assetIds }, reversedAt: null },
      _sum: { depreciationAmount: true },
    });

    const result: Record<string, Decimal> = {};
    for (const entry of entries) {
      if (entry._sum.depreciationAmount) {
        result[entry.assetId] = new Decimal(entry._sum.depreciationAmount.toString());
      }
    }
    return result;
  } catch {
    // DepreciationEntry table may not exist in older environments
    return {};
  }
}
