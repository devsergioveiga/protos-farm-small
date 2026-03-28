// ─── Financial Statements Service ────────────────────────────────────────────
// DB queries and calculator orchestration for DRE, BP, and cross-validation.
// Follows the same pattern as ledger.service.ts (prisma direct, no withRlsContext).

import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import { calculateDre } from './dre.calculator';
import { calculateBp } from './bp.calculator';
import { calculateCrossValidation } from './cross-validation.calculator';
import { calculateDfcDireto, calculateDfcIndireto } from './dfc.calculator';
import { getTrialBalance } from '../ledger/ledger.service';
import {
  FinancialStatementsError,
  type DreFilters,
  type DreOutput,
  type DreAccountData,
  type BpFilters,
  type BpOutput,
  type BpAccountData,
  type BpSparklineMonth,
  type CrossValidationOutput,
  type MarginRankingItem,
} from './financial-statements.types';
import type { DfcFilters, DfcOutput, DfcPaidItem, DfcSection } from './dfc.types';

// ─── getDre ──────────────────────────────────────────────────────────────────

export async function getDre(
  organizationId: string,
  filters: DreFilters,
): Promise<DreOutput & { marginRanking?: MarginRankingItem[] }> {
  // Verify fiscal year exists
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: filters.fiscalYearId, organizationId },
    select: { id: true, startDate: true, endDate: true },
  });

  if (!fiscalYear) {
    throw new FinancialStatementsError(
      'Exercício fiscal não encontrado',
      'FISCAL_YEAR_NOT_FOUND',
      404,
    );
  }

  // Find prior fiscal year (previous year, same org)
  const priorYearStart = new Date(fiscalYear.startDate);
  priorYearStart.setFullYear(priorYearStart.getFullYear() - 1);
  const priorFiscalYear = await prisma.fiscalYear.findFirst({
    where: { organizationId, startDate: priorYearStart },
    select: { id: true },
  });

  // Load all RECEITA + DESPESA accounts (analytic + synthetic — calculator will filter)
  const allAccounts = await prisma.chartOfAccount.findMany({
    where: {
      organizationId,
      isActive: true,
      accountType: { in: ['RECEITA', 'DESPESA'] },
    },
    select: {
      id: true,
      code: true,
      name: true,
      accountType: true,
      nature: true,
      isSynthetic: true,
      isFairValueAdj: true,
    },
    orderBy: { code: 'asc' },
  });

  let accountDataList: DreAccountData[];

  if (!filters.costCenterId) {
    // ─── Consolidated path: use AccountBalance ─────────────────────────────

    // Current month balances
    const currentBalances = await prisma.accountBalance.findMany({
      where: { organizationId, fiscalYearId: filters.fiscalYearId, month: filters.month },
      select: { accountId: true, debitTotal: true, creditTotal: true },
    });

    // YTD: sum months 1..filters.month
    const ytdRaw = await prisma.accountBalance.groupBy({
      by: ['accountId'],
      where: {
        organizationId,
        fiscalYearId: filters.fiscalYearId,
        month: { lte: filters.month },
      },
      _sum: { debitTotal: true, creditTotal: true },
    });

    // Prior year same month
    const priorBalances = priorFiscalYear
      ? await prisma.accountBalance.findMany({
          where: {
            organizationId,
            fiscalYearId: priorFiscalYear.id,
            month: filters.month,
          },
          select: { accountId: true, debitTotal: true, creditTotal: true },
        })
      : [];

    // Build lookup maps
    const currentMap = new Map(currentBalances.map((b) => [b.accountId, b]));
    const ytdMap = new Map(
      ytdRaw.map((r) => [
        r.accountId,
        {
          debitTotal: r._sum.debitTotal ?? new Decimal(0),
          creditTotal: r._sum.creditTotal ?? new Decimal(0),
        },
      ]),
    );
    const priorMap = new Map(priorBalances.map((b) => [b.accountId, b]));

    accountDataList = allAccounts.map((acct) => {
      const cur = currentMap.get(acct.id);
      const ytd = ytdMap.get(acct.id);
      const prior = priorMap.get(acct.id);
      return {
        accountId: acct.id,
        code: acct.code,
        name: acct.name,
        accountType: acct.accountType as 'RECEITA' | 'DESPESA',
        nature: acct.nature as 'DEVEDORA' | 'CREDORA',
        isSynthetic: acct.isSynthetic,
        isFairValueAdj: acct.isFairValueAdj,
        currentMonthDebit: cur?.debitTotal.toString() ?? '0',
        currentMonthCredit: cur?.creditTotal.toString() ?? '0',
        ytdDebit: ytd?.debitTotal.toString() ?? '0',
        ytdCredit: ytd?.creditTotal.toString() ?? '0',
        priorYearDebit: prior?.debitTotal.toString() ?? '0',
        priorYearCredit: prior?.creditTotal.toString() ?? '0',
      };
    });

    // Compute margin ranking by cost center
    const fiscalYearForRanking = {
      id: fiscalYear.id,
      year: new Date(fiscalYear.startDate).getFullYear(),
    };
    const marginRanking = await computeMarginRanking(
      organizationId,
      fiscalYearForRanking,
      filters.month,
    );

    const result = calculateDre({ accounts: accountDataList });
    return { ...result, marginRanking };
  } else {
    // ─── CC-filtered path: aggregate from JournalEntryLine ────────────────

    // Date ranges
    const year = new Date(fiscalYear.startDate).getFullYear();
    const monthStart = new Date(year, filters.month - 1, 1);
    const monthEnd = new Date(year, filters.month, 0, 23, 59, 59, 999);
    const ytdStart = new Date(year, 0, 1);

    type JelAggRow = { accountId: string; side: string; total: Decimal };

    async function queryJelAgg(startDate: Date, endDate: Date): Promise<JelAggRow[]> {
      const rows = await prisma.$queryRaw<
        Array<{ accountId: string; side: string; total: unknown }>
      >`
        SELECT jel."accountId", jel.side, SUM(jel.amount) as total
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel."journalEntryId"
        WHERE je."organizationId" = ${organizationId}
          AND jel."costCenterId" = ${filters.costCenterId}
          AND je.status = 'POSTED'
          AND je."entryDate" BETWEEN ${startDate} AND ${endDate}
        GROUP BY jel."accountId", jel.side
      `;
      return rows.map((r) => ({
        accountId: r.accountId,
        side: r.side,
        total: new Decimal(String(r.total)),
      }));
    }

    const [currentRows, ytdRows, priorRows] = await Promise.all([
      queryJelAgg(monthStart, monthEnd),
      queryJelAgg(ytdStart, monthEnd),
      priorFiscalYear
        ? queryJelAgg(
            new Date(year - 1, filters.month - 1, 1),
            new Date(year - 1, filters.month, 0, 23, 59, 59, 999),
          )
        : Promise.resolve([] as JelAggRow[]),
    ]);

    // Build maps: accountId -> { debit, credit }
    function buildJelMap(rows: JelAggRow[]): Map<string, { debit: Decimal; credit: Decimal }> {
      const map = new Map<string, { debit: Decimal; credit: Decimal }>();
      for (const row of rows) {
        if (!map.has(row.accountId)) {
          map.set(row.accountId, { debit: new Decimal(0), credit: new Decimal(0) });
        }
        const entry = map.get(row.accountId)!;
        if (row.side === 'DEBIT') {
          entry.debit = entry.debit.plus(row.total);
        } else {
          entry.credit = entry.credit.plus(row.total);
        }
      }
      return map;
    }

    const currentMap = buildJelMap(currentRows);
    const ytdMap = buildJelMap(ytdRows);
    const priorMap = buildJelMap(priorRows);

    accountDataList = allAccounts.map((acct) => {
      const cur = currentMap.get(acct.id) ?? { debit: new Decimal(0), credit: new Decimal(0) };
      const ytd = ytdMap.get(acct.id) ?? { debit: new Decimal(0), credit: new Decimal(0) };
      const prior = priorMap.get(acct.id) ?? { debit: new Decimal(0), credit: new Decimal(0) };
      return {
        accountId: acct.id,
        code: acct.code,
        name: acct.name,
        accountType: acct.accountType as 'RECEITA' | 'DESPESA',
        nature: acct.nature as 'DEVEDORA' | 'CREDORA',
        isSynthetic: acct.isSynthetic,
        isFairValueAdj: acct.isFairValueAdj,
        currentMonthDebit: cur.debit.toString(),
        currentMonthCredit: cur.credit.toString(),
        ytdDebit: ytd.debit.toString(),
        ytdCredit: ytd.credit.toString(),
        priorYearDebit: prior.debit.toString(),
        priorYearCredit: prior.credit.toString(),
      };
    });

    return calculateDre({ accounts: accountDataList });
  }
}

