import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PesticideApplicationError,
  PESTICIDE_TARGETS,
  DOSE_UNITS,
  type CreatePesticideApplicationInput,
  type PesticideApplicationItem,
} from './pesticide-applications.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateInput(input: CreatePesticideApplicationInput): void {
  if (!input.fieldPlotId?.trim()) {
    throw new PesticideApplicationError('Talhão é obrigatório', 400);
  }
  if (!input.appliedAt) {
    throw new PesticideApplicationError('Data/hora da aplicação é obrigatória', 400);
  }
  const date = new Date(input.appliedAt);
  if (isNaN(date.getTime())) {
    throw new PesticideApplicationError('Data de aplicação inválida', 400);
  }
  if (!input.productName?.trim()) {
    throw new PesticideApplicationError('Produto comercial é obrigatório', 400);
  }
  if (!input.activeIngredient?.trim()) {
    throw new PesticideApplicationError('Ingrediente ativo é obrigatório', 400);
  }
  if (input.dose == null || input.dose <= 0) {
    throw new PesticideApplicationError('Dose deve ser maior que zero', 400);
  }
  if (input.sprayVolume == null || input.sprayVolume <= 0) {
    throw new PesticideApplicationError('Volume de calda deve ser maior que zero', 400);
  }
  if (!(PESTICIDE_TARGETS as readonly string[]).includes(input.target)) {
    throw new PesticideApplicationError('Alvo inválido. Use: PRAGA, DOENCA ou PLANTA_DANINHA', 400);
  }
  if (input.doseUnit && !(DOSE_UNITS as readonly string[]).includes(input.doseUnit)) {
    throw new PesticideApplicationError('Unidade de dose inválida', 400);
  }
}

