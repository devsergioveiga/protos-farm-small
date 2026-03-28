import Decimal from 'decimal.js';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { calculateINSS, calculateIRRF } from '../payroll-engine/payroll-engine.service';
import { payrollTablesService } from '../payroll-tables/payroll-tables.service';
import type { EngineParams } from '../payroll-runs/payroll-runs.types';
import type {
  VacationCalcInput,
  VacationCalcResult,
  ScheduleVacationInput,
  VacationPeriodOutput,
  VacationScheduleOutput,
  ListScheduleFilters,
} from './vacation-schedules.types';
import { VacationError } from './vacation-schedules.types';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

// ─── Load Engine Params ──────────────────────────────────────────────

export async function loadVacationEngineParams(
  orgId: string,
  referenceDate: Date,
): Promise<EngineParams> {
  const [inssTable, irrfTable, salaryFamilyTable, miscTable] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payrollTablesService.getEffective(orgId, 'INSS_BRACKETS' as any, referenceDate),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payrollTablesService.getEffective(orgId, 'IRRF_BRACKETS' as any, referenceDate),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payrollTablesService.getEffective(orgId, 'SALARY_FAMILY' as any, referenceDate),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payrollTablesService.getEffective(orgId, 'MISC_SCALARS' as any, referenceDate),
  ]);

  const scalarMap = new Map<string, Decimal>();
  for (const row of miscTable?.scalarValues ?? []) {
    scalarMap.set(row.key, new Decimal(row.value.toString()));
  }
  for (const row of salaryFamilyTable?.scalarValues ?? []) {
    scalarMap.set(row.key, new Decimal(row.value.toString()));
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inssBrackets: (inssTable?.brackets ?? []).map((b: any) => ({
      from: new Decimal(b.fromValue.toString()),
      upTo: b.upTo !== null ? new Decimal(b.upTo.toString()) : null,
      rate: new Decimal(b.rate.toString()),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    irrfBrackets: (irrfTable?.brackets ?? []).map((b: any) => ({
      upTo: b.upTo !== null ? new Decimal(b.upTo.toString()) : null,
      rate: new Decimal(b.rate.toString()),
      deduction: new Decimal((b.deduction ?? 0).toString()),
    })),
    inssCeiling: scalarMap.get('INSS_CEILING') ?? new Decimal(7786.02),
    dependentDeduction: scalarMap.get('DEPENDENT_DEDUCTION') ?? new Decimal(189.59),
    irrfExemptionLimit: scalarMap.get('IRRF_EXEMPTION') ?? new Decimal(3036.0),
    redutorUpperLimit: scalarMap.get('REDUTOR_UPPER') ?? new Decimal(20000),
    redutorA: scalarMap.get('REDUTOR_A') ?? new Decimal(564.8),
    redutorB: scalarMap.get('REDUTOR_B') ?? new Decimal(142.8),
    salaryFamilyValuePerChild: scalarMap.get('SALARY_FAMILY_VALUE') ?? new Decimal(62.04),
    salaryFamilyIncomeLimit: scalarMap.get('SALARY_FAMILY_LIMIT') ?? new Decimal(1819.26),
    ratPercent: scalarMap.get('RAT_PERCENT') ?? new Decimal(3),
  };
}

// ─── Calculation ─────────────────────────────────────────────────────

/**
 * Pure function: calculates vacation pay following CLT Art. 142 + TST OJ 386.
 * Abono pecuniário (Art. 143) is exempt from INSS/IRRF.
 */
export function calculateVacationPay(
  input: VacationCalcInput,
  params: EngineParams,
): VacationCalcResult {
  // dailyRate = baseSalary / 30
  const dailyRate = input.baseSalary.div(30);
  // vacationBase = dailyRate × daysScheduled
  const vacationBase = dailyRate.mul(input.daysScheduled);
  // bonusThird = (vacationBase + avgOvertime + avgNight) / 3 — CLT Art. 142
  const bonusThird = vacationBase.add(input.avgOvertime).add(input.avgNight).div(3);
  // abonoValue = dailyRate × abonoDays × (4/3) — NOT subject to INSS/IRRF (OJ 386)
  const abonoValue = dailyRate.mul(input.abonoDays).mul(new Decimal('1.333333'));
  // grossTaxable = vacationBase + bonusThird + averages (abono excluded)
  const grossTaxable = vacationBase.add(bonusThird).add(input.avgOvertime).add(input.avgNight);

  // INSS on grossTaxable (same brackets as monthly payroll)
  const inssResult = calculateINSS(grossTaxable, params.inssBrackets, params.inssCeiling);
  const inssAmount = inssResult.contribution;

  // IRRF on grossTaxable - INSS - dependentDeductions
  const irrfResult = calculateIRRF({
    grossSalary: grossTaxable,
    inssContribution: inssAmount,
    dependents: input.dependentCount,
    alimony: new Decimal(0),
    brackets: params.irrfBrackets,
    dependentDeduction: params.dependentDeduction,
    exemptionLimit: params.irrfExemptionLimit,
    redutorUpperLimit: params.redutorUpperLimit,
    redutorA: params.redutorA,
    redutorB: params.redutorB,
  });
  const irrfAmount = irrfResult.finalTax;

  // FGTS on full gross (CLT Art. 28 §9 — FGTS base includes abono base)
  const fgtsAmount = grossTaxable.mul(new Decimal('0.08')).toDecimalPlaces(2);

  // net = grossTaxable - inss - irrf + abonoValue
  const netAmount = grossTaxable
    .minus(inssAmount)
    .minus(irrfAmount)
    .plus(abonoValue)
    .toDecimalPlaces(2);

  return {
    vacationBase: vacationBase.toDecimalPlaces(2),
    bonusThird: bonusThird.toDecimalPlaces(2),
    abonoValue: abonoValue.toDecimalPlaces(2),
    grossTaxable: grossTaxable.toDecimalPlaces(2),
    inssAmount,
    irrfAmount,
    fgtsAmount,
    netAmount,
  };
}

// ─── Payment Due Date ────────────────────────────────────────────────

/**
 * CLT Art. 145: vacation payment must be made at least 2 business days before start.
 * Skips weekends (no holiday lib needed for business day calculation — weekends only).
 */
export function calcPaymentDueDate(startDate: Date): Date {
  const date = new Date(startDate);
  let businessDaysToSubtract = 2;

  while (businessDaysToSubtract > 0) {
    date.setUTCDate(date.getUTCDate() - 1);
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // 0 = Sunday, 6 = Saturday
      businessDaysToSubtract--;
    }
  }

  return date;
}

// ─── Fractionation Validation ────────────────────────────────────────

/**
 * CLT Art. 134: vacation can be split into up to 3 fractions.
 * Rules: each fraction >= 5 days; at least one fraction >= 14 days.
 */
export function validateFractionation(
  existingSchedules: Array<{ totalDays: number; status: string }>,
  newTotalDays: number,
  periodDaysEarned: number,
): void {
  const activeSchedules = existingSchedules.filter((s) => s.status !== 'CANCELLED');

  // Max 3 fractions
  if (activeSchedules.length >= 3) {
    throw new VacationError(
      'Máximo de 3 frações de férias atingido para este período aquisitivo',
      422,
      'MAX_FRACTIONS_EXCEEDED',
    );
  }

  // Each fraction must be >= 5 days
  if (newTotalDays < 5) {
    throw new VacationError(
      'Cada fração de férias deve ter no mínimo 5 dias (CLT Art. 134)',
      422,
      'FRACTION_TOO_SHORT',
    );
  }

  // At least one fraction must be >= 14 days (CLT Art. 134 §1)
  const allDays = [...activeSchedules.map((s) => s.totalDays), newTotalDays];
  const hasLongFraction = allDays.some((d) => d >= 14);
  if (!hasLongFraction) {
    throw new VacationError(
      'Pelo menos uma fração de férias deve ter no mínimo 14 dias (CLT Art. 134 §1)',
      422,
      'NO_LONG_FRACTION',
    );
  }

  // Total days must not exceed period balance
  const totalScheduled = activeSchedules.reduce((sum, s) => sum + s.totalDays, 0);
  if (totalScheduled + newTotalDays > periodDaysEarned) {
    throw new VacationError(
      `Total de dias agendados (${totalScheduled + newTotalDays}) excede o saldo do período (${periodDaysEarned})`,
      422,
      'INSUFFICIENT_BALANCE',
    );
  }
}

// ─── Doubling Period Alert ───────────────────────────────────────────

function calcDoublingDeadline(endDate: Date): Date {
  const deadline = new Date(endDate);
  deadline.setUTCFullYear(deadline.getUTCFullYear() + 1);
  return deadline;
}

function isNearDoubling(doublingDeadline: Date, daysAhead: number = 60): boolean {
  const alertDate = new Date(doublingDeadline);
  alertDate.setUTCDate(alertDate.getUTCDate() - daysAhead);
  return new Date() >= alertDate;
}

// ─── Period Management ───────────────────────────────────────────────

/**
 * Creates the first ACCRUING vacation period when employee is admitted.
 */
export async function initVacationPeriod(
  employeeId: string,
  admissionDate: Date,
  ctx: RlsContext,
): Promise<unknown> {
  return withRlsContext(ctx, async (tx) => {
    const endDate = new Date(admissionDate);
    endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
    endDate.setUTCDate(endDate.getUTCDate() - 1);

    return tx.vacationAcquisitivePeriod.create({
      data: {
        employeeId,
        startDate: admissionDate,
        endDate,
        daysEarned: 30,
        daysTaken: 0,
        daysLost: 0,
        status: 'ACCRUING',
      },
    });
  });
}

/**
 * Advances a vacation period from ACCRUING → AVAILABLE and creates the next period.
 */
export async function advancePeriod(periodId: string, ctx: RlsContext): Promise<unknown> {
  return withRlsContext(ctx, async (tx) => {
    const period = await tx.vacationAcquisitivePeriod.findFirst({
      where: { id: periodId },
    });
    if (!period) {
      throw new VacationError('Período aquisitivo não encontrado', 404);
    }
    if (period.status !== 'ACCRUING') {
      throw new VacationError('Apenas períodos ACCRUING podem ser avançados', 400);
    }

    // Transition current period to AVAILABLE
    const updated = await tx.vacationAcquisitivePeriod.update({
      where: { id: periodId },
      data: { status: 'AVAILABLE' },
    });

    // Create next ACCRUING period (starts day after current endDate)
    const nextStart = new Date(period.endDate);
    nextStart.setUTCDate(nextStart.getUTCDate() + 1);
    const nextEnd = new Date(nextStart);
    nextEnd.setUTCFullYear(nextEnd.getUTCFullYear() + 1);
    nextEnd.setUTCDate(nextEnd.getUTCDate() - 1);

    await tx.vacationAcquisitivePeriod.create({
      data: {
        employeeId: period.employeeId,
        startDate: nextStart,
        endDate: nextEnd,
        daysEarned: 30,
        daysTaken: 0,
        daysLost: 0,
        status: 'ACCRUING',
      },
    });

    return updated;
  });
}

// ─── Schedule Vacation ───────────────────────────────────────────────

export async function scheduleVacation(
  input: ScheduleVacationInput,
  ctx: RlsContext,
): Promise<VacationScheduleOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Load acquisitive period
    const period = await tx.vacationAcquisitivePeriod.findFirst({
      where: {
        id: input.acquisitivePeriodId,
        employeeId: input.employeeId,
      },
      include: {
        schedules: {
          where: { status: { not: 'CANCELLED' } },
          select: { totalDays: true, status: true },
        },
      },
    });
    if (!period) {
      throw new VacationError('Período aquisitivo não encontrado', 404);
    }
    if (period.status === 'ACCRUING') {
      throw new VacationError(
        'Férias não podem ser agendadas durante o período aquisitivo (12 meses ainda em andamento)',
        422,
        'PERIOD_STILL_ACCRUING',
      );
    }

    // Validate abono (0 or 10 only)
    if (input.abono !== 0 && input.abono !== 10) {
      throw new VacationError(
        'Abono pecuniário deve ser 0 ou 10 dias (CLT Art. 143)',
        422,
        'INVALID_ABONO',
      );
    }

    // Validate fractionation rules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateFractionation(period.schedules as any[], input.totalDays, period.daysEarned);

    // Load employee to get salary, dependents
    const employee = await tx.employee.findFirst({
      where: { id: input.employeeId },
      include: {
        dependents: { where: { irrf: true } },
        salaryHistory: {
          orderBy: { effectiveAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!employee) {
      throw new VacationError('Colaborador não encontrado', 404);
    }

    const baseSalary = employee.salaryHistory[0]
      ? new Decimal(employee.salaryHistory[0].salary.toString())
      : new Decimal(0);

    // Load engine params
    const startDateObj = new Date(input.startDate);
    const params = await loadVacationEngineParams(input.organizationId, startDateObj);

    // Calculate vacation pay
    const calcInput: VacationCalcInput = {
      baseSalary,
      daysScheduled: input.totalDays,
      abonoDays: input.abono,
      avgOvertime: new Decimal(0), // TODO: compute 12-month avg from payroll history
      avgNight: new Decimal(0),
      dependentCount: employee.dependents.length,
    };
    const calcResult = calculateVacationPay(calcInput, params);

    // Calculate end date and payment due date
    const endDate = new Date(startDateObj);
    endDate.setUTCDate(endDate.getUTCDate() + input.totalDays - 1);
    const paymentDueDate = calcPaymentDueDate(startDateObj);

    // Create schedule
    const schedule = await tx.vacationSchedule.create({
      data: {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        acquisitivePeriodId: input.acquisitivePeriodId,
        startDate: startDateObj,
        endDate,
        totalDays: input.totalDays,
        abono: input.abono,
        grossAmount: calcResult.grossTaxable,
        inssAmount: calcResult.inssAmount,
        irrfAmount: calcResult.irrfAmount,
        netAmount: calcResult.netAmount,
        fgtsAmount: calcResult.fgtsAmount,
        paymentDueDate,
        status: 'SCHEDULED',
        createdBy: input.createdBy,
      },
      include: {
        employee: { select: { name: true } },
      },
    });

    // Update daysTaken on period
    await tx.vacationAcquisitivePeriod.update({
      where: { id: input.acquisitivePeriodId },
      data: {
        daysTaken: { increment: input.totalDays },
        status: 'SCHEDULED',
      },
    });

    return {
      id: schedule.id,
      organizationId: schedule.organizationId,
      employeeId: schedule.employeeId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      employeeName: (schedule.employee as any).name,
      acquisitivePeriodId: schedule.acquisitivePeriodId,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      totalDays: schedule.totalDays,
      abono: schedule.abono,
      grossAmount: new Decimal(schedule.grossAmount.toString()),
      inssAmount: new Decimal(schedule.inssAmount.toString()),
      irrfAmount: new Decimal(schedule.irrfAmount.toString()),
      netAmount: new Decimal(schedule.netAmount.toString()),
      fgtsAmount: new Decimal(schedule.fgtsAmount.toString()),
      paymentDueDate: schedule.paymentDueDate,
      status: schedule.status,
      receiptUrl: schedule.receiptUrl,
      processedAt: schedule.processedAt,
      createdBy: schedule.createdBy,
      createdAt: schedule.createdAt,
    };
  });
}

// ─── Cancel Vacation ────────────────────────────────────────────────

export async function cancelVacation(scheduleId: string, ctx: RlsContext): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const schedule = await tx.vacationSchedule.findFirst({
      where: { id: scheduleId, organizationId: ctx.organizationId },
    });
    if (!schedule) {
      throw new VacationError('Agendamento de férias não encontrado', 404);
    }
    if (schedule.status !== 'SCHEDULED') {
      throw new VacationError('Apenas agendamentos com status SCHEDULED podem ser cancelados', 400);
    }

    await tx.vacationSchedule.update({
      where: { id: scheduleId },
      data: { status: 'CANCELLED' },
    });

    // Return days to the acquisitive period
    await tx.vacationAcquisitivePeriod.update({
      where: { id: schedule.acquisitivePeriodId },
      data: {
        daysTaken: { decrement: schedule.totalDays },
      },
    });
  });
}