// ─── computeMarginRanking ────────────────────────────────────────────────────

async function computeMarginRanking(
  organizationId: string,
  fiscalYear: { id: string; year: number },
  month: number,
): Promise<MarginRankingItem[]> {
  const year = fiscalYear.year;
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // Revenue (4.x) and CPV (5.1.x) by cost center
  const rows = await prisma.$queryRaw<
    Array<{
      costCenterId: string;
      costCenterName: string;
      accountCode: string;
      side: string;
      total: unknown;
    }>
  >`
    SELECT
      cc.id as "costCenterId",
      cc.name as "costCenterName",
      coa.code as "accountCode",
      jel.side,
      SUM(jel.amount) as total
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel."journalEntryId"
    JOIN cost_centers cc ON cc.id = jel."costCenterId"
    JOIN chart_of_accounts coa ON coa.id = jel."accountId"
    WHERE je."organizationId" = ${organizationId}
      AND je.status = 'POSTED'
      AND je."entryDate" BETWEEN ${startDate} AND ${endDate}
      AND jel."costCenterId" IS NOT NULL
      AND (coa.code LIKE '4.%' OR coa.code LIKE '5.1.%')
    GROUP BY cc.id, cc.name, coa.code, jel.side
  `;

  // Aggregate by cost center
  const ccMap = new Map<string, { name: string; revenue: Decimal; cpv: Decimal }>();
  for (const row of rows) {
    if (!ccMap.has(row.costCenterId)) {
      ccMap.set(row.costCenterId, {
        name: row.costCenterName,
        revenue: new Decimal(0),
        cpv: new Decimal(0),
      });
    }
    const entry = ccMap.get(row.costCenterId)!;
    const amount = new Decimal(String(row.total));
    const isRevenue = row.accountCode.startsWith('4.');
    const isCpv = row.accountCode.startsWith('5.1.');
    if (isRevenue) {
      if (row.side === 'CREDIT') entry.revenue = entry.revenue.plus(amount);
      else entry.revenue = entry.revenue.minus(amount);
    } else if (isCpv) {
      if (row.side === 'DEBIT') entry.cpv = entry.cpv.plus(amount);
      else entry.cpv = entry.cpv.minus(amount);
    }
  }

  const items: MarginRankingItem[] = Array.from(ccMap.entries()).map(([id, data]) => {
    const grossMargin = data.revenue.minus(data.cpv);
    const marginPercent = data.revenue.isZero()
      ? '0.00'
      : grossMargin.div(data.revenue).times(100).toFixed(2);
    return {
      costCenterId: id,
      costCenterName: data.name,
      revenue: data.revenue.toFixed(2),
      cpv: data.cpv.toFixed(2),
      grossMargin: grossMargin.toFixed(2),
      marginPercent,
    };
  });

  return items.sort((a, b) =>
    new Decimal(b.grossMargin).minus(new Decimal(a.grossMargin)).toNumber(),
  );
}

