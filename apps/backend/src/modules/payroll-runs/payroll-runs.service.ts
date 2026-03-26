// ─── PayrollRun Orchestrator Service ─────────────────────────────────
// Full lifecycle: create → process → recalculate → close → revert.
// Per-employee transactions prevent timeout on large payrolls.
// Per D-08: closing a run auto-generates S-1200/S-1210/S-1299 eSocial events.

import Decimal from 'decimal.js';
import JSZip from 'jszip';
import { prisma } from '../../database/prisma';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { payrollTablesService } from '../payroll-tables/payroll-tables.service';
import {
  calculateEmployeePayroll,
  calculateThirteenthSalary,
} from './payroll-calculation.service';
import { generatePayslipPdf } from './payroll-pdf.service';
import { sendMail } from '../../shared/mail/mail.service';
import {
  PayrollRunError,
  VALID_PAYROLL_TRANSITIONS,
  type EngineParams,
  type EmployeePayrollInput,
  type ThirteenthSalaryInput,
  type CpPreviewResponse,
  type CpPreviewItem,
  type TaxGuidePreviewItem,
} from './payroll-runs.types';
import type { PayrollRunType, PayrollRunStatus } from '@prisma/client';
import { PayableCategory } from '@prisma/client';
import { generateBatch as esocialGenerateBatch } from '../esocial-events/esocial-events.service';
import { nthBusinessDay } from './payroll-date-utils';
import {
  createPayrollEntries,
  revertPayrollEntries,
} from '../accounting-entries/accounting-entries.service';
import { getAbsenceImpactForMonth } from '../employee-absences/employee-absences.service';

// ─── Types ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type TxClient = any;

export interface CreateRunInput {
  referenceMonth: string; // "YYYY-MM"
  runType: PayrollRunType;
  notes?: string;
}

