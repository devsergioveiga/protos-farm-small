// ─── PayrollRun Orchestrator Service ─────────────────────────────────
// Full lifecycle: create → process → recalculate → close → revert.
// Per-employee transactions prevent timeout on large payrolls.

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
} from './payroll-runs.types';
import type { PayrollRunType, PayrollRunStatus } from '@prisma/client';

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
 * Returns the Nth business day (Mon–Fri, ignoring holidays for simplicity) of a given month.
 */
function nthBusinessDay(year: number, month: number, n: number): Date {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1) break;
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      count++;
      if (count === n) return d;
    }
  }
  // Fallback: last day of month
  return new Date(Date.UTC(year, month - 1, 0));
}

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

  // Per-employee: create payable, lock timesheet, deduct advances
  for (const item of items) {
    const farmId = item.employee.farms[0]?.farmId;
    if (!farmId) continue;

    await prisma.$transaction(async (tx) => {
      // Create Payable for net salary
      await tx.payable.create({
        data: {
          organizationId: rls.organizationId,
          farmId,
          supplierName: item.employee.name,
          category: 'PAYROLL' as any,
          description: `Salário ${_formatMonthLabel(run.referenceMonth)} — ${item.employee.name}`,
          totalAmount: new Decimal(item.netSalary.toString()),
          dueDate: salaryDueDate,
          originType: 'PAYROLL_RUN_ITEM',
          originId: item.id,
        },
      });

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
          category: 'PAYROLL' as any,
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
          category: 'PAYROLL' as any,
          description: `FGTS ${_formatMonthLabel(run.referenceMonth)}`,
          totalAmount: totalFgts,
          dueDate: fgtsDueDate,
          originType: 'PAYROLL_EMPLOYER_FGTS',
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

  // Cancel all Payables linked to this run
  await prisma.payable.updateMany({
    where: {
      OR: [
        { originType: 'PAYROLL_RUN_ITEM', originId: { in: itemIds } },
        { originType: 'PAYROLL_EMPLOYER_INSS', originId: runId },
        { originType: 'PAYROLL_EMPLOYER_FGTS', originId: runId },
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