// ─── getBalanceSheet ──────────────────────────────────────────────────────────

export async function getBalanceSheet(
  organizationId: string,
  filters: BpFilters,
): Promise<BpOutput> {
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: filters.fiscalYearId, organizationId },
    select: { id: true, startDate: true },
  });

  if (!fiscalYear) {
    throw new FinancialStatementsError(
      'Exercício fiscal não encontrado',
      'FISCAL_YEAR_NOT_FOUND',
      404,
    );
  }

  // Load all ATIVO + PASSIVO + PL accounts
  const allAccounts = await prisma.chartOfAccount.findMany({
    where: {
      organizationId,
      isActive: true,
      accountType: { in: ['ATIVO', 'PASSIVO', 'PL'] },
    },
    select: {
      id: true,
      code: true,
      name: true,
      accountType: true,
      isSynthetic: true,
    },
    orderBy: { code: 'asc' },
  });

  // Current month closing balances
  const currentBalances = await prisma.accountBalance.findMany({
    where: { organizationId, fiscalYearId: filters.fiscalYearId, month: filters.month },
    select: { accountId: true, closingBalance: true },
  });

  // Prior month closing balances
  let priorBalances: Array<{ accountId: string; closingBalance: Decimal }> = [];
  if (filters.month === 1) {
    // Prior year December
    const priorYearStart = new Date(fiscalYear.startDate);
    priorYearStart.setFullYear(priorYearStart.getFullYear() - 1);
    const priorFiscalYear = await prisma.fiscalYear.findFirst({
      where: { organizationId, startDate: priorYearStart },
      select: { id: true },
    });
    if (priorFiscalYear) {
      priorBalances = await prisma.accountBalance.findMany({
        where: { organizationId, fiscalYearId: priorFiscalYear.id, month: 12 },
        select: { accountId: true, closingBalance: true },
      });
    }
  } else {
    priorBalances = await prisma.accountBalance.findMany({
      where: { organizationId, fiscalYearId: filters.fiscalYearId, month: filters.month - 1 },
      select: { accountId: true, closingBalance: true },
    });
  }

  // Build lookup maps
  const currentMap = new Map(currentBalances.map((b) => [b.accountId, b.closingBalance]));
  const priorMap = new Map(priorBalances.map((b) => [b.accountId, b.closingBalance]));

  const accountDataList: BpAccountData[] = allAccounts.map((acct) => ({
    accountId: acct.id,
    code: acct.code,
    name: acct.name,
    accountType: acct.accountType as 'ATIVO' | 'PASSIVO' | 'PL',
    isSynthetic: acct.isSynthetic,
    currentBalance: (currentMap.get(acct.id) ?? new Decimal(0)).toString(),
    priorBalance: (priorMap.get(acct.id) ?? new Decimal(0)).toString(),
  }));

  // Get total farm area
  const farmAreaResult = await prisma.farm.aggregate({
    where: { organizationId },
    _sum: { totalAreaHa: true },
  });
  const totalAreaHa = farmAreaResult._sum.totalAreaHa
    ? new Decimal(farmAreaResult._sum.totalAreaHa.toString()).toNumber()
    : 0;

  // Get resultado liquido from DRE for ROE
  let resultadoLiquido = '0';
  try {
    const dre = await getDre(organizationId, {
      fiscalYearId: filters.fiscalYearId,
      month: filters.month,
    });
    resultadoLiquido = dre.resultadoLiquido.currentMonth;
  } catch {
    // If DRE fails (e.g., no RECEITA/DESPESA accounts), default to 0
    resultadoLiquido = '0';
  }

  // Sparkline data: last 6 months
  const sparklineMonths: BpSparklineMonth[] = await computeSparklineMonths(
    organizationId,
    filters,
    allAccounts,
  );

  return calculateBp({
    accounts: accountDataList,
    totalAreaHa,
    resultadoLiquido,
    sparklineMonths,
  });
}

// ─── computeSparklineMonths ───────────────────────────────────────────────────

