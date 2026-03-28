// ─── HR Dashboard Service ─────────────────────────────────────────────
// INTEGR-03: Aggregation endpoint for HR KPIs.
// All data is read-only from existing models — no writes.
//
// Turnover rate: standard HR formula ((admissions + terminations) / 2) / avg_headcount * 100
// Note: rehires within 12 months count as both a termination and admission — this is
// correct per the standard formula and documents workforce movement, not unique people.

import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import type { HrDashboardQuery, HrDashboardResponse } from './hr-dashboard.types';

// ─── Helpers ─────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatYearMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toNumber(v: Decimal | null | undefined): number {
  if (v == null) return 0;
  return v.toNumber();
}

// ─── Public API ───────────────────────────────────────────────────────

export async function getHrDashboard(
  rls: RlsContext,
  query: HrDashboardQuery,
): Promise<HrDashboardResponse> {
  const { organizationId } = rls;
  const { farmId, year, month } = query;

  // Reference month as UTC date (first day of month)
  const referenceMonth = new Date(Date.UTC(year, month - 1, 1));
  const today = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
  );
  const twelveMonthsAgo = addMonths(today, -12);

  // ─── Headcount ──────────────────────────────────────────────────────

  // Determine employee filter: if farmId, restrict to employees linked to that farm
  const employeeIdFilter = farmId ? await _getEmployeeIdsForFarm(organizationId, farmId) : null;

  const headcount = await _getHeadcount(organizationId, employeeIdFilter);

  // ─── Current Month Cost ─────────────────────────────────────────────

  const currentRun = await prisma.payrollRun.findFirst({
    where: {
      organizationId,
      status: 'COMPLETED',
      referenceMonth: referenceMonth,
    },
    select: {
      id: true,
      totalGross: true,
      totalNet: true,
      totalCharges: true,
      employeeCount: true,
    },
  });

  const currentMonthCost = await _buildCurrentMonthCost(
    organizationId,
    currentRun,
    headcount.total,
    farmId,
  );

  // ─── Trend 12 Months ────────────────────────────────────────────────
  // Use pre-computed PayrollRun.totalGross/totalNet/totalCharges (Pitfall 4)

  const trend12Months = await _getTrend12Months(organizationId, referenceMonth);

  // ─── Composition ────────────────────────────────────────────────────
  // For the current run, break down by rubrica categories from PayrollRunItems

  const composition = currentRun ? await _getComposition(currentRun.id) : _emptyComposition();

  // ─── Cost By Activity ───────────────────────────────────────────────

  const costByActivity = await _getCostByActivity(organizationId, referenceMonth, farmId);

  // ─── Turnover ───────────────────────────────────────────────────────

  const turnover = await _getTurnover(organizationId, twelveMonthsAgo, employeeIdFilter);

  // ─── Upcoming Contract Expirations ──────────────────────────────────

  const upcomingContractExpirations = await _getUpcomingExpirations(organizationId, today, farmId);

  // ─── Alerts ─────────────────────────────────────────────────────────

  const alerts = await _getAlerts(organizationId, today);

  return {
    headcount,
    currentMonthCost,
    trend12Months,
    composition,
    costByActivity,
    turnover,
    upcomingContractExpirations,
    alerts,
  };
}

// ─── Private Helpers ─────────────────────────────────────────────────

async function _getEmployeeIdsForFarm(organizationId: string, farmId: string): Promise<string[]> {
  const links = await prisma.employeeFarm.findMany({
    where: {
      farmId,
      employee: { organizationId },
    },
    select: { employeeId: true },
  });
  return links.map((l) => l.employeeId);
}

async function _getHeadcount(
  organizationId: string,
  employeeIdFilter: string[] | null,
): Promise<HrDashboardResponse['headcount']> {
  const _where = {
    organizationId,
    ...(employeeIdFilter ? { id: { in: employeeIdFilter } } : {}),
    status: { not: 'DESLIGADO' as const },
  };

  // Count by status (all non-terminated employees)
  const byStatusRaw = await prisma.employee.groupBy({
    by: ['status'],
    where: {
      organizationId,
      ...(employeeIdFilter ? { id: { in: employeeIdFilter } } : {}),
      status: { not: 'DESLIGADO' as const },
    },
    _count: { id: true },
  });

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of byStatusRaw) {
    byStatus[row.status] = row._count.id;
    total += row._count.id;
  }

  // Count by contract type (active contracts only)
  const byContractRaw = await prisma.employeeContract.groupBy({
    by: ['contractType'],
    where: {
      organizationId,
      isActive: true,
      ...(employeeIdFilter ? { employeeId: { in: employeeIdFilter } } : {}),
    },
    _count: { id: true },
  });

  const byContractType: Record<string, number> = {};
  for (const row of byContractRaw) {
    byContractType[row.contractType] = row._count.id;
  }

  return { total, byStatus, byContractType };
}

