// ─── Employee Terminations Service ───────────────────────────────────
// Orchestrates the full termination lifecycle:
//   DRAFT → PROCESSED → PAID
// Calculates all rescision amounts, updates employee status, and generates
// TRCT/GRRF PDFs.

import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { payrollTablesService } from '../payroll-tables/payroll-tables.service';
import { calculateTermination } from './termination-calculation.service';
import { generateTRCTPdf, generateGRRFPdf } from './termination-pdf.service';
import {
  TerminationError,
  type CreateTerminationInput,
  type ListTerminationsInput,
  type TerminationOutput,
  type EmployeeData,
  type TerminationInput,
} from './employee-terminations.types';
import type { EngineParams } from '../payroll-runs/payroll-runs.types';
import { generateEvent as esocialGenerateEvent } from '../esocial-events/esocial-events.service';

// ─── Helpers ────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type TxClient = any;

/**
 * Build EngineParams from payroll tables for the termination month.
 * Reuses the same pattern as payroll-runs.service.ts.
 */
async function loadEngineParams(orgId: string, referenceMonth: Date): Promise<EngineParams> {
  const [inssTable, irrfTable, salaryFamilyTable, miscTable] = await Promise.all([
    payrollTablesService.getEffective(orgId, 'INSS_BRACKETS' as any, referenceMonth),
    payrollTablesService.getEffective(orgId, 'IRRF_BRACKETS' as any, referenceMonth),
    payrollTablesService.getEffective(orgId, 'SALARY_FAMILY' as any, referenceMonth),
    payrollTablesService.getEffective(orgId, 'MISC_SCALARS' as any, referenceMonth),
  ]);

  const scalarMap = new Map<string, Decimal>();
  for (const row of miscTable?.scalarValues ?? []) {
    scalarMap.set(row.key, new Decimal(row.value.toString()));
  }
  for (const row of salaryFamilyTable?.scalarValues ?? []) {
    scalarMap.set(row.key, new Decimal(row.value.toString()));
  }

  return {
    inssBrackets: (inssTable?.brackets ?? []).map((b: any) => ({
      from: new Decimal(b.fromValue.toString()),
      upTo: b.upTo !== null ? new Decimal(b.upTo.toString()) : null,
      rate: new Decimal(b.rate.toString()),
    })),
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

/**
 * Maps a DB termination record to TerminationOutput.
 */
function mapToOutput(record: any): TerminationOutput {
  return {
    id: record.id as string,
    organizationId: record.organizationId as string,
    employeeId: record.employeeId as string,
    employeeName: (record.employee?.name ?? '') as string,
    terminationType: record.terminationType as string,
    terminationDate: record.terminationDate instanceof Date
      ? record.terminationDate.toISOString().split('T')[0]
      : String(record.terminationDate),
    noticePeriodDays: record.noticePeriodDays as number,
    noticePeriodType: record.noticePeriodType as string,
    balanceSalary: record.balanceSalary.toString(),
    thirteenthProp: record.thirteenthProp.toString(),
    vacationVested: record.vacationVested.toString(),
    vacationProp: record.vacationProp.toString(),
    vacationBonus: record.vacationBonus.toString(),
    noticePay: record.noticePay.toString(),
    fgtsBalance: record.fgtsBalance.toString(),
    fgtsPenalty: record.fgtsPenalty.toString(),
    totalGross: record.totalGross.toString(),
    inssAmount: record.inssAmount.toString(),
    irrfAmount: record.irrfAmount.toString(),
    totalNet: record.totalNet.toString(),
    paymentDeadline: record.paymentDeadline instanceof Date
      ? record.paymentDeadline.toISOString().split('T')[0]
      : String(record.paymentDeadline),
    trctPdfUrl: record.trctPdfUrl as string | null,
    grfPdfUrl: record.grfPdfUrl as string | null,
    status: record.status as string,
    processedAt: record.processedAt
      ? (record.processedAt instanceof Date
        ? record.processedAt.toISOString()
        : String(record.processedAt))
      : null,
    createdBy: record.createdBy as string,
    createdAt: record.createdAt instanceof Date
      ? record.createdAt.toISOString()
      : String(record.createdAt),
  };
}

// ─── employeeSelect ─────────────────────────────────────────────────────

const employeeSelect = {
  id: true,
  name: true,
  cpf: true,
  status: true,
  admissionDate: true,
  dependentsCount: true,
  organizationId: true,
  position: { select: { title: true } },
  termination: { select: { id: true } },
} as const;

const terminationSelect = {
  id: true,
  organizationId: true,
  employeeId: true,
  terminationType: true,
  terminationDate: true,
  noticePeriodDays: true,
  noticePeriodType: true,
  balanceSalary: true,
  thirteenthProp: true,
  vacationVested: true,
  vacationProp: true,
  vacationBonus: true,
  noticePay: true,
  fgtsBalance: true,
  fgtsPenalty: true,
  totalGross: true,
  inssAmount: true,
  irrfAmount: true,
  totalNet: true,
  paymentDeadline: true,
  trctPdfUrl: true,
  grfPdfUrl: true,
  status: true,
  processedAt: true,
  createdBy: true,
  createdAt: true,
  employee: { select: { name: true, cpf: true, position: { select: { title: true } } } },
} as const;

// ─── processTermination ──────────────────────────────────────────────────

/**
 * Creates a DRAFT termination record with all calculated amounts.
 * Validates employee status (not already DESLIGADO, not AFASTADO with stability).
 */
export async function processTermination(
  input: CreateTerminationInput,
  ctx: RlsContext,
): Promise<TerminationOutput> {
  const { organizationId, employeeId, terminationType, terminationDate, noticePeriodType, fgtsBalanceOverride, createdBy } = input;

  const terminationDateObj = new Date(terminationDate + 'T00:00:00.000Z');

  return withRlsContext(ctx, async (tx: TxClient) => {
    // ── Load employee ────────────────────────────────────────────────
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: employeeSelect,
    });

    if (!employee) {
      throw new TerminationError('Colaborador não encontrado', 404, 'EMPLOYEE_NOT_FOUND');
    }

    if (employee.status === 'DESLIGADO' || employee.termination) {
      throw new TerminationError(
        'Este colaborador já foi desligado',
        409,
        'ALREADY_TERMINATED',
      );
    }

    if (employee.status === 'AFASTADO') {
      throw new TerminationError(
        'Colaborador afastado possui estabilidade e não pode ser desligado neste momento',
        422,
        'EMPLOYEE_ON_LEAVE',
      );
    }

    // ── Load current salary ──────────────────────────────────────────
    const salaryRecord = await tx.employeeSalaryHistory.findFirst({
      where: {
        employeeId,
        effectiveDate: { lte: terminationDateObj },
      },
      orderBy: { effectiveDate: 'desc' },
    });

    const lastSalary = salaryRecord ? new Decimal(salaryRecord.salary.toString()) : new Decimal(0);

    // ── Load vacation data ───────────────────────────────────────────
    const vacationPeriods = await tx.vacationAcquisitivePeriod.findMany({
      where: { employeeId },
      orderBy: { startDate: 'asc' },
    });

    // Vested days: EXPIRED periods with remaining days (daysEarned - daysTaken - daysLost)
    let vacationVestedDays = 0;
    let vacationPropDays = 0;

    for (const period of vacationPeriods) {
      if (period.status === 'EXPIRED' || period.status === 'TAKEN') {
        const remaining = period.daysEarned - period.daysTaken - period.daysLost;
        if (remaining > 0) vacationVestedDays += remaining;
      } else if (period.status === 'ACCRUING') {
        // Proportional days in current period
        const startMs = new Date(period.startDate).getTime();
        const termMs = terminationDateObj.getTime();
        const diffDays = Math.floor((termMs - startMs) / (1000 * 60 * 60 * 24));
        // Proportional days earned in 12-month period
        vacationPropDays = Math.min(Math.floor((diffDays / 365) * 30), 30);
      }
    }

    // ── Load last 12 months of payroll for overtime/night averages ──
    const twelveMonthsAgo = new Date(terminationDateObj);
    twelveMonthsAgo.setUTCFullYear(twelveMonthsAgo.getUTCFullYear() - 1);

    const payrollItems = await tx.payrollRunItem.findMany({
      where: {
        employeeId,
        payrollRun: {
          referenceMonth: { gte: twelveMonthsAgo, lte: terminationDateObj },
        },
      },
      select: {
        grossSalary: true,
        lineItemsJson: true,
      },
    });

    // Compute averages for overtime and night premium from lineItemsJson
    let totalOvertime = new Decimal(0);
    let totalNight = new Decimal(0);
    const monthCount = payrollItems.length || 1;

    for (const item of payrollItems) {
      if (item.lineItemsJson && Array.isArray(item.lineItemsJson)) {
        for (const line of item.lineItemsJson as any[]) {
          if (line.type === 'PROVENTO') {
            const code = String(line.code ?? '');
            if (code.startsWith('HE') || code === 'HORA_EXTRA_50' || code === 'HORA_EXTRA_100') {
              totalOvertime = totalOvertime.plus(new Decimal(String(line.value ?? 0)));
            }
            if (code === 'AD_NOTURNO' || code === 'ADICIONAL_NOTURNO') {
              totalNight = totalNight.plus(new Decimal(String(line.value ?? 0)));
            }
          }
        }
      }
    }

    const avgOvertime = totalOvertime.div(monthCount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const avgNight = totalNight.div(monthCount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // ── Compute monthsThirteenth ──────────────────────────────────────
    // Months worked in current year where >= 15 days in the month counts as 1
    const currentYear = terminationDateObj.getUTCFullYear();
    const admissionDate = new Date(employee.admissionDate);
    const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
    const effectiveStart = admissionDate > startOfYear ? admissionDate : startOfYear;

    let monthsThirteenth = 0;
    for (let m = effectiveStart.getUTCMonth(); m <= terminationDateObj.getUTCMonth(); m++) {
      const isLastMonth = m === terminationDateObj.getUTCMonth();
      const isFirstMonth = m === effectiveStart.getUTCMonth();

      const daysInMonth = new Date(Date.UTC(currentYear, m + 1, 0)).getUTCDate();
      let daysWorked = daysInMonth;

      if (isFirstMonth && isLastMonth) {
        daysWorked = terminationDateObj.getUTCDate() - effectiveStart.getUTCDate() + 1;
      } else if (isLastMonth) {
        daysWorked = terminationDateObj.getUTCDate();
      } else if (isFirstMonth) {
        daysWorked = daysInMonth - effectiveStart.getUTCDate() + 1;
      }

      if (daysWorked >= 15) monthsThirteenth++;
    }

    // ── Estimate FGTS balance ──────────────────────────────────────────
    // Use override if provided, else estimate from payroll history
    let fgtsBalance: Decimal;
    if (fgtsBalanceOverride) {
      fgtsBalance = new Decimal(fgtsBalanceOverride);
    } else {
      const fgtsEstimate = payrollItems.reduce((acc: Decimal, item: { grossSalary: any }) => {
        const gross = new Decimal(item.grossSalary?.toString() ?? 0);
        return acc.plus(gross.mul('0.08'));
      }, new Decimal(0));
      fgtsBalance = fgtsEstimate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    // ── Load engine params ─────────────────────────────────────────────
    const params = await loadEngineParams(organizationId, terminationDateObj);

    // ── Calculate termination ──────────────────────────────────────────
    const calcInput: TerminationInput = {
      admissionDate: new Date(employee.admissionDate),
      terminationDate: terminationDateObj,
      terminationType: terminationType as TerminationInput['terminationType'],
      noticeType: noticePeriodType as TerminationInput['noticeType'],
      lastSalary,
      fgtsBalance,
      vacationVestedDays,
      vacationPropDays,
      monthsThirteenth,
      avgOvertime,
      avgNight,
      dependentCount: employee.dependentsCount ?? 0,
    };

    const result = calculateTermination(calcInput, params);

    // ── Persist DRAFT record ───────────────────────────────────────────
    const termination = await tx.employeeTermination.create({
      data: {
        organizationId,
        employeeId,
        terminationType,
        terminationDate: terminationDateObj,
        noticePeriodDays: result.noticePeriodDays,
        noticePeriodType,
        balanceSalary: result.balanceSalary,
        thirteenthProp: result.thirteenthProp,
        vacationVested: result.vacationVested,
        vacationProp: result.vacationProp,
        vacationBonus: result.vacationBonus,
        noticePay: result.noticePay,
        fgtsBalance: result.fgtsBalance,
        fgtsPenalty: result.fgtsPenalty,
        totalGross: result.totalGross,
        inssAmount: result.inssAmount,
        irrfAmount: result.irrfAmount,
        totalNet: result.totalNet,
        paymentDeadline: result.paymentDeadline,
        status: 'DRAFT',
        createdBy,
      },
      select: terminationSelect,
    });

    return mapToOutput(termination);
  });
}

// ─── confirmTermination ──────────────────────────────────────────────────

/**
 * Transitions termination from DRAFT → PROCESSED.
 * Updates employee status to DESLIGADO and sets processedAt.
 */
export async function confirmTermination(
  terminationId: string,
  ctx: RlsContext,
): Promise<TerminationOutput> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const termination = await tx.employeeTermination.findFirst({
      where: { id: terminationId, organizationId: ctx.organizationId },
      select: terminationSelect,
    });

    if (!termination) {
      throw new TerminationError('Rescisão não encontrada', 404, 'NOT_FOUND');
    }

    if (termination.status !== 'DRAFT') {
      throw new TerminationError(
        `Rescisão não pode ser confirmada no status '${termination.status}'`,
        422,
        'INVALID_TRANSITION',
      );
    }

    // Transition employee to DESLIGADO
    await tx.employee.update({
      where: { id: termination.employeeId },
      data: {
        status: 'DESLIGADO',
        terminationDate: termination.terminationDate,
      },
    });

    const updated = await tx.employeeTermination.update({
      where: { id: terminationId },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
      select: terminationSelect,
    });

    const output = mapToOutput(updated);

    // Auto-generate S-2299 eSocial event (per D-08) — AFTER transaction commits
    try {
      await esocialGenerateEvent(
        ctx.organizationId,
        { eventType: 'S-2299', sourceType: 'EMPLOYEE_TERMINATION', sourceId: terminationId },
        ctx.userId ?? 'system',
      );
    } catch (err) {
      // Log but do not fail the termination — eSocial event can be generated manually
      console.error('[employee-terminations] Failed to auto-generate S-2299:', err);
    }

    return output;
  });
}