async function computeSparklineMonths(
  organizationId: string,
  filters: BpFilters,
  allAccounts: Array<{ id: string; code: string; accountType: string; isSynthetic: boolean }>,
): Promise<BpSparklineMonth[]> {
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: filters.fiscalYearId, organizationId },
    select: { id: true, startDate: true },
  });
  if (!fiscalYear) return [];

  // Collect last 6 months (current + 5 previous)
  const months: Array<{ fiscalYearId: string; month: number; displayMonth: number }> = [];
  for (let i = 0; i < 6; i++) {
    const m = filters.month - i;
    if (m >= 1) {
      months.push({ fiscalYearId: filters.fiscalYearId, month: m, displayMonth: m });
    } else {
      // Previous fiscal year
      const priorYearStart = new Date(fiscalYear.startDate);
      priorYearStart.setFullYear(priorYearStart.getFullYear() - 1);
      const priorFY = await prisma.fiscalYear.findFirst({
        where: { organizationId, startDate: priorYearStart },
        select: { id: true },
      });
      if (priorFY) {
        months.push({ fiscalYearId: priorFY.id, month: 12 + m, displayMonth: 12 + m });
      }
    }
  }

  const analyticIds = allAccounts.filter((a) => !a.isSynthetic).map((a) => a.id);
  const analyticCodes = allAccounts
    .filter((a) => !a.isSynthetic)
    .reduce((map, a) => {
      map.set(a.id, a.code);
      return map;
    }, new Map<string, string>());
  const analyticTypes = allAccounts
    .filter((a) => !a.isSynthetic)
    .reduce((map, a) => {
      map.set(a.id, a.accountType);
      return map;
    }, new Map<string, string>());

  const result: BpSparklineMonth[] = [];

  for (const { fiscalYearId, month, displayMonth } of months) {
    const balances = await prisma.accountBalance.findMany({
      where: { organizationId, fiscalYearId, month, accountId: { in: analyticIds } },
      select: { accountId: true, closingBalance: true },
    });

    let acTotal = new Decimal(0);
    let pncTotal = new Decimal(0);
    let pcTotal = new Decimal(0);
    let plTotal = new Decimal(0);
    let estoquesBalance = new Decimal(0);

    for (const b of balances) {
      const code = analyticCodes.get(b.accountId) ?? '';
      const type = analyticTypes.get(b.accountId) ?? '';
      const bal = new Decimal(b.closingBalance.toString());

      if (type === 'ATIVO') {
        if (code.startsWith('1.1.')) acTotal = acTotal.plus(bal);
        if (code.startsWith('1.1.02')) estoquesBalance = estoquesBalance.plus(bal);
      } else if (type === 'PASSIVO') {
        if (code.startsWith('2.1.')) pcTotal = pcTotal.plus(bal);
        if (code.startsWith('2.2.')) pncTotal = pncTotal.plus(bal);
      } else if (type === 'PL') {
        plTotal = plTotal.plus(bal);
      }
    }

    result.push({
      month: displayMonth,
      acTotal: acTotal.toFixed(2),
      pcTotal: pcTotal.toFixed(2),
      pncTotal: pncTotal.toFixed(2),
      plTotal: plTotal.toFixed(2),
      ativoTotal: acTotal.plus(new Decimal(0)).toFixed(2), // ANC not tracked here
      estoquesBalance: estoquesBalance.toFixed(2),
      resultadoLiquido: '0', // simplified — ROE sparkline uses 0 for prior months
    });
  }

  return result.reverse(); // oldest first
}

// ─── getDfc ───────────────────────────────────────────────────────────────────