export interface ListRunsInput {
  page?: number;
  limit?: number;
  status?: string;
  runType?: string;
  referenceMonth?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Validate and apply a state machine transition. Throws PayrollRunError on invalid transition.
 */
function applyTransition(currentStatus: string, transitionName: string): string {
  const transition = VALID_PAYROLL_TRANSITIONS[transitionName];
  if (!transition || !transition[currentStatus]) {
    throw new PayrollRunError(
      `Transição inválida '${transitionName}' para o status '${currentStatus}'`,
      'INVALID_TRANSITION',
      400,
    );
  }
  return transition[currentStatus];
}

/**
 * Build cost-center allocation items for a payable.
 * Groups TimeEntryActivity by costCenterId for the employee in the reference month.
 * Falls back to EmployeeContract.costCenterId at 100% if no time entries found.
 * Returns empty array if no cost center is available.
 */
async function buildCostCenterItems(
  tx: TxClient,
  employeeId: string,
  referenceMonth: Date,
  farmId: string,
): Promise<Array<{ costCenterId: string; farmId: string; allocMode: string; percentage: Decimal }>> {
  // Compute month range for time entry lookup
  const year = referenceMonth.getUTCFullYear();
  const month = referenceMonth.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  // Find time entries for this employee in the reference month
  const timeEntries = await tx.timeEntry.findMany({
    where: {
      employeeId,
      workDate: { gte: monthStart, lte: monthEnd },
    },
    select: {
      activities: {
        where: { costCenterId: { not: null } },
        select: { costCenterId: true, minutes: true },
      },
    },
  });

  // Aggregate minutes per cost center
  const ccMinutes = new Map<string, number>();
  for (const entry of timeEntries) {
    for (const act of entry.activities) {
      if (act.costCenterId) {
        ccMinutes.set(act.costCenterId, (ccMinutes.get(act.costCenterId) ?? 0) + act.minutes);
      }
    }
  }

  if (ccMinutes.size > 0) {
    const totalMinutes = [...ccMinutes.values()].reduce((a, b) => a + b, 0);
    if (totalMinutes === 0) return [];

    const entries = [...ccMinutes.entries()];
    const result: Array<{ costCenterId: string; farmId: string; allocMode: string; percentage: Decimal }> = [];

    let sumSoFar = new Decimal(0);
    for (let i = 0; i < entries.length; i++) {
      const [ccId, minutes] = entries[i];
      let pct: Decimal;
      if (i === entries.length - 1) {
        // Last entry: remainder to ensure sum = 100
        pct = new Decimal(100).minus(sumSoFar);
      } else {
        pct = new Decimal(minutes).div(totalMinutes).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        sumSoFar = sumSoFar.plus(pct);
      }
      result.push({ costCenterId: ccId, farmId, allocMode: 'PERCENTAGE', percentage: pct });
    }
    return result;
  }

  // Fallback: employee contract cost center at 100%
  const contract = await tx.employeeContract.findFirst({
    where: { employeeId, isActive: true },
    select: { costCenterId: true },
    orderBy: { startDate: 'desc' },
  });

  if (contract?.costCenterId) {
    return [
      {
        costCenterId: contract.costCenterId,
        farmId,
        allocMode: 'PERCENTAGE',
        percentage: new Decimal(100),
      },
    ];
  }

  return [];
}

/**
 * Build EngineParams from legal tables for a reference month.
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
 * Calculate employee payroll inside a transaction (shared by processRun and recalculateEmployee).
 */
async function calculateAndCreateItem(
  tx: TxClient,
  orgId: string,
  runId: string,
  employee: any,
  referenceMonth: Date,
  runType: PayrollRunType,
  engineParams: EngineParams,
  yearTimesheetMap?: Map<string, any[]>,
): Promise<void> {
  // Get current salary from salary history (latest effectiveAt <= referenceMonth)
  const salaryEntry = employee.salaryHistory?.[0];
  const baseSalary = salaryEntry
    ? new Decimal(salaryEntry.salary.toString())
    : new Decimal(0);

  if (baseSalary.isZero()) {
    // Create PENDING_TIMESHEET item for employees without salary data
    await tx.payrollRunItem.create({
      data: {
        payrollRunId: runId,
        employeeId: employee.id,
        status: 'PENDING_TIMESHEET',
        baseSalary: new Decimal(0),
        grossSalary: new Decimal(0),
        netSalary: new Decimal(0),
        lineItemsJson: null,
      },
    });
    return;
  }

  // For THIRTEENTH runs, timesheet is not required — skip timesheet gate
  const isThirteenth = runType === 'THIRTEENTH_FIRST' || runType === 'THIRTEENTH_SECOND';

  let timesheet: any = null;

  if (!isThirteenth) {
    // Get approved timesheet for this employee + referenceMonth
    timesheet = await tx.timesheet.findFirst({
      where: {
        employeeId: employee.id,
        referenceMonth,
        status: 'APPROVED',
      },
      select: {
        id: true,
        status: true,
        totalOvertime50: true,
        totalOvertime100: true,
        totalNightMinutes: true,
        totalAbsences: true,
      },
    });

    // If no approved timesheet, create PENDING_TIMESHEET item
    if (!timesheet) {
      await tx.payrollRunItem.create({
        data: {
          payrollRunId: runId,
          employeeId: employee.id,
          status: 'PENDING_TIMESHEET',
          baseSalary,
          grossSalary: new Decimal(0),
          netSalary: new Decimal(0),
          lineItemsJson: null,
        },
      });
      return;
    }
  }

  // Get pending salary advances for this employee + referenceMonth
  const advances = await tx.salaryAdvance.findMany({
    where: {
      employeeId: employee.id,
      referenceMonth,
      deductedInRunId: null,
    },
    select: { amount: true },
  });
  const pendingAdvances = advances.reduce(
    (sum: Decimal, a: any) => sum.plus(new Decimal(a.amount.toString())),
    new Decimal(0),
  );

  // Dependents count
  const dependents = employee.dependents ?? [];
  const dependentsCount = dependents.filter((d: any) => d.irrf).length;
  const dependentsUnder14 = dependents.filter((d: any) => d.salaryFamily).length;

  let result;

  if (runType === 'THIRTEENTH_FIRST' || runType === 'THIRTEENTH_SECOND') {
    // Calculate months worked
    const refYear = referenceMonth.getUTCFullYear();
    const cutoffDate =
      runType === 'THIRTEENTH_FIRST'
        ? new Date(Date.UTC(refYear, 10, 30)) // Nov 30
        : new Date(Date.UTC(refYear, 11, 31)); // Dec 31
    const startDate = new Date(
      Math.max(
        employee.admissionDate.getTime(),
        new Date(Date.UTC(refYear, 0, 1)).getTime(),
      ),
    );
    const monthsWorked = Math.max(
      1,
      Math.floor(
        (cutoffDate.getTime() - startDate.getTime()) /
          (30.4375 * 24 * 60 * 60 * 1000),
      ) + 1,
    );

    // Calculate averages from year's timesheets (provided via yearTimesheetMap for SECOND)
    let avgOvertime50 = new Decimal(0);
    let avgOvertime100 = new Decimal(0);
    let avgNightPremium = new Decimal(0);

    if (runType === 'THIRTEENTH_SECOND' && yearTimesheetMap) {
      const yearTimesheets = yearTimesheetMap.get(employee.id) ?? [];
      if (yearTimesheets.length > 0) {
        const hourlyRate = baseSalary.div(220).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
        const totalOt50 = yearTimesheets.reduce((s: number, t: any) => s + (t.totalOvertime50 ?? 0), 0);
        const totalOt100 = yearTimesheets.reduce((s: number, t: any) => s + (t.totalOvertime100 ?? 0), 0);
        const totalNight = yearTimesheets.reduce((s: number, t: any) => s + (t.totalNightMinutes ?? 0), 0);
        const months = yearTimesheets.length;

        avgOvertime50 = new Decimal(totalOt50).div(60).mul(hourlyRate).mul('1.5').div(months).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        avgOvertime100 = new Decimal(totalOt100).div(60).mul(hourlyRate).mul('2.0').div(months).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        avgNightPremium = new Decimal(totalNight).div(60).mul(hourlyRate).mul('0.25').div(months).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
    }

    const thirteenthInput: ThirteenthSalaryInput = {
      parcel: runType === 'THIRTEENTH_FIRST' ? 'FIRST' : 'SECOND',
      employeeId: employee.id,
      baseSalary,
      admissionDate: employee.admissionDate,
      monthsWorked,
      dependentsCount,
      alimonyAmount: new Decimal(0),
      avgOvertime50,
      avgOvertime100,
      avgNightPremium,
    };

    result = calculateThirteenthSalary(thirteenthInput, engineParams);
  } else {
    // MONTHLY or ADVANCE

    // Fetch absence impact for this employee in the reference month
    const absenceData = await getAbsenceImpactForMonth(employee.id, referenceMonth, tx);

    const payrollInput: EmployeePayrollInput = {
      employeeId: employee.id,
      baseSalary,
      admissionDate: employee.admissionDate,
      dependentsCount,
      dependentsUnder14,
      alimonyAmount: new Decimal(0),
      housingProvided: false,
      foodProvided: false,
      requestedHousing: new Decimal(0),
      requestedFood: new Decimal(0),
      regionalMinWage: new Decimal(1412), // Federal minimum wage 2026
      vtPercent: new Decimal(0),
      timesheetData: {
        totalOvertime50: timesheet.totalOvertime50,
        totalOvertime100: timesheet.totalOvertime100,
        totalNightMinutes: timesheet.totalNightMinutes,
        totalAbsences: timesheet.totalAbsences,
      },
      pendingAdvances,
      customRubricas: [],
      absenceData, // NEW — wired from getAbsenceImpactForMonth
    };

    result = calculateEmployeePayroll(payrollInput, referenceMonth, engineParams);
  }

  // Serialize lineItems (convert Decimal to number for JSON storage)
  const lineItemsJson = result.lineItems.map((li) => ({
    ...li,
    value: li.value instanceof Decimal ? li.value.toNumber() : li.value,
  }));

  await tx.payrollRunItem.create({
    data: {
      payrollRunId: runId,
      employeeId: employee.id,
      status: 'CALCULATED',
      baseSalary: result.baseSalary,
      proRataDays: result.proRataDays ?? undefined,
      overtime50: result.overtime50,
      overtime100: result.overtime100,
      dsrValue: result.dsrValue,
      nightPremium: result.nightPremium,
      salaryFamily: result.salaryFamily,
      otherProvisions: result.otherProvisions,
      grossSalary: result.grossSalary,
      inssAmount: result.inssAmount,
      irrfAmount: result.irrfAmount,
      vtDeduction: result.vtDeduction,
      housingDeduction: result.housingDeduction,
      foodDeduction: result.foodDeduction,
      advanceDeduction: result.advanceDeduction,
      otherDeductions: result.otherDeductions,
      netSalary: result.netSalary,
      fgtsAmount: result.fgtsAmount,
      inssPatronal: result.inssPatronal,
      lineItemsJson,
    },
  });
}

// ─── createRun ─────────────────────────────────────────────────────────

export async function createRun(
  rls: RlsContext,
  input: CreateRunInput,
): Promise<Record<string, unknown>> {
  const referenceMonth = new Date(input.referenceMonth + '-01');

  // Check uniqueness
  const existing = await prisma.payrollRun.findFirst({
    where: {
      organizationId: rls.organizationId,
      referenceMonth,
      runType: input.runType,
    },
    select: { id: true },
  });

  if (existing) {
    throw new PayrollRunError(
      'Já existe uma folha para esta competência e tipo',
      'DUPLICATE_RUN',
      409,
    );
  }

  const run = await prisma.payrollRun.create({
    data: {
      organizationId: rls.organizationId,
      referenceMonth,
      runType: input.runType,
      status: 'PENDING',
      triggeredBy: rls.userId ?? 'system',
      notes: input.notes ?? null,
    },
  });

  return run as Record<string, unknown>;
}

// ─── processRun ────────────────────────────────────────────────────────

export async function processRun(rls: RlsContext, runId: string): Promise<void> {
  // Fetch run
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, organizationId: rls.organizationId },
  });

  if (!run) {
    throw new PayrollRunError('Folha não encontrada', 'RUN_NOT_FOUND', 404);
  }

  // Validate state transition START: PENDING → PROCESSING
  applyTransition(run.status, 'START');

  // Transition to PROCESSING
  await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: 'PROCESSING' },
  });

  // Load engine params
  const engineParams = await loadEngineParams(rls.organizationId, run.referenceMonth);

  // Fetch all active employees
  const employees = await prisma.employee.findMany({
    where: {
      organizationId: rls.organizationId,
      status: 'ATIVO',
    },
    select: {
      id: true,
      name: true,
      cpf: true,
      email: true,
      admissionDate: true,
      salaryHistory: {
        where: { effectiveAt: { lte: run.referenceMonth } },
        orderBy: { effectiveAt: 'desc' },
        take: 1,
        select: { salary: true, effectiveAt: true },
      },
      dependents: {
        select: { irrf: true, salaryFamily: true, birthDate: true },
      },
      farms: {
        where: { status: 'ATIVO' },
        select: { farmId: true },
        orderBy: { startDate: 'desc' },
        take: 1,
      },
    },
  });

  // For 13th salary second parcel, fetch all timesheets for the reference year
  let yearTimesheetMap: Map<string, any[]> | undefined;
  if (run.runType === 'THIRTEENTH_SECOND') {
    const refYear = run.referenceMonth.getUTCFullYear();
    const yearStart = new Date(Date.UTC(refYear, 0, 1));
    const yearEnd = new Date(Date.UTC(refYear, 11, 31));
    const yearTimesheets = await prisma.timesheet.findMany({
      where: {
        organizationId: rls.organizationId,
        referenceMonth: { gte: yearStart, lte: yearEnd },
        status: 'APPROVED',
      },
      select: {
        employeeId: true,
        totalOvertime50: true,
        totalOvertime100: true,
        totalNightMinutes: true,
      },
    });
    yearTimesheetMap = new Map<string, any[]>();
    for (const ts of yearTimesheets) {
      const existing = yearTimesheetMap.get(ts.employeeId) ?? [];
      existing.push(ts);
      yearTimesheetMap.set(ts.employeeId, existing);
    }
  }

  // Per-employee transaction pattern
  for (const employee of employees) {
    await prisma.$transaction(async (tx) => {
      await calculateAndCreateItem(
        tx,
        rls.organizationId,
        runId,
        employee,
        run.referenceMonth,
        run.runType,
        engineParams,
        yearTimesheetMap,
      );
    });
  }

  // Recalculate totals
  const items = await prisma.payrollRunItem.findMany({
    where: { payrollRunId: runId },
    select: {
      grossSalary: true,
      netSalary: true,
      inssPatronal: true,
      fgtsAmount: true,
      status: true,
    },
  });

  const calculatedItems = items.filter((i: any) => i.status === 'CALCULATED');
  const totalGross = calculatedItems.reduce(
    (s: Decimal, i: any) => s.plus(new Decimal(i.grossSalary.toString())),
    new Decimal(0),
  );
  const totalNet = calculatedItems.reduce(
    (s: Decimal, i: any) => s.plus(new Decimal(i.netSalary.toString())),
    new Decimal(0),
  );
  const totalCharges = calculatedItems.reduce(
    (s: Decimal, i: any) =>
      s
        .plus(new Decimal(i.inssPatronal.toString()))
        .plus(new Decimal(i.fgtsAmount.toString())),
    new Decimal(0),
  );

  // Transition to CALCULATED
  await prisma.payrollRun.update({
    where: { id: runId },
    data: {
      status: 'CALCULATED',
      employeeCount: employees.length,
      totalGross,
      totalNet,
      totalCharges,
    },
  });
}

