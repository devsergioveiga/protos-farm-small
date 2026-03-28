// ─── Financial Statements Service ────────────────────────────────────────────
// DB queries and calculator orchestration for DRE, BP, and cross-validation.
// Follows the same pattern as ledger.service.ts (prisma direct, no withRlsContext).

import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import { calculateDre } from './dre.calculator';
import { calculateBp } from './bp.calculator';
import { calculateCrossValidation } from './cross-validation.calculator';
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

// ─── getDre ──────────────────────────────────────────────────────────────────

export async function getDre(
  organizationId: string,
  filters: DreFilters,
): Promise<DreOutput & { marginRanking?: MarginRankingItem[] }> {
  // Verify fiscal year exists
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: filters.fiscalYearId, organizationId },
    select: { id: true, startDate: true, endDate: true, year: true },
  });

  if (!fiscalYear) {
    throw new FinancialStatementsError('Exercício fiscal não encontrado', 'FISCAL_YEAR_NOT_FOUND', 404);
  }

  // Find prior fiscal year (previous year, same org)
  const priorFiscalYear = await prisma.fiscalYear.findFirst({
    where: { organizationId, year: fiscalYear.year - 1 },
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
    type YtdRow = { accountId: string; debitTotal: Decimal; creditTotal: Decimal };
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
        { debitTotal: r._sum.debitTotal ?? new Decimal(0), creditTotal: r._sum.creditTotal ?? new Decimal(0) },
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
    const marginRanking = await computeMarginRanking(organizationId, fiscalYear, filters.month);

    const result = calculateDre({ accounts: accountDataList });
    return { ...result, marginRanking };
  } else {
    // ─── CC-filtered path: aggregate from JournalEntryLine ────────────────

    // Date ranges
    const year = fiscalYear.year;
    const monthStart = new Date(year, filters.month - 1, 1);
    const monthEnd = new Date(year, filters.month, 0, 23, 59, 59, 999);
    const ytdStart = new Date(year, 0, 1);

    type JelAggRow = { accountId: string; side: string; total: Decimal };

    async function queryJelAgg(startDate: Date, endDate: Date): Promise<JelAggRow[]> {
      const rows = await prisma.$queryRaw<Array<{ accountId: string; side: string; total: unknown }>>`
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
  const rows = await prisma.$queryRaw<Array<{
    costCenterId: string;
    costCenterName: string;
    accountCode: string;
    side: string;
    total: unknown;
  }>>`
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
      ccMap.set(row.costCenterId, { name: row.costCenterName, revenue: new Decimal(0), cpv: new Decimal(0) });
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

  return items.sort((a, b) => new Decimal(b.grossMargin).minus(new Decimal(a.grossMargin)).toNumber());
}

// ─── getBalanceSheet ──────────────────────────────────────────────────────────

export async function getBalanceSheet(
  organizationId: string,
  filters: BpFilters,
): Promise<BpOutput> {
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: filters.fiscalYearId, organizationId },
    select: { id: true, year: true },
  });

  if (!fiscalYear) {
    throw new FinancialStatementsError('Exercício fiscal não encontrado', 'FISCAL_YEAR_NOT_FOUND', 404);
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
    const priorFiscalYear = await prisma.fiscalYear.findFirst({
      where: { organizationId, year: fiscalYear.year - 1 },
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
    const dre = await getDre(organizationId, { fiscalYearId: filters.fiscalYearId, month: filters.month });
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
    select: { id: true, year: true },
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
      const priorFY = await prisma.fiscalYear.findFirst({
        where: { organizationId, year: fiscalYear.year - 1 },
        select: { id: true },
      });
      if (priorFY) {
        months.push({ fiscalYearId: priorFY.id, month: 12 + m, displayMonth: 12 + m });
      }
    }
  }

  const analyticIds = allAccounts.filter((a) => !a.isSynthetic).map((a) => a.id);
  const analyticCodes = allAccounts.filter((a) => !a.isSynthetic).reduce(
    (map, a) => { map.set(a.id, a.code); return map; },
    new Map<string, string>(),
  );
  const analyticTypes = allAccounts.filter((a) => !a.isSynthetic).reduce(
    (map, a) => { map.set(a.id, a.accountType); return map; },
    new Map<string, string>(),
  );

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
      where: { organizationId, fiscalYearId: filters.fiscalYearId, month: filters.month, accountId: { in: lucrosIds } },
      select: { closingBalance: true },
    });
    let priorBalancesData: Array<{ closingBalance: Decimal }> = [];

    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { id: filters.fiscalYearId, organizationId },
      select: { id: true, year: true },
    });

    if (fiscalYear) {
      if (filters.month === 1) {
        const priorFY = await prisma.fiscalYear.findFirst({
          where: { organizationId, year: fiscalYear.year - 1 },
          select: { id: true },
        });
        if (priorFY) {
          priorBalancesData = await prisma.accountBalance.findMany({
            where: { organizationId, fiscalYearId: priorFY.id, month: 12, accountId: { in: lucrosIds } },
            select: { closingBalance: true },
          });
        }
      } else {
        priorBalancesData = await prisma.accountBalance.findMany({
          where: { organizationId, fiscalYearId: filters.fiscalYearId, month: filters.month - 1, accountId: { in: lucrosIds } },
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

  return calculateCrossValidation({
    resultadoLiquido,
    deltaLucrosAcumulados,
    ativoTotal,
    passivoTotal,
    plTotal,
    totalDebitos,
    totalCreditos,
  });
}