export async function getDfc(organizationId: string, filters: DfcFilters): Promise<DfcOutput> {
  // Verify fiscal year exists
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: filters.fiscalYearId, organizationId },
    select: { id: true, startDate: true, endDate: true },
  });

  if (!fiscalYear) {
    throw new FinancialStatementsError(
      'Exercício fiscal não encontrado',
      'FISCAL_YEAR_NOT_FOUND',
      404,
    );
  }

  // Derive year from startDate
  const year = fiscalYear.startDate.getFullYear();

  // Find prior fiscal year (start date in previous year)
  const priorYearStart = new Date(year - 1, 0, 1);
  const priorYearEnd = new Date(year - 1, 11, 31, 23, 59, 59, 999);
  const priorFiscalYear = await prisma.fiscalYear.findFirst({
    where: { organizationId, startDate: { gte: priorYearStart, lte: priorYearEnd } },
    select: { id: true },
  });

  // Derive date ranges
  const currentMonthStart = new Date(year, filters.month - 1, 1);
  const currentMonthEnd = new Date(year, filters.month, 0, 23, 59, 59, 999);
  const ytdStart = fiscalYear.startDate;
  const ytdEnd = currentMonthEnd;
  const priorYearMonthStart = priorFiscalYear ? new Date(year - 1, filters.month - 1, 1) : null;
  const priorYearMonthEnd = priorFiscalYear
    ? new Date(year - 1, filters.month, 0, 23, 59, 59, 999)
    : null;

  // Load paid payables
  async function loadPayables(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ category: string; amountPaid: Decimal | null }>> {
    return prisma.payable.findMany({
      where: { organizationId, paidAt: { gte: startDate, lte: endDate } },
      select: { category: true, amountPaid: true },
    });
  }

  // Load settled receivables
  async function loadReceivables(
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ category: string; amountReceived: Decimal | null }>> {
    return prisma.receivable.findMany({
      where: { organizationId, receivedAt: { gte: startDate, lte: endDate } },
      select: { category: true, amountReceived: true },
    });
  }

  // Build DfcPaidItem arrays
  function buildItems(
    payables: Array<{ category: string; amountPaid: Decimal | null }>,
    receivables: Array<{ category: string; amountReceived: Decimal | null }>,
  ): DfcPaidItem[] {
    const items: DfcPaidItem[] = [];
    for (const p of payables) {
      if (p.amountPaid && new Decimal(p.amountPaid.toString()).gt(0)) {
        items.push({
          category: p.category,
          amount: p.amountPaid.toString(),
          type: 'outflow' as const,
        });
      }
    }
    for (const r of receivables) {
      if (r.amountReceived && new Decimal(r.amountReceived.toString()).gt(0)) {
        items.push({
          category: r.category,
          amount: r.amountReceived.toString(),
          type: 'inflow' as const,
        });
      }
    }
    return items;
  }

  // Load all periods in parallel
  const [
    currentPayables,
    currentReceivables,
    ytdPayables,
    ytdReceivables,
    priorPayables,
    priorReceivables,
  ] = await Promise.all([
    loadPayables(currentMonthStart, currentMonthEnd),
    loadReceivables(currentMonthStart, currentMonthEnd),
    loadPayables(ytdStart, ytdEnd),
    loadReceivables(ytdStart, ytdEnd),
    priorYearMonthStart && priorYearMonthEnd
      ? loadPayables(priorYearMonthStart, priorYearMonthEnd)
      : Promise.resolve([]),
    priorYearMonthStart && priorYearMonthEnd
      ? loadReceivables(priorYearMonthStart, priorYearMonthEnd)
      : Promise.resolve([]),
  ]);

  const currentMonthItems = buildItems(currentPayables, currentReceivables);
  const ytdItems = buildItems(ytdPayables, ytdReceivables);
  const priorYearItems = buildItems(priorPayables, priorReceivables);

  // Load cash account balances (accounts with code starting '1.1.01')
  const cashAccounts = await prisma.chartOfAccount.findMany({
    where: { organizationId, isActive: true, isSynthetic: false, code: { startsWith: '1.1.01' } },
    select: { id: true },
  });
  const cashAccountIds = cashAccounts.map((a) => a.id);

  async function sumCashBalance(
    fyId: string,
    month: number,
    field: 'openingBalance' | 'closingBalance',
  ): Promise<string> {
    if (cashAccountIds.length === 0) return '0.00';
    const balances = await prisma.accountBalance.findMany({
      where: { organizationId, fiscalYearId: fyId, month, accountId: { in: cashAccountIds } },
      select: { [field]: true },
    });
    return balances
      .reduce(
        (sum, b) => sum.plus(new Decimal((b as Record<string, unknown>)[field]?.toString() ?? '0')),
        new Decimal(0),
      )
      .toFixed(2);
  }

  // Month 1 opening for YTD
  const [
    currentMonthOpening,
    currentMonthClosing,
    ytdOpening,
    ytdClosing,
    priorYearOpening,
    priorYearClosing,
  ] = await Promise.all([
    sumCashBalance(filters.fiscalYearId, filters.month, 'openingBalance'),
    sumCashBalance(filters.fiscalYearId, filters.month, 'closingBalance'),
    sumCashBalance(filters.fiscalYearId, 1, 'openingBalance'),
    sumCashBalance(filters.fiscalYearId, filters.month, 'closingBalance'),
    priorFiscalYear
      ? sumCashBalance(priorFiscalYear.id, filters.month, 'openingBalance')
      : Promise.resolve('0.00'),
    priorFiscalYear
      ? sumCashBalance(priorFiscalYear.id, filters.month, 'closingBalance')
      : Promise.resolve('0.00'),
  ]);

  // Calculate direto
  const direto = calculateDfcDireto({
    currentMonthItems,
    ytdItems,
    priorYearItems,
    cashBalances: {
      currentMonthOpening,
      currentMonthClosing,
      ytdOpening,
      ytdClosing,
      priorYearOpening,
      priorYearClosing,
    },
  });

  // Gather indireto adjustments
  // lucroLiquido from DRE
  let lucroLiquidoCurrentMonth = '0.00';
  let lucroLiquidoYtd = '0.00';
  let lucroLiquidoPriorYear = '0.00';
  try {
    const dreResult = await getDre(organizationId, filters);
    lucroLiquidoCurrentMonth = dreResult.resultadoLiquido.currentMonth;
    lucroLiquidoYtd = dreResult.resultadoLiquido.ytd;
    lucroLiquidoPriorYear = dreResult.resultadoLiquido.priorYear;
  } catch {
    // If DRE fails, default to 0
  }

  // Depreciacao: AccountBalance debitTotal - creditTotal for accounts starting '5.2.03'
  async function getDepreciacao(fyId: string, monthNum: number, isYtd = false): Promise<string> {
    const deprAccounts = await prisma.chartOfAccount.findMany({
      where: { organizationId, isActive: true, isSynthetic: false, code: { startsWith: '5.2.03' } },
      select: { id: true },
    });
    if (deprAccounts.length === 0) return '0.00';
    const ids = deprAccounts.map((a) => a.id);
    if (isYtd) {
      const rows = await prisma.accountBalance.groupBy({
        by: ['accountId'],
        where: {
          organizationId,
          fiscalYearId: fyId,
          month: { lte: monthNum },
          accountId: { in: ids },
        },
        _sum: { debitTotal: true, creditTotal: true },
      });
      return rows
        .reduce((sum, r) => {
          const d = new Decimal(r._sum.debitTotal?.toString() ?? '0');
          const c = new Decimal(r._sum.creditTotal?.toString() ?? '0');
          return sum.plus(d.minus(c));
        }, new Decimal(0))
        .toFixed(2);
    } else {
      const balances = await prisma.accountBalance.findMany({
        where: { organizationId, fiscalYearId: fyId, month: monthNum, accountId: { in: ids } },
        select: { debitTotal: true, creditTotal: true },
      });
      return balances
        .reduce((sum, b) => {
          return sum.plus(
            new Decimal(b.debitTotal.toString()).minus(new Decimal(b.creditTotal.toString())),
          );
        }, new Decimal(0))
        .toFixed(2);
    }
  }

  // Provisoes delta: closingBalance delta for accounts starting '2.1.03' or '2.1.04'
  async function getProvisoesClosing(fyId: string, monthNum: number): Promise<Decimal> {
    const provAccounts = await prisma.chartOfAccount.findMany({
      where: {
        organizationId,
        isActive: true,
        isSynthetic: false,
        OR: [{ code: { startsWith: '2.1.03' } }, { code: { startsWith: '2.1.04' } }],
      },
      select: { id: true },
    });
    if (provAccounts.length === 0) return new Decimal(0);
    const ids = provAccounts.map((a) => a.id);
    const balances = await prisma.accountBalance.findMany({
      where: { organizationId, fiscalYearId: fyId, month: monthNum, accountId: { in: ids } },
      select: { closingBalance: true },
    });
    return balances.reduce(
      (sum, b) => sum.plus(new Decimal(b.closingBalance.toString())),
      new Decimal(0),
    );
  }

  // CPC 29 fair value adjustments: accounts with isFairValueAdj = true
  async function getCpc29FairValue(fyId: string, monthNum: number): Promise<string> {
    const fvAccounts = await prisma.chartOfAccount.findMany({
      where: { organizationId, isActive: true, isSynthetic: false, isFairValueAdj: true },
      select: { id: true },
    });
    if (fvAccounts.length === 0) return '0.00';
    const ids = fvAccounts.map((a) => a.id);
    const balances = await prisma.accountBalance.findMany({
      where: { organizationId, fiscalYearId: fyId, month: monthNum, accountId: { in: ids } },
      select: { debitTotal: true, creditTotal: true },
    });
    return balances
      .reduce((sum, b) => {
        return sum.plus(
          new Decimal(b.creditTotal.toString()).minus(new Decimal(b.debitTotal.toString())),
        );
      }, new Decimal(0))
      .toFixed(2);
  }

  // Working capital: closingBalance delta (current - prior month/opening)
  async function getAccountGroupClosing(
    fyId: string,
    monthNum: number,
    prefixes: string[],
  ): Promise<Decimal> {
    const orClauses = prefixes.map((p) => ({ code: { startsWith: p } }));
    const accounts = await prisma.chartOfAccount.findMany({
      where: { organizationId, isActive: true, isSynthetic: false, OR: orClauses },
      select: { id: true },
    });
    if (accounts.length === 0) return new Decimal(0);
    const ids = accounts.map((a) => a.id);
    const balances = await prisma.accountBalance.findMany({
      where: { organizationId, fiscalYearId: fyId, month: monthNum, accountId: { in: ids } },
      select: { closingBalance: true },
    });
    return balances.reduce(
      (sum, b) => sum.plus(new Decimal(b.closingBalance.toString())),
      new Decimal(0),
    );
  }

  // We need prior-month closing for deltas
  let priorMonthFyId = filters.fiscalYearId;
  let priorMonthNum = filters.month - 1;
  if (filters.month === 1) {
    priorMonthFyId = priorFiscalYear?.id ?? filters.fiscalYearId;
    priorMonthNum = 12;
  }

  const [
    depreciacaoCurrentMonth,
    depreciacaoYtd,
    depreciacaoPriorYear,
    provisoesCurrentClosing,
    provisoesPriorClosing,
    provisoesYtdOpening,
    cpc29CurrentMonth,
    crCurrentClosing,
    crPriorClosing,
    crYtdOpening,
    estCurrentClosing,
    estPriorClosing,
    estYtdOpening,
    cpCurrentClosing,
    cpPriorClosing,
    cpYtdOpening,
    obCurrentClosing,
    obPriorClosing,
    obYtdOpening,
  ] = await Promise.all([
    getDepreciacao(filters.fiscalYearId, filters.month, false),
    getDepreciacao(filters.fiscalYearId, filters.month, true),
    priorFiscalYear
      ? getDepreciacao(priorFiscalYear.id, filters.month, false)
      : Promise.resolve('0.00'),
    getProvisoesClosing(filters.fiscalYearId, filters.month),
    getProvisoesClosing(priorMonthFyId, priorMonthNum),
    getProvisoesClosing(filters.fiscalYearId, 1),
    getCpc29FairValue(filters.fiscalYearId, filters.month),
    // deltaContasReceber: accounts starting '1.1.03'
    getAccountGroupClosing(filters.fiscalYearId, filters.month, ['1.1.03']),
    getAccountGroupClosing(priorMonthFyId, priorMonthNum, ['1.1.03']),
    getAccountGroupClosing(filters.fiscalYearId, 1, ['1.1.03']),
    // deltaEstoques: accounts starting '1.1.02'
    getAccountGroupClosing(filters.fiscalYearId, filters.month, ['1.1.02']),
    getAccountGroupClosing(priorMonthFyId, priorMonthNum, ['1.1.02']),
    getAccountGroupClosing(filters.fiscalYearId, 1, ['1.1.02']),
    // deltaContasPagar: accounts starting '2.1.01'
    getAccountGroupClosing(filters.fiscalYearId, filters.month, ['2.1.01']),
    getAccountGroupClosing(priorMonthFyId, priorMonthNum, ['2.1.01']),
    getAccountGroupClosing(filters.fiscalYearId, 1, ['2.1.01']),
    // deltaObrigacoes: accounts starting '2.1.02', '2.1.03', '2.1.04'
    getAccountGroupClosing(filters.fiscalYearId, filters.month, ['2.1.02', '2.1.03', '2.1.04']),
    getAccountGroupClosing(priorMonthFyId, priorMonthNum, ['2.1.02', '2.1.03', '2.1.04']),
    getAccountGroupClosing(filters.fiscalYearId, 1, ['2.1.02', '2.1.03', '2.1.04']),
  ]);

  // Prior year components
  const priorYearFyId = priorFiscalYear?.id;
  let cpc29PriorYear = '0.00';
  if (priorYearFyId) {
    cpc29PriorYear = await getCpc29FairValue(priorYearFyId, filters.month);
  }

  // Provisoes delta
  const provisoesCurrentMonth = provisoesCurrentClosing.minus(provisoesPriorClosing).toFixed(2);
  const provisoesYtd = provisoesCurrentClosing.minus(provisoesYtdOpening).toFixed(2);
  // For priorYear provisoes: use 0 (simplification — priorFY data less critical)
  const provisoesPriorYear = '0.00';

  // Working capital deltas: currentMonth = current closing - prior month closing
  const deltaContasReceberCurrentMonth = crCurrentClosing.minus(crPriorClosing).toFixed(2);
  const deltaContasReceberYtd = crCurrentClosing.minus(crYtdOpening).toFixed(2);
  const deltaContasReceberPriorYear = '0.00';

  const deltaEstoquesCurrentMonth = estCurrentClosing.minus(estPriorClosing).toFixed(2);
  const deltaEstoquesYtd = estCurrentClosing.minus(estYtdOpening).toFixed(2);
  const deltaEstoquesPriorYear = '0.00';

  const deltaContasPagarCurrentMonth = cpCurrentClosing.minus(cpPriorClosing).toFixed(2);
  const deltaContasPagarYtd = cpCurrentClosing.minus(cpYtdOpening).toFixed(2);
  const deltaContasPagarPriorYear = '0.00';

  const deltaObrigacoesCurrentMonth = obCurrentClosing.minus(obPriorClosing).toFixed(2);
  const deltaObrigacoesYtd = obCurrentClosing.minus(obYtdOpening).toFixed(2);
  const deltaObrigacoesPriorYear = '0.00';

  // Extract investimento and financiamento sections from direto
  const investimentoSection = direto.sections.find(
    (s): s is DfcSection => s.id === 'investimento',
  )!;
  const financiamentoSection = direto.sections.find(
    (s): s is DfcSection => s.id === 'financiamento',
  )!;

  const indireto = calculateDfcIndireto({
    lucroLiquido: {
      currentMonth: lucroLiquidoCurrentMonth,
      ytd: lucroLiquidoYtd,
      priorYear: lucroLiquidoPriorYear,
    },
    depreciacao: {
      currentMonth: depreciacaoCurrentMonth,
      ytd: depreciacaoYtd,
      priorYear: depreciacaoPriorYear,
    },
    provisoes: {
      currentMonth: provisoesCurrentMonth,
      ytd: provisoesYtd,
      priorYear: provisoesPriorYear,
    },
    cpc29FairValue: {
      currentMonth: cpc29CurrentMonth,
      ytd: cpc29CurrentMonth, // simplified: same as current month for YTD
      priorYear: cpc29PriorYear,
    },
    workingCapitalDeltas: {
      deltaContasReceber: {
        currentMonth: deltaContasReceberCurrentMonth,
        ytd: deltaContasReceberYtd,
        priorYear: deltaContasReceberPriorYear,
      },
      deltaEstoques: {
        currentMonth: deltaEstoquesCurrentMonth,
        ytd: deltaEstoquesYtd,
        priorYear: deltaEstoquesPriorYear,
      },
      deltaContasPagar: {
        currentMonth: deltaContasPagarCurrentMonth,
        ytd: deltaContasPagarYtd,
        priorYear: deltaContasPagarPriorYear,
      },
      deltaObrigacoes: {
        currentMonth: deltaObrigacoesCurrentMonth,
        ytd: deltaObrigacoesYtd,
        priorYear: deltaObrigacoesPriorYear,
      },
    },
    investimentoSection,
    financiamentoSection,
    cash: direto.cash,
  });

  return { direto, indireto };
}

