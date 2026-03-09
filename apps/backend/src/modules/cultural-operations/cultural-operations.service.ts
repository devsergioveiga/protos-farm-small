import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  CulturalOperationError,
  CULTURAL_OPERATION_TYPES,
  OPERATION_TYPE_LABELS,
  PRUNING_TYPES,
  PRUNING_TYPE_LABELS,
  type CreateCulturalOperationInput,
  type CulturalOperationItem,
} from './cultural-operations.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateInput(input: CreateCulturalOperationInput): void {
  if (!input.fieldPlotId?.trim()) {
    throw new CulturalOperationError('Talhão é obrigatório', 400);
  }
  if (!input.performedAt) {
    throw new CulturalOperationError('Data/hora da operação é obrigatória', 400);
  }
  const date = new Date(input.performedAt);
  if (isNaN(date.getTime())) {
    throw new CulturalOperationError('Data da operação inválida', 400);
  }
  if (
    !input.operationType ||
    !(CULTURAL_OPERATION_TYPES as readonly string[]).includes(input.operationType)
  ) {
    throw new CulturalOperationError(
      `Tipo de operação inválido. Use: ${CULTURAL_OPERATION_TYPES.join(', ')}`,
      400,
    );
  }
  if (input.durationHours != null && input.durationHours <= 0) {
    throw new CulturalOperationError('Duração deve ser maior que zero', 400);
  }
  if (input.laborCount != null && input.laborCount <= 0) {
    throw new CulturalOperationError('Número de trabalhadores deve ser maior que zero', 400);
  }
  if (input.laborHours != null && input.laborHours <= 0) {
    throw new CulturalOperationError('Horas de mão de obra deve ser maior que zero', 400);
  }
  if (input.pruningType && !(PRUNING_TYPES as readonly string[]).includes(input.pruningType)) {
    throw new CulturalOperationError(
      `Tipo de poda inválido. Use: ${PRUNING_TYPES.join(', ')}`,
      400,
    );
  }
  if (
    input.pruningPercentage != null &&
    (input.pruningPercentage < 0 || input.pruningPercentage > 100)
  ) {
    throw new CulturalOperationError('Percentual de poda deve estar entre 0 e 100', 400);
  }
}

function computeTotalCost(row: Record<string, unknown>): number | null {
  const machineHourCost = row.machineHourCost != null ? Number(row.machineHourCost) : 0;
  const laborHourCost = row.laborHourCost != null ? Number(row.laborHourCost) : 0;
  const supplyCost = row.supplyCost != null ? Number(row.supplyCost) : 0;
  const total = machineHourCost + laborHourCost + supplyCost;
  return total > 0 ? total : null;
}