async function _buildCurrentMonthCost(
  organizationId: string,
  run: {
    totalGross: Decimal | null;
    totalNet: Decimal | null;
    totalCharges: Decimal | null;
    employeeCount: number;
  } | null,
  headcountTotal: number,
  farmId: string | undefined,
): Promise<HrDashboardResponse['currentMonthCost']> {
  if (!run) {
    return { gross: 0, net: 0, charges: 0, avgPerEmployee: 0, costPerHectare: null };
  }

  const gross = new Decimal(run.totalGross?.toString() ?? 0);
  const net = new Decimal(run.totalNet?.toString() ?? 0);
  const charges = new Decimal(run.totalCharges?.toString() ?? 0);

  const employeeCount =
    headcountTotal > 0 ? headcountTotal : run.employeeCount > 0 ? run.employeeCount : 1;
  const avgPerEmployee = gross.div(employeeCount);

  let costPerHectare: number | null = null;

  if (farmId) {
    const farm = await prisma.farm.findFirst({
      where: { id: farmId, organizationId },
      select: { totalAreaHa: true },
    });
    if (farm?.totalAreaHa && new Decimal(farm.totalAreaHa.toString()).gt(0)) {
      costPerHectare = gross.div(new Decimal(farm.totalAreaHa.toString())).toNumber();
    }
  } else {
    const farms = await prisma.farm.findMany({
      where: { organizationId },
      select: { totalAreaHa: true },
    });
    const totalHa = farms.reduce(
      (sum, f) => sum.plus(f.totalAreaHa ? new Decimal(f.totalAreaHa.toString()) : new Decimal(0)),
      new Decimal(0),
    );
    if (totalHa.gt(0)) {
      costPerHectare = gross.div(totalHa).toNumber();
    }
  }

  return {
    gross: toNumber(gross),
    net: toNumber(net),
    charges: toNumber(charges),
    avgPerEmployee: toNumber(avgPerEmployee),
    costPerHectare,
  };
}

async function _getTrend12Months(
  organizationId: string,
  referenceMonth: Date,
): Promise<HrDashboardResponse['trend12Months']> {
  // Find last 12 COMPLETED runs up to and including referenceMonth
  const runs = await prisma.payrollRun.findMany({
    where: {
      organizationId,
      status: 'COMPLETED',
      referenceMonth: { lte: referenceMonth },
    },
    select: {
      referenceMonth: true,
      totalGross: true,
      totalNet: true,
      totalCharges: true,
    },
    orderBy: { referenceMonth: 'desc' },
    take: 12,
  });

  // Return in ascending order for chart display
  return runs.reverse().map((r) => ({
    yearMonth: formatYearMonth(r.referenceMonth),
    gross: toNumber(r.totalGross),
    net: toNumber(r.totalNet),
    charges: toNumber(r.totalCharges),
  }));
}

async function _getComposition(runId: string): Promise<HrDashboardResponse['composition']> {
  const items = await prisma.payrollRunItem.findMany({
    where: { payrollRunId: runId },
    select: {
      grossSalary: true,
      overtime50: true,
      overtime100: true,
      inssPatronal: true,
      fgtsAmount: true,
      vtDeduction: true,
      foodDeduction: true,
      housingDeduction: true,
    },
  });

  if (items.length === 0) {
    return _emptyComposition();
  }

  let salarios = new Decimal(0);
  let horasExtras = new Decimal(0);
  let encargos = new Decimal(0);
  let beneficios = new Decimal(0);

  for (const item of items) {
    const ot50 = new Decimal(item.overtime50.toString());
    const ot100 = new Decimal(item.overtime100.toString());
    const totalOvertime = ot50.plus(ot100);
    const gross = new Decimal(item.grossSalary.toString());

    horasExtras = horasExtras.plus(totalOvertime);
    // Salarios = gross - overtime portion
    salarios = salarios.plus(gross.minus(totalOvertime));

    encargos = encargos.plus(
      new Decimal(item.inssPatronal.toString()).plus(new Decimal(item.fgtsAmount.toString())),
    );

    beneficios = beneficios.plus(
      new Decimal(item.vtDeduction.toString())
        .plus(new Decimal(item.foodDeduction.toString()))
        .plus(new Decimal(item.housingDeduction.toString())),
    );
  }

  const total = salarios.plus(horasExtras).plus(encargos).plus(beneficios);

  if (total.eq(0)) {
    return _emptyComposition();
  }

  const categories = [
    { label: 'Salários', amount: salarios },
    { label: 'Horas Extras', amount: horasExtras },
    { label: 'Encargos Patronais', amount: encargos },
    { label: 'Benefícios', amount: beneficios },
  ];

  const result = categories
    .filter((c) => c.amount.gt(0))
    .map((c) => ({
      label: c.label,
      amount: toNumber(c.amount),
      percentage: toNumber(c.amount.div(total).times(100).toDecimalPlaces(2)),
    }));

  return result;
}

