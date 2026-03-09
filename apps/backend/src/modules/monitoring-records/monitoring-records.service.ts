import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  MonitoringRecordError,
  INFESTATION_LEVELS,
  INFESTATION_LEVEL_LABELS,
  type CreateMonitoringRecordInput,
  type UpdateMonitoringRecordInput,
  type ListMonitoringRecordsQuery,
  type MonitoringRecordItem,
  type InfestationLevel,
} from './monitoring-records.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toItem(row: Record<string, unknown>): MonitoringRecordItem {
  const point = row.monitoringPoint as Record<string, unknown> | undefined;
  const pest = row.pest as Record<string, unknown> | undefined;
  const level = row.infestationLevel as InfestationLevel;

  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    monitoringPointId: row.monitoringPointId as string,
    monitoringPointCode: (point?.code as string) ?? '',
    pestId: row.pestId as string,
    pestName: (pest?.commonName as string) ?? '',
    pestCategory: (pest?.category as string) ?? '',
    observedAt: (row.observedAt as Date).toISOString(),
    infestationLevel: level,
    infestationLevelLabel: INFESTATION_LEVEL_LABELS[level] ?? level,
    sampleCount: (row.sampleCount as number) ?? null,
    pestCount: (row.pestCount as number) ?? null,
    growthStage: (row.growthStage as string) ?? null,
    hasNaturalEnemies: (row.hasNaturalEnemies as boolean) ?? false,
    naturalEnemiesDesc: (row.naturalEnemiesDesc as string) ?? null,
    damagePercentage: row.damagePercentage != null ? Number(row.damagePercentage) : null,
    photoUrl: (row.photoUrl as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function validateCreateInput(input: CreateMonitoringRecordInput): void {
  if (!input.monitoringPointId?.trim()) {
    throw new MonitoringRecordError('Ponto de monitoramento é obrigatório', 400);
  }
  if (!input.pestId?.trim()) {
    throw new MonitoringRecordError('Praga é obrigatória', 400);
  }
  if (!input.observedAt) {
    throw new MonitoringRecordError('Data da observação é obrigatória', 400);
  }
  const observedDate = new Date(input.observedAt);
  if (isNaN(observedDate.getTime())) {
    throw new MonitoringRecordError('Data da observação inválida', 400);
  }
  if (
    !input.infestationLevel ||
    !INFESTATION_LEVELS.includes(input.infestationLevel as InfestationLevel)
  ) {
    throw new MonitoringRecordError(
      `Nível de infestação inválido. Valores: ${INFESTATION_LEVELS.join(', ')}`,
      400,
    );
  }
  if (
    input.sampleCount != null &&
    (input.sampleCount < 0 || !Number.isInteger(input.sampleCount))
  ) {
    throw new MonitoringRecordError('Quantidade de amostras deve ser um inteiro positivo', 400);
  }
  if (input.pestCount != null && (input.pestCount < 0 || !Number.isInteger(input.pestCount))) {
    throw new MonitoringRecordError('Contagem de pragas deve ser um inteiro positivo', 400);
  }
  if (
    input.damagePercentage != null &&
    (input.damagePercentage < 0 || input.damagePercentage > 100)
  ) {
    throw new MonitoringRecordError('Percentual de dano deve estar entre 0 e 100', 400);
  }
}

function validateUpdateInput(input: UpdateMonitoringRecordInput): void {
  if (
    input.infestationLevel !== undefined &&
    !INFESTATION_LEVELS.includes(input.infestationLevel as InfestationLevel)
  ) {
    throw new MonitoringRecordError(
      `Nível de infestação inválido. Valores: ${INFESTATION_LEVELS.join(', ')}`,
      400,
    );
  }
  if (input.observedAt !== undefined) {
    const observedDate = new Date(input.observedAt);
    if (isNaN(observedDate.getTime())) {
      throw new MonitoringRecordError('Data da observação inválida', 400);
    }
  }
  if (
    input.sampleCount != null &&
    (input.sampleCount < 0 || !Number.isInteger(input.sampleCount))
  ) {
    throw new MonitoringRecordError('Quantidade de amostras deve ser um inteiro positivo', 400);
  }
  if (input.pestCount != null && (input.pestCount < 0 || !Number.isInteger(input.pestCount))) {
    throw new MonitoringRecordError('Contagem de pragas deve ser um inteiro positivo', 400);
  }
  if (
    input.damagePercentage != null &&
    (input.damagePercentage < 0 || input.damagePercentage > 100)
  ) {
    throw new MonitoringRecordError('Percentual de dano deve estar entre 0 e 100', 400);
  }
}

const includeRelations = {
  monitoringPoint: { select: { code: true } },
  pest: { select: { commonName: true, category: true } },
};

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createMonitoringRecord(
  ctx: RlsContext,
  farmId: string,
  fieldPlotId: string,
  input: CreateMonitoringRecordInput,
): Promise<MonitoringRecordItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Verify monitoring point belongs to this field plot + farm
    const point = await tx.monitoringPoint.findFirst({
      where: { id: input.monitoringPointId, farmId, fieldPlotId, deletedAt: null },
    });
    if (!point) {
      throw new MonitoringRecordError('Ponto de monitoramento não encontrado neste talhão', 404);
    }

    // Verify pest exists in the organization
    const pest = await tx.pest.findFirst({
      where: { id: input.pestId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!pest) {
      throw new MonitoringRecordError('Praga não encontrada na biblioteca', 404);
    }

    const row = await tx.monitoringRecord.create({
      data: {
        farmId,
        fieldPlotId,
        monitoringPointId: input.monitoringPointId,
        pestId: input.pestId,
        observedAt: new Date(input.observedAt),
        infestationLevel: input.infestationLevel as InfestationLevel,
        sampleCount: input.sampleCount ?? null,
        pestCount: input.pestCount ?? null,
        growthStage: input.growthStage?.trim() || null,
        hasNaturalEnemies: input.hasNaturalEnemies ?? false,
        naturalEnemiesDesc: input.naturalEnemiesDesc?.trim() || null,
        damagePercentage: input.damagePercentage ?? null,
        photoUrl: input.photoUrl?.trim() || null,
        notes: input.notes?.trim() || null,
      },
      include: includeRelations,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listMonitoringRecords(
  ctx: RlsContext,
  farmId: string,
  fieldPlotId: string,
  query: ListMonitoringRecordsQuery,
): Promise<{
  data: MonitoringRecordItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      farmId,
      fieldPlotId,
      deletedAt: null,
    };

    if (query.monitoringPointId) {
      where.monitoringPointId = query.monitoringPointId;
    }
    if (query.pestId) {
      where.pestId = query.pestId;
    }
    if (query.infestationLevel) {
      where.infestationLevel = query.infestationLevel;
    }
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);
      where.observedAt = dateFilter;
    }

    const [rows, total] = await Promise.all([
      tx.monitoringRecord.findMany({
        where,
        include: includeRelations,
        orderBy: { observedAt: 'desc' },
        skip,
        take: limit,
      }),
      tx.monitoringRecord.count({ where }),
    ]);

    return {
      data: rows.map((r: unknown) => toItem(r as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getMonitoringRecord(
  ctx: RlsContext,
  farmId: string,
  recordId: string,
): Promise<MonitoringRecordItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.monitoringRecord.findFirst({
      where: { id: recordId, farmId, deletedAt: null },
      include: includeRelations,
    });
    if (!row) {
      throw new MonitoringRecordError('Registro de monitoramento não encontrado', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateMonitoringRecord(
  ctx: RlsContext,
  farmId: string,
  recordId: string,
  input: UpdateMonitoringRecordInput,
): Promise<MonitoringRecordItem> {
  validateUpdateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.monitoringRecord.findFirst({
      where: { id: recordId, farmId, deletedAt: null },
    });
    if (!existing) {
      throw new MonitoringRecordError('Registro de monitoramento não encontrado', 404);
    }

    // If changing pest, verify it exists
    if (input.pestId !== undefined) {
      const pest = await tx.pest.findFirst({
        where: { id: input.pestId, organizationId: ctx.organizationId, deletedAt: null },
      });
      if (!pest) {
        throw new MonitoringRecordError('Praga não encontrada na biblioteca', 404);
      }
    }

    const data: Record<string, unknown> = {};
    if (input.pestId !== undefined) data.pestId = input.pestId;
    if (input.observedAt !== undefined) data.observedAt = new Date(input.observedAt);
    if (input.infestationLevel !== undefined) data.infestationLevel = input.infestationLevel;
    if (input.sampleCount !== undefined) data.sampleCount = input.sampleCount;
    if (input.pestCount !== undefined) data.pestCount = input.pestCount;
    if (input.growthStage !== undefined) data.growthStage = input.growthStage?.trim() || null;
    if (input.hasNaturalEnemies !== undefined) data.hasNaturalEnemies = input.hasNaturalEnemies;
    if (input.naturalEnemiesDesc !== undefined)
      data.naturalEnemiesDesc = input.naturalEnemiesDesc?.trim() || null;
    if (input.damagePercentage !== undefined) data.damagePercentage = input.damagePercentage;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    const row = await tx.monitoringRecord.update({
      where: { id: recordId },
      data,
      include: includeRelations,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteMonitoringRecord(
  ctx: RlsContext,
  farmId: string,
  recordId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.monitoringRecord.findFirst({
      where: { id: recordId, farmId, deletedAt: null },
    });
    if (!existing) {
      throw new MonitoringRecordError('Registro de monitoramento não encontrado', 404);
    }

    await tx.monitoringRecord.update({
      where: { id: recordId },
      data: { deletedAt: new Date() },
    });
  });
}
