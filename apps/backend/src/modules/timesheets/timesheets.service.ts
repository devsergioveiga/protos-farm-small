import Decimal from 'decimal.js';
import { differenceInMinutes } from 'date-fns';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  calcDailyWork,
  calcMonthlyTotals,
  isHolidayOrSunday,
  calcInterjornada,
} from '../time-calculations/time-calculations.service';
import { createOvertimeBankEntry } from '../overtime-bank/overtime-bank.service';
import { TimesheetError } from './timesheets.types';
import type {
  CreateTimesheetInput,
  TimesheetApprovalInput,
  TimesheetCorrectionInput,
  TimesheetListQuery,
  TimesheetOutput,
  TimesheetInconsistency,
} from './timesheets.types';
import type { DailyWorkInput, DailyWorkResult } from '../time-calculations/time-calculations.types';

// ─── State Machine ────────────────────────────────────────────────────

type TimesheetStatus =
  | 'DRAFT'
  | 'PENDING_MANAGER'
  | 'MANAGER_APPROVED'
  | 'PENDING_RH'
  | 'APPROVED'
  | 'LOCKED'
  | 'REJECTED';

const VALID_TRANSITIONS: Record<string, Partial<Record<string, TimesheetStatus>>> = {
  APPROVE_MANAGER: { PENDING_MANAGER: 'MANAGER_APPROVED' },
  APPROVE_RH: { PENDING_RH: 'APPROVED' },
  REJECT: {
    PENDING_MANAGER: 'DRAFT',
    MANAGER_APPROVED: 'DRAFT',
    PENDING_RH: 'DRAFT',
  },
  EMPLOYEE_ACCEPT: { APPROVED: 'APPROVED' },
  EMPLOYEE_DISPUTE: { APPROVED: 'APPROVED' },
};

// ─── Helpers ─────────────────────────────────────────────────────────

function calcScheduledMinutesFromSchedule(
  schedule: {
    startTime: string; // "HH:MM"
    endTime: string; // "HH:MM"
    breakMinutes: number;
  } | null,
): number {
  if (!schedule) return 480; // default 8h

  const [startH, startM] = schedule.startTime.split(':').map(Number);
  const [endH, endM] = schedule.endTime.split(':').map(Number);
  const totalMinutes = endH * 60 + endM - (startH * 60 + startM);
  return Math.max(0, totalMinutes - schedule.breakMinutes);
}

function _calcNightMinutesForPeriod(clockIn: Date, clockOut: Date): number {
  const NIGHT_START = 21;
  const NIGHT_END = 5;
  let nightMinutes = 0;
  let current = new Date(clockIn);
  const end = new Date(clockOut);
  while (current < end) {
    const hour = current.getHours();
    if (hour >= NIGHT_START || hour < NIGHT_END) nightMinutes++;
    current = new Date(current.getTime() + 60000);
  }
  return nightMinutes;
}

