import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PlantingError,
  SEASON_TYPES,
  SEASON_TYPE_LABELS,
  DOSE_UNITS,
  FERTILIZER_APPLICATION_MODES,
  type CreatePlantingInput,
  type PlantingItem,
  type SeedTreatmentItem,
  type BaseFertilizationItem,
} from './planting-operations.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateInput(input: CreatePlantingInput): void {
  if (!input.fieldPlotId?.trim()) {
    throw new PlantingError('Talhão é obrigatório', 400);
  }
  if (!input.crop?.trim()) {
    throw new PlantingError('Cultura é obrigatória', 400);
  }
  if (!input.plantingDate) {
    throw new PlantingError('Data de plantio é obrigatória', 400);
  }
  const plantDate = new Date(input.plantingDate);
  if (isNaN(plantDate.getTime())) {
    throw new PlantingError('Data de plantio inválida', 400);
  }
  if (!input.seasonYear?.trim()) {
    throw new PlantingError('Safra é obrigatória', 400);
  }
  if (input.seasonType && !(SEASON_TYPES as readonly string[]).includes(input.seasonType)) {
    throw new PlantingError(`Tipo de safra inválido. Use: ${SEASON_TYPES.join(', ')}`, 400);
  }
  if (input.plantedAreaPercent != null) {
    if (input.plantedAreaPercent <= 0 || input.plantedAreaPercent > 100) {
      throw new PlantingError('Percentual de área plantada deve estar entre 0 e 100', 400);
    }
  }
  if (input.populationPerM != null && input.populationPerM <= 0) {
    throw new PlantingError('População de plantas deve ser maior que zero', 400);
  }
  if (input.rowSpacingCm != null && input.rowSpacingCm <= 0) {
    throw new PlantingError('Espaçamento entre linhas deve ser maior que zero', 400);
  }
  if (input.depthCm != null && input.depthCm <= 0) {
    throw new PlantingError('Profundidade deve ser maior que zero', 400);
  }
  if (input.seedRateKgHa != null && input.seedRateKgHa <= 0) {
    throw new PlantingError('Taxa de semeadura deve ser maior que zero', 400);
  }
  if (input.averageSpeedKmH != null && input.averageSpeedKmH <= 0) {
    throw new PlantingError('Velocidade média deve ser maior que zero', 400);
  }

  // Validate seed treatments (CA3)
  if (input.seedTreatments && input.seedTreatments.length > 0) {
    for (const st of input.seedTreatments) {
      if (!st.productName?.trim()) {
        throw new PlantingError('Nome do produto é obrigatório em cada tratamento de semente', 400);
      }
      if (st.dose == null || st.dose <= 0) {
        throw new PlantingError(`Dose do produto "${st.productName}" deve ser maior que zero`, 400);
      }
      if (!st.doseUnit || !(DOSE_UNITS as readonly string[]).includes(st.doseUnit)) {
        throw new PlantingError(
          `Unidade de dose inválida para "${st.productName}". Use: ${DOSE_UNITS.join(', ')}`,
          400,
        );
      }
    }
  }

  // Validate base fertilizations (CA4)
  if (input.baseFertilizations && input.baseFertilizations.length > 0) {
    for (const bf of input.baseFertilizations) {
      if (!bf.formulation?.trim()) {
        throw new PlantingError('Formulação é obrigatória em cada adubação de base', 400);
      }
      if (bf.doseKgHa == null || bf.doseKgHa <= 0) {
        throw new PlantingError(
          `Dose da formulação "${bf.formulation}" deve ser maior que zero`,
          400,
        );
      }
      if (
        !bf.applicationMode ||
        !(FERTILIZER_APPLICATION_MODES as readonly string[]).includes(bf.applicationMode)
      ) {
        throw new PlantingError(
          `Modo de aplicação inválido para "${bf.formulation}". Use: ${FERTILIZER_APPLICATION_MODES.join(', ')}`,
          400,
        );
      }
    }
  }
}

function computeTotalCost(row: Record<string, unknown>): number | null {
  const seedCost = row.seedCost != null ? Number(row.seedCost) : 0;
  const fertilizerCost = row.fertilizerCost != null ? Number(row.fertilizerCost) : 0;
  const treatmentCost = row.treatmentCost != null ? Number(row.treatmentCost) : 0;
  const operationCost = row.operationCost != null ? Number(row.operationCost) : 0;

  const total = seedCost + fertilizerCost + treatmentCost + operationCost;
  return total > 0 ? Math.round(total * 100) / 100 : null;
}

