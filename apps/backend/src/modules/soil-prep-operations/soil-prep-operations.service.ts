import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  SoilPrepError,
  WEATHER_CONDITIONS,
  WEATHER_LABELS,
  DOSE_UNITS,
  type CreateSoilPrepInput,
  type SoilPrepItem,
  type SoilPrepInputItem,
} from './soil-prep-operations.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateInput(input: CreateSoilPrepInput): void {
  if (!input.fieldPlotId?.trim()) {
    throw new SoilPrepError('Talhão é obrigatório', 400);
  }
  if (!input.operationTypeName?.trim()) {
    throw new SoilPrepError('Nome do tipo de operação é obrigatório', 400);
  }
  if (!input.startedAt) {
    throw new SoilPrepError('Data/hora de início é obrigatória', 400);
  }
  const startDate = new Date(input.startedAt);
  if (isNaN(startDate.getTime())) {
    throw new SoilPrepError('Data de início inválida', 400);
  }
  if (input.endedAt) {
    const endDate = new Date(input.endedAt);
    if (isNaN(endDate.getTime())) {
      throw new SoilPrepError('Data de fim inválida', 400);
    }
    if (endDate <= startDate) {
      throw new SoilPrepError('Data de fim deve ser posterior à data de início', 400);
    }
  }
  if (input.depthCm != null && input.depthCm <= 0) {
    throw new SoilPrepError('Profundidade deve ser maior que zero', 400);
  }
  if (
    input.soilMoisturePercent != null &&
    (input.soilMoisturePercent < 0 || input.soilMoisturePercent > 100)
  ) {
    throw new SoilPrepError('Umidade do solo deve estar entre 0 e 100%', 400);
  }
  if (
    input.weatherCondition &&
    !(WEATHER_CONDITIONS as readonly string[]).includes(input.weatherCondition)
  ) {
    throw new SoilPrepError(
      `Condição climática inválida. Use: ${WEATHER_CONDITIONS.join(', ')}`,
      400,
    );
  }
  if (input.durationHours != null && input.durationHours <= 0) {
    throw new SoilPrepError('Duração deve ser maior que zero', 400);
  }
  if (input.laborCount != null && input.laborCount <= 0) {
    throw new SoilPrepError('Número de trabalhadores deve ser maior que zero', 400);
  }

  // Validate inputs array
  if (input.inputs && input.inputs.length > 0) {
    for (const inp of input.inputs) {
      if (!inp.productName?.trim()) {
        throw new SoilPrepError('Nome do produto é obrigatório em cada insumo', 400);
      }
      if (inp.dose == null || inp.dose <= 0) {
        throw new SoilPrepError(
          `Dose do produto "${inp.productName}" deve ser maior que zero`,
          400,
        );
      }
      if (!inp.doseUnit || !(DOSE_UNITS as readonly string[]).includes(inp.doseUnit)) {
        throw new SoilPrepError(
          `Unidade de dose inválida para "${inp.productName}". Use: ${DOSE_UNITS.join(', ')}`,
          400,
        );
      }
    }
  }
}

function computeTotalCost(row: Record<string, unknown>): number | null {
  const durationHours = row.durationHours != null ? Number(row.durationHours) : 0;
  const machineCostPerHour = row.machineCostPerHour != null ? Number(row.machineCostPerHour) : 0;
  const laborCount = row.laborCount != null ? Number(row.laborCount) : 0;
  const laborHourCost = row.laborHourCost != null ? Number(row.laborHourCost) : 0;
  const inputsCost = row.inputsCost != null ? Number(row.inputsCost) : 0;

  const machineCost = durationHours * machineCostPerHour;
  const laborCost = durationHours * laborCount * laborHourCost;
  const total = machineCost + laborCost + inputsCost;

  return total > 0 ? Math.round(total * 100) / 100 : null;
}

function autoCalculateInputTotals(
  inputs: SoilPrepInputItem[],
  areaHa: number,
): SoilPrepInputItem[] {
  return inputs.map((inp) => ({
    ...inp,
    totalQuantity: inp.totalQuantity ?? Math.round(inp.dose * areaHa * 100) / 100,
  }));
}