function formatTimesheet(
  row: {
    id: string;
    employeeId: string;
    employee: { name: string };
    referenceMonth: Date;
    status: string;
    totalWorked: number;
    totalOvertime50: number;
    totalOvertime100: number;
    totalNightMinutes: number;
    totalAbsences: number;
    closingDeadline: Date | null;
    managerApprovedBy: string | null;
    managerApprovedAt: Date | null;
    rhApprovedBy: string | null;
    rhApprovedAt: Date | null;
    employeeAcceptedAt: Date | null;
    employeeDisputeNote: string | null;
    payrollRunId: string | null;
    notes: string | null;
    corrections: Array<{
      id: string;
      timeEntryId: string | null;
      correctedBy: string;
      justification: string;
      beforeJson: unknown;
      afterJson: unknown;
      createdAt: Date;
    }>;
    createdAt: Date;
  },
  inconsistencies: TimesheetInconsistency[] = [],
): TimesheetOutput {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    referenceMonth: row.referenceMonth.toISOString().split('T')[0],
    status: row.status as TimesheetOutput['status'],
    totalWorked: row.totalWorked,
    totalOvertime50: row.totalOvertime50,
    totalOvertime100: row.totalOvertime100,
    totalNightMinutes: row.totalNightMinutes,
    totalAbsences: row.totalAbsences,
    closingDeadline: row.closingDeadline ? row.closingDeadline.toISOString().split('T')[0] : null,
    managerApprovedBy: row.managerApprovedBy,
    managerApprovedAt: row.managerApprovedAt ? row.managerApprovedAt.toISOString() : null,
    rhApprovedBy: row.rhApprovedBy,
    rhApprovedAt: row.rhApprovedAt ? row.rhApprovedAt.toISOString() : null,
    employeeAcceptedAt: row.employeeAcceptedAt ? row.employeeAcceptedAt.toISOString() : null,
    employeeDisputeNote: row.employeeDisputeNote,
    payrollRunId: row.payrollRunId,
    notes: row.notes,
    corrections: row.corrections.map((c) => ({
      id: c.id,
      timeEntryId: c.timeEntryId,
      correctedBy: c.correctedBy,
      justification: c.justification,
      beforeJson: c.beforeJson as Record<string, unknown>,
      afterJson: c.afterJson as Record<string, unknown>,
      createdAt: c.createdAt.toISOString(),
    })),
    inconsistencies,
    createdAt: row.createdAt.toISOString(),
  };
}

const SHEET_SELECT = {
  id: true,
  employeeId: true,
  employee: { select: { name: true } },
  referenceMonth: true,
  status: true,
  totalWorked: true,
  totalOvertime50: true,
  totalOvertime100: true,
  totalNightMinutes: true,
  totalAbsences: true,
  closingDeadline: true,
  managerApprovedBy: true,
  managerApprovedAt: true,
  rhApprovedBy: true,
  rhApprovedAt: true,
  employeeAcceptedAt: true,
  employeeDisputeNote: true,
  payrollRunId: true,
  notes: true,
  corrections: {
    select: {
      id: true,
      timeEntryId: true,
      correctedBy: true,
      justification: true,
      beforeJson: true,
      afterJson: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
  createdAt: true,
} as const;

// ─── createTimesheet ──────────────────────────────────────────────────

export async function createTimesheet(
  ctx: RlsContext,
  orgId: string,
  input: CreateTimesheetInput,
): Promise<TimesheetOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Validate employee
    const employee = await tx.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true, organizationId: true },
    });
    if (!employee || employee.organizationId !== orgId) {
      throw new TimesheetError('Colaborador não encontrado nesta organização', 404);
    }

    const referenceMonth = new Date(input.referenceMonth);

    const sheet = await tx.timesheet.create({
      data: {
        organizationId: orgId,
        employeeId: input.employeeId,
        referenceMonth,
        status: 'DRAFT',
        totalWorked: 0,
        totalOvertime50: 0,
        totalOvertime100: 0,
        totalNightMinutes: 0,
        totalAbsences: 0,
        closingDeadline: input.closingDeadline ? new Date(input.closingDeadline) : undefined,
      },
      select: SHEET_SELECT,
    });

    return formatTimesheet(sheet as Parameters<typeof formatTimesheet>[0]);
  });
}

// ─── calculateTimesheet ───────────────────────────────────────────────