// ─── markAsPaid ──────────────────────────────────────────────────────────

/**
 * Transitions termination from PROCESSED → PAID.
 */
export async function markAsPaid(
  terminationId: string,
  ctx: RlsContext,
): Promise<TerminationOutput> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const termination = await tx.employeeTermination.findFirst({
      where: { id: terminationId, organizationId: ctx.organizationId },
      select: terminationSelect,
    });

    if (!termination) {
      throw new TerminationError('Rescisão não encontrada', 404, 'NOT_FOUND');
    }

    if (termination.status !== 'PROCESSED') {
      throw new TerminationError(
        'Rescisão deve ser confirmada (PROCESSED) antes de marcar como paga',
        422,
        'INVALID_TRANSITION',
      );
    }

    const updated = await tx.employeeTermination.update({
      where: { id: terminationId },
      data: { status: 'PAID' },
      select: terminationSelect,
    });

    return mapToOutput(updated);
  });
}

// ─── listTerminations ────────────────────────────────────────────────────

export async function listTerminations(
  filters: ListTerminationsInput,
  ctx: RlsContext,
): Promise<{ data: TerminationOutput[]; total: number }> {
  const { organizationId, terminationType, status, fromDate, toDate, page = 1, limit = 20 } = filters;

  const where: Record<string, unknown> = { organizationId };
  if (terminationType) where['terminationType'] = terminationType;
  if (status) where['status'] = status;
  if (fromDate || toDate) {
    where['terminationDate'] = {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate) } : {}),
    };
  }

  return withRlsContext(ctx, async (tx: TxClient) => {
    const [records, total] = await Promise.all([
      tx.employeeTermination.findMany({
        where,
        select: terminationSelect,
        orderBy: { terminationDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      tx.employeeTermination.findMany({ where, select: { id: true } }).then((r: any[]) => r.length),
    ]);

    return { data: records.map(mapToOutput), total };
  });
}

// ─── getTerminationById ──────────────────────────────────────────────────

export async function getTerminationById(
  terminationId: string,
  ctx: RlsContext,
): Promise<TerminationOutput> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const record = await tx.employeeTermination.findFirst({
      where: { id: terminationId, organizationId: ctx.organizationId },
      select: terminationSelect,
    });

    if (!record) {
      throw new TerminationError('Rescisão não encontrada', 404, 'NOT_FOUND');
    }

    return mapToOutput(record);
  });
}

