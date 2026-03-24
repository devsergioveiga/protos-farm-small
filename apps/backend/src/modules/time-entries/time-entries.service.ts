import Decimal from 'decimal.js';
import { differenceInMinutes } from 'date-fns';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { TimeEntryError } from './time-entries.types';
import type {
  CreateTimeEntryInput,
  UpdateTimeEntryInput,
  TimeEntryListQuery,
  TimeEntryOutput,
  CreateTimeEntryActivityInput,
  TimeEntryActivityOutput,
} from './time-entries.types';

// ─── Helpers ─────────────────────────────────────────────────────────

function calcNightMinutes(clockIn: Date, clockOut: Date): number {
  // Rural night period: 21:00–05:00 (Lei 5.889/73)
  const NIGHT_START = 21;
  const NIGHT_END = 5;

  let nightMinutes = 0;
  let current = new Date(clockIn);
  const end = new Date(clockOut);

  while (current < end) {
    const hour = current.getHours();
    const isNight = hour >= NIGHT_START || hour < NIGHT_END;
    if (isNight) {
      nightMinutes++;
    }
    current = new Date(current.getTime() + 60000); // advance 1 minute
  }

  return nightMinutes;
}

function formatEntry(row: {
  id: string;
  employeeId: string;
  employee: { name: string };
  farmId: string;
  farm: { name: string };
  date: Date;
  clockIn: Date;
  breakStart: Date | null;
  breakEnd: Date | null;
  clockOut: Date | null;
  workedMinutes: number | null;
  nightMinutes: number | null;
  outOfRange: boolean;
  noBoundary: boolean;
  latitude: Decimal | null;
  longitude: Decimal | null;
  source: string;
  managerNote: string | null;
  timesheetId: string | null;
  payrollRunId: string | null;
  activities: Array<{
    id: string;
    timeEntryId: string;
    operationType: string;
    fieldOperationId: string | null;
    fieldPlotId: string | null;
    farmLocationId: string | null;
    costCenterId: string | null;
    minutes: number;
    hourlyRate: Decimal;
    costAmount: Decimal;
    notes: string | null;
  }>;
  createdBy: string;
  createdAt: Date;
}): TimeEntryOutput {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    farmId: row.farmId,
    farmName: row.farm.name,
    date: row.date.toISOString().split('T')[0],
    clockIn: row.clockIn.toISOString(),
    breakStart: row.breakStart ? row.breakStart.toISOString() : null,
    breakEnd: row.breakEnd ? row.breakEnd.toISOString() : null,
    clockOut: row.clockOut ? row.clockOut.toISOString() : null,
    workedMinutes: row.workedMinutes,
    nightMinutes: row.nightMinutes,
    outOfRange: row.outOfRange,
    noBoundary: row.noBoundary,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    source: row.source as TimeEntryOutput['source'],
    managerNote: row.managerNote,
    timesheetId: row.timesheetId,
    payrollRunId: row.payrollRunId,
    activities: row.activities.map((a) => ({
      id: a.id,
      timeEntryId: a.timeEntryId,
      operationType: a.operationType,
      fieldOperationId: a.fieldOperationId,
      fieldPlotId: a.fieldPlotId,
      farmLocationId: a.farmLocationId,
      costCenterId: a.costCenterId,
      minutes: a.minutes,
      hourlyRate: a.hourlyRate.toFixed(4),
      costAmount: a.costAmount.toFixed(2),
      notes: a.notes,
    })),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

const ENTRY_SELECT = {
  id: true,
  employeeId: true,
  employee: { select: { name: true } },
  farmId: true,
  farm: { select: { name: true } },
  date: true,
  clockIn: true,
  breakStart: true,
  breakEnd: true,
  clockOut: true,
  workedMinutes: true,
  nightMinutes: true,
  outOfRange: true,
  noBoundary: true,
  latitude: true,
  longitude: true,
  source: true,
  managerNote: true,
  timesheetId: true,
  payrollRunId: true,
  activities: {
    select: {
      id: true,
      timeEntryId: true,
      operationType: true,
      fieldOperationId: true,
      fieldPlotId: true,
      farmLocationId: true,
      costCenterId: true,
      minutes: true,
      hourlyRate: true,
      costAmount: true,
      notes: true,
    },
  },
  createdBy: true,
  createdAt: true,
} as const;

// ─── createTimeEntry ──────────────────────────────────────────────────

export async function createTimeEntry(
  ctx: RlsContext,
  orgId: string,
  employeeId: string,
  input: CreateTimeEntryInput,
): Promise<TimeEntryOutput> {
  // Validate MANAGER source requires managerNote >= 10 chars
  if (input.source === 'MANAGER') {
    if (!input.managerNote || input.managerNote.trim().length < 10) {
      throw new TimeEntryError(
        'managerNote obrigatório para lançamentos manuais (mínimo 10 caracteres)',
        400,
      );
    }
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate employee belongs to org
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, organizationId: true, status: true },
    });
    if (!employee || employee.organizationId !== orgId) {
      throw new TimeEntryError('Colaborador não encontrado nesta organização', 404);
    }
    if (employee.status !== 'ATIVO') {
      throw new TimeEntryError(`Colaborador com status ${employee.status} não pode registrar ponto`, 422);
    }

    // Check if month is locked (payrollRunId set on timesheet)
    const entryDate = new Date(input.date);
    const firstDayOfMonth = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1);
    const lockedSheet = await tx.timesheet.findUnique({
      where: { employeeId_referenceMonth: { employeeId, referenceMonth: firstDayOfMonth } },
      select: { payrollRunId: true },
    });
    if (lockedSheet?.payrollRunId != null) {
      throw new TimeEntryError(
        'Folha de ponto fechada para folha de pagamento — edição bloqueada',
        409,
      );
    }

    // Geofencing via PostGIS ST_Contains
    let outOfRange = false;
    let noBoundary = false;

    if (input.latitude != null && input.longitude != null) {
      const geoResult = await tx.$queryRaw<Array<{ inside: boolean; has_boundary: boolean }>>`
        SELECT
          (boundary IS NOT NULL) AS has_boundary,
          CASE
            WHEN boundary IS NULL THEN false
            ELSE ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326))
          END AS inside
        FROM farms
        WHERE id = ${input.farmId}::uuid
        LIMIT 1
      `;

      if (geoResult.length > 0) {
        const row = geoResult[0];
        if (!row.has_boundary) {
          noBoundary = true;
          outOfRange = false;
        } else {
          outOfRange = !row.inside;
        }
      }
    }

    // Calculate workedMinutes and nightMinutes
    const clockIn = new Date(input.clockIn);
    const clockOut = input.clockOut ? new Date(input.clockOut) : null;

    let workedMinutes: number | null = null;
    let nightMinutes: number | null = null;

    if (clockOut) {
      const breakDuration =
        input.breakStart && input.breakEnd
          ? differenceInMinutes(new Date(input.breakEnd), new Date(input.breakStart))
          : 0;
      workedMinutes = differenceInMinutes(clockOut, clockIn) - Math.max(0, breakDuration);
      nightMinutes = calcNightMinutes(clockIn, clockOut);
    }

    const entry = await tx.timeEntry.create({
      data: {
        organizationId: orgId,
        employeeId,
        farmId: input.farmId,
        date: new Date(input.date),
        clockIn,
        breakStart: input.breakStart ? new Date(input.breakStart) : undefined,
        breakEnd: input.breakEnd ? new Date(input.breakEnd) : undefined,
        clockOut,
        workedMinutes,
        nightMinutes,
        outOfRange,
        noBoundary,
        latitude: input.latitude != null ? new Decimal(input.latitude) : undefined,
        longitude: input.longitude != null ? new Decimal(input.longitude) : undefined,
        source: input.source,
        managerNote: input.managerNote,
        createdBy: ctx.userId ?? 'system',
      },
      select: ENTRY_SELECT,
    });

    return formatEntry(entry as Parameters<typeof formatEntry>[0]);
  });
}