function toItem(row: Record<string, unknown>): SoilPrepItem {
  const fieldPlot = row.fieldPlot as { name: string; boundaryAreaHa: unknown } | undefined;
  const recorder = row.recorder as { name: string } | undefined;
  const weather = (row.weatherCondition as string) ?? null;
  const rawInputs = (row.inputs as SoilPrepInputItem[]) ?? [];

  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    fieldPlotName: fieldPlot?.name ?? '',
    fieldPlotAreaHa: fieldPlot?.boundaryAreaHa != null ? Number(fieldPlot.boundaryAreaHa) : 0,
    operationTypeId: (row.operationTypeId as string) ?? null,
    operationTypeName: row.operationTypeName as string,
    startedAt: (row.startedAt as Date).toISOString(),
    endedAt: row.endedAt ? (row.endedAt as Date).toISOString() : null,
    machineName: (row.machineName as string) ?? null,
    implementName: (row.implementName as string) ?? null,
    operatorName: (row.operatorName as string) ?? null,
    depthCm: row.depthCm != null ? Number(row.depthCm) : null,
    inputs: rawInputs,
    soilMoisturePercent: row.soilMoisturePercent != null ? Number(row.soilMoisturePercent) : null,
    weatherCondition: weather,
    weatherConditionLabel: weather ? (WEATHER_LABELS[weather] ?? weather) : null,
    durationHours: row.durationHours != null ? Number(row.durationHours) : null,
    machineCostPerHour: row.machineCostPerHour != null ? Number(row.machineCostPerHour) : null,
    laborCount: (row.laborCount as number) ?? null,
    laborHourCost: row.laborHourCost != null ? Number(row.laborHourCost) : null,
    inputsCost: row.inputsCost != null ? Number(row.inputsCost) : null,
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
  recorder: { select: { name: true } },
};

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createSoilPrepOperation(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateSoilPrepInput,
): Promise<SoilPrepItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new SoilPrepError('Fazenda não encontrada', 404);
    }

    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
      select: { id: true, boundaryAreaHa: true },
    });
    if (!plot) {
      throw new SoilPrepError('Talhão não encontrado nesta fazenda', 404);
    }

    // Validate operationTypeId if provided
    if (input.operationTypeId) {
      const opType = await tx.operationType.findFirst({
        where: { id: input.operationTypeId, deletedAt: null },
        select: { id: true },
      });
      if (!opType) {
        throw new SoilPrepError('Tipo de operação não encontrado', 404);
      }
    }

    // Auto-calculate input totals from plot area
    const areaHa = Number(plot.boundaryAreaHa);
    const processedInputs = input.inputs?.length
      ? autoCalculateInputTotals(input.inputs, areaHa)
      : [];

    const data: Record<string, unknown> = {
      farmId,
      fieldPlotId: input.fieldPlotId,
      operationTypeId: input.operationTypeId ?? null,
      operationTypeName: input.operationTypeName.trim(),
      startedAt: new Date(input.startedAt),
      endedAt: input.endedAt ? new Date(input.endedAt) : null,
      machineName: input.machineName?.trim() ?? null,
      implementName: input.implementName?.trim() ?? null,
      operatorName: input.operatorName?.trim() ?? null,
      depthCm: input.depthCm ?? null,
      inputs: processedInputs,
      soilMoisturePercent: input.soilMoisturePercent ?? null,
      weatherCondition: input.weatherCondition ?? null,
      durationHours: input.durationHours ?? null,
      machineCostPerHour: input.machineCostPerHour ?? null,
      laborCount: input.laborCount ?? null,
      laborHourCost: input.laborHourCost ?? null,
      inputsCost: input.inputsCost ?? null,
      notes: input.notes?.trim() ?? null,
      photoUrl: input.photoUrl?.trim() ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      recordedBy: userId,
    };

    if (input.id) {
      data.id = input.id;
    }

    const row = await tx.soilPrepOperation.create({
      data: data as Parameters<typeof tx.soilPrepOperation.create>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listSoilPrepOperations(
  ctx: RlsContext,
  farmId: string,
  options: {
    page?: number;
    limit?: number;
    fieldPlotId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<{
  data: SoilPrepItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.fieldPlotId) {
      where.fieldPlotId = options.fieldPlotId;
    }
    if (options.search) {
      where.OR = [
        { operationTypeName: { contains: options.search, mode: 'insensitive' } },
        { machineName: { contains: options.search, mode: 'insensitive' } },
        { implementName: { contains: options.search, mode: 'insensitive' } },
        { operatorName: { contains: options.search, mode: 'insensitive' } },
        { notes: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    if (options.dateFrom || options.dateTo) {
      const startedAt: Record<string, Date> = {};
      if (options.dateFrom) startedAt.gte = new Date(options.dateFrom);
      if (options.dateTo) startedAt.lte = new Date(options.dateTo);
      where.startedAt = startedAt;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const [rows, total] = await Promise.all([
      tx.soilPrepOperation.findMany({
        where: whereClause,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_RELATIONS,
      }),
      tx.soilPrepOperation.count({ where: whereClause }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getSoilPrepOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
): Promise<SoilPrepItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.soilPrepOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      include: INCLUDE_RELATIONS,
    });
    if (!row) {
      throw new SoilPrepError('Operação de preparo de solo não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateSoilPrepOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
  input: Partial<CreateSoilPrepInput>,
): Promise<SoilPrepItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.soilPrepOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      select: { id: true, fieldPlotId: true },
    });
    if (!existing) {
      throw new SoilPrepError('Operação de preparo de solo não encontrada', 404);
    }

    if (input.fieldPlotId) {
      const plot = await tx.fieldPlot.findFirst({
        where: { id: input.fieldPlotId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!plot) {
        throw new SoilPrepError('Talhão não encontrado nesta fazenda', 404);
      }
    }

    if (input.operationTypeId) {
      const opType = await tx.operationType.findFirst({
        where: { id: input.operationTypeId, deletedAt: null },
        select: { id: true },
      });
      if (!opType) {
        throw new SoilPrepError('Tipo de operação não encontrado', 404);
      }
    }

    if (input.startedAt) {
      const startDate = new Date(input.startedAt);
      if (isNaN(startDate.getTime())) {
        throw new SoilPrepError('Data de início inválida', 400);
      }
    }
    if (input.endedAt) {
      const endDate = new Date(input.endedAt);
      if (isNaN(endDate.getTime())) {
        throw new SoilPrepError('Data de fim inválida', 400);
      }
    }
    if (input.depthCm != null && input.depthCm <= 0) {
      throw new SoilPrepError('Profundidade deve ser maior que zero', 400);
    }
    if (
      input.soilMoisturePercent != null &&
      (input.soilMoisturePercent < 0 || input.soilMoisturePercent > 100)
    ) {
      throw new SoilPrepError('Umidade do solo deve estar entre 0 e 100%', 400);
    }
    if (
      input.weatherCondition &&
      !(WEATHER_CONDITIONS as readonly string[]).includes(input.weatherCondition)
    ) {
      throw new SoilPrepError('Condição climática inválida', 400);
    }
    if (input.durationHours != null && input.durationHours <= 0) {
      throw new SoilPrepError('Duração deve ser maior que zero', 400);
    }

    // Auto-calculate input totals if inputs provided
    let processedInputs: undefined | SoilPrepInputItem[];
    if (input.inputs) {
      const targetPlotId = input.fieldPlotId ?? existing.fieldPlotId;
      const plot = await tx.fieldPlot.findFirst({
        where: { id: targetPlotId, deletedAt: null },
        select: { boundaryAreaHa: true },
      });
      const areaHa = plot ? Number(plot.boundaryAreaHa) : 0;
      processedInputs = autoCalculateInputTotals(input.inputs, areaHa);
    }

    const data: Record<string, unknown> = {};
    if (input.fieldPlotId) data.fieldPlotId = input.fieldPlotId;
    if (input.operationTypeId !== undefined) data.operationTypeId = input.operationTypeId ?? null;
    if (input.operationTypeName !== undefined)
      data.operationTypeName = input.operationTypeName?.trim();
    if (input.startedAt) data.startedAt = new Date(input.startedAt);
    if (input.endedAt !== undefined) data.endedAt = input.endedAt ? new Date(input.endedAt) : null;
    if (input.machineName !== undefined) data.machineName = input.machineName?.trim() ?? null;
    if (input.implementName !== undefined) data.implementName = input.implementName?.trim() ?? null;
    if (input.operatorName !== undefined) data.operatorName = input.operatorName?.trim() ?? null;
    if (input.depthCm !== undefined) data.depthCm = input.depthCm ?? null;
    if (processedInputs !== undefined) data.inputs = processedInputs;
    if (input.soilMoisturePercent !== undefined)
      data.soilMoisturePercent = input.soilMoisturePercent ?? null;
    if (input.weatherCondition !== undefined)
      data.weatherCondition = input.weatherCondition ?? null;
    if (input.durationHours !== undefined) data.durationHours = input.durationHours ?? null;
    if (input.machineCostPerHour !== undefined)
      data.machineCostPerHour = input.machineCostPerHour ?? null;
    if (input.laborCount !== undefined) data.laborCount = input.laborCount ?? null;
    if (input.laborHourCost !== undefined) data.laborHourCost = input.laborHourCost ?? null;
    if (input.inputsCost !== undefined) data.inputsCost = input.inputsCost ?? null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl?.trim() ?? null;
    if (input.latitude !== undefined) data.latitude = input.latitude ?? null;
    if (input.longitude !== undefined) data.longitude = input.longitude ?? null;

    const row = await tx.soilPrepOperation.update({
      where: { id: operationId },
      data: data as Parameters<typeof tx.soilPrepOperation.update>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE (soft) ──────────────────────────────────────────────────

export async function deleteSoilPrepOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.soilPrepOperation.findFirst({
      where: { id: operationId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new SoilPrepError('Operação de preparo de solo não encontrada', 404);
    }
    await tx.soilPrepOperation.update({
      where: { id: operationId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── BULK CREATE (CA8) ──────────────────────────────────────────────

export async function createSoilPrepBulk(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  fieldPlotIds: string[],
  input: Omit<CreateSoilPrepInput, 'fieldPlotId'>,
): Promise<SoilPrepItem[]> {
  if (!fieldPlotIds.length || fieldPlotIds.length > 50) {
    throw new SoilPrepError('Selecione entre 1 e 50 talhões', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new SoilPrepError('Fazenda não encontrada', 404);
    }

    const plots = await tx.fieldPlot.findMany({
      where: { id: { in: fieldPlotIds }, farmId, deletedAt: null },
      select: { id: true, boundaryAreaHa: true },
    });
    if (plots.length !== fieldPlotIds.length) {
      throw new SoilPrepError(
        `${fieldPlotIds.length - plots.length} talhão(ões) não encontrado(s) nesta fazenda`,
        404,
      );
    }

    if (input.operationTypeId) {
      const opType = await tx.operationType.findFirst({
        where: { id: input.operationTypeId, deletedAt: null },
        select: { id: true },
      });
      if (!opType) {
        throw new SoilPrepError('Tipo de operação não encontrado', 404);
      }
    }

    const results: SoilPrepItem[] = [];
    for (const plot of plots) {
      const areaHa = Number(plot.boundaryAreaHa);
      const processedInputs = input.inputs?.length
        ? autoCalculateInputTotals(input.inputs, areaHa)
        : [];

      const data: Record<string, unknown> = {
        farmId,
        fieldPlotId: plot.id,
        operationTypeId: input.operationTypeId ?? null,
        operationTypeName: input.operationTypeName.trim(),
        startedAt: new Date(input.startedAt),
        endedAt: input.endedAt ? new Date(input.endedAt) : null,
        machineName: input.machineName?.trim() ?? null,
        implementName: input.implementName?.trim() ?? null,
        operatorName: input.operatorName?.trim() ?? null,
        depthCm: input.depthCm ?? null,
        inputs: processedInputs,
        soilMoisturePercent: input.soilMoisturePercent ?? null,
        weatherCondition: input.weatherCondition ?? null,
        durationHours: input.durationHours ?? null,
        machineCostPerHour: input.machineCostPerHour ?? null,
        laborCount: input.laborCount ?? null,
        laborHourCost: input.laborHourCost ?? null,
        inputsCost: input.inputsCost ?? null,
        notes: input.notes?.trim() ?? null,
        photoUrl: input.photoUrl?.trim() ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        recordedBy: userId,
      };

      const row = await tx.soilPrepOperation.create({
        data: data as Parameters<typeof tx.soilPrepOperation.create>[0]['data'],
        include: INCLUDE_RELATIONS,
      });
      results.push(toItem(row as unknown as Record<string, unknown>));
    }

    return results;
  });
}