function _emptyComposition(): HrDashboardResponse['composition'] {
  return [];
}

async function _getCostByActivity(
  organizationId: string,
  referenceMonth: Date,
  farmId: string | undefined,
): Promise<HrDashboardResponse['costByActivity']> {
  const monthStart = referenceMonth;
  const monthEnd = addMonths(referenceMonth, 1);

  const activities = await prisma.timeEntryActivity.groupBy({
    by: ['operationType'],
    where: {
      timeEntry: {
        organizationId,
        date: { gte: monthStart, lt: monthEnd },
        ...(farmId ? { farmId } : {}),
      },
    },
    _sum: { costAmount: true },
  });

  return activities
    .filter((a) => a._sum.costAmount != null)
    .map((a) => ({
      activityType: a.operationType,
      totalCost: toNumber(a._sum.costAmount),
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

async function _getTurnover(
  organizationId: string,
  twelveMonthsAgo: Date,
  employeeIdFilter: string[] | null,
): Promise<HrDashboardResponse['turnover']> {
  const baseWhere = {
    employee: { organizationId },
    ...(employeeIdFilter ? { employeeId: { in: employeeIdFilter } } : {}),
    effectiveAt: { gte: twelveMonthsAgo },
  };

  const admissionsLast12 = await prisma.employeeStatusHistory.count({
    where: {
      ...baseWhere,
      toStatus: 'ATIVO',
    },
  });

  const terminationsLast12 = await prisma.employeeStatusHistory.count({
    where: {
      ...baseWhere,
      toStatus: 'DESLIGADO',
    },
  });

  // Average headcount: use current active count as approximation
  const avgHeadcount = await prisma.employee.count({
    where: {
      organizationId,
      ...(employeeIdFilter ? { id: { in: employeeIdFilter } } : {}),
    },
  });

  const rate =
    avgHeadcount > 0
      ? new Decimal(admissionsLast12 + terminationsLast12)
          .div(2)
          .div(avgHeadcount)
          .times(100)
          .toDecimalPlaces(2)
          .toNumber()
      : 0;

  return {
    last12MonthsRate: rate,
    terminationsLast12,
    admissionsLast12,
  };
}

async function _getUpcomingExpirations(
  organizationId: string,
  today: Date,
  farmId: string | undefined,
): Promise<HrDashboardResponse['upcomingContractExpirations']> {
  const in90Days = addDays(today, 90);

  const contracts = await prisma.employeeContract.findMany({
    where: {
      organizationId,
      isActive: true,
      contractType: { in: ['SEASONAL', 'CLT_DETERMINATE', 'TRIAL'] },
      endDate: {
        gte: today,
        lte: in90Days,
      },
      ...(farmId
        ? {
            employee: {
              farms: {
                some: { farmId },
              },
            },
          }
        : {}),
    },
    include: {
      employee: {
        select: { id: true, name: true },
      },
    },
    orderBy: { endDate: 'asc' },
  });

  const bucket30: typeof contracts = [];
  const bucket60: typeof contracts = [];
  const bucket90: typeof contracts = [];

  const in30Days = addDays(today, 30);
  const in60Days = addDays(today, 60);

  for (const c of contracts) {
    if (!c.endDate) continue;
    if (c.endDate <= in30Days) {
      bucket30.push(c);
    } else if (c.endDate <= in60Days) {
      bucket60.push(c);
    } else {
      bucket90.push(c);
    }
  }

  function toEmployeeList(
    bucket: typeof contracts,
  ): Array<{ id: string; name: string; endDate: string; contractType: string }> {
    return bucket.map((c) => ({
      id: c.employee.id,
      name: c.employee.name,
      endDate: c.endDate!.toISOString().split('T')[0],
      contractType: c.contractType,
    }));
  }

  return [
    { days: 30, count: bucket30.length, employees: toEmployeeList(bucket30) },
    { days: 60, count: bucket60.length, employees: toEmployeeList(bucket60) },
    { days: 90, count: bucket90.length, employees: toEmployeeList(bucket90) },
  ];
}

async function _getAlerts(
  organizationId: string,
  today: Date,
): Promise<HrDashboardResponse['alerts']> {
  const overduePayablesPayroll = await prisma.payable.count({
    where: {
      organizationId,
      category: 'PAYROLL',
      status: 'OVERDUE',
    },
  });

  const pendingTimesheets = await prisma.timesheet.count({
    where: {
      organizationId,
      status: 'PENDING_RH',
    },
  });

  const expiredContracts = await prisma.employeeContract.count({
    where: {
      organizationId,
      isActive: true,
      endDate: { lt: today },
    },
  });

  return {
    overduePayablesPayroll,
    pendingTimesheets,
    expiredContracts,
  };
}