// ─── listTimeEntries ──────────────────────────────────────────────────

export async function listTimeEntries(
  ctx: RlsContext,
  orgId: string,
  query: TimeEntryListQuery,
): Promise<{ data: TimeEntryOutput[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(200, Math.max(1, query.limit ?? 50));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: orgId };
  if (query.farmId) where.farmId = query.farmId;
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.source) where.source = query.source;
  if (query.dateFrom || query.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) dateFilter.lte = new Date(query.dateTo);
    where.date = dateFilter;
  }

  return withRlsContext(ctx, async (tx) => {
    const [entries, total] = await Promise.all([
      tx.timeEntry.findMany({
        where,
        select: ENTRY_SELECT,
        orderBy: [{ date: 'desc' }, { clockIn: 'desc' }],
        skip,
        take: limit,
      }),
      tx.timeEntry.count({ where }),
    ]);

    return {
      data: entries.map((e) => formatEntry(e as Parameters<typeof formatEntry>[0])),
      total,
      page,
      limit,
    };
  });
}

// ─── getTimeEntry ─────────────────────────────────────────────────────

export async function getTimeEntry(
  ctx: RlsContext,
  orgId: string,
  id: string,
): Promise<TimeEntryOutput> {
  return withRlsContext(ctx, async (tx) => {
    const entry = await tx.timeEntry.findUnique({
      where: { id },
      select: ENTRY_SELECT,
    });

    if (!entry || entry.organizationId !== orgId) {
      throw new TimeEntryError('Registro de ponto não encontrado', 404);
    }

    return formatEntry(entry as Parameters<typeof formatEntry>[0]);
  });
}