function toItem(row: Record<string, unknown>): PesticideApplicationItem {
  const fieldPlot = row.fieldPlot as { name: string } | undefined;
  const recorder = row.recorder as { name: string } | undefined;
  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    fieldPlotName: fieldPlot?.name ?? '',
    appliedAt: (row.appliedAt as Date).toISOString(),
    productName: row.productName as string,
    activeIngredient: row.activeIngredient as string,
    dose: Number(row.dose),
    doseUnit: row.doseUnit as string,
    sprayVolume: Number(row.sprayVolume),
    target: row.target as string,
    targetDescription: (row.targetDescription as string) ?? null,
    artNumber: (row.artNumber as string) ?? null,
    agronomistCrea: (row.agronomistCrea as string) ?? null,
    technicalJustification: (row.technicalJustification as string) ?? null,
    temperature: row.temperature != null ? Number(row.temperature) : null,
    relativeHumidity: row.relativeHumidity != null ? Number(row.relativeHumidity) : null,
    windSpeed: row.windSpeed != null ? Number(row.windSpeed) : null,
    sprayerType: (row.sprayerType as string) ?? null,
    nozzleType: (row.nozzleType as string) ?? null,
    workingPressure: row.workingPressure != null ? Number(row.workingPressure) : null,
    applicationSpeed: row.applicationSpeed != null ? Number(row.applicationSpeed) : null,
    notes: (row.notes as string) ?? null,
    recordedBy: row.recordedBy as string,
    recorderName: recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ─── CRUD ───────────────────────────────────────────────────────────

export async function createPesticideApplication(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreatePesticideApplicationInput,
): Promise<PesticideApplicationItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new PesticideApplicationError('Fazenda não encontrada', 404);
    }

    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!plot) {
      throw new PesticideApplicationError('Talhão não encontrado nesta fazenda', 404);
    }

    const data: Record<string, unknown> = {
      farmId,
      fieldPlotId: input.fieldPlotId,
      appliedAt: new Date(input.appliedAt),
      productName: input.productName.trim(),
      activeIngredient: input.activeIngredient.trim(),
      dose: input.dose,
      doseUnit: input.doseUnit ?? 'L_HA',
      sprayVolume: input.sprayVolume,
      target: input.target,
      targetDescription: input.targetDescription?.trim() ?? null,
      artNumber: input.artNumber?.trim() ?? null,
      agronomistCrea: input.agronomistCrea?.trim() ?? null,
      technicalJustification: input.technicalJustification?.trim() ?? null,
      temperature: input.temperature ?? null,
      relativeHumidity: input.relativeHumidity ?? null,
      windSpeed: input.windSpeed ?? null,
      sprayerType: input.sprayerType?.trim() ?? null,
      nozzleType: input.nozzleType?.trim() ?? null,
      workingPressure: input.workingPressure ?? null,
      applicationSpeed: input.applicationSpeed ?? null,
      notes: input.notes?.trim() ?? null,
      recordedBy: userId,
    };

    if (input.id) {
      (data as Record<string, unknown>).id = input.id;
    }

    const row = await tx.pesticideApplication.create({
      data: data as Parameters<typeof tx.pesticideApplication.create>[0]['data'],
      include: {
        fieldPlot: { select: { name: true } },
        recorder: { select: { name: true } },
      },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function listPesticideApplications(
  ctx: RlsContext,
  farmId: string,
  options: {
    page?: number;
    limit?: number;
    fieldPlotId?: string;
    target?: string;
    search?: string;
  } = {},
): Promise<{
  data: PesticideApplicationItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.fieldPlotId) {
      where.fieldPlotId = options.fieldPlotId;
    }
    if (options.target && (PESTICIDE_TARGETS as readonly string[]).includes(options.target)) {
      where.target = options.target;
    }
    if (options.search) {
      where.OR = [
        { productName: { contains: options.search, mode: 'insensitive' } },
        { activeIngredient: { contains: options.search, mode: 'insensitive' } },
        { targetDescription: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const [rows, total] = await Promise.all([
      tx.pesticideApplication.findMany({
        where: whereClause,
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          fieldPlot: { select: { name: true } },
          recorder: { select: { name: true } },
        },
      }),
      tx.pesticideApplication.count({ where: whereClause }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export async function getPesticideApplication(
  ctx: RlsContext,
  farmId: string,
  applicationId: string,
): Promise<PesticideApplicationItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.pesticideApplication.findFirst({
      where: { id: applicationId, farmId, deletedAt: null },
      include: {
        fieldPlot: { select: { name: true } },
        recorder: { select: { name: true } },
      },
    });
    if (!row) {
      throw new PesticideApplicationError('Aplicação não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function updatePesticideApplication(
  ctx: RlsContext,
  farmId: string,
  applicationId: string,
  input: Partial<CreatePesticideApplicationInput>,
): Promise<PesticideApplicationItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.pesticideApplication.findFirst({
      where: { id: applicationId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new PesticideApplicationError('Aplicação não encontrada', 404);
    }

    if (input.fieldPlotId) {
      const plot = await tx.fieldPlot.findFirst({
        where: { id: input.fieldPlotId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!plot) {
        throw new PesticideApplicationError('Talhão não encontrado nesta fazenda', 404);
      }
    }

    if (input.target && !(PESTICIDE_TARGETS as readonly string[]).includes(input.target)) {
      throw new PesticideApplicationError('Alvo inválido', 400);
    }
    if (input.doseUnit && !(DOSE_UNITS as readonly string[]).includes(input.doseUnit)) {
      throw new PesticideApplicationError('Unidade de dose inválida', 400);
    }
    if (input.dose != null && input.dose <= 0) {
      throw new PesticideApplicationError('Dose deve ser maior que zero', 400);
    }
    if (input.sprayVolume != null && input.sprayVolume <= 0) {
      throw new PesticideApplicationError('Volume de calda deve ser maior que zero', 400);
    }

    const data: Record<string, unknown> = {};
    if (input.fieldPlotId) data.fieldPlotId = input.fieldPlotId;
    if (input.appliedAt) data.appliedAt = new Date(input.appliedAt);
    if (input.productName) data.productName = input.productName.trim();
    if (input.activeIngredient) data.activeIngredient = input.activeIngredient.trim();
    if (input.dose != null) data.dose = input.dose;
    if (input.doseUnit) data.doseUnit = input.doseUnit;
    if (input.sprayVolume != null) data.sprayVolume = input.sprayVolume;
    if (input.target) data.target = input.target;
    if (input.targetDescription !== undefined)
      data.targetDescription = input.targetDescription?.trim() ?? null;
    if (input.artNumber !== undefined) data.artNumber = input.artNumber?.trim() ?? null;
    if (input.agronomistCrea !== undefined)
      data.agronomistCrea = input.agronomistCrea?.trim() ?? null;
    if (input.technicalJustification !== undefined)
      data.technicalJustification = input.technicalJustification?.trim() ?? null;
    if (input.temperature !== undefined) data.temperature = input.temperature ?? null;
    if (input.relativeHumidity !== undefined)
      data.relativeHumidity = input.relativeHumidity ?? null;
    if (input.windSpeed !== undefined) data.windSpeed = input.windSpeed ?? null;
    if (input.sprayerType !== undefined) data.sprayerType = input.sprayerType?.trim() ?? null;
    if (input.nozzleType !== undefined) data.nozzleType = input.nozzleType?.trim() ?? null;
    if (input.workingPressure !== undefined) data.workingPressure = input.workingPressure ?? null;
    if (input.applicationSpeed !== undefined)
      data.applicationSpeed = input.applicationSpeed ?? null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;

    const row = await tx.pesticideApplication.update({
      where: { id: applicationId },
      data: data as Parameters<typeof tx.pesticideApplication.update>[0]['data'],
      include: {
        fieldPlot: { select: { name: true } },
        recorder: { select: { name: true } },
      },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deletePesticideApplication(
  ctx: RlsContext,
  farmId: string,
  applicationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.pesticideApplication.findFirst({
      where: { id: applicationId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new PesticideApplicationError('Aplicação não encontrada', 404);
    }
    await tx.pesticideApplication.update({
      where: { id: applicationId },
      data: { deletedAt: new Date() },
    });
  });
}