// ─── recalculateEmployee ───────────────────────────────────────────────

export async function recalculateEmployee(
  rls: RlsContext,
  runId: string,
  employeeId: string,
): Promise<void> {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, organizationId: rls.organizationId },
  });

  if (!run) {
    throw new PayrollRunError('Folha não encontrada', 'RUN_NOT_FOUND', 404);
  }

  // Validate state: RECALC requires CALCULATED status
  applyTransition(run.status, 'RECALC');

  // Transition to PROCESSING briefly
  await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: 'PROCESSING' },
  });

  // Load engine params
  const engineParams = await loadEngineParams(rls.organizationId, run.referenceMonth);

  // Delete existing item for this employee
  await prisma.payrollRunItem.deleteMany({
    where: { payrollRunId: runId, employeeId },
  });

  // Fetch employee
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId: rls.organizationId },
    select: {
      id: true,
      name: true,
      cpf: true,
      email: true,
      admissionDate: true,
      salaryHistory: {
        where: { effectiveAt: { lte: run.referenceMonth } },
        orderBy: { effectiveAt: 'desc' },
        take: 1,
        select: { salary: true, effectiveAt: true },
      },
      dependents: {
        select: { irrf: true, salaryFamily: true, birthDate: true },
      },
      farms: {
        where: { status: 'ATIVO' },
        select: { farmId: true },
        orderBy: { startDate: 'desc' },
        take: 1,
      },
    },
  });

  if (!employee) {
    throw new PayrollRunError('Colaborador não encontrado', 'EMPLOYEE_NOT_FOUND', 404);
  }

  await prisma.$transaction(async (tx) => {
    await calculateAndCreateItem(
      tx,
      rls.organizationId,
      runId,
      employee,
      run.referenceMonth,
      run.runType,
      engineParams,
    );
  });

  // Recalculate totals
  const items = await prisma.payrollRunItem.findMany({
    where: { payrollRunId: runId },
    select: {
      grossSalary: true,
      netSalary: true,
      inssPatronal: true,
      fgtsAmount: true,
      status: true,
    },
  });

  const calculatedItems = items.filter((i: any) => i.status === 'CALCULATED');
  const totalGross = calculatedItems.reduce(
    (s: Decimal, i: any) => s.plus(new Decimal(i.grossSalary.toString())),
    new Decimal(0),
  );
  const totalNet = calculatedItems.reduce(
    (s: Decimal, i: any) => s.plus(new Decimal(i.netSalary.toString())),
    new Decimal(0),
  );
  const totalCharges = calculatedItems.reduce(
    (s: Decimal, i: any) =>
      s
        .plus(new Decimal(i.inssPatronal.toString()))
        .plus(new Decimal(i.fgtsAmount.toString())),
    new Decimal(0),
  );

  await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: 'CALCULATED', totalGross, totalNet, totalCharges },
  });
}