function autoCalculateFertilizerTotals(
  fertilizations: BaseFertilizationItem[],
  areaHa: number,
): BaseFertilizationItem[] {
  return fertilizations.map((bf) => ({
    ...bf,
    totalQuantity: bf.totalQuantity ?? Math.round(bf.doseKgHa * areaHa * 100) / 100,
  }));
}

function toItem(row: Record<string, unknown>): PlantingItem {
  const fieldPlot = row.fieldPlot as { name: string; boundaryAreaHa: unknown } | undefined;
  const cultivar = row.cultivar as { name: string } | null | undefined;
  const recorder = row.recorder as { name: string } | undefined;
  const seasonType = (row.seasonType as string) ?? 'SAFRA';
  const rawTreatments = (row.seedTreatments as SeedTreatmentItem[]) ?? [];
  const rawFertilizations = (row.baseFertilizations as BaseFertilizationItem[]) ?? [];
  const plotAreaHa = fieldPlot?.boundaryAreaHa != null ? Number(fieldPlot.boundaryAreaHa) : 0;
  const pct = row.plantedAreaPercent != null ? Number(row.plantedAreaPercent) : 100;

  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    fieldPlotName: fieldPlot?.name ?? '',
    fieldPlotAreaHa: plotAreaHa,
    cultivarId: (row.cultivarId as string) ?? null,
    cultivarName: cultivar?.name ?? null,
    operationTypeId: (row.operationTypeId as string) ?? null,
    seasonYear: row.seasonYear as string,
    seasonType,
    seasonTypeLabel: SEASON_TYPE_LABELS[seasonType] ?? seasonType,
    crop: row.crop as string,
    plantingDate: (row.plantingDate as Date).toISOString().split('T')[0],
    plantedAreaPercent: pct,
    plantedAreaHa: Math.round(plotAreaHa * (pct / 100) * 10000) / 10000,
    populationPerM: row.populationPerM != null ? Number(row.populationPerM) : null,
    rowSpacingCm: row.rowSpacingCm != null ? Number(row.rowSpacingCm) : null,
    depthCm: row.depthCm != null ? Number(row.depthCm) : null,
    seedRateKgHa: row.seedRateKgHa != null ? Number(row.seedRateKgHa) : null,
    seedTreatments: rawTreatments,
    baseFertilizations: rawFertilizations,
    machineName: (row.machineName as string) ?? null,
    operatorName: (row.operatorName as string) ?? null,
    averageSpeedKmH: row.averageSpeedKmH != null ? Number(row.averageSpeedKmH) : null,
    seedCost: row.seedCost != null ? Number(row.seedCost) : null,
    fertilizerCost: row.fertilizerCost != null ? Number(row.fertilizerCost) : null,
    treatmentCost: row.treatmentCost != null ? Number(row.treatmentCost) : null,
    operationCost: row.operationCost != null ? Number(row.operationCost) : null,
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
  fieldPlot: { select: { name: true, boundaryAreaHa: true } },
  cultivar: { select: { name: true } },
  recorder: { select: { name: true } },
};

// ─── CREATE (CA1-CA5, CA7-CA9) ──────────────────────────────────────