// ─── getTrctPdf ──────────────────────────────────────────────────────────

export async function getTrctPdf(
  terminationId: string,
  ctx: RlsContext,
): Promise<Buffer> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const termination = await tx.employeeTermination.findFirst({
      where: { id: terminationId, organizationId: ctx.organizationId },
      select: terminationSelect,
    });

    if (!termination) {
      throw new TerminationError('Rescisão não encontrada', 404, 'NOT_FOUND');
    }

    const employee = await tx.employee.findFirst({
      where: { id: termination.employeeId },
      select: { id: true, name: true, cpf: true, admissionDate: true, position: { select: { title: true } } },
    });

    const employeeData: EmployeeData = {
      id: employee?.id ?? '',
      name: employee?.name ?? '',
      cpf: employee?.cpf ?? '',
      admissionDate: employee?.admissionDate ?? new Date(),
      cargo: employee?.position?.title,
    };

    return generateTRCTPdf(mapToOutput(termination), employeeData);
  });
}

// ─── getGrffPdf ──────────────────────────────────────────────────────────

export async function getGrffPdf(
  terminationId: string,
  ctx: RlsContext,
): Promise<Buffer> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const termination = await tx.employeeTermination.findFirst({
      where: { id: terminationId, organizationId: ctx.organizationId },
      select: terminationSelect,
    });

    if (!termination) {
      throw new TerminationError('Rescisão não encontrada', 404, 'NOT_FOUND');
    }

    const employee = await tx.employee.findFirst({
      where: { id: termination.employeeId },
      select: { id: true, name: true, cpf: true, admissionDate: true, position: { select: { title: true } } },
    });

    const employeeData: EmployeeData = {
      id: employee?.id ?? '',
      name: employee?.name ?? '',
      cpf: employee?.cpf ?? '',
      admissionDate: employee?.admissionDate ?? new Date(),
      cargo: employee?.position?.title,
    };

    return generateGRRFPdf(mapToOutput(termination), employeeData);
  });
}

// ─── getExpiringDeadlines ─────────────────────────────────────────────────

/**
 * Returns terminations whose paymentDeadline is within the next `daysAhead` days.
 * Used for alerting about upcoming payment obligations.
 */
export async function getExpiringDeadlines(
  orgId: string,
  daysAhead: number,
): Promise<TerminationOutput[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() + daysAhead);

  // No RLS context needed for direct query (organizationId filter is explicit)
  const records = await prisma.employeeTermination.findMany({
    where: {
      organizationId: orgId,
      status: { in: ['DRAFT', 'PROCESSED'] },
      paymentDeadline: { lte: cutoff },
    },
    select: terminationSelect,
    orderBy: { paymentDeadline: 'asc' },
  });

  return records.map(mapToOutput);
}