// ─── closeRun ─────────────────────────────────────────────────────────

export async function closeRun(rls: RlsContext, runId: string): Promise<void> {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, organizationId: rls.organizationId },
  });

  if (!run) {
    throw new PayrollRunError('Folha não encontrada', 'RUN_NOT_FOUND', 404);
  }

  // Validate state: CLOSE requires CALCULATED
  applyTransition(run.status, 'CLOSE');

  // Fetch items with employee data
  const items = await prisma.payrollRunItem.findMany({
    where: { payrollRunId: runId, status: 'CALCULATED' },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          cpf: true,
          email: true,
          admissionDate: true,
          farms: {
            where: { status: 'ATIVO' },
            select: { farmId: true },
            orderBy: { startDate: 'desc' },
            take: 1,
          },
          contracts: {
            where: { isActive: true },
            select: { position: { select: { name: true } } },
            orderBy: { startDate: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  // Determine due dates for payables
  const refYear = run.referenceMonth.getUTCFullYear();
  const refMonth = run.referenceMonth.getUTCMonth() + 1; // 1-based
  const nextMonth = refMonth === 12 ? 1 : refMonth + 1;
  const nextYear = refMonth === 12 ? refYear + 1 : refYear;

  // Salary due: 5th business day of following month
  const salaryDueDate = nthBusinessDay(nextYear, nextMonth, 5);
  // FGTS due: 7th of following month
  const fgtsDueDate = new Date(Date.UTC(nextYear, nextMonth - 1, 7));
  // INSS patronal due: 20th of following month
  const inssPatronalDueDate = new Date(Date.UTC(nextYear, nextMonth - 1, 20));

  let totalInssPatronal = new Decimal(0);
  let totalFgts = new Decimal(0);

  // Accumulate IRRF for aggregated CP
  let totalIrrf = new Decimal(0);

  // Per-employee: create payable, lock timesheet, deduct advances
  for (const item of items) {
    const farmId = item.employee.farms[0]?.farmId;
    if (!farmId) continue;

    await prisma.$transaction(async (tx) => {
      // Build cost-center items for this employee
      const ccItems = await buildCostCenterItems(tx, item.employeeId, run.referenceMonth, farmId);

      // Create Payable for net salary
      const salaryPayable = await tx.payable.create({
        data: {
          organizationId: rls.organizationId,
          farmId,
          supplierName: item.employee.name,
          category: PayableCategory.PAYROLL,
          description: `Salário ${_formatMonthLabel(run.referenceMonth)} — ${item.employee.name}`,
          totalAmount: new Decimal(item.netSalary.toString()),
          dueDate: salaryDueDate,
          originType: 'PAYROLL_RUN_ITEM',
          originId: item.id,
        },
      });
      if (ccItems.length > 0) {
        await tx.payableCostCenterItem.createMany({
          data: ccItems.map((cc) => ({ ...cc, payableId: salaryPayable.id })),
        });
      }

      // Create VT payable if vtDeduction > 0
      const vtAmount = new Decimal(item.vtDeduction.toString());
      if (vtAmount.greaterThan(0)) {
        const vtDueDate = nthBusinessDay(nextYear, nextMonth, 5);
        const vtPayable = await tx.payable.create({
          data: {
            organizationId: rls.organizationId,
            farmId,
            supplierName: 'Vale-Transporte',
            category: PayableCategory.PAYROLL,
            description: `Vale-Transporte ${_formatMonthLabel(run.referenceMonth)} — ${item.employee.name}`,
            totalAmount: vtAmount,
            dueDate: vtDueDate,
            originType: 'PAYROLL_EMPLOYEE_VT',
            originId: item.id,
          },
        });
        if (ccItems.length > 0) {
          await tx.payableCostCenterItem.createMany({
            data: ccItems.map((cc) => ({ ...cc, payableId: vtPayable.id })),
          });
        }
      }

      // Create Pension (alimony) payable if alimonyDeduction > 0
      const alimonyAmount = item.alimonyDeduction
        ? new Decimal(item.alimonyDeduction.toString())
        : new Decimal(0);
      if (alimonyAmount.greaterThan(0)) {
        const pensionDueDate = nthBusinessDay(nextYear, nextMonth, 5);
        const pensionPayable = await tx.payable.create({
          data: {
            organizationId: rls.organizationId,
            farmId,
            supplierName: `Pensão Alimentícia — ${item.employee.name}`,
            category: PayableCategory.PAYROLL,
            description: `Pensão Alimentícia ${_formatMonthLabel(run.referenceMonth)} — ${item.employee.name}`,
            totalAmount: alimonyAmount,
            dueDate: pensionDueDate,
            originType: 'PAYROLL_EMPLOYEE_PENSION',
            originId: item.id,
          },
        });
        if (ccItems.length > 0) {
          await tx.payableCostCenterItem.createMany({
            data: ccItems.map((cc) => ({ ...cc, payableId: pensionPayable.id })),
          });
        }
      }

      // Create Sindical payable if sindicalDeduction exists in lineItemsJson
      const lineItems = Array.isArray(item.lineItemsJson) ? (item.lineItemsJson as any[]) : [];
      const sindicalLineItem = lineItems.find(
        (li: any) =>
          li.type === 'DESCONTO' &&
          (String(li.code).startsWith('9') || // Contribuição sindical typically code 9xx
            String(li.description ?? '')
              .toLowerCase()
              .includes('sindical')),
      );
      if (sindicalLineItem) {
        const sindicalAmount = new Decimal(
          typeof sindicalLineItem.value === 'string'
            ? parseFloat(sindicalLineItem.value)
            : sindicalLineItem.value ?? 0,
        );
        if (sindicalAmount.greaterThan(0)) {
          // Due date: last business day of month following deduction
          const sindicalDueDate = nthBusinessDay(nextYear, nextMonth + 1 > 12 ? 1 : nextMonth + 1, 5);
          const sindicalPayable = await tx.payable.create({
            data: {
              organizationId: rls.organizationId,
              farmId,
              supplierName: `Contribuição Sindical — ${item.employee.name}`,
              category: PayableCategory.PAYROLL,
              description: `Contribuição Sindical ${_formatMonthLabel(run.referenceMonth)} — ${item.employee.name}`,
              totalAmount: sindicalAmount,
              dueDate: sindicalDueDate,
              originType: 'PAYROLL_EMPLOYEE_SINDICAL',
              originId: item.id,
            },
          });
          if (ccItems.length > 0) {
            await tx.payableCostCenterItem.createMany({
              data: ccItems.map((cc) => ({ ...cc, payableId: sindicalPayable.id })),
            });
          }
        }
      }

      // Lock timesheet
      const timesheet = await tx.timesheet.findFirst({
        where: { employeeId: item.employeeId, referenceMonth: run.referenceMonth },
        select: { id: true },
      });
      if (timesheet) {
        await tx.timesheet.update({
          where: { id: timesheet.id },
          data: { status: 'LOCKED', payrollRunId: runId },
        });
      }

      // Mark salary advances as deducted
      await tx.salaryAdvance.updateMany({
        where: {
          employeeId: item.employeeId,
          referenceMonth: run.referenceMonth,
          deductedInRunId: null,
        },
        data: { deductedInRunId: runId },
      });
    });

    totalInssPatronal = totalInssPatronal.plus(new Decimal(item.inssPatronal.toString()));
    totalFgts = totalFgts.plus(new Decimal(item.fgtsAmount.toString()));
    totalIrrf = totalIrrf.plus(new Decimal(item.irrfAmount.toString()));
  }

  // Get any farm for employer CPs (use from first item)
  const anyFarmId = items[0]?.employee.farms[0]?.farmId;

  if (anyFarmId && items.length > 0) {
    // Create employer INSS patronal CP
    if (totalInssPatronal.greaterThan(0)) {
      await prisma.payable.create({
        data: {
          organizationId: rls.organizationId,
          farmId: anyFarmId,
          supplierName: 'INSS Patronal',
          category: PayableCategory.PAYROLL,
          description: `INSS Patronal ${_formatMonthLabel(run.referenceMonth)}`,
          totalAmount: totalInssPatronal,
          dueDate: inssPatronalDueDate,
          originType: 'PAYROLL_EMPLOYER_INSS',
          originId: runId,
        },
      });
    }

    // Create employer FGTS CP
    if (totalFgts.greaterThan(0)) {
      await prisma.payable.create({
        data: {
          organizationId: rls.organizationId,
          farmId: anyFarmId,
          supplierName: 'FGTS',
          category: PayableCategory.PAYROLL,
          description: `FGTS ${_formatMonthLabel(run.referenceMonth)}`,
          totalAmount: totalFgts,
          dueDate: fgtsDueDate,
          originType: 'PAYROLL_EMPLOYER_FGTS',
          originId: runId,
        },
      });
    }

    // Create aggregated IRRF CP (one per run, 20th of next month)
    if (totalIrrf.greaterThan(0)) {
      const irrfDueDate = new Date(Date.UTC(nextYear, nextMonth - 1, 20));
      await prisma.payable.create({
        data: {
          organizationId: rls.organizationId,
          farmId: anyFarmId,
          supplierName: `IRRF Retido — Folha ${_formatMonthLabel(run.referenceMonth)}`,
          category: PayableCategory.PAYROLL,
          description: `IRRF Retido na Fonte ${_formatMonthLabel(run.referenceMonth)}`,
          totalAmount: totalIrrf,
          dueDate: irrfDueDate,
          originType: 'PAYROLL_EMPLOYEE_IRRF',
          originId: runId,
        },
      });
    }
  }

  // Generate payslip PDFs and send emails
  const orgData = { name: rls.organizationId, cnpj: '' };
  for (const item of items) {
    try {
      const lineItems = Array.isArray(item.lineItemsJson)
        ? (item.lineItemsJson as any[]).map((li) => ({
            ...li,
            value: typeof li.value === 'string' ? parseFloat(li.value) : li.value,
          }))
        : [];

      const pdfBuffer = await generatePayslipPdf({
        orgName: orgData.name,
        orgCnpj: orgData.cnpj,
        employeeName: item.employee.name,
        employeeCpf: item.employee.cpf,
        employeeCargo: item.employee.contracts[0]?.position?.name ?? '',
        admissionDate: item.employee.admissionDate,
        referenceMonth: _formatIsoMonth(run.referenceMonth),
        runType: run.runType,
        lineItems,
        grossSalary: new Decimal(item.grossSalary.toString()).toNumber(),
        totalDeductions: new Decimal(item.grossSalary.toString())
          .minus(new Decimal(item.netSalary.toString()))
          .toNumber(),
        netSalary: new Decimal(item.netSalary.toString()).toNumber(),
        inssBase: new Decimal(item.grossSalary.toString()).toNumber(),
        irrfBase: new Decimal(item.grossSalary.toString()).toNumber(),
        fgtsMonth: new Decimal(item.fgtsAmount.toString()).toNumber(),
        // NOTE: Derives fgtsBase from fgtsAmount assuming standard 8% FGTS rate (Lei 8.036/90).
        // This is correct for all CLT employees. Apprentices (2% rate) are not yet supported
        // in this payroll engine. If apprentice support is added, store fgtsBase in the DB item.
        fgtsBase: new Decimal(item.fgtsAmount.toString()).isZero()
          ? 0
          : new Decimal(item.fgtsAmount.toString()).div('0.08').toDecimalPlaces(2).toNumber(),
      });

      // Send email if employee has email
      if (item.employee.email) {
        await sendMail({
          to: item.employee.email,
          subject: `Holerite ${_formatMonthLabel(run.referenceMonth)}`,
          text: `Olá ${item.employee.name}, segue em anexo o seu holerite de ${_formatMonthLabel(run.referenceMonth)}.`,
          attachments: [
            {
              filename: `holerite_${_formatIsoMonth(run.referenceMonth)}_${item.employee.name.toUpperCase().replace(/\s+/g, '-')}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        });

        await prisma.payrollRunItem.updateMany({
          where: { id: item.id },
          data: { payslipSentAt: new Date() },
        });
      }
    } catch (_err) {
      // Email/PDF errors should not abort the close operation
    }
  }

  // Transition to COMPLETED
  await prisma.payrollRun.update({
    where: { id: runId },
    data: {
      status: 'COMPLETED',
      closedAt: new Date(),
      closedBy: rls.userId ?? 'system',
    },
  });

  // Auto-generate periodic eSocial events (per D-08)
  const referenceMonth = `${run.referenceMonth.getUTCFullYear()}-${String(run.referenceMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  try {
    await esocialGenerateBatch(rls.organizationId, 'S-1200', referenceMonth, rls.userId ?? 'system');
    await esocialGenerateBatch(rls.organizationId, 'S-1210', referenceMonth, rls.userId ?? 'system');
    // S-1299 guard is enforced internally — will block if S-1200/S-1210 not all EXPORTADO
    await esocialGenerateBatch(rls.organizationId, 'S-1299', referenceMonth, rls.userId ?? 'system');
  } catch (err) {
    console.error('[payroll-runs] Failed to auto-generate periodic eSocial events:', err);
  }

  // Auto-create accounting entries (non-blocking — failure must not abort payroll close)
  try {
    await createPayrollEntries(rls.organizationId, runId);
  } catch (err) {
    console.error('[payroll-runs] Failed to create accounting entries:', err);
  }
}

// ─── revertRun ─────────────────────────────────────────────────────────

export async function revertRun(rls: RlsContext, runId: string): Promise<void> {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, organizationId: rls.organizationId },
    include: { items: { select: { id: true } } },
  });

  if (!run) {
    throw new PayrollRunError('Folha não encontrada', 'RUN_NOT_FOUND', 404);
  }

  // Validate state: REVERT requires COMPLETED
  applyTransition(run.status, 'REVERT');

  const itemIds = run.items.map((i: any) => i.id);

  // All payroll originTypes that can be created by closeRun
  const PAYROLL_ORIGIN_TYPES = [
    'PAYROLL_RUN_ITEM',
    'PAYROLL_EMPLOYER_INSS',
    'PAYROLL_EMPLOYER_FGTS',
    'PAYROLL_EMPLOYEE_IRRF',
    'PAYROLL_EMPLOYEE_VT',
    'PAYROLL_EMPLOYEE_PENSION',
    'PAYROLL_EMPLOYEE_SINDICAL',
  ] as const;

  // Cancel all Payables linked to this run (per-item or run-level)
  await prisma.payable.updateMany({
    where: {
      OR: [
        {
          originType: { in: [...PAYROLL_ORIGIN_TYPES] as string[] },
          originId: { in: [...itemIds, runId] },
        },
      ],
    },
    data: { status: 'CANCELLED' as any },
  });

  // Unlock timesheets
  await prisma.timesheet.updateMany({
    where: { payrollRunId: runId },
    data: { status: 'APPROVED', payrollRunId: null },
  });

  // Reset salary advance deductions
  await prisma.salaryAdvance.updateMany({
    where: { deductedInRunId: runId },
    data: { deductedInRunId: null },
  });

  // Transition to REVERTED
  await prisma.payrollRun.update({
    where: { id: runId },
    data: {
      status: 'REVERTED',
      revertedAt: new Date(),
      revertedBy: rls.userId ?? 'system',
    },
  });

  // Delete accounting entries for this run (non-blocking)
  try {
    await revertPayrollEntries(rls.organizationId, runId);
  } catch (err) {
    console.error('[payroll-runs] Failed to revert accounting entries:', err);
  }
}

// ─── cpPreview ─────────────────────────────────────────────────────────

/**
 * Dry-run preview of which CPs would be created by closeRun.
 * Does NOT write to DB. Includes FUNRURAL from tax-guides module.
 */
export async function cpPreview(rls: RlsContext, runId: string): Promise<CpPreviewResponse> {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, organizationId: rls.organizationId },
  });

  if (!run) {
    throw new PayrollRunError('Folha não encontrada', 'RUN_NOT_FOUND', 404);
  }

  // Fetch CALCULATED items with employee data
  const items = await prisma.payrollRunItem.findMany({
    where: { payrollRunId: runId, status: 'CALCULATED' },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
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

  const refYear = run.referenceMonth.getUTCFullYear();
  const refMonth = run.referenceMonth.getUTCMonth() + 1;
  const nextMonth = refMonth === 12 ? 1 : refMonth + 1;
  const nextYear = refMonth === 12 ? refYear + 1 : refYear;

  const previewItems: CpPreviewItem[] = [];
  let totalAmount = new Decimal(0);
  let totalIrrf = new Decimal(0);
  let runTotalNet = new Decimal(0);

  for (const item of items) {
    const farmId = item.employee.farms[0]?.farmId;
    if (!farmId) continue;

    // Net salary CP
    const netAmount = new Decimal(item.netSalary.toString());
    runTotalNet = runTotalNet.plus(netAmount);
    previewItems.push({
      type: 'Salario Liquido',
      employeeName: item.employee.name,
      amount: netAmount.toNumber(),
      dueDate: nthBusinessDay(nextYear, nextMonth, 5).toISOString().split('T')[0],
      costCenterItems: [],
    });
    totalAmount = totalAmount.plus(netAmount);

    // VT CP
    const vtAmount = new Decimal(item.vtDeduction.toString());
    if (vtAmount.greaterThan(0)) {
      previewItems.push({
        type: 'VT',
        employeeName: item.employee.name,
        amount: vtAmount.toNumber(),
        dueDate: nthBusinessDay(nextYear, nextMonth, 5).toISOString().split('T')[0],
        costCenterItems: [],
      });
      totalAmount = totalAmount.plus(vtAmount);
    }

    // Pension CP
    const alimonyAmount = item.alimonyDeduction
      ? new Decimal(item.alimonyDeduction.toString())
      : new Decimal(0);
    if (alimonyAmount.greaterThan(0)) {
      previewItems.push({
        type: 'Pensao',
        employeeName: item.employee.name,
        amount: alimonyAmount.toNumber(),
        dueDate: nthBusinessDay(nextYear, nextMonth, 5).toISOString().split('T')[0],
        costCenterItems: [],
      });
      totalAmount = totalAmount.plus(alimonyAmount);
    }

    // Sindical CP
    const lineItems = Array.isArray(item.lineItemsJson) ? (item.lineItemsJson as any[]) : [];
    const sindicalLineItem = lineItems.find(
      (li: any) =>
        li.type === 'DESCONTO' &&
        (String(li.code).startsWith('9') ||
          String(li.description ?? '')
            .toLowerCase()
            .includes('sindical')),
    );
    if (sindicalLineItem) {
      const sindicalAmount = new Decimal(
        typeof sindicalLineItem.value === 'string'
          ? parseFloat(sindicalLineItem.value)
          : sindicalLineItem.value ?? 0,
      );
      if (sindicalAmount.greaterThan(0)) {
        previewItems.push({
          type: 'Sindical',
          employeeName: item.employee.name,
          amount: sindicalAmount.toNumber(),
          dueDate: nthBusinessDay(nextYear, nextMonth + 1 > 12 ? 1 : nextMonth + 1, 5)
            .toISOString()
            .split('T')[0],
          costCenterItems: [],
        });
        totalAmount = totalAmount.plus(sindicalAmount);
      }
    }

    // Accumulate IRRF
    totalIrrf = totalIrrf.plus(new Decimal(item.irrfAmount.toString()));
  }

  // INSS patronal
  const totalInssPatronal = items.reduce(
    (s: Decimal, i: any) => s.plus(new Decimal(i.inssPatronal.toString())),
    new Decimal(0),
  );
  if (totalInssPatronal.greaterThan(0)) {
    previewItems.push({
      type: 'INSS Patronal',
      amount: totalInssPatronal.toNumber(),
      dueDate: new Date(Date.UTC(nextYear, nextMonth - 1, 20)).toISOString().split('T')[0],
      costCenterItems: [],
    });
    totalAmount = totalAmount.plus(totalInssPatronal);
  }

  // FGTS
  const totalFgts = items.reduce(
    (s: Decimal, i: any) => s.plus(new Decimal(i.fgtsAmount.toString())),
    new Decimal(0),
  );
  if (totalFgts.greaterThan(0)) {
    previewItems.push({
      type: 'FGTS',
      amount: totalFgts.toNumber(),
      dueDate: new Date(Date.UTC(nextYear, nextMonth - 1, 7)).toISOString().split('T')[0],
      costCenterItems: [],
    });
    totalAmount = totalAmount.plus(totalFgts);
  }

  // IRRF (aggregated)
  if (totalIrrf.greaterThan(0)) {
    previewItems.push({
      type: 'IRRF',
      amount: totalIrrf.toNumber(),
      dueDate: new Date(Date.UTC(nextYear, nextMonth - 1, 20)).toISOString().split('T')[0],
      costCenterItems: [],
    });
    totalAmount = totalAmount.plus(totalIrrf);
  }

  // Fetch existing TaxGuide records for the same referenceMonth
  const taxGuides = await prisma.taxGuide.findMany({
    where: {
      organizationId: rls.organizationId,
      referenceMonth: run.referenceMonth,
    },
    select: {
      guideType: true,
      totalAmount: true,
      dueDate: true,
      referenceMonth: true,
    },
  });

  const taxGuideItems: TaxGuidePreviewItem[] = taxGuides.map((tg: any) => ({
    type: String(tg.guideType),
    amount: new Decimal(tg.totalAmount.toString()).toNumber(),
    dueDate: tg.dueDate.toISOString().split('T')[0],
    referenceMonth: _formatIsoMonth(tg.referenceMonth),
  }));

  const totalTaxGuides = taxGuideItems.reduce((s, t) => s + t.amount, 0);

  // Reconciliation: totalAmount of net-salary CPs vs run.totalNet
  const runNetFromDb = run.totalNet ? new Decimal(run.totalNet.toString()) : runTotalNet;
  const diff = totalAmount.minus(runNetFromDb).abs();
  const reconciled = diff.lessThan(new Decimal('0.01'));

  return {
    items: previewItems,
    taxGuideItems,
    totalAmount: totalAmount.toNumber(),
    totalTaxGuides,
    runTotalNet: runNetFromDb.toNumber(),
    reconciled,
  };
}

// ─── listRuns ──────────────────────────────────────────────────────────

export async function listRuns(
  rls: RlsContext,
  filters: ListRunsInput,
): Promise<{ data: any[]; total: number }> {
  const { page = 1, limit = 20, status, runType, referenceMonth } = filters;

  const where: Record<string, unknown> = {
    organizationId: rls.organizationId,
  };

  if (status) where.status = status;
  if (runType) where.runType = runType;
  if (referenceMonth) {
    where.referenceMonth = new Date(referenceMonth + '-01');
  }

  const data = await prisma.payrollRun.findMany({
    where,
    orderBy: [{ referenceMonth: 'desc' }, { createdAt: 'desc' }],
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      referenceMonth: true,
      runType: true,
      status: true,
      employeeCount: true,
      totalGross: true,
      totalNet: true,
      totalCharges: true,
      triggeredBy: true,
      closedAt: true,
      notes: true,
      createdAt: true,
    },
  });

  return { data, total: data.length };
}

// ─── getRun ────────────────────────────────────────────────────────────

export async function getRun(
  rls: RlsContext,
  runId: string,
): Promise<Record<string, unknown>> {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, organizationId: rls.organizationId },
    include: {
      items: {
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              cpf: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!run) {
    throw new PayrollRunError('Folha não encontrada', 'RUN_NOT_FOUND', 404);
  }

  return run as Record<string, unknown>;
}

// ─── downloadPayslipsZip ───────────────────────────────────────────────

export async function downloadPayslipsZip(
  rls: RlsContext,
  runId: string,
): Promise<Buffer> {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, organizationId: rls.organizationId },
    include: {
      items: {
        where: { status: 'CALCULATED' },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              cpf: true,
              admissionDate: true,
              contracts: {
                where: { isActive: true },
                select: { position: { select: { name: true } } },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!run) {
    throw new PayrollRunError('Folha não encontrada', 'RUN_NOT_FOUND', 404);
  }

  const orgName = (run as any).organization?.name ?? rls.organizationId;
  const orgCnpj = (run as any).organization?.cnpj ?? '';
  const isoMonth = _formatIsoMonth(run.referenceMonth);

  const zip = new JSZip();

  for (const item of (run as any).items) {
    const lineItems = Array.isArray(item.lineItemsJson)
      ? (item.lineItemsJson as any[]).map((li: any) => ({
          ...li,
          value: typeof li.value === 'string' ? parseFloat(li.value) : li.value,
        }))
      : [];

    const pdfBuffer = await generatePayslipPdf({
      orgName,
      orgCnpj,
      employeeName: item.employee.name,
      employeeCpf: item.employee.cpf,
      employeeCargo: item.employee.contracts[0]?.position?.name ?? '',
      admissionDate: item.employee.admissionDate,
      referenceMonth: isoMonth,
      runType: run.runType,
      lineItems,
      grossSalary: new Decimal(item.grossSalary.toString()).toNumber(),
      totalDeductions: new Decimal(item.grossSalary.toString())
        .minus(new Decimal(item.netSalary.toString()))
        .toNumber(),
      netSalary: new Decimal(item.netSalary.toString()).toNumber(),
      inssBase: new Decimal(item.grossSalary.toString()).toNumber(),
      irrfBase: new Decimal(item.grossSalary.toString()).toNumber(),
      fgtsMonth: new Decimal(item.fgtsAmount.toString()).toNumber(),
      // NOTE: Derives fgtsBase from fgtsAmount assuming standard 8% FGTS rate (Lei 8.036/90).
      // This is correct for all CLT employees. Apprentices (2% rate) are not yet supported
      // in this payroll engine. If apprentice support is added, store fgtsBase in the DB item.
      fgtsBase: new Decimal(item.fgtsAmount.toString()).isZero()
        ? 0
        : new Decimal(item.fgtsAmount.toString()).div('0.08').toDecimalPlaces(2).toNumber(),
    });

    const filename = `holerite_${isoMonth}_${item.employee.name.toUpperCase().replace(/\s+/g, '-')}.pdf`;
    zip.file(filename, pdfBuffer);
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ─── getEmployeePayslips ───────────────────────────────────────────────

export async function getEmployeePayslips(
  rls: RlsContext,
  employeeId: string,
): Promise<any[]> {
  const items = await prisma.payrollRunItem.findMany({
    where: {
      employeeId,
      payrollRun: {
        organizationId: rls.organizationId,
        status: 'COMPLETED',
        referenceMonth: {
          gte: new Date(Date.UTC(new Date().getUTCFullYear() - 1, new Date().getUTCMonth(), 1)),
        },
      },
    },
    include: {
      payrollRun: {
        select: {
          referenceMonth: true,
          runType: true,
        },
      },
    },
    orderBy: {
      payrollRun: { referenceMonth: 'desc' },
    },
    take: 12,
  });

  return items as any[];
}

// ─── Private helpers ──────────────────────────────────────────────────

function _formatMonthLabel(date: Date): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${months[date.getUTCMonth()]}/${date.getUTCFullYear()}`;
}

function _formatIsoMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