export async function calculateTimesheet(
  ctx: RlsContext,
  orgId: string,
  timesheetId: string,
): Promise<TimesheetOutput> {
  return withRlsContext(ctx, async (tx) => {
    const sheet = await tx.timesheet.findUnique({
      where: { id: timesheetId },
      select: {
        id: true,
        organizationId: true,
        employeeId: true,
        referenceMonth: true,
        status: true,
      },
    });

    if (!sheet || sheet.organizationId !== orgId) {
      throw new TimesheetError('Folha de ponto não encontrada', 404);
    }

    // Get work schedule for scheduled hours
    const contract = await tx.employeeContract.findFirst({
      where: { employeeId: sheet.employeeId, endDate: null },
      orderBy: { startDate: 'desc' },
      select: {
        salary: true,
        weeklyHours: true,
        workSchedule: {
          select: {
            startTime: true,
            endTime: true,
            breakMinutes: true,
            workDays: true,
          },
        },
      },
    });

    const scheduledMinutes = calcScheduledMinutesFromSchedule(contract?.workSchedule ?? null);

    // Fetch all time entries for this employee and reference month
    const refMonth = sheet.referenceMonth;
    const nextMonth = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 1);

    const timeEntries = await tx.timeEntry.findMany({
      where: {
        employeeId: sheet.employeeId,
        organizationId: orgId,
        date: { gte: refMonth, lt: nextMonth },
      },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        clockIn: true,
        breakStart: true,
        breakEnd: true,
        clockOut: true,
        workedMinutes: true,
        nightMinutes: true,
        outOfRange: true,
        noBoundary: true,
      },
    });

    // Build daily results + detect inconsistencies
    const dailyResults: DailyWorkResult[] = [];
    const inconsistencies: TimesheetInconsistency[] = [];
    let previousClockOut: Date | null = null;

    for (const entry of timeEntries) {
      const date = entry.date;
      const isDayOff = isHolidayOrSunday(date);

      // Inconsistency: missing clock out
      if (!entry.clockOut) {
        inconsistencies.push({
          timeEntryId: entry.id,
          date: date.toISOString().split('T')[0],
          type: 'MISSING_CLOCK_OUT',
          description: 'Ponto sem saída registrada',
          severity: 'ERROR',
        });
      }

      // Inconsistency: out of range
      if (entry.outOfRange) {
        inconsistencies.push({
          timeEntryId: entry.id,
          date: date.toISOString().split('T')[0],
          type: 'OUT_OF_RANGE',
          description: 'Ponto registrado fora da área da fazenda',
          severity: 'WARNING',
        });
      }

      // Inconsistency: no boundary
      if (entry.noBoundary) {
        inconsistencies.push({
          timeEntryId: entry.id,
          date: date.toISOString().split('T')[0],
          type: 'NO_BOUNDARY',
          description: 'Fazenda sem limite geográfico cadastrado',
          severity: 'WARNING',
        });
      }

      // Interjornada check
      if (previousClockOut) {
        const { alert } = calcInterjornada(previousClockOut, entry.clockIn);
        if (alert) {
          inconsistencies.push({
            timeEntryId: entry.id,
            date: date.toISOString().split('T')[0],
            type: 'INTERJORNADA_VIOLATION',
            description: 'Intervalo entre jornadas menor que 11 horas',
            severity: 'WARNING',
          });
        }
      }

      const workedMins = entry.workedMinutes ?? 0;
      const nightMins = entry.nightMinutes ?? 0;

      const dailyInput: DailyWorkInput = {
        workedMinutes: new Decimal(workedMins),
        scheduledMinutes: new Decimal(scheduledMinutes),
        isDayOff,
        nightMinutes: new Decimal(nightMins),
      };

      const result = calcDailyWork(dailyInput, previousClockOut, entry.clockIn);
      dailyResults.push(result);

      if (entry.clockOut) {
        previousClockOut = entry.clockOut;
      }
    }

    const totals = calcMonthlyTotals(dailyResults);

    // Update time entries to link to this timesheet
    await tx.timeEntry.updateMany({
      where: {
        employeeId: sheet.employeeId,
        organizationId: orgId,
        date: { gte: refMonth, lt: nextMonth },
      },
      data: { timesheetId },
    });

    // Create OvertimeBankEntry CREDIT if overtime50 > 0
    const overtime50 = totals.totalOvertime50.toNumber();
    if (overtime50 > 0) {
      const expiresAt = new Date(refMonth.getFullYear(), refMonth.getMonth() + 6, 1);
      await createOvertimeBankEntry(ctx, orgId, {
        employeeId: sheet.employeeId,
        referenceMonth: refMonth.toISOString().split('T')[0],
        minutes: Math.round(overtime50),
        balanceType: 'CREDIT',
        description: `HE 50% — ${refMonth.toISOString().split('T')[0].substring(0, 7)}`,
        expiresAt: expiresAt.toISOString().split('T')[0],
        timesheetId,
      });
    }

    // Transition DRAFT -> PENDING_MANAGER
    const updatedSheet = await tx.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: 'PENDING_MANAGER',
        totalWorked: Math.round(totals.totalWorked.toNumber()),
        totalOvertime50: Math.round(totals.totalOvertime50.toNumber()),
        totalOvertime100: Math.round(totals.totalOvertime100.toNumber()),
        totalNightMinutes: Math.round(totals.totalNightMinutes.toNumber()),
        totalAbsences: totals.totalAbsences,
      },
      select: SHEET_SELECT,
    });

    return formatTimesheet(updatedSheet as Parameters<typeof formatTimesheet>[0], inconsistencies);
  });
}

