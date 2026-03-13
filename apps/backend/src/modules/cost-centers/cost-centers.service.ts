import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  CostCenterError,
  type CreateCostCenterInput,
  type UpdateCostCenterInput,
  type CostCenterItem,
} from './cost-centers.types';

function toItem(row: Record<string, unknown>): CostCenterItem {
  const fieldTeams = row.fieldTeams as unknown[] | undefined;
  return {
    id: row.id as string,
    farmId: row.farmId as string,
    code: row.code as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    isActive: row.isActive as boolean,
    teamCount: fieldTeams?.length ?? (row._count as { fieldTeams: number })?.fieldTeams ?? 0,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

export async function createCostCenter(
  ctx: RlsContext,
  farmId: string,
  input: CreateCostCenterInput,
): Promise<CostCenterItem> {
  if (!input.code?.trim()) throw new CostCenterError('Código é obrigatório', 400);
  if (!input.name?.trim()) throw new CostCenterError('Nome é obrigatório', 400);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) throw new CostCenterError('Fazenda não encontrada', 404);

    const existing = await tx.costCenter.findFirst({
      where: { farmId, code: input.code.trim() },
    });
    if (existing)
      throw new CostCenterError('Já existe um centro de custo com este código nesta fazenda', 409);

    const row = await tx.costCenter.create({
      data: {
        farmId,
        code: input.code.trim(),
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
      },
      include: { _count: { select: { fieldTeams: true } } },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function listCostCenters(
  ctx: RlsContext,
  farmId: string,
  options: { activeOnly?: boolean } = {},
): Promise<CostCenterItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId };
    if (options.activeOnly) where.isActive = true;

    const rows = await tx.costCenter.findMany({
      where: where as NonNullable<Parameters<typeof tx.costCenter.findMany>[0]>['where'],
      orderBy: { code: 'asc' },
      include: { _count: { select: { fieldTeams: true } } },
    });

    return rows.map((r) => toItem(r as unknown as Record<string, unknown>));
  });
}

export async function getCostCenter(
  ctx: RlsContext,
  farmId: string,
  costCenterId: string,
): Promise<CostCenterItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.costCenter.findFirst({
      where: { id: costCenterId, farmId },
      include: {
        fieldTeams: {
          where: { deletedAt: null },
          select: { id: true, name: true },
        },
        _count: { select: { fieldTeams: true } },
      },
    });
    if (!row) throw new CostCenterError('Centro de custo não encontrado', 404);
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function updateCostCenter(
  ctx: RlsContext,
  farmId: string,
  costCenterId: string,
  input: UpdateCostCenterInput,
): Promise<CostCenterItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.costCenter.findFirst({
      where: { id: costCenterId, farmId },
      select: { id: true },
    });
    if (!existing) throw new CostCenterError('Centro de custo não encontrado', 404);

    if (input.code) {
      const dup = await tx.costCenter.findFirst({
        where: { farmId, code: input.code.trim(), id: { not: costCenterId } },
      });
      if (dup)
        throw new CostCenterError(
          'Já existe um centro de custo com este código nesta fazenda',
          409,
        );
    }

    const data: Record<string, unknown> = {};
    if (input.code) data.code = input.code.trim();
    if (input.name) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description?.trim() ?? null;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const row = await tx.costCenter.update({
      where: { id: costCenterId },
      data: data as Parameters<typeof tx.costCenter.update>[0]['data'],
      include: { _count: { select: { fieldTeams: true } } },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteCostCenter(
  ctx: RlsContext,
  farmId: string,
  costCenterId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.costCenter.findFirst({
      where: { id: costCenterId, farmId },
      include: { _count: { select: { fieldTeams: true } } },
    });
    if (!row) throw new CostCenterError('Centro de custo não encontrado', 404);

    const count = (row as unknown as Record<string, unknown>)._count as { fieldTeams: number };
    if (count.fieldTeams > 0) {
      throw new CostCenterError(
        'Não é possível excluir: existem equipes vinculadas a este centro de custo',
        409,
      );
    }

    await tx.costCenter.delete({ where: { id: costCenterId } });
  });
}
