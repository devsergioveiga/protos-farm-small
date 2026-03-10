import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  TeamOperationError,
  TEAM_OPERATION_TYPES,
  TEAM_OPERATION_TYPE_LABELS,
  type CreateTeamOperationInput,
  type TeamOperationItem,
  type TeamOperationEntryItem,
  type PlotLaborCostItem,
  type TimesheetEntry,
} from './team-operations.types';

const INCLUDE_RELATIONS = {
  fieldPlot: { select: { name: true } },
  team: { select: { name: true } },
  recorder: { select: { name: true } },
  entries: {
    include: { user: { select: { name: true, email: true, hourlyRate: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

function toEntryItem(row: Record<string, unknown>, durationHours: number): TeamOperationEntryItem {
  const user = row.user as { name: string; email: string; hourlyRate?: unknown } | undefined;
  const hoursWorked = row.hoursWorked != null ? Number(row.hoursWorked) : null;
  const hourlyRate = user?.hourlyRate != null ? Number(user.hourlyRate) : null;
  const effectiveHours = hoursWorked ?? durationHours;
  const laborCost = hourlyRate != null ? Math.round(effectiveHours * hourlyRate * 100) / 100 : null;

  return {
    id: row.id as string,
    userId: row.userId as string,
    userName: user?.name ?? '',
    userEmail: user?.email ?? '',
    hoursWorked,
    productivity: row.productivity != null ? Number(row.productivity) : null,
    productivityUnit: (row.productivityUnit as string) ?? null,
    notes: (row.notes as string) ?? null,
    hourlyRate,
    laborCost,
  };
}

function toItem(row: Record<string, unknown>): TeamOperationItem {
  const fieldPlot = row.fieldPlot as { name: string } | undefined;
  const team = row.team as { name: string } | undefined;
  const recorder = row.recorder as { name: string } | undefined;
  const entries = (row.entries as Record<string, unknown>[]) ?? [];
  const opType = row.operationType as string;

  const timeStart = row.timeStart as Date;
  const timeEnd = row.timeEnd as Date;
  const durationMs = timeEnd.getTime() - timeStart.getTime();
  const durationHours = Math.round((durationMs / 3_600_000) * 100) / 100;

  const mappedEntries = entries.map((e) => toEntryItem(e, durationHours));
  const costs = mappedEntries.map((e) => e.laborCost).filter((c): c is number => c != null);
  const totalLaborCost =
    costs.length > 0 ? Math.round(costs.reduce((a, b) => a + b, 0) * 100) / 100 : null;

  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    fieldPlotName: fieldPlot?.name ?? '',
    teamId: row.teamId as string,
    teamName: team?.name ?? '',
    operationType: opType,
    operationTypeLabel: TEAM_OPERATION_TYPE_LABELS[opType] ?? opType,
    performedAt: (row.performedAt as Date).toISOString(),
    timeStart: timeStart.toISOString(),
    timeEnd: timeEnd.toISOString(),
    durationHours,
    notes: (row.notes as string) ?? null,
    photoUrl: (row.photoUrl as string) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    entryCount: mappedEntries.length,
    entries: mappedEntries,
    totalLaborCost,
    recordedBy: row.recordedBy as string,
    recorderName: recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function validateInput(input: CreateTeamOperationInput): void {
  if (!input.fieldPlotId?.trim()) {
    throw new TeamOperationError('Talhão é obrigatório', 400);
  }
  if (!input.teamId?.trim()) {
    throw new TeamOperationError('Equipe é obrigatória', 400);
  }
  if (
    !input.operationType ||
    !(TEAM_OPERATION_TYPES as readonly string[]).includes(input.operationType)
  ) {
    throw new TeamOperationError(
      `Tipo de operação inválido. Use: ${TEAM_OPERATION_TYPES.join(', ')}`,
      400,
    );
  }
  if (!input.performedAt) {
    throw new TeamOperationError('Data da operação é obrigatória', 400);
  }
  if (!input.timeStart || !input.timeEnd) {
    throw new TeamOperationError('Hora de início e fim são obrigatórias', 400);
  }
  const start = new Date(input.timeStart);
  const end = new Date(input.timeEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new TeamOperationError('Hora de início ou fim inválida', 400);
  }
  if (end <= start) {
    throw new TeamOperationError('Hora de fim deve ser posterior à hora de início', 400);
  }
  if (!input.memberIds || input.memberIds.length === 0) {
    throw new TeamOperationError('Selecione ao menos um membro da equipe', 400);
  }
}

export async function createTeamOperation(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateTeamOperationInput,
): Promise<TeamOperationItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Validate farm
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) throw new TeamOperationError('Fazenda não encontrada', 404);

    // Validate field plot belongs to farm
    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!plot) throw new TeamOperationError('Talhão não encontrado nesta fazenda', 404);

    // Validate team belongs to farm
    const team = await tx.fieldTeam.findFirst({
      where: { id: input.teamId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!team) throw new TeamOperationError('Equipe não encontrada nesta fazenda', 404);

    const uniqueMemberIds = [...new Set(input.memberIds)];

    // Build entry data with optional individual fields
    const entriesMap = new Map((input.entries ?? []).map((e) => [e.userId, e]));

    const operation = await tx.teamOperation.create({
      data: {
        farmId,
        fieldPlotId: input.fieldPlotId,
        teamId: input.teamId,
        operationType: input.operationType as Parameters<
          typeof tx.teamOperation.create
        >[0]['data']['operationType'],
        performedAt: new Date(input.performedAt),
        timeStart: new Date(input.timeStart),
        timeEnd: new Date(input.timeEnd),
        notes: input.notes?.trim() ?? null,
        photoUrl: input.photoUrl ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        recordedBy: userId,
        entries: {
          create: uniqueMemberIds.map((memberId) => {
            const entry = entriesMap.get(memberId);
            return {
              userId: memberId,
              hoursWorked: entry?.hoursWorked ?? null,
              productivity: entry?.productivity ?? null,
              productivityUnit: entry?.productivityUnit ?? null,
              notes: entry?.notes?.trim() ?? null,
            };
          }),
        },
      },
      include: INCLUDE_RELATIONS,
    });

    return toItem(operation as unknown as Record<string, unknown>);
  });
}

export async function listTeamOperations(
  ctx: RlsContext,
  farmId: string,
  options: {
    page?: number;
    limit?: number;
    teamId?: string;
    fieldPlotId?: string;
    operationType?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<{
  data: TeamOperationItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.teamId) where.teamId = options.teamId;
    if (options.fieldPlotId) where.fieldPlotId = options.fieldPlotId;
    if (
      options.operationType &&
      (TEAM_OPERATION_TYPES as readonly string[]).includes(options.operationType)
    ) {
      where.operationType = options.operationType;
    }
    if (options.dateFrom || options.dateTo) {
      const performedAt: Record<string, Date> = {};
      if (options.dateFrom) performedAt.gte = new Date(options.dateFrom);
      if (options.dateTo) performedAt.lte = new Date(options.dateTo);
      where.performedAt = performedAt;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const [rows, total] = await Promise.all([
      tx.teamOperation.findMany({
        where: whereClause,
        orderBy: { performedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_RELATIONS,
      }),
      tx.teamOperation.count({ where: whereClause }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export async function getTeamOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
): Promise<TeamOperationItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.teamOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      include: INCLUDE_RELATIONS,
    });
    if (!row) throw new TeamOperationError('Operação não encontrada', 404);
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteTeamOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.teamOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new TeamOperationError('Operação não encontrada', 404);
    await tx.teamOperation.update({
      where: { id: operationId },
      data: { deletedAt: new Date() },
    });
  });
}

export function getOperationTypes(): Array<{ value: string; label: string }> {
  return TEAM_OPERATION_TYPES.map((t) => ({ value: t, label: TEAM_OPERATION_TYPE_LABELS[t] ?? t }));
}

// ─── CA9: Cost by plot ─────────────────────────────────────────────

export async function getCostByPlot(
  ctx: RlsContext,
  farmId: string,
  options: { dateFrom?: string; dateTo?: string } = {},
): Promise<PlotLaborCostItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.dateFrom || options.dateTo) {
      const performedAt: Record<string, Date> = {};
      if (options.dateFrom) performedAt.gte = new Date(options.dateFrom);
      if (options.dateTo) performedAt.lte = new Date(options.dateTo);
      where.performedAt = performedAt;
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const operations = await tx.teamOperation.findMany({
      where: where as any,
      include: {
        fieldPlot: { select: { id: true, name: true } },
        entries: {
          include: { user: { select: { hourlyRate: true } } },
        },
      },
      orderBy: { performedAt: 'desc' },
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const plotMap = new Map<
      string,
      { name: string; opCount: number; totalHours: number; totalCost: number; entries: number }
    >();

    for (const op of operations) {
      const plotId = op.fieldPlotId;
      const plotName = (op.fieldPlot as { name: string }).name;
      const durationMs = (op.timeEnd as Date).getTime() - (op.timeStart as Date).getTime();
      const durationHours = durationMs / 3_600_000;

      let acc = plotMap.get(plotId);
      if (!acc) {
        acc = { name: plotName, opCount: 0, totalHours: 0, totalCost: 0, entries: 0 };
        plotMap.set(plotId, acc);
      }
      acc.opCount += 1;

      for (const entry of op.entries as Array<Record<string, unknown>>) {
        const user = entry.user as { hourlyRate?: unknown } | undefined;
        const hw = entry.hoursWorked != null ? Number(entry.hoursWorked) : durationHours;
        const rate = user?.hourlyRate != null ? Number(user.hourlyRate) : null;
        acc.totalHours += hw;
        acc.entries += 1;
        if (rate != null) {
          acc.totalCost += hw * rate;
        }
      }
    }

    return Array.from(plotMap.entries())
      .map(([fieldPlotId, data]) => ({
        fieldPlotId,
        fieldPlotName: data.name,
        operationCount: data.opCount,
        totalHours: Math.round(data.totalHours * 100) / 100,
        totalLaborCost: Math.round(data.totalCost * 100) / 100,
        entries: data.entries,
      }))
      .sort((a, b) => b.totalLaborCost - a.totalLaborCost);
  });
}

// ─── CA8: Timesheet report ─────────────────────────────────────────

export async function getTimesheet(
  ctx: RlsContext,
  farmId: string,
  options: { dateFrom?: string; dateTo?: string; userId?: string } = {},
): Promise<TimesheetEntry[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.dateFrom || options.dateTo) {
      const performedAt: Record<string, Date> = {};
      if (options.dateFrom) performedAt.gte = new Date(options.dateFrom);
      if (options.dateTo) performedAt.lte = new Date(options.dateTo);
      where.performedAt = performedAt;
    }

    const entryWhere: Record<string, unknown> = {};
    if (options.userId) entryWhere.userId = options.userId;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const operations = await tx.teamOperation.findMany({
      where: where as any,
      include: {
        fieldPlot: { select: { name: true } },
        entries: {
          where: Object.keys(entryWhere).length > 0 ? (entryWhere as any) : undefined,
          include: { user: { select: { name: true, email: true, hourlyRate: true } } },
        },
      },
      orderBy: { performedAt: 'asc' },
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Group by date + userId
    const key = (date: string, userId: string) => `${date}|${userId}`;
    const map = new Map<
      string,
      {
        date: string;
        userId: string;
        userName: string;
        userEmail: string;
        hourlyRate: number | null;
        operations: TimesheetEntry['operations'];
      }
    >();

    for (const op of operations) {
      const dateStr = (op.performedAt as Date).toISOString().split('T')[0];
      const plotName = (op.fieldPlot as { name: string }).name;
      const durationMs = (op.timeEnd as Date).getTime() - (op.timeStart as Date).getTime();
      const durationHours = durationMs / 3_600_000;
      const opType = op.operationType as string;

      for (const entry of op.entries as Array<Record<string, unknown>>) {
        const user = entry.user as { name: string; email: string; hourlyRate?: unknown };
        const userId = entry.userId as string;
        const k = key(dateStr, userId);
        const hw = entry.hoursWorked != null ? Number(entry.hoursWorked) : durationHours;

        let acc = map.get(k);
        if (!acc) {
          acc = {
            date: dateStr,
            userId,
            userName: user.name,
            userEmail: user.email,
            hourlyRate: user.hourlyRate != null ? Number(user.hourlyRate) : null,
            operations: [],
          };
          map.set(k, acc);
        }

        acc.operations.push({
          operationId: op.id,
          operationType: opType,
          operationTypeLabel: TEAM_OPERATION_TYPE_LABELS[opType] ?? opType,
          fieldPlotName: plotName,
          timeStart: (op.timeStart as Date).toISOString(),
          timeEnd: (op.timeEnd as Date).toISOString(),
          hoursWorked: Math.round(hw * 100) / 100,
        });
      }
    }

    return Array.from(map.values()).map((entry) => {
      const totalHours = entry.operations.reduce((sum, o) => sum + o.hoursWorked, 0);
      return {
        date: entry.date,
        userId: entry.userId,
        userName: entry.userName,
        userEmail: entry.userEmail,
        hourlyRate: entry.hourlyRate,
        operationCount: entry.operations.length,
        totalHours: Math.round(totalHours * 100) / 100,
        totalLaborCost:
          entry.hourlyRate != null ? Math.round(totalHours * entry.hourlyRate * 100) / 100 : null,
        operations: entry.operations,
      };
    });
  });
}
