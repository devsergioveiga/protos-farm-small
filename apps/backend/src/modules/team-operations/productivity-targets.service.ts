import { withRlsContext, type RlsContext } from '../../database/rls';
import { TEAM_OPERATION_TYPES, TEAM_OPERATION_TYPE_LABELS } from './team-operations.types';
import {
  ProductivityTargetError,
  type CreateProductivityTargetInput,
  type UpdateProductivityTargetInput,
  type ProductivityTargetItem,
} from './productivity-targets.types';

function toItem(row: Record<string, unknown>): ProductivityTargetItem {
  const opType = row.operationType as string;
  return {
    id: row.id as string,
    farmId: row.farmId as string,
    operationType: opType,
    operationTypeLabel: TEAM_OPERATION_TYPE_LABELS[opType] ?? opType,
    targetValue: Number(row.targetValue),
    targetUnit: row.targetUnit as string,
    period: row.period as string,
    ratePerUnit: row.ratePerUnit != null ? Number(row.ratePerUnit) : null,
    rateUnit: (row.rateUnit as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

export async function listProductivityTargets(
  ctx: RlsContext,
  farmId: string,
): Promise<ProductivityTargetItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const rows = await tx.productivityTarget.findMany({
      where: { farmId },
      orderBy: { operationType: 'asc' },
    });
    return rows.map((r) => toItem(r as unknown as Record<string, unknown>));
  });
}

export async function createProductivityTarget(
  ctx: RlsContext,
  farmId: string,
  input: CreateProductivityTargetInput,
): Promise<ProductivityTargetItem> {
  if (
    !input.operationType ||
    !(TEAM_OPERATION_TYPES as readonly string[]).includes(input.operationType)
  ) {
    throw new ProductivityTargetError(
      `Tipo de operação inválido. Use: ${TEAM_OPERATION_TYPES.join(', ')}`,
      400,
    );
  }
  if (input.targetValue == null || input.targetValue <= 0) {
    throw new ProductivityTargetError('Meta de produtividade deve ser maior que zero', 400);
  }
  if (!input.targetUnit?.trim()) {
    throw new ProductivityTargetError('Unidade da meta é obrigatória', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) throw new ProductivityTargetError('Fazenda não encontrada', 404);

    const existing = await tx.productivityTarget.findUnique({
      where: {
        farmId_operationType_targetUnit: {
          farmId,
          operationType: input.operationType as Parameters<
            typeof tx.productivityTarget.create
          >[0]['data']['operationType'],
          targetUnit: input.targetUnit.trim(),
        },
      },
    });
    if (existing) {
      throw new ProductivityTargetError(
        'Já existe uma meta para esse tipo de operação e unidade',
        409,
      );
    }

    const row = await tx.productivityTarget.create({
      data: {
        farmId,
        operationType: input.operationType as Parameters<
          typeof tx.productivityTarget.create
        >[0]['data']['operationType'],
        targetValue: input.targetValue,
        targetUnit: input.targetUnit.trim(),
        period: input.period ?? 'day',
        ratePerUnit: input.ratePerUnit ?? null,
        rateUnit: input.rateUnit?.trim() ?? null,
      },
    });
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function updateProductivityTarget(
  ctx: RlsContext,
  farmId: string,
  targetId: string,
  input: UpdateProductivityTargetInput,
): Promise<ProductivityTargetItem> {
  if (input.targetValue != null && input.targetValue <= 0) {
    throw new ProductivityTargetError('Meta de produtividade deve ser maior que zero', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.productivityTarget.findFirst({
      where: { id: targetId, farmId },
    });
    if (!existing) throw new ProductivityTargetError('Meta não encontrada', 404);

    const row = await tx.productivityTarget.update({
      where: { id: targetId },
      data: {
        ...(input.targetValue != null && { targetValue: input.targetValue }),
        ...(input.targetUnit != null && { targetUnit: input.targetUnit.trim() }),
        ...(input.period != null && { period: input.period }),
        ...(input.ratePerUnit !== undefined && { ratePerUnit: input.ratePerUnit }),
        ...(input.rateUnit !== undefined && { rateUnit: input.rateUnit?.trim() ?? null }),
      },
    });
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteProductivityTarget(
  ctx: RlsContext,
  farmId: string,
  targetId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.productivityTarget.findFirst({
      where: { id: targetId, farmId },
    });
    if (!existing) throw new ProductivityTargetError('Meta não encontrada', 404);
    await tx.productivityTarget.delete({ where: { id: targetId } });
  });
}