// ─── updateTimeEntry ──────────────────────────────────────────────────

export async function updateTimeEntry(
  ctx: RlsContext,
  orgId: string,
  id: string,
  input: UpdateTimeEntryInput,
): Promise<TimeEntryOutput> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.timeEntry.findUnique({
      where: { id },
      select: { organizationId: true, employeeId: true, date: true, clockIn: true, clockOut: true, breakStart: true, breakEnd: true },
    });

    if (!existing || existing.organizationId !== orgId) {
      throw new TimeEntryError('Registro de ponto não encontrado', 404);
    }

    // Check lock
    const firstDayOfMonth = new Date(
      existing.date.getFullYear(),
      existing.date.getMonth(),
      1,
    );
    const lockedSheet = await tx.timesheet.findUnique({
      where: {
        employeeId_referenceMonth: {
          employeeId: existing.employeeId,
          referenceMonth: firstDayOfMonth,
        },
      },
      select: { payrollRunId: true },
    });
    if (lockedSheet?.payrollRunId != null) {
      throw new TimeEntryError(
        'Folha de ponto fechada para folha de pagamento — edição bloqueada',
        409,
      );
    }

    const clockIn = input.clockIn ? new Date(input.clockIn) : existing.clockIn;
    const clockOut =
      input.clockOut !== undefined
        ? input.clockOut
          ? new Date(input.clockOut)
          : null
        : existing.clockOut;
    const breakStart =
      input.breakStart !== undefined
        ? input.breakStart
          ? new Date(input.breakStart)
          : null
        : existing.breakStart;
    const breakEnd =
      input.breakEnd !== undefined
        ? input.breakEnd
          ? new Date(input.breakEnd)
          : null
        : existing.breakEnd;

    let workedMinutes: number | null = null;
    let nightMinutes: number | null = null;

    if (clockOut) {
      const breakDuration =
        breakStart && breakEnd ? differenceInMinutes(breakEnd, breakStart) : 0;
      workedMinutes = differenceInMinutes(clockOut, clockIn) - Math.max(0, breakDuration);
      nightMinutes = calcNightMinutes(clockIn, clockOut);
    }

    const entry = await tx.timeEntry.update({
      where: { id },
      data: {
        clockIn,
        breakStart,
        breakEnd,
        clockOut,
        workedMinutes,
        nightMinutes,
        managerNote: input.managerNote,
      },
      select: ENTRY_SELECT,
    });

    return formatEntry(entry as Parameters<typeof formatEntry>[0]);
  });
}

// ─── addActivity ──────────────────────────────────────────────────────