export async function createPlantingOperation(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreatePlantingInput,
): Promise<PlantingItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new PlantingError('Fazenda não encontrada', 404);
    }

    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
      select: { id: true, boundaryAreaHa: true },
    });
    if (!plot) {
      throw new PlantingError('Talhão não encontrado nesta fazenda', 404);
    }

    // Validate cultivar if provided
    if (input.cultivarId) {
      const cultivar = await tx.cultivar.findFirst({
        where: { id: input.cultivarId, deletedAt: null },
        select: { id: true },
      });
      if (!cultivar) {
        throw new PlantingError('Cultivar não encontrada', 404);
      }
    }

    // Validate operationTypeId if provided
    if (input.operationTypeId) {
      const opType = await tx.operationType.findFirst({
        where: { id: input.operationTypeId, deletedAt: null },
        select: { id: true },
      });
      if (!opType) {
        throw new PlantingError('Tipo de operação não encontrado', 404);
      }
    }

    // Auto-calculate fertilizer totals from plot area
    const areaHa = Number(plot.boundaryAreaHa);
    const processedFertilizations = input.baseFertilizations?.length
      ? autoCalculateFertilizerTotals(input.baseFertilizations, areaHa)
      : [];

    const data: Record<string, unknown> = {
      farmId,
      fieldPlotId: input.fieldPlotId,
      cultivarId: input.cultivarId ?? null,
      operationTypeId: input.operationTypeId ?? null,
      seasonYear: input.seasonYear.trim(),
      seasonType: input.seasonType ?? 'SAFRA',
      crop: input.crop.trim(),
      plantingDate: new Date(input.plantingDate),
      plantedAreaPercent: input.plantedAreaPercent ?? 100,
      populationPerM: input.populationPerM ?? null,
      rowSpacingCm: input.rowSpacingCm ?? null,
      depthCm: input.depthCm ?? null,
      seedRateKgHa: input.seedRateKgHa ?? null,
      seedTreatments: input.seedTreatments ?? [],
      baseFertilizations: processedFertilizations,
      machineName: input.machineName?.trim() ?? null,
      operatorName: input.operatorName?.trim() ?? null,
      averageSpeedKmH: input.averageSpeedKmH ?? null,
      seedCost: input.seedCost ?? null,
      fertilizerCost: input.fertilizerCost ?? null,
      treatmentCost: input.treatmentCost ?? null,
      operationCost: input.operationCost ?? null,
      notes: input.notes?.trim() ?? null,
      photoUrl: input.photoUrl?.trim() ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      recordedBy: userId,
    };

    if (input.id) {
      data.id = input.id;
    }

    const row = await tx.plantingOperation.create({
      data: data as Parameters<typeof tx.plantingOperation.create>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    // CA7 — Update plot status to 'Plantado'
    await tx.fieldPlot.update({
      where: { id: input.fieldPlotId },
      data: {
        status: 'PLANTADO',
        currentCrop: input.crop.trim(),
      },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST (CA13) ────────────────────────────────────────────────────

export async function listPlantingOperations(
  ctx: RlsContext,
  farmId: string,
  options: {
    page?: number;
    limit?: number;
    fieldPlotId?: string;
    search?: string;
    crop?: string;
    seasonYear?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<{
  data: PlantingItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.fieldPlotId) {
      where.fieldPlotId = options.fieldPlotId;
    }
    if (options.crop) {
      where.crop = { contains: options.crop, mode: 'insensitive' };
    }
    if (options.seasonYear) {
      where.seasonYear = options.seasonYear;
    }
    if (options.search) {
      where.OR = [
        { crop: { contains: options.search, mode: 'insensitive' } },
        { machineName: { contains: options.search, mode: 'insensitive' } },
        { operatorName: { contains: options.search, mode: 'insensitive' } },
        { notes: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    if (options.dateFrom || options.dateTo) {
      const plantingDate: Record<string, Date> = {};
      if (options.dateFrom) plantingDate.gte = new Date(options.dateFrom);
      if (options.dateTo) plantingDate.lte = new Date(options.dateTo);
      where.plantingDate = plantingDate;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const [rows, total] = await Promise.all([
      tx.plantingOperation.findMany({
        where: whereClause,
        orderBy: { plantingDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_RELATIONS,
      }),
      tx.plantingOperation.count({ where: whereClause }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getPlantingOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
): Promise<PlantingItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.plantingOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      include: INCLUDE_RELATIONS,
    });
    if (!row) {
      throw new PlantingError('Operação de plantio não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updatePlantingOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
  input: Partial<CreatePlantingInput>,
): Promise<PlantingItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.plantingOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      select: { id: true, fieldPlotId: true },
    });
    if (!existing) {
      throw new PlantingError('Operação de plantio não encontrada', 404);
    }

    if (input.fieldPlotId) {
      const plot = await tx.fieldPlot.findFirst({
        where: { id: input.fieldPlotId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!plot) {
        throw new PlantingError('Talhão não encontrado nesta fazenda', 404);
      }
    }

    if (input.cultivarId) {
      const cultivar = await tx.cultivar.findFirst({
        where: { id: input.cultivarId, deletedAt: null },
        select: { id: true },
      });
      if (!cultivar) {
        throw new PlantingError('Cultivar não encontrada', 404);
      }
    }

    if (input.operationTypeId) {
      const opType = await tx.operationType.findFirst({
        where: { id: input.operationTypeId, deletedAt: null },
        select: { id: true },
      });
      if (!opType) {
        throw new PlantingError('Tipo de operação não encontrado', 404);
      }
    }

    if (input.plantingDate) {
      const d = new Date(input.plantingDate);
      if (isNaN(d.getTime())) {
        throw new PlantingError('Data de plantio inválida', 400);
      }
    }
    if (input.plantedAreaPercent != null) {
      if (input.plantedAreaPercent <= 0 || input.plantedAreaPercent > 100) {
        throw new PlantingError('Percentual de área plantada deve estar entre 0 e 100', 400);
      }
    }
    if (input.populationPerM != null && input.populationPerM <= 0) {
      throw new PlantingError('População de plantas deve ser maior que zero', 400);
    }
    if (input.rowSpacingCm != null && input.rowSpacingCm <= 0) {
      throw new PlantingError('Espaçamento entre linhas deve ser maior que zero', 400);
    }
    if (input.depthCm != null && input.depthCm <= 0) {
      throw new PlantingError('Profundidade deve ser maior que zero', 400);
    }
    if (input.seedRateKgHa != null && input.seedRateKgHa <= 0) {
      throw new PlantingError('Taxa de semeadura deve ser maior que zero', 400);
    }
    if (input.averageSpeedKmH != null && input.averageSpeedKmH <= 0) {
      throw new PlantingError('Velocidade média deve ser maior que zero', 400);
    }

    // Auto-calculate fertilizer totals if baseFertilizations provided
    let processedFertilizations: undefined | BaseFertilizationItem[];
    if (input.baseFertilizations) {
      const targetPlotId = input.fieldPlotId ?? existing.fieldPlotId;
      const plot = await tx.fieldPlot.findFirst({
        where: { id: targetPlotId, deletedAt: null },
        select: { boundaryAreaHa: true },
      });
      const areaHa = plot ? Number(plot.boundaryAreaHa) : 0;
      processedFertilizations = autoCalculateFertilizerTotals(input.baseFertilizations, areaHa);
    }

    const data: Record<string, unknown> = {};
    if (input.fieldPlotId) data.fieldPlotId = input.fieldPlotId;
    if (input.cultivarId !== undefined) data.cultivarId = input.cultivarId ?? null;
    if (input.operationTypeId !== undefined) data.operationTypeId = input.operationTypeId ?? null;
    if (input.seasonYear !== undefined) data.seasonYear = input.seasonYear?.trim();
    if (input.seasonType !== undefined) data.seasonType = input.seasonType;
    if (input.crop !== undefined) data.crop = input.crop?.trim();
    if (input.plantingDate) data.plantingDate = new Date(input.plantingDate);
    if (input.plantedAreaPercent !== undefined) data.plantedAreaPercent = input.plantedAreaPercent;
    if (input.populationPerM !== undefined) data.populationPerM = input.populationPerM ?? null;
    if (input.rowSpacingCm !== undefined) data.rowSpacingCm = input.rowSpacingCm ?? null;
    if (input.depthCm !== undefined) data.depthCm = input.depthCm ?? null;
    if (input.seedRateKgHa !== undefined) data.seedRateKgHa = input.seedRateKgHa ?? null;
    if (input.seedTreatments !== undefined) data.seedTreatments = input.seedTreatments;
    if (processedFertilizations !== undefined) data.baseFertilizations = processedFertilizations;
    if (input.machineName !== undefined) data.machineName = input.machineName?.trim() ?? null;
    if (input.operatorName !== undefined) data.operatorName = input.operatorName?.trim() ?? null;
    if (input.averageSpeedKmH !== undefined) data.averageSpeedKmH = input.averageSpeedKmH ?? null;
    if (input.seedCost !== undefined) data.seedCost = input.seedCost ?? null;
    if (input.fertilizerCost !== undefined) data.fertilizerCost = input.fertilizerCost ?? null;
    if (input.treatmentCost !== undefined) data.treatmentCost = input.treatmentCost ?? null;
    if (input.operationCost !== undefined) data.operationCost = input.operationCost ?? null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl?.trim() ?? null;
    if (input.latitude !== undefined) data.latitude = input.latitude ?? null;
    if (input.longitude !== undefined) data.longitude = input.longitude ?? null;

    const row = await tx.plantingOperation.update({
      where: { id: operationId },
      data: data as Parameters<typeof tx.plantingOperation.update>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    // CA7 — Update plot status if crop changed
    if (input.crop) {
      const targetPlotId = input.fieldPlotId ?? existing.fieldPlotId;
      await tx.fieldPlot.update({
        where: { id: targetPlotId },
        data: {
          status: 'PLANTADO',
          currentCrop: input.crop.trim(),
        },
      });
    }

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE (soft) ──────────────────────────────────────────────────

export async function deletePlantingOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.plantingOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new PlantingError('Operação de plantio não encontrada', 404);
    }
    await tx.plantingOperation.update({
      where: { id: operationId },
      data: { deletedAt: new Date() },
    });
  });
}