function toItem(row: Record<string, unknown>): CulturalOperationItem {
  const fieldPlot = row.fieldPlot as { name: string } | undefined;
  const recorder = row.recorder as { name: string } | undefined;
  const opType = row.operationType as string;
  const pType = (row.pruningType as string) ?? null;
  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    fieldPlotName: fieldPlot?.name ?? '',
    performedAt: (row.performedAt as Date).toISOString(),
    operationType: opType,
    operationTypeLabel: OPERATION_TYPE_LABELS[opType] ?? opType,
    durationHours: row.durationHours != null ? Number(row.durationHours) : null,
    machineName: (row.machineName as string) ?? null,
    laborCount: (row.laborCount as number) ?? null,
    laborHours: row.laborHours != null ? Number(row.laborHours) : null,
    irrigationDepthMm: row.irrigationDepthMm != null ? Number(row.irrigationDepthMm) : null,
    irrigationTimeMin: row.irrigationTimeMin != null ? Number(row.irrigationTimeMin) : null,
    irrigationSystem: (row.irrigationSystem as string) ?? null,
    pruningType: pType,
    pruningTypeLabel: pType ? (PRUNING_TYPE_LABELS[pType] ?? pType) : null,
    pruningPercentage: row.pruningPercentage != null ? Number(row.pruningPercentage) : null,
    machineHourCost: row.machineHourCost != null ? Number(row.machineHourCost) : null,
    laborHourCost: row.laborHourCost != null ? Number(row.laborHourCost) : null,
    supplyCost: row.supplyCost != null ? Number(row.supplyCost) : null,
    totalCost: computeTotalCost(row),
    notes: (row.notes as string) ?? null,
    photoUrl: (row.photoUrl as string) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    recordedBy: row.recordedBy as string,
    recorderName: recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

const INCLUDE_RELATIONS = {
  fieldPlot: { select: { name: true } },
  recorder: { select: { name: true } },
};

// ─── CRUD ───────────────────────────────────────────────────────────

export async function createCulturalOperation(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateCulturalOperationInput,
): Promise<CulturalOperationItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new CulturalOperationError('Fazenda não encontrada', 404);
    }

    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!plot) {
      throw new CulturalOperationError('Talhão não encontrado nesta fazenda', 404);
    }

    const data: Record<string, unknown> = {
      farmId,
      fieldPlotId: input.fieldPlotId,
      performedAt: new Date(input.performedAt),
      operationType: input.operationType,
      durationHours: input.durationHours ?? null,
      machineName: input.machineName?.trim() ?? null,
      laborCount: input.laborCount ?? null,
      laborHours: input.laborHours ?? null,
      irrigationDepthMm: input.irrigationDepthMm ?? null,
      irrigationTimeMin: input.irrigationTimeMin ?? null,
      irrigationSystem: input.irrigationSystem?.trim() ?? null,
      pruningType: input.pruningType ?? null,
      pruningPercentage: input.pruningPercentage ?? null,
      machineHourCost: input.machineHourCost ?? null,
      laborHourCost: input.laborHourCost ?? null,
      supplyCost: input.supplyCost ?? null,
      notes: input.notes?.trim() ?? null,
      photoUrl: input.photoUrl?.trim() ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      recordedBy: userId,
    };

    if (input.id) {
      data.id = input.id;
    }

    const row = await tx.culturalOperation.create({
      data: data as Parameters<typeof tx.culturalOperation.create>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function listCulturalOperations(
  ctx: RlsContext,
  farmId: string,
  options: {
    page?: number;
    limit?: number;
    fieldPlotId?: string;
    operationType?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<{
  data: CulturalOperationItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.fieldPlotId) {
      where.fieldPlotId = options.fieldPlotId;
    }
    if (
      options.operationType &&
      (CULTURAL_OPERATION_TYPES as readonly string[]).includes(options.operationType)
    ) {
      where.operationType = options.operationType;
    }
    if (options.search) {
      where.OR = [
        { machineName: { contains: options.search, mode: 'insensitive' } },
        { irrigationSystem: { contains: options.search, mode: 'insensitive' } },
        { notes: { contains: options.search, mode: 'insensitive' } },
      ];
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
      tx.culturalOperation.findMany({
        where: whereClause,
        orderBy: { performedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_RELATIONS,
      }),
      tx.culturalOperation.count({ where: whereClause }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export async function getCulturalOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
): Promise<CulturalOperationItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.culturalOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      include: INCLUDE_RELATIONS,
    });
    if (!row) {
      throw new CulturalOperationError('Operação não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function updateCulturalOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
  input: Partial<CreateCulturalOperationInput>,
): Promise<CulturalOperationItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.culturalOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new CulturalOperationError('Operação não encontrada', 404);
    }

    if (input.fieldPlotId) {
      const plot = await tx.fieldPlot.findFirst({
        where: { id: input.fieldPlotId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!plot) {
        throw new CulturalOperationError('Talhão não encontrado nesta fazenda', 404);
      }
    }

    if (
      input.operationType &&
      !(CULTURAL_OPERATION_TYPES as readonly string[]).includes(input.operationType)
    ) {
      throw new CulturalOperationError('Tipo de operação inválido', 400);
    }
    if (input.durationHours != null && input.durationHours <= 0) {
      throw new CulturalOperationError('Duração deve ser maior que zero', 400);
    }
    if (input.pruningType && !(PRUNING_TYPES as readonly string[]).includes(input.pruningType)) {
      throw new CulturalOperationError('Tipo de poda inválido', 400);
    }
    if (
      input.pruningPercentage != null &&
      (input.pruningPercentage < 0 || input.pruningPercentage > 100)
    ) {
      throw new CulturalOperationError('Percentual de poda deve estar entre 0 e 100', 400);
    }

    const data: Record<string, unknown> = {};
    if (input.fieldPlotId) data.fieldPlotId = input.fieldPlotId;
    if (input.performedAt) data.performedAt = new Date(input.performedAt);
    if (input.operationType) data.operationType = input.operationType;
    if (input.durationHours !== undefined) data.durationHours = input.durationHours ?? null;
    if (input.machineName !== undefined) data.machineName = input.machineName?.trim() ?? null;
    if (input.laborCount !== undefined) data.laborCount = input.laborCount ?? null;
    if (input.laborHours !== undefined) data.laborHours = input.laborHours ?? null;
    if (input.irrigationDepthMm !== undefined)
      data.irrigationDepthMm = input.irrigationDepthMm ?? null;
    if (input.irrigationTimeMin !== undefined)
      data.irrigationTimeMin = input.irrigationTimeMin ?? null;
    if (input.irrigationSystem !== undefined)
      data.irrigationSystem = input.irrigationSystem?.trim() ?? null;
    if (input.pruningType !== undefined) data.pruningType = input.pruningType ?? null;
    if (input.pruningPercentage !== undefined)
      data.pruningPercentage = input.pruningPercentage ?? null;
    if (input.machineHourCost !== undefined) data.machineHourCost = input.machineHourCost ?? null;
    if (input.laborHourCost !== undefined) data.laborHourCost = input.laborHourCost ?? null;
    if (input.supplyCost !== undefined) data.supplyCost = input.supplyCost ?? null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl?.trim() ?? null;
    if (input.latitude !== undefined) data.latitude = input.latitude ?? null;
    if (input.longitude !== undefined) data.longitude = input.longitude ?? null;

    const row = await tx.culturalOperation.update({
      where: { id: operationId },
      data: data as Parameters<typeof tx.culturalOperation.update>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteCulturalOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.culturalOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new CulturalOperationError('Operação não encontrada', 404);
    }
    await tx.culturalOperation.update({
      where: { id: operationId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── Types Listing ──────────────────────────────────────────────────

export function getOperationTypes(): Array<{ value: string; label: string }> {
  return CULTURAL_OPERATION_TYPES.map((t) => ({
    value: t,
    label: OPERATION_TYPE_LABELS[t] ?? t,
  }));
}