export async function addActivity(
  ctx: RlsContext,
  orgId: string,
  timeEntryId: string,
  input: CreateTimeEntryActivityInput,
): Promise<TimeEntryActivityOutput> {
  return withRlsContext(ctx, async (tx) => {
    const entry = await tx.timeEntry.findUnique({
      where: { id: timeEntryId },
      select: { organizationId: true, employeeId: true },
    });

    if (!entry || entry.organizationId !== orgId) {
      throw new TimeEntryError('Registro de ponto não encontrado', 404);
    }

    // Get employee hourly rate from latest contract
    const contract = await tx.employeeContract.findFirst({
      where: { employeeId: entry.employeeId, endDate: null },
      orderBy: { startDate: 'desc' },
      select: {
        salary: true,
        workScheduleId: true,
        workSchedule: { select: { scheduledHoursPerDay: true, workDaysPerWeek: true } },
      },
    });

    let hourlyRate = new Decimal(0);
    if (contract?.salary) {
      // Calculate monthly hours: scheduledHoursPerDay * workDaysPerWeek * (52/12)
      const hoursPerDay = contract.workSchedule?.scheduledHoursPerDay ?? 8;
      const daysPerWeek = contract.workSchedule?.workDaysPerWeek ?? 6;
      const monthlyHours = new Decimal(hoursPerDay).mul(daysPerWeek).mul(new Decimal(52).div(12));
      hourlyRate = new Decimal(contract.salary.toString()).div(monthlyHours);
    }

    const costAmount = hourlyRate.mul(new Decimal(input.minutes).div(60));

    const activity = await tx.timeEntryActivity.create({
      data: {
        timeEntryId,
        operationType: input.operationType,
        fieldOperationId: input.fieldOperationId,
        fieldPlotId: input.fieldPlotId,
        farmLocationId: input.farmLocationId,
        costCenterId: input.costCenterId,
        minutes: input.minutes,
        hourlyRate,
        costAmount,
        notes: input.notes,
      },
      select: {
        id: true,
        timeEntryId: true,
        operationType: true,
        fieldOperationId: true,
        fieldPlotId: true,
        farmLocationId: true,
        costCenterId: true,
        minutes: true,
        hourlyRate: true,
        costAmount: true,
        notes: true,
      },
    });

    return {
      id: activity.id,
      timeEntryId: activity.timeEntryId,
      operationType: activity.operationType,
      fieldOperationId: activity.fieldOperationId,
      fieldPlotId: activity.fieldPlotId,
      farmLocationId: activity.farmLocationId,
      costCenterId: activity.costCenterId,
      minutes: activity.minutes,
      hourlyRate: activity.hourlyRate.toFixed(4),
      costAmount: activity.costAmount.toFixed(2),
      notes: activity.notes,
    };
  });
}

// ─── addTeamActivity ──────────────────────────────────────────────────

export async function addTeamActivity(
  ctx: RlsContext,
  orgId: string,
  teamId: string,
  input: {
    date: string;
    operationType: string;
    fieldOperationId?: string;
    fieldPlotId?: string;
    farmLocationId?: string;
    costCenterId?: string;
    minutes: number;
    notes?: string;
  },
): Promise<{
  created: number;
  skipped: number;
  details: Array<{ employeeId: string; employeeName: string; status: 'created' | 'skipped_no_entry' }>;
}> {
  return withRlsContext(ctx, async (tx) => {
    const team = await tx.fieldTeam.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { leftAt: null },
          include: { employee: { select: { id: true, name: true, organizationId: true } } },
        },
      },
    });

    if (!team || team.organizationId !== orgId) {
      throw new TimeEntryError('Equipe não encontrada', 404);
    }

    const targetDate = new Date(input.date);
    const details: Array<{
      employeeId: string;
      employeeName: string;
      status: 'created' | 'skipped_no_entry';
    }> = [];
    let created = 0;
    let skipped = 0;

    for (const member of team.members) {
      if (!member.employeeId || member.employee.organizationId !== orgId) {
        continue;
      }

      // Find time entry for this employee on the given date
      const timeEntry = await tx.timeEntry.findFirst({
        where: {
          employeeId: member.employeeId,
          organizationId: orgId,
          date: targetDate,
        },
        select: { id: true },
      });

      if (!timeEntry) {
        details.push({
          employeeId: member.employeeId,
          employeeName: member.employee.name,
          status: 'skipped_no_entry',
        });
        skipped++;
        continue;
      }

      await addActivity(ctx, orgId, timeEntry.id, {
        timeEntryId: timeEntry.id,
        operationType: input.operationType,
        fieldOperationId: input.fieldOperationId,
        fieldPlotId: input.fieldPlotId,
        farmLocationId: input.farmLocationId,
        costCenterId: input.costCenterId ?? team.costCenterId ?? undefined,
        minutes: input.minutes,
        notes: input.notes,
      });

      details.push({
        employeeId: member.employeeId,
        employeeName: member.employee.name,
        status: 'created',
      });
      created++;
    }

    return { created, skipped, details };
  });
}