// ─── approveTimesheet ─────────────────────────────────────────────────

export async function approveTimesheet(
  ctx: RlsContext,
  orgId: string,
  timesheetId: string,
  userId: string,
  input: TimesheetApprovalInput,
): Promise<TimesheetOutput> {
  // Validate justification for REJECT and EMPLOYEE_DISPUTE
  if (
    (input.action === 'REJECT' || input.action === 'EMPLOYEE_DISPUTE') &&
    (!input.justification || input.justification.trim().length < 20)
  ) {
    throw new TimesheetError('Justificativa deve ter pelo menos 20 caracteres', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const sheet = await tx.timesheet.findUnique({
      where: { id: timesheetId },
      select: { id: true, organizationId: true, status: true },
    });

    if (!sheet || sheet.organizationId !== orgId) {
      throw new TimesheetError('Folha de ponto não encontrada', 404);
    }

    const currentStatus = sheet.status as TimesheetStatus;
    const validNextStatus = VALID_TRANSITIONS[input.action]?.[currentStatus];

    if (validNextStatus === undefined) {
      const validStatuses = Object.keys(VALID_TRANSITIONS[input.action] ?? {}).join(', ');
      throw new TimesheetError(
        `Transição inválida: ação "${input.action}" não permitida no status "${currentStatus}". Status válidos: ${validStatuses}`,
        400,
      );
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {};

    if (input.action === 'APPROVE_MANAGER') {
      updateData.managerApprovedBy = userId;
      updateData.managerApprovedAt = now;
      // Auto-transition to PENDING_RH after MANAGER_APPROVED
      updateData.status = 'PENDING_RH';
    } else if (input.action === 'APPROVE_RH') {
      updateData.rhApprovedBy = userId;
      updateData.rhApprovedAt = now;
      updateData.status = 'APPROVED';
    } else if (input.action === 'REJECT') {
      updateData.status = 'DRAFT';
      updateData.notes = input.justification;
    } else if (input.action === 'EMPLOYEE_ACCEPT') {
      updateData.employeeAcceptedAt = now;
      updateData.status = 'APPROVED';
    } else if (input.action === 'EMPLOYEE_DISPUTE') {
      updateData.employeeDisputeNote = input.justification;
      updateData.status = 'APPROVED';
    }

    const updatedSheet = await tx.timesheet.update({
      where: { id: timesheetId },
      data: updateData,
      select: SHEET_SELECT,
    });

    return formatTimesheet(updatedSheet as Parameters<typeof formatTimesheet>[0]);
  });
}

// ─── correctTimeEntry ─────────────────────────────────────────────────

export async function correctTimeEntry(
  ctx: RlsContext,
  orgId: string,
  timesheetId: string,
  input: TimesheetCorrectionInput,
): Promise<TimesheetOutput> {
  return withRlsContext(ctx, async (tx) => {
    const sheet = await tx.timesheet.findUnique({
      where: { id: timesheetId },
      select: { id: true, organizationId: true },
    });

    if (!sheet || sheet.organizationId !== orgId) {
      throw new TimesheetError('Folha de ponto não encontrada', 404);
    }

    // Fetch current time entry state as beforeJson
    const timeEntry = await tx.timeEntry.findUnique({
      where: { id: input.timeEntryId },
      select: {
        id: true,
        clockIn: true,
        breakStart: true,
        breakEnd: true,
        clockOut: true,
        workedMinutes: true,
        nightMinutes: true,
      },
    });

    if (!timeEntry) {
      throw new TimesheetError('Registro de ponto não encontrado', 404);
    }

    const beforeJson = {
      clockIn: timeEntry.clockIn.toISOString(),
      breakStart: timeEntry.breakStart?.toISOString() ?? null,
      breakEnd: timeEntry.breakEnd?.toISOString() ?? null,
      clockOut: timeEntry.clockOut?.toISOString() ?? null,
    };

    // Apply corrections
    const newClockIn = input.corrections.clockIn
      ? new Date(input.corrections.clockIn)
      : timeEntry.clockIn;
    const newClockOut =
      'clockOut' in input.corrections
        ? input.corrections.clockOut
          ? new Date(input.corrections.clockOut)
          : null
        : timeEntry.clockOut;
    const newBreakStart =
      'breakStart' in input.corrections
        ? input.corrections.breakStart
          ? new Date(input.corrections.breakStart)
          : null
        : timeEntry.breakStart;
    const newBreakEnd =
      'breakEnd' in input.corrections
        ? input.corrections.breakEnd
          ? new Date(input.corrections.breakEnd)
          : null
        : timeEntry.breakEnd;

    // Recalculate
    let workedMinutes: number | null = null;
    let nightMinutes: number | null = null;
    if (newClockOut) {
      const breakDuration =
        newBreakStart && newBreakEnd ? differenceInMinutes(newBreakEnd, newBreakStart) : 0;
      workedMinutes = differenceInMinutes(newClockOut, newClockIn) - Math.max(0, breakDuration);

      // Simple night minutes calculation
      let nm = 0;
      let cur = new Date(newClockIn);
      while (cur < newClockOut) {
        const h = cur.getHours();
        if (h >= 21 || h < 5) nm++;
        cur = new Date(cur.getTime() + 60000);
      }
      nightMinutes = nm;
    }

    const afterJson = {
      clockIn: newClockIn.toISOString(),
      breakStart: newBreakStart?.toISOString() ?? null,
      breakEnd: newBreakEnd?.toISOString() ?? null,
      clockOut: newClockOut?.toISOString() ?? null,
    };

    // Update time entry
    await tx.timeEntry.update({
      where: { id: input.timeEntryId },
      data: {
        clockIn: newClockIn,
        breakStart: newBreakStart,
        breakEnd: newBreakEnd,
        clockOut: newClockOut,
        workedMinutes,
        nightMinutes,
      },
    });

    // Create correction record
    await tx.timesheetCorrection.create({
      data: {
        timesheetId,
        timeEntryId: input.timeEntryId,
        correctedBy: ctx.userId ?? 'system',
        justification: input.justification,
        beforeJson,
        afterJson,
      },
    });

    const updatedSheet = await tx.timesheet.findUnique({
      where: { id: timesheetId },
      select: SHEET_SELECT,
    });

    return formatTimesheet(updatedSheet! as Parameters<typeof formatTimesheet>[0]);
  });
}

// ─── getTimesheet ─────────────────────────────────────────────────────

export async function getTimesheet(
  ctx: RlsContext,
  orgId: string,
  id: string,
): Promise<TimesheetOutput> {
  return withRlsContext(ctx, async (tx) => {
    const sheet = await tx.timesheet.findUnique({
      where: { id },
      select: {
        ...SHEET_SELECT,
        organizationId: true,
        employeeId: true,
        referenceMonth: true,
        timeEntries: {
          select: {
            id: true,
            date: true,
            clockIn: true,
            clockOut: true,
            outOfRange: true,
            noBoundary: true,
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!sheet || sheet.organizationId !== orgId) {
      throw new TimesheetError('Folha de ponto não encontrada', 404);
    }

    // Calculate inconsistencies on-the-fly
    const inconsistencies: TimesheetInconsistency[] = [];
    let previousClockOut: Date | null = null;

    for (const entry of sheet.timeEntries) {
      if (!entry.clockOut) {
        inconsistencies.push({
          timeEntryId: entry.id,
          date: entry.date.toISOString().split('T')[0],
          type: 'MISSING_CLOCK_OUT',
          description: 'Ponto sem saída registrada',
          severity: 'ERROR',
        });
      }
      if (entry.outOfRange) {
        inconsistencies.push({
          timeEntryId: entry.id,
          date: entry.date.toISOString().split('T')[0],
          type: 'OUT_OF_RANGE',
          description: 'Ponto registrado fora da área da fazenda',
          severity: 'WARNING',
        });
      }
      if (entry.noBoundary) {
        inconsistencies.push({
          timeEntryId: entry.id,
          date: entry.date.toISOString().split('T')[0],
          type: 'NO_BOUNDARY',
          description: 'Fazenda sem limite geográfico cadastrado',
          severity: 'WARNING',
        });
      }
      if (previousClockOut) {
        const { alert } = calcInterjornada(previousClockOut, entry.clockIn);
        if (alert) {
          inconsistencies.push({
            timeEntryId: entry.id,
            date: entry.date.toISOString().split('T')[0],
            type: 'INTERJORNADA_VIOLATION',
            description: 'Intervalo entre jornadas menor que 11 horas',
            severity: 'WARNING',
          });
        }
      }
      if (entry.clockOut) {
        previousClockOut = entry.clockOut;
      }
    }

    return formatTimesheet(sheet as Parameters<typeof formatTimesheet>[0], inconsistencies);
  });
}

// ─── listTimesheets ───────────────────────────────────────────────────

export async function listTimesheets(
  ctx: RlsContext,
  orgId: string,
  query: TimesheetListQuery,
): Promise<{ data: TimesheetOutput[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(200, Math.max(1, query.limit ?? 50));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: orgId };
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.status) where.status = query.status;
  if (query.referenceMonth) where.referenceMonth = new Date(query.referenceMonth);

  return withRlsContext(ctx, async (tx) => {
    const [sheets, total] = await Promise.all([
      tx.timesheet.findMany({
        where,
        select: SHEET_SELECT,
        orderBy: [{ referenceMonth: 'desc' }],
        skip,
        take: limit,
      }),
      tx.timesheet.count({ where }),
    ]);

    return {
      data: sheets.map((s) => formatTimesheet(s as Parameters<typeof formatTimesheet>[0])),
      total,
      page,
      limit,
    };
  });
}

// ─── generateTimesheetPdf ─────────────────────────────────────────────

export async function generateTimesheetPdf(
  ctx: RlsContext,
  orgId: string,
  id: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const sheet = await withRlsContext(ctx, async (tx) => {
    const s = await tx.timesheet.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        employeeId: true,
        referenceMonth: true,
        status: true,
        totalWorked: true,
        totalOvertime50: true,
        totalOvertime100: true,
        totalNightMinutes: true,
        totalAbsences: true,
        managerApprovedBy: true,
        managerApprovedAt: true,
        rhApprovedBy: true,
        rhApprovedAt: true,
        employee: {
          select: {
            name: true,
            cpf: true,
          },
        },
        timeEntries: {
          select: {
            date: true,
            clockIn: true,
            breakStart: true,
            breakEnd: true,
            clockOut: true,
            workedMinutes: true,
            nightMinutes: true,
            source: true,
            managerNote: true,
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!s || s.organizationId !== orgId) {
      throw new TimesheetError('Folha de ponto não encontrada', 404);
    }

    return s;
  });

  const PDFDocument = (await import('pdfkit')).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve({
        buffer,
        filename: `espelho-ponto-${sheet.employee.name.toLowerCase().replace(/\s+/g, '-')}-${sheet.referenceMonth.toISOString().substring(0, 7)}.pdf`,
      });
    });
    doc.on('error', reject);

    const refMonth = sheet.referenceMonth;
    const monthStr = `${String(refMonth.getMonth() + 1).padStart(2, '0')}/${refMonth.getFullYear()}`;

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text('ESPELHO DE PONTO', { align: 'center' });
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Funcionário: ${sheet.employee.name}`, { align: 'center' });
    doc.text(`CPF: ${sheet.employee.cpf}`, { align: 'center' });
    doc.text(`Referência: ${monthStr}`, { align: 'center' });
    doc.text(`Status: ${sheet.status}`, { align: 'center' });
    doc.moveDown();

    // Table header
    const cols = [
      'Data',
      'Entrada',
      'Int.Início',
      'Int.Fim',
      'Saída',
      'Horas',
      'HE 50%',
      'HE 100%',
      'Noturno',
    ];
    const colWidths = [60, 60, 60, 60, 60, 45, 45, 45, 45];
    const startX = 50;
    let x = startX;
    const headerY = doc.y;

    doc.fontSize(7).font('Helvetica-Bold');
    cols.forEach((col, i) => {
      doc.text(col, x, headerY, { width: colWidths[i], align: 'center' });
      x += colWidths[i];
    });
    doc.moveDown(0.5);
    doc
      .moveTo(startX, doc.y)
      .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), doc.y)
      .stroke();

    // Table rows
    doc.fontSize(7).font('Helvetica');
    for (const entry of sheet.timeEntries) {
      x = startX;
      const rowY = doc.y + 2;
      const row = [
        entry.date.toISOString().split('T')[0],
        entry.clockIn.toISOString().substring(11, 16),
        entry.breakStart ? entry.breakStart.toISOString().substring(11, 16) : '-',
        entry.breakEnd ? entry.breakEnd.toISOString().substring(11, 16) : '-',
        entry.clockOut ? entry.clockOut.toISOString().substring(11, 16) : '-',
        entry.workedMinutes
          ? `${Math.floor(entry.workedMinutes / 60)}:${String(entry.workedMinutes % 60).padStart(2, '0')}`
          : '-',
        '-',
        '-',
        entry.nightMinutes ? `${entry.nightMinutes}min` : '-',
      ];
      row.forEach((cell, i) => {
        doc.text(cell, x, rowY, { width: colWidths[i], align: 'center' });
        x += colWidths[i];
      });
      doc.moveDown(0.5);
    }

    // Totals
    doc.moveDown();
    doc
      .moveTo(startX, doc.y)
      .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), doc.y)
      .stroke();
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(
      `Total Horas Trabalhadas: ${Math.floor(sheet.totalWorked / 60)}h${String(sheet.totalWorked % 60).padStart(2, '0')}min`,
      startX,
    );
    doc.text(
      `Total HE 50%: ${Math.floor(sheet.totalOvertime50 / 60)}h${String(sheet.totalOvertime50 % 60).padStart(2, '0')}min`,
      startX,
    );
    doc.text(
      `Total HE 100%: ${Math.floor(sheet.totalOvertime100 / 60)}h${String(sheet.totalOvertime100 % 60).padStart(2, '0')}min`,
      startX,
    );
    doc.text(`Total Noturno: ${sheet.totalNightMinutes}min`, startX);
    doc.text(`Faltas: ${sheet.totalAbsences} dia(s)`, startX);

    // Signatures
    doc.moveDown(3);
    const sigY = doc.y;
    doc.fontSize(9).font('Helvetica');
    doc
      .moveTo(startX, sigY)
      .lineTo(startX + 160, sigY)
      .stroke();
    doc.text('Assinatura do Empregado', startX, sigY + 5);

    doc
      .moveTo(startX + 200, sigY)
      .lineTo(startX + 360, sigY)
      .stroke();
    doc.text('Assinatura do Gerente', startX + 200, sigY + 5);

    doc
      .moveTo(startX + 400, sigY)
      .lineTo(startX + 480, sigY)
      .stroke();
    doc.text('RH', startX + 400, sigY + 5);

    doc.end();
  });
}
