import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  TeamOperationError,
  TEAM_OPERATION_TYPES,
  TEAM_OPERATION_TYPE_LABELS,
  type CreateTeamOperationInput,
  type TeamOperationItem,
  type TeamOperationEntryItem,
} from './team-operations.types';

const INCLUDE_RELATIONS = {
  fieldPlot: { select: { name: true } },
  team: { select: { name: true } },
  recorder: { select: { name: true } },
  entries: {
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

function toEntryItem(row: Record<string, unknown>): TeamOperationEntryItem {
  const user = row.user as { name: string; email: string } | undefined;
  return {
    id: row.id as string,
    userId: row.userId as string,
    userName: user?.name ?? '',
    userEmail: user?.email ?? '',
    hoursWorked: row.hoursWorked != null ? Number(row.hoursWorked) : null,
    productivity: row.productivity != null ? Number(row.productivity) : null,
    productivityUnit: (row.productivityUnit as string) ?? null,
    notes: (row.notes as string) ?? null,
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
    entryCount: entries.length,
    entries: entries.map((e) => toEntryItem(e)),
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