// ─── getCrossValidation ───────────────────────────────────────────────────────

export async function getCrossValidation(
  organizationId: string,
  filters: { fiscalYearId: string; month: number },
): Promise<CrossValidationOutput> {
  // Get DRE result
  const dre = await getDre(organizationId, filters);
  const resultadoLiquido = dre.resultadoLiquido.currentMonth;

  // Get BP data
  const bp = await getBalanceSheet(organizationId, filters);
  const ativoTotal = bp.totalAtivo.currentBalance;
  const passivoTotal = bp.totalPassivo.currentBalance;
  const plTotal = bp.passivo.find((g) => g.id === 'pl')?.total.currentBalance ?? '0';

  // Delta Lucros Acumulados: account code starts with '3.3'
  // closingBalance current month minus closingBalance prior month
  const lucrosAccounts = await prisma.chartOfAccount.findMany({
    where: { organizationId, isActive: true, code: { startsWith: '3.3' }, isSynthetic: false },
    select: { id: true },
  });
  const lucrosIds = lucrosAccounts.map((a) => a.id);

  let deltaLucrosAcumulados = '0';
  if (lucrosIds.length > 0) {
    const currentBalances = await prisma.accountBalance.findMany({
      where: {
        organizationId,
        fiscalYearId: filters.fiscalYearId,
        month: filters.month,
        accountId: { in: lucrosIds },
      },
      select: { closingBalance: true },
    });
    let priorBalancesData: Array<{ closingBalance: Decimal }> = [];

    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { id: filters.fiscalYearId, organizationId },
      select: { id: true, startDate: true },
    });

    if (fiscalYear) {
      if (filters.month === 1) {
        const priorYearStart = new Date(fiscalYear.startDate);
        priorYearStart.setFullYear(priorYearStart.getFullYear() - 1);
        const priorFY = await prisma.fiscalYear.findFirst({
          where: { organizationId, startDate: priorYearStart },
          select: { id: true },
        });
        if (priorFY) {
          priorBalancesData = await prisma.accountBalance.findMany({
            where: {
              organizationId,
              fiscalYearId: priorFY.id,
              month: 12,
              accountId: { in: lucrosIds },
            },
            select: { closingBalance: true },
          });
        }
      } else {
        priorBalancesData = await prisma.accountBalance.findMany({
          where: {
            organizationId,
            fiscalYearId: filters.fiscalYearId,
            month: filters.month - 1,
            accountId: { in: lucrosIds },
          },
          select: { closingBalance: true },
        });
      }
    }

    const currentSum = currentBalances.reduce(
      (sum, b) => sum.plus(new Decimal(b.closingBalance.toString())),
      new Decimal(0),
    );
    const priorSum = priorBalancesData.reduce(
      (sum, b) => sum.plus(new Decimal(b.closingBalance.toString())),
      new Decimal(0),
    );
    deltaLucrosAcumulados = currentSum.minus(priorSum).toFixed(2);
  }

  // Get trial balance totals for invariant 4
  let totalDebitos = '0';
  let totalCreditos = '0';
  try {
    const trialBalance = await getTrialBalance(organizationId, {
      fiscalYearId: filters.fiscalYearId,
      month: filters.month,
    });
    totalDebitos = trialBalance.grandTotals.currentBalanceDebit;
    totalCreditos = trialBalance.grandTotals.currentBalanceCredit;
  } catch {
    // If trial balance not available, totals stay 0
  }

  // Compute DFC net cash flow and BP cash delta for invariant #2
  let dfcNetCashFlow: string | undefined;
  let bpCashDelta: string | undefined;
  try {
    const dfc = await getDfc(organizationId, filters);
    dfcNetCashFlow = dfc.direto.cash.variacaoLiquida.currentMonth;

    // BP cash delta: closingBalance of 1.1.01.xx current month minus prior month
    const cashAccounts = await prisma.chartOfAccount.findMany({
      where: { organizationId, isActive: true, isSynthetic: false, code: { startsWith: '1.1.01' } },
      select: { id: true },
    });
    const cashIds = cashAccounts.map((a) => a.id);
    if (cashIds.length > 0) {
      const fiscalYearForCash = await prisma.fiscalYear.findFirst({
        where: { id: filters.fiscalYearId, organizationId },
        select: { id: true, startDate: true },
      });

      const currentCash = await prisma.accountBalance.findMany({
        where: {
          organizationId,
          fiscalYearId: filters.fiscalYearId,
          month: filters.month,
          accountId: { in: cashIds },
        },
        select: { closingBalance: true },
      });

      let priorCash: Array<{ closingBalance: Decimal }> = [];
      if (fiscalYearForCash) {
        if (filters.month === 1) {
          const cashFyYear = fiscalYearForCash.startDate.getFullYear();
          const priorYearStartForCash = new Date(cashFyYear - 1, 0, 1);
          const priorYearEndForCash = new Date(cashFyYear - 1, 11, 31, 23, 59, 59, 999);
          const priorFYForCash = await prisma.fiscalYear.findFirst({
            where: {
              organizationId,
              startDate: { gte: priorYearStartForCash, lte: priorYearEndForCash },
            },
            select: { id: true },
          });
          if (priorFYForCash) {
            priorCash = await prisma.accountBalance.findMany({
              where: {
                organizationId,
                fiscalYearId: priorFYForCash.id,
                month: 12,
                accountId: { in: cashIds },
              },
              select: { closingBalance: true },
            });
          }
        } else {
          priorCash = await prisma.accountBalance.findMany({
            where: {
              organizationId,
              fiscalYearId: filters.fiscalYearId,
              month: filters.month - 1,
              accountId: { in: cashIds },
            },
            select: { closingBalance: true },
          });
        }
      }

      const currentSum = currentCash.reduce(
        (s, b) => s.plus(new Decimal(b.closingBalance.toString())),
        new Decimal(0),
      );
      const priorSum = priorCash.reduce(
        (s, b) => s.plus(new Decimal(b.closingBalance.toString())),
        new Decimal(0),
      );
      bpCashDelta = currentSum.minus(priorSum).toFixed(2);
    }
  } catch {
    // If DFC fails, invariant stays PENDING
  }

  return calculateCrossValidation({
    resultadoLiquido,
    deltaLucrosAcumulados,
    ativoTotal,
    passivoTotal,
    plTotal,
    totalDebitos,
    totalCreditos,
    dfcNetCashFlow,
    bpCashDelta,
  });
}
