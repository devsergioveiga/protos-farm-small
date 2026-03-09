import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  FieldTeamError,
  FIELD_TEAM_TYPES,
  TEAM_TYPE_LABELS,
  type CreateFieldTeamInput,
  type FieldTeamItem,
  type FieldTeamMemberItem,
} from './field-teams.types';

const INCLUDE_RELATIONS = {
  leader: { select: { name: true } },
  creator: { select: { name: true } },
  members: {
    where: { leftAt: null },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { joinedAt: 'asc' as const },
  },
};

function toMemberItem(row: Record<string, unknown>): FieldTeamMemberItem {
  const user = row.user as { name: string; email: string } | undefined;
  return {
    id: row.id as string,
    userId: row.userId as string,
    userName: user?.name ?? '',
    userEmail: user?.email ?? '',
    joinedAt: (row.joinedAt as Date).toISOString(),
    leftAt: row.leftAt ? (row.leftAt as Date).toISOString() : null,
  };
}

function toItem(row: Record<string, unknown>): FieldTeamItem {
  const leader = row.leader as { name: string } | undefined;
  const creator = row.creator as { name: string } | undefined;
  const members = (row.members as Record<string, unknown>[]) ?? [];
  const teamType = row.teamType as string;
  return {
    id: row.id as string,
    farmId: row.farmId as string,
    name: row.name as string,
    teamType,
    teamTypeLabel: TEAM_TYPE_LABELS[teamType] ?? teamType,
    isTemporary: row.isTemporary as boolean,
    leaderId: row.leaderId as string,
    leaderName: leader?.name ?? '',
    notes: (row.notes as string) ?? null,
    memberCount: members.length,
    members: members.map((m) => toMemberItem(m)),
    createdBy: row.createdBy as string,
    creatorName: creator?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function validateInput(input: CreateFieldTeamInput): void {
  if (!input.name?.trim()) {
    throw new FieldTeamError('Nome da equipe é obrigatório', 400);
  }
  if (!input.teamType || !(FIELD_TEAM_TYPES as readonly string[]).includes(input.teamType)) {
    throw new FieldTeamError(`Tipo de equipe inválido. Use: ${FIELD_TEAM_TYPES.join(', ')}`, 400);
  }
  if (!input.leaderId?.trim()) {
    throw new FieldTeamError('Responsável é obrigatório', 400);
  }
}

export async function createFieldTeam(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateFieldTeamInput,
): Promise<FieldTeamItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) throw new FieldTeamError('Fazenda não encontrada', 404);

    const leader = await tx.user.findFirst({
      where: { id: input.leaderId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!leader) throw new FieldTeamError('Responsável não encontrado', 404);

    const team = await tx.fieldTeam.create({
      data: {
        farmId,
        name: input.name.trim(),
        teamType: input.teamType as Parameters<typeof tx.fieldTeam.create>[0]['data']['teamType'],
        isTemporary: input.isTemporary ?? false,
        leaderId: input.leaderId,
        notes: input.notes?.trim() ?? null,
        createdBy: userId,
      },
      include: INCLUDE_RELATIONS,
    });

    // Add members if provided
    if (input.memberIds && input.memberIds.length > 0) {
      const uniqueIds = [...new Set(input.memberIds)];
      await tx.fieldTeamMember.createMany({
        data: uniqueIds.map((uid) => ({ teamId: team.id, userId: uid })),
      });
      // Re-fetch with members
      const updated = await tx.fieldTeam.findUnique({
        where: { id: team.id },
        include: INCLUDE_RELATIONS,
      });
      return toItem(updated as unknown as Record<string, unknown>);
    }

    return toItem(team as unknown as Record<string, unknown>);
  });
}

export async function listFieldTeams(
  ctx: RlsContext,
  farmId: string,
  options: { page?: number; limit?: number; teamType?: string; search?: string } = {},
): Promise<{
  data: FieldTeamItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.teamType && (FIELD_TEAM_TYPES as readonly string[]).includes(options.teamType)) {
      where.teamType = options.teamType;
    }
    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { notes: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const [rows, total] = await Promise.all([
      tx.fieldTeam.findMany({
        where: whereClause,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_RELATIONS,
      }),
      tx.fieldTeam.count({ where: whereClause }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export async function getFieldTeam(
  ctx: RlsContext,
  farmId: string,
  teamId: string,
): Promise<FieldTeamItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.fieldTeam.findFirst({
      where: { id: teamId, farmId, deletedAt: null },
      include: INCLUDE_RELATIONS,
    });
    if (!row) throw new FieldTeamError('Equipe não encontrada', 404);
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function updateFieldTeam(
  ctx: RlsContext,
  farmId: string,
  teamId: string,
  input: Partial<CreateFieldTeamInput>,
): Promise<FieldTeamItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.fieldTeam.findFirst({
      where: { id: teamId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new FieldTeamError('Equipe não encontrada', 404);

    if (input.teamType && !(FIELD_TEAM_TYPES as readonly string[]).includes(input.teamType)) {
      throw new FieldTeamError('Tipo de equipe inválido', 400);
    }
    if (input.leaderId) {
      const leader = await tx.user.findFirst({
        where: { id: input.leaderId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!leader) throw new FieldTeamError('Responsável não encontrado', 404);
    }

    const data: Record<string, unknown> = {};
    if (input.name) data.name = input.name.trim();
    if (input.teamType) data.teamType = input.teamType;
    if (input.isTemporary !== undefined) data.isTemporary = input.isTemporary;
    if (input.leaderId) data.leaderId = input.leaderId;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;

    const row = await tx.fieldTeam.update({
      where: { id: teamId },
      data: data as Parameters<typeof tx.fieldTeam.update>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteFieldTeam(
  ctx: RlsContext,
  farmId: string,
  teamId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.fieldTeam.findFirst({
      where: { id: teamId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new FieldTeamError('Equipe não encontrada', 404);
    await tx.fieldTeam.update({
      where: { id: teamId },
      data: { deletedAt: new Date() },
    });
  });
}

export function getTeamTypes(): Array<{ value: string; label: string }> {
  return FIELD_TEAM_TYPES.map((t) => ({ value: t, label: TEAM_TYPE_LABELS[t] ?? t }));
}