// ─── Mark as Paid ────────────────────────────────────────────────────

export async function markAsPaid(scheduleId: string, ctx: RlsContext): Promise<unknown> {
  return withRlsContext(ctx, async (tx) => {
    const schedule = await tx.vacationSchedule.findFirst({
      where: { id: scheduleId, organizationId: ctx.organizationId },
    });
    if (!schedule) {
      throw new VacationError('Agendamento de férias não encontrado', 404);
    }
    if (schedule.status !== 'SCHEDULED') {
      throw new VacationError('Apenas agendamentos SCHEDULED podem ser marcados como PAID', 400);
    }

    return tx.vacationSchedule.update({
      where: { id: scheduleId },
      data: { status: 'PAID', processedAt: new Date() },
    });
  });
}

// ─── List Acquisitive Periods ────────────────────────────────────────

export async function listAcquisitivePeriods(
  employeeId: string,
  orgId: string,
  ctx: RlsContext,
): Promise<VacationPeriodOutput[]> {
  return withRlsContext(ctx, async (tx) => {
    const periods = await tx.vacationAcquisitivePeriod.findMany({
      where: { employeeId },
      include: {
        employee: { select: { organizationId: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    // Filter by org
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgPeriods = periods.filter((p) => (p.employee as any).organizationId === orgId);

    return orgPeriods.map((p) => {
      const doublingDeadline = calcDoublingDeadline(p.endDate);
      return {
        id: p.id,
        employeeId: p.employeeId,
        startDate: p.startDate,
        endDate: p.endDate,
        daysEarned: p.daysEarned,
        daysTaken: p.daysTaken,
        daysLost: p.daysLost,
        balance: p.daysEarned - p.daysTaken,
        status: p.status,
        doublingDeadline,
        isNearDoubling: isNearDoubling(doublingDeadline),
      };
    });
  });
}

// ─── List Schedules ──────────────────────────────────────────────────

export async function listSchedules(
  orgId: string,
  filters: ListScheduleFilters,
  ctx: RlsContext,
): Promise<VacationScheduleOutput[]> {
  return withRlsContext(ctx, async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId: orgId };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.startDate = {};
      if (filters.from) where.startDate.gte = new Date(filters.from);
      if (filters.to) where.startDate.lte = new Date(filters.to);
    }

    const schedules = await tx.vacationSchedule.findMany({
      where,
      include: { employee: { select: { name: true } } },
      orderBy: { startDate: 'desc' },
    });

    return schedules.map((s) => ({
      id: s.id,
      organizationId: s.organizationId,
      employeeId: s.employeeId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      employeeName: (s.employee as any).name,
      acquisitivePeriodId: s.acquisitivePeriodId,
      startDate: s.startDate,
      endDate: s.endDate,
      totalDays: s.totalDays,
      abono: s.abono,
      grossAmount: new Decimal(s.grossAmount.toString()),
      inssAmount: new Decimal(s.inssAmount.toString()),
      irrfAmount: new Decimal(s.irrfAmount.toString()),
      netAmount: new Decimal(s.netAmount.toString()),
      fgtsAmount: new Decimal(s.fgtsAmount.toString()),
      paymentDueDate: s.paymentDueDate,
      status: s.status,
      receiptUrl: s.receiptUrl,
      processedAt: s.processedAt,
      createdBy: s.createdBy,
      createdAt: s.createdAt,
    }));
  });
}

// ─── Get Schedule By ID ──────────────────────────────────────────────

export async function getScheduleById(
  scheduleId: string,
  orgId: string,
  ctx: RlsContext,
): Promise<VacationScheduleOutput> {
  return withRlsContext(ctx, async (tx) => {
    const s = await tx.vacationSchedule.findFirst({
      where: { id: scheduleId, organizationId: orgId },
      include: { employee: { select: { name: true } } },
    });
    if (!s) {
      throw new VacationError('Agendamento de férias não encontrado', 404);
    }

    return {
      id: s.id,
      organizationId: s.organizationId,
      employeeId: s.employeeId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      employeeName: (s.employee as any).name,
      acquisitivePeriodId: s.acquisitivePeriodId,
      startDate: s.startDate,
      endDate: s.endDate,
      totalDays: s.totalDays,
      abono: s.abono,
      grossAmount: new Decimal(s.grossAmount.toString()),
      inssAmount: new Decimal(s.inssAmount.toString()),
      irrfAmount: new Decimal(s.irrfAmount.toString()),
      netAmount: new Decimal(s.netAmount.toString()),
      fgtsAmount: new Decimal(s.fgtsAmount.toString()),
      paymentDueDate: s.paymentDueDate,
      status: s.status,
      receiptUrl: s.receiptUrl,
      processedAt: s.processedAt,
      createdBy: s.createdBy,
      createdAt: s.createdAt,
    };
  });
}

// ─── Get Expiring Periods ─────────────────────────────────────────────

export async function getExpiringPeriods(
  orgId: string,
  daysAhead: number,
  ctx: RlsContext,
): Promise<VacationPeriodOutput[]> {
  return withRlsContext(ctx, async (tx) => {
    const periods = await tx.vacationAcquisitivePeriod.findMany({
      where: {
        status: { in: ['AVAILABLE', 'SCHEDULED'] },
        employee: { organizationId: orgId },
      },
      include: { employee: { select: { organizationId: true } } },
      orderBy: { endDate: 'asc' },
    });

    const today = new Date();
    return periods
      .filter((p) => {
        const deadline = calcDoublingDeadline(p.endDate);
        const alertDate = new Date(deadline);
        alertDate.setUTCDate(alertDate.getUTCDate() - daysAhead);
        return today >= alertDate;
      })
      .map((p) => {
        const doublingDeadline = calcDoublingDeadline(p.endDate);
        return {
          id: p.id,
          employeeId: p.employeeId,
          startDate: p.startDate,
          endDate: p.endDate,
          daysEarned: p.daysEarned,
          daysTaken: p.daysTaken,
          daysLost: p.daysLost,
          balance: p.daysEarned - p.daysTaken,
          status: p.status,
          doublingDeadline,
          isNearDoubling: true,
        };
      });
  });
}
