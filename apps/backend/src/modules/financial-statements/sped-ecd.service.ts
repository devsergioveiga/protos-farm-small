// ─── SPED ECD Service ─────────────────────────────────────────────────────────
// Orchestration layer for SPED Contabil (ECD) validation and generation.
// Queries Prisma DB and calls SpedEcdWriter (pure class) for file generation.

import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import { SpedEcdWriter } from './sped-ecd.writer';
import { getUnmappedSpedAccounts } from '../chart-of-accounts/chart-of-accounts.service';
import { getTrialBalance } from '../ledger/ledger.service';
import { getDre, getBalanceSheet } from './financial-statements.service';
import type {
  SpedEcdInput,
  SpedOrgData,
  SpedAccountData,
  SpedMonthlyBalance,
  SpedJournalEntry,
  SpedJournalLine,
  SpedCostCenter,
  SpedDreRow,
  SpedBpRow,
  SpedDlpaRow,
  SpedValidationItem,
  SpedValidationResult,
} from './sped-ecd.types';

// ─── Errors ───────────────────────────────────────────────────────────────────

export class SpedEcdError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'SpedEcdError';
  }
}

// ─── validateSpedEcd ──────────────────────────────────────────────────────────

export async function validateSpedEcd(
  organizationId: string,
  fiscalYearId: string,
): Promise<SpedValidationResult> {
  const items: SpedValidationItem[] = [];

  // Verify fiscal year exists
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: fiscalYearId, organizationId },
    select: { id: true, startDate: true, endDate: true },
  });

  if (!fiscalYear) {
    throw new SpedEcdError('Exercicio fiscal nao encontrado', 'FISCAL_YEAR_NOT_FOUND', 404);
  }

  // 1. UNMAPPED_SPED (ERROR) — analytic accounts without spedRefCode
  const unmapped = await getUnmappedSpedAccounts(organizationId);
  if (unmapped.length > 0) {
    items.push({
      severity: 'ERROR',
      code: 'UNMAPPED_SPED',
      message: `${unmapped.length} conta(s) sem mapeamento SPED (codigo referencial ausente)`,
      navigateTo: '/chart-of-accounts',
    });
  }

  // 2. OPEN_PERIODS (ERROR) — accounting periods not closed
  const openPeriods = await prisma.accountingPeriod.findMany({
    where: { organizationId, fiscalYearId, status: 'OPEN' },
    select: { month: true, year: true },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  for (const period of openPeriods) {
    const mm = String(period.month).padStart(2, '0');
    items.push({
      severity: 'ERROR',
      code: 'OPEN_PERIODS',
      message: `Periodo ${mm}/${period.year} nao esta fechado`,
      navigateTo: '/monthly-closing',
    });
  }

  // 3. UNBALANCED_TRIAL (ERROR) — trial balance debits != credits
  const periods = await prisma.accountingPeriod.findMany({
    where: { organizationId, fiscalYearId },
    select: { month: true, year: true },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  for (const period of periods) {
    try {
      const trial = await getTrialBalance(organizationId, {
        fiscalYearId,
        month: period.month,
      });

      if (trial.grandTotals && !trial.isBalanced) {
        const mm = String(period.month).padStart(2, '0');
        items.push({
          severity: 'ERROR',
          code: 'UNBALANCED_TRIAL',
          message: `Balancete desequilibrado: debitos != creditos em ${mm}/${period.year}`,
          navigateTo: '/trial-balance',
        });
      }
    } catch {
      // Skip if trial balance cannot be computed for a period
    }
  }

  // 4. DUPLICATE_I050 (ERROR) — duplicate COA codes
  const allAccounts = await prisma.chartOfAccount.findMany({
    where: { organizationId, isActive: true },
    select: { code: true },
  });

  const codeCounts = new Map<string, number>();
  for (const acct of allAccounts) {
    codeCounts.set(acct.code, (codeCounts.get(acct.code) ?? 0) + 1);
  }
  const duplicates = Array.from(codeCounts.entries()).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    items.push({
      severity: 'ERROR',
      code: 'DUPLICATE_I050',
      message: `${duplicates.length} codigo(s) de conta duplicado(s) no plano de contas`,
      navigateTo: '/chart-of-accounts',
    });
  }

  // 5. I155_INCONSISTENCY (ERROR) — journal entry sum != AccountBalance for each month
  for (const period of periods) {
    try {
      // Sum journal entry lines per account for this month (using side + amount)
      const startDate = new Date(period.year, period.month - 1, 1);
      const endDate = new Date(period.year, period.month, 0);

      const lineAggregates = await prisma.journalEntryLine.groupBy({
        by: ['accountId', 'side'],
        where: {
          journalEntry: {
            organizationId,
            entryDate: { gte: startDate, lte: endDate },
            status: 'POSTED',
          },
        },
        _sum: { amount: true },
      });

      // AccountBalance uses debitTotal/creditTotal fields (no year field — linked via fiscalYearId)
      const accountBalances = await prisma.accountBalance.findMany({
        where: {
          organizationId,
          fiscalYearId,
          month: period.month,
          account: { isSynthetic: false },
        },
        select: { accountId: true, debitTotal: true, creditTotal: true },
      });

      let hasInconsistency = false;
      for (const bal of accountBalances) {
        const debitAgg = lineAggregates.find(
          (a) => a.accountId === bal.accountId && a.side === 'DEBIT',
        );
        const creditAgg = lineAggregates.find(
          (a) => a.accountId === bal.accountId && a.side === 'CREDIT',
        );
        const lineDebit = new Decimal(debitAgg?._sum?.amount?.toString() ?? '0');
        const lineCredit = new Decimal(creditAgg?._sum?.amount?.toString() ?? '0');
        const balDebit = new Decimal(bal.debitTotal.toString());
        const balCredit = new Decimal(bal.creditTotal.toString());

        if (!lineDebit.equals(balDebit) || !lineCredit.equals(balCredit)) {
          hasInconsistency = true;
          break;
        }
      }

      if (hasInconsistency) {
        const mm = String(period.month).padStart(2, '0');
        items.push({
          severity: 'ERROR',
          code: 'I155_INCONSISTENCY',
          message: `Totalizacao I155 inconsistente em ${mm}/${period.year}: soma dos lancamentos != saldo apurado`,
          navigateTo: '/monthly-closing',
        });
      }
    } catch {
      // Skip if inconsistency check fails
    }
  }

  // 6. NO_MOVEMENT (WARNING) — analytic accounts with zero movement
  const analyticAccounts = await prisma.chartOfAccount.findMany({
    where: { organizationId, isActive: true, isSynthetic: false },
    select: { id: true },
  });

  if (analyticAccounts.length > 0) {
    const accountsWithMovement = await prisma.accountBalance.findMany({
      where: {
        organizationId,
        fiscalYearId,
        accountId: { in: analyticAccounts.map((a) => a.id) },
        OR: [
          { debitTotal: { gt: 0 } },
          { creditTotal: { gt: 0 } },
        ],
      },
      select: { accountId: true },
      distinct: ['accountId'],
    });

    const movementAccountIds = new Set(accountsWithMovement.map((a) => a.accountId));
    const noMovementCount = analyticAccounts.filter(
      (a) => !movementAccountIds.has(a.id),
    ).length;

    if (noMovementCount > 0) {
      items.push({
        severity: 'WARNING',
        code: 'NO_MOVEMENT',
        message: `${noMovementCount} conta(s) sem movimento no periodo (serao incluidas com saldo zero)`,
        navigateTo: '/chart-of-accounts',
      });
    }
  }

  // 7. INACTIVE_ACCOUNTS (WARNING) — inactive accounts with historical data
  const inactiveWithData = await prisma.chartOfAccount.count({
    where: {
      organizationId,
      isActive: false,
      accountBalances: { some: {} },
    },
  });

  if (inactiveWithData > 0) {
    items.push({
      severity: 'WARNING',
      code: 'INACTIVE_ACCOUNTS',
      message: `${inactiveWithData} conta(s) inativa(s) com dados historicos`,
      navigateTo: '/chart-of-accounts',
    });
  }

  return {
    items,
    hasErrors: items.some((i) => i.severity === 'ERROR'),
  };
}

// ─── generateSpedEcd ─────────────────────────────────────────────────────────

export async function generateSpedEcd(
  organizationId: string,
  fiscalYearId: string,
): Promise<{ content: string; filename: string }> {
  // 1. Load Organization
  const org = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: {
      name: true,
      document: true,
      accountantName: true,
      accountantCrc: true,
      accountantCpf: true,
    },
  });

  if (!org) {
    throw new SpedEcdError('Organizacao nao encontrada', 'ORG_NOT_FOUND', 404);
  }

  // 2. Load FiscalYear — derive year from startDate.getFullYear()
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: fiscalYearId, organizationId },
    select: { id: true, startDate: true, endDate: true },
  });

  if (!fiscalYear) {
    throw new SpedEcdError('Exercicio fiscal nao encontrado', 'FISCAL_YEAR_NOT_FOUND', 404);
  }

  const year = fiscalYear.startDate.getFullYear();

  // 3. Load all active ChartOfAccounts
  // ChartOfAccount: nature (not accountNature), parent relation available
  const rawAccounts = await prisma.chartOfAccount.findMany({
    where: { organizationId, isActive: true },
    select: {
      code: true,
      name: true,
      accountType: true,
      nature: true,      // ChartOfAccount field is "nature" (not accountNature)
      isSynthetic: true,
      level: true,
      parentId: true,    // use parentId for lookup
      spedRefCode: true,
    },
    orderBy: { code: 'asc' },
  });

  // Build code lookup from id to code for parent resolution
  const accountIdToCode = new Map<string, string>();
  for (const _a of rawAccounts) {
    // We need ids for this — re-fetch with id
  }

  // Fetch with id included for parent lookup
  const rawAccountsWithId = await prisma.chartOfAccount.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      accountType: true,
      nature: true,
      isSynthetic: true,
      level: true,
      parentId: true,
      spedRefCode: true,
    },
    orderBy: { code: 'asc' },
  });

  for (const a of rawAccountsWithId) {
    accountIdToCode.set(a.id, a.code);
  }

  const accounts: SpedAccountData[] = rawAccountsWithId.map((a) => ({
    code: a.code,
    name: a.name,
    accountType: a.accountType as SpedAccountData['accountType'],
    accountNature: a.nature as SpedAccountData['accountNature'],
    isSynthetic: a.isSynthetic,
    level: a.level,
    parentCode: a.parentId ? (accountIdToCode.get(a.parentId) ?? null) : null,
    spedRefCode: a.spedRefCode ?? null,
  }));

  // 4. Load AccountBalance (analytic accounts only) for fiscal year
  // AccountBalance: debitTotal/creditTotal (not totalDebits/totalCredits), no year field
  const rawBalances = await prisma.accountBalance.findMany({
    where: {
      organizationId,
      fiscalYearId,
      account: { isSynthetic: false },
    },
    select: {
      accountId: true,
      month: true,
      openingBalance: true,
      debitTotal: true,
      creditTotal: true,
      closingBalance: true,
    },
    orderBy: [{ month: 'asc' }],
  });

  const fyYear = fiscalYear.startDate.getFullYear();
  const monthlyBalances: SpedMonthlyBalance[] = rawBalances.map((b) => ({
    accountCode: accountIdToCode.get(b.accountId) ?? b.accountId,
    month: b.month,
    year: fyYear,
    openingBalance: b.openingBalance.toString(),
    totalDebits: b.debitTotal.toString(),
    totalCredits: b.creditTotal.toString(),
    closingBalance: b.closingBalance.toString(),
  }));

  // 5. Load JournalEntries + Lines (POSTED status only)
  // JournalEntryLine: side (DEBIT|CREDIT) + amount, no debit/credit separate fields
  // JournalEntry: no totalDebit field — compute from lines
  const rawJournalEntries = await prisma.journalEntry.findMany({
    where: {
      organizationId,
      entryDate: { gte: fiscalYear.startDate, lte: fiscalYear.endDate },
      status: 'POSTED',
    },
    select: {
      entryNumber: true,
      entryDate: true,
      lines: {
        select: {
          accountId: true,
          side: true,
          amount: true,
          description: true,
        },
      },
    },
    orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }],
  });

  const journalEntries: SpedJournalEntry[] = rawJournalEntries.map((e) => {
    const lines: SpedJournalLine[] = e.lines.map((l) => ({
      accountCode: accountIdToCode.get(l.accountId) ?? l.accountId,
      amount: l.amount.toString(),
      isDebit: l.side === 'DEBIT',
      description: l.description ?? '',
    }));

    // Compute totalDebit from lines
    const totalDebit = lines
      .filter((l) => l.isDebit)
      .reduce((sum, l) => sum.plus(l.amount), new Decimal(0));

    return {
      entryNumber: e.entryNumber,
      entryDate: e.entryDate,
      totalDebit: totalDebit.toFixed(2),
      lines,
    };
  });

  // 6. Load CostCenters (linked to farms belonging to this org)
  const rawCostCenters = await prisma.costCenter.findMany({
    where: { farm: { organizationId } },
    select: { code: true, name: true },
    orderBy: { code: 'asc' },
  }).catch(() => []);

  const costCenters: SpedCostCenter[] = rawCostCenters.map((cc) => ({
    code: cc.code,
    name: cc.name,
  }));

  // 7. Get DRE and BP data for J-block
  const lastMonth = fiscalYear.endDate.getMonth() + 1;
  const dreRows: SpedDreRow[] = [];
  const bpRows: SpedBpRow[] = [];

  try {
    const dre = await getDre(organizationId, { fiscalYearId, month: lastMonth });
    // Map DRE sections to SpedDreRow
    for (const section of dre.sections) {
      for (const row of section.rows) {
        if (row.accountId && !row.isSubtotal) {
          const acct = accounts.find((a) => a.code === row.code);
          if (acct?.spedRefCode) {
            const ytdAmount = new Decimal(row.ytd);
            dreRows.push({
              spedRefCode: acct.spedRefCode,
              name: row.name,
              amount: ytdAmount.abs().toFixed(2),
              isDebit: acct.accountType === 'DESPESA',
            });
          }
        }
      }
    }
  } catch {
    // DRE data not available — J150 will be empty
  }

  try {
    const bp = await getBalanceSheet(organizationId, { fiscalYearId, month: lastMonth });
    // Map BP groups to SpedBpRow (BpGroupRow: currentBalance/priorBalance)
    const allGroups = [...bp.ativo, ...bp.passivo];
    for (const group of allGroups) {
      for (const row of group.rows) {
        if (!row.isSubtotal) {
          const acct = accounts.find((a) => a.code === row.code);
          if (acct?.spedRefCode) {
            const closingAmount = new Decimal(row.currentBalance ?? '0');
            const openingAmount = new Decimal(row.priorBalance ?? '0');
            const groupInd: 'A' | 'P' =
              acct.accountType === 'ATIVO' ? 'A' : 'P';
            bpRows.push({
              spedRefCode: acct.spedRefCode,
              name: row.name,
              openingAmount: openingAmount.abs().toFixed(2),
              openingIsDebit: acct.accountNature === 'DEVEDORA',
              closingAmount: closingAmount.abs().toFixed(2),
              closingIsDebit: acct.accountNature === 'DEVEDORA',
              groupIndicator: groupInd,
            });
          }
        }
      }
    }
  } catch {
    // BP data not available — J100 will be empty
  }

  // 8. Build DLPA from PL accounts
  const plBalances = monthlyBalances.filter((b) => {
    const acct = accounts.find((a) => a.code === b.accountCode);
    return acct?.accountType === 'PL';
  });

  const dlpaRows: SpedDlpaRow[] = [];
  const plAccountsWithData = new Set(plBalances.map((b) => b.accountCode));
  for (const code of plAccountsWithData) {
    const acct = accounts.find((a) => a.code === code);
    if (!acct || !acct.spedRefCode) continue;
    const firstBalance = plBalances.find(
      (b) => b.accountCode === code && b.month === fiscalYear.startDate.getMonth() + 1,
    );
    const lastBalance = plBalances
      .filter((b) => b.accountCode === code)
      .sort((a, b2) => b2.month - a.month)[0];

    if (firstBalance && lastBalance) {
      dlpaRows.push({
        spedRefCode: acct.spedRefCode,
        name: acct.name,
        openingAmount: new Decimal(firstBalance.openingBalance).abs().toFixed(2),
        openingIsDebit: acct.accountNature === 'DEVEDORA',
        closingAmount: new Decimal(lastBalance.closingBalance).abs().toFixed(2),
        closingIsDebit: acct.accountNature === 'DEVEDORA',
      });
    }
  }

  // 9. Construct SpedEcdInput
  const orgData: SpedOrgData = {
    name: org.name,
    cnpj: org.document.replace(/\D/g, ''),
    uf: '',
    ie: '',
    codMun: '',
    im: '',
    accountantName: org.accountantName ?? null,
    accountantCrc: org.accountantCrc ?? null,
    accountantCpf: org.accountantCpf ?? null,
  };

  const input: SpedEcdInput = {
    org: orgData,
    fiscalYearStart: fiscalYear.startDate,
    fiscalYearEnd: fiscalYear.endDate,
    accounts,
    monthlyBalances,
    journalEntries,
    costCenters,
    dreRows,
    bpRows,
    dlpaRows,
  };

  // 10. Generate SPED ECD content
  const content = new SpedEcdWriter(input).generate();

  // 11. Build filename: SPED_ECD_{CNPJ}_{YEAR}.txt
  const cnpjDigits = org.document.replace(/\D/g, '');
  const filename = `SPED_ECD_${cnpjDigits}_${year}.txt`;

  return { content, filename };
}
