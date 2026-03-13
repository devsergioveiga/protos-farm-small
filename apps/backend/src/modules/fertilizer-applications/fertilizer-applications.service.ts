import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  FertilizerApplicationError,
  FERTILIZER_APPLICATION_TYPES,
  FERTILIZER_DOSE_UNITS,
  type CreateFertilizerApplicationInput,
  type FertilizerApplicationItem,
  type NutrientSummaryItem,
} from './fertilizer-applications.types';
import {
  createConsumptionOutput,
  cancelConsumptionOutput,
  doseToAbsoluteQuantity,
} from '../stock-deduction/stock-deduction';
import { convertToStockUnit } from '../stock-deduction/unit-conversion-bridge';

// ─── Helpers ────────────────────────────────────────────────────────

function validateInput(input: CreateFertilizerApplicationInput): void {
  if (!input.fieldPlotId?.trim()) {
    throw new FertilizerApplicationError('Talhão é obrigatório', 400);
  }
  if (!input.appliedAt) {
    throw new FertilizerApplicationError('Data/hora da aplicação é obrigatória', 400);
  }
  const date = new Date(input.appliedAt);
  if (isNaN(date.getTime())) {
    throw new FertilizerApplicationError('Data de aplicação inválida', 400);
  }
  if (
    !input.applicationType ||
    !(FERTILIZER_APPLICATION_TYPES as readonly string[]).includes(input.applicationType)
  ) {
    throw new FertilizerApplicationError(
      'Tipo de aplicação inválido. Use: COBERTURA_SOLIDA, COBERTURA_SULCO, COBERTURA_LANCO, FOLIAR ou FERTIRRIGACAO',
      400,
    );
  }
  if (!input.productName?.trim()) {
    throw new FertilizerApplicationError('Produto é obrigatório', 400);
  }
  if (input.dose == null || input.dose <= 0) {
    throw new FertilizerApplicationError('Dose deve ser maior que zero', 400);
  }
  if (input.doseUnit && !(FERTILIZER_DOSE_UNITS as readonly string[]).includes(input.doseUnit)) {
    throw new FertilizerApplicationError('Unidade de dose inválida', 400);
  }
}

function toItem(row: Record<string, unknown>): FertilizerApplicationItem {
  const fieldPlot = row.fieldPlot as { name: string } | undefined;
  const recorder = row.recorder as { name: string } | undefined;
  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    fieldPlotName: fieldPlot?.name ?? '',
    appliedAt: (row.appliedAt as Date).toISOString(),
    applicationType: row.applicationType as string,
    productName: row.productName as string,
    formulation: (row.formulation as string) ?? null,
    dose: Number(row.dose),
    doseUnit: row.doseUnit as string,
    nutrientSource: (row.nutrientSource as string) ?? null,
    phenologicalStage: (row.phenologicalStage as string) ?? null,
    nitrogenN: row.nitrogenN != null ? Number(row.nitrogenN) : null,
    phosphorusP: row.phosphorusP != null ? Number(row.phosphorusP) : null,
    potassiumK: row.potassiumK != null ? Number(row.potassiumK) : null,
    machineName: (row.machineName as string) ?? null,
    operatorName: (row.operatorName as string) ?? null,
    areaAppliedHa: row.areaAppliedHa != null ? Number(row.areaAppliedHa) : null,
    plantsPerHa: (row.plantsPerHa as number) ?? null,
    dosePerPlantG: row.dosePerPlantG != null ? Number(row.dosePerPlantG) : null,
    notes: (row.notes as string) ?? null,
    photoUrl: (row.photoUrl as string) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    recordedBy: row.recordedBy as string,
    recorderName: recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
    productId: (row.productId as string) ?? null,
    stockOutputId: (row.stockOutputId as string) ?? null,
    totalQuantityUsed: row.totalQuantityUsed != null ? Number(row.totalQuantityUsed) : null,
  };
}

// ─── CRUD ───────────────────────────────────────────────────────────

export async function createFertilizerApplication(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateFertilizerApplicationInput,
): Promise<FertilizerApplicationItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new FertilizerApplicationError('Fazenda não encontrada', 404);
    }

    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
      select: { id: true, boundaryAreaHa: true },
    });
    if (!plot) {
      throw new FertilizerApplicationError('Talhão não encontrado nesta fazenda', 404);
    }

    // Calculate total quantity for stock deduction (US-096 CA2)
    const doseUnit = input.doseUnit ?? 'KG_HA';
    const areaHa = input.areaAppliedHa ?? Number(plot.boundaryAreaHa);
    let totalQuantityUsed: number | null = input.totalQuantityUsed ?? null;

    if (totalQuantityUsed == null && input.productId) {
      const baseQuantity = doseToAbsoluteQuantity(
        input.dose,
        doseUnit,
        areaHa,
        input.plantsPerHa ?? undefined,
      );
      // US-096 CA2: Convert to product's configured stock unit
      const conversion = await convertToStockUnit(
        tx,
        ctx.organizationId,
        input.productId,
        baseQuantity,
        doseUnit,
      );
      totalQuantityUsed = Math.round(conversion.stockQuantity * 10000) / 10000;
    }

    const data: Record<string, unknown> = {
      farmId,
      fieldPlotId: input.fieldPlotId,
      appliedAt: new Date(input.appliedAt),
      applicationType: input.applicationType,
      productName: input.productName.trim(),
      formulation: input.formulation?.trim() ?? null,
      dose: input.dose,
      doseUnit,
      nutrientSource: input.nutrientSource?.trim() ?? null,
      phenologicalStage: input.phenologicalStage?.trim() ?? null,
      nitrogenN: input.nitrogenN ?? null,
      phosphorusP: input.phosphorusP ?? null,
      potassiumK: input.potassiumK ?? null,
      machineName: input.machineName?.trim() ?? null,
      operatorName: input.operatorName?.trim() ?? null,
      areaAppliedHa: input.areaAppliedHa ?? null,
      plantsPerHa: input.plantsPerHa ?? null,
      dosePerPlantG: input.dosePerPlantG ?? null,
      notes: input.notes?.trim() ?? null,
      photoUrl: input.photoUrl?.trim() ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      recordedBy: userId,
      productId: input.productId ?? null,
      totalQuantityUsed: totalQuantityUsed ?? null,
    };

    if (input.id) {
      (data as Record<string, unknown>).id = input.id;
    }

    // Stock deduction — if productId is provided, create CONSUMPTION output
    if (input.productId && totalQuantityUsed && totalQuantityUsed > 0) {
      const deduction = await createConsumptionOutput(tx, {
        organizationId: ctx.organizationId,
        items: [{ productId: input.productId, quantity: totalQuantityUsed }],
        fieldOperationRef: `fertilizer-application:${input.id ?? 'new'}`,
        fieldPlotId: input.fieldPlotId,
        outputDate: new Date(input.appliedAt),
        notes: `Baixa automática — Adubação: ${input.productName.trim()}`,
      });
      if (deduction) {
        data.stockOutputId = deduction.stockOutputId;
      }
    }

    const row = await tx.fertilizerApplication.create({
      data: data as Parameters<typeof tx.fertilizerApplication.create>[0]['data'],
      include: {
        fieldPlot: { select: { name: true } },
        recorder: { select: { name: true } },
      },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function listFertilizerApplications(
  ctx: RlsContext,
  farmId: string,
  options: {
    page?: number;
    limit?: number;
    fieldPlotId?: string;
    applicationType?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<{
  data: FertilizerApplicationItem[];
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
      options.applicationType &&
      (FERTILIZER_APPLICATION_TYPES as readonly string[]).includes(options.applicationType)
    ) {
      where.applicationType = options.applicationType;
    }
    if (options.search) {
      where.OR = [
        { productName: { contains: options.search, mode: 'insensitive' } },
        { nutrientSource: { contains: options.search, mode: 'insensitive' } },
        { formulation: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    if (options.dateFrom || options.dateTo) {
      const appliedAt: Record<string, Date> = {};
      if (options.dateFrom) appliedAt.gte = new Date(options.dateFrom);
      if (options.dateTo) appliedAt.lte = new Date(options.dateTo);
      where.appliedAt = appliedAt;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const [rows, total] = await Promise.all([
      tx.fertilizerApplication.findMany({
        where: whereClause,
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          fieldPlot: { select: { name: true } },
          recorder: { select: { name: true } },
        },
      }),
      tx.fertilizerApplication.count({ where: whereClause }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export async function getFertilizerApplication(
  ctx: RlsContext,
  farmId: string,
  applicationId: string,
): Promise<FertilizerApplicationItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.fertilizerApplication.findFirst({
      where: { id: applicationId, farmId, deletedAt: null },
      include: {
        fieldPlot: { select: { name: true } },
        recorder: { select: { name: true } },
      },
    });
    if (!row) {
      throw new FertilizerApplicationError('Aplicação não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function updateFertilizerApplication(
  ctx: RlsContext,
  farmId: string,
  applicationId: string,
  input: Partial<CreateFertilizerApplicationInput>,
): Promise<FertilizerApplicationItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.fertilizerApplication.findFirst({
      where: { id: applicationId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new FertilizerApplicationError('Aplicação não encontrada', 404);
    }

    if (input.fieldPlotId) {
      const plot = await tx.fieldPlot.findFirst({
        where: { id: input.fieldPlotId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!plot) {
        throw new FertilizerApplicationError('Talhão não encontrado nesta fazenda', 404);
      }
    }

    if (
      input.applicationType &&
      !(FERTILIZER_APPLICATION_TYPES as readonly string[]).includes(input.applicationType)
    ) {
      throw new FertilizerApplicationError('Tipo de aplicação inválido', 400);
    }
    if (input.doseUnit && !(FERTILIZER_DOSE_UNITS as readonly string[]).includes(input.doseUnit)) {
      throw new FertilizerApplicationError('Unidade de dose inválida', 400);
    }
    if (input.dose != null && input.dose <= 0) {
      throw new FertilizerApplicationError('Dose deve ser maior que zero', 400);
    }

    const data: Record<string, unknown> = {};
    if (input.fieldPlotId) data.fieldPlotId = input.fieldPlotId;
    if (input.appliedAt) data.appliedAt = new Date(input.appliedAt);
    if (input.applicationType) data.applicationType = input.applicationType;
    if (input.productName) data.productName = input.productName.trim();
    if (input.formulation !== undefined) data.formulation = input.formulation?.trim() ?? null;
    if (input.dose != null) data.dose = input.dose;
    if (input.doseUnit) data.doseUnit = input.doseUnit;
    if (input.nutrientSource !== undefined)
      data.nutrientSource = input.nutrientSource?.trim() ?? null;
    if (input.phenologicalStage !== undefined)
      data.phenologicalStage = input.phenologicalStage?.trim() ?? null;
    if (input.nitrogenN !== undefined) data.nitrogenN = input.nitrogenN ?? null;
    if (input.phosphorusP !== undefined) data.phosphorusP = input.phosphorusP ?? null;
    if (input.potassiumK !== undefined) data.potassiumK = input.potassiumK ?? null;
    if (input.machineName !== undefined) data.machineName = input.machineName?.trim() ?? null;
    if (input.operatorName !== undefined) data.operatorName = input.operatorName?.trim() ?? null;
    if (input.areaAppliedHa !== undefined) data.areaAppliedHa = input.areaAppliedHa ?? null;
    if (input.plantsPerHa !== undefined) data.plantsPerHa = input.plantsPerHa ?? null;
    if (input.dosePerPlantG !== undefined) data.dosePerPlantG = input.dosePerPlantG ?? null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl?.trim() ?? null;
    if (input.latitude !== undefined) data.latitude = input.latitude ?? null;
    if (input.longitude !== undefined) data.longitude = input.longitude ?? null;

    const row = await tx.fertilizerApplication.update({
      where: { id: applicationId },
      data: data as Parameters<typeof tx.fertilizerApplication.update>[0]['data'],
      include: {
        fieldPlot: { select: { name: true } },
        recorder: { select: { name: true } },
      },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteFertilizerApplication(
  ctx: RlsContext,
  farmId: string,
  applicationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.fertilizerApplication.findFirst({
      where: { id: applicationId, farmId, deletedAt: null },
      select: { id: true, stockOutputId: true },
    });
    if (!row) {
      throw new FertilizerApplicationError('Aplicação não encontrada', 404);
    }

    // Cancel linked stock output (reverse balances)
    if (row.stockOutputId) {
      await cancelConsumptionOutput(tx, ctx.organizationId, row.stockOutputId);
    }

    await tx.fertilizerApplication.update({
      where: { id: applicationId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── Nutrient Summary (CA7) ─────────────────────────────────────────

export async function getNutrientSummary(
  ctx: RlsContext,
  farmId: string,
  options: { seasonYear?: string; fieldPlotId?: string } = {},
): Promise<NutrientSummaryItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };

    if (options.fieldPlotId) {
      where.fieldPlotId = options.fieldPlotId;
    }

    // Season year filter (e.g. "2025/2026" → July 2025 to June 2026)
    if (options.seasonYear) {
      const match = options.seasonYear.match(/^(\d{4})\/(\d{4})$/);
      if (match) {
        const startYear = parseInt(match[1]);
        const endYear = parseInt(match[2]);
        where.appliedAt = {
          gte: new Date(`${startYear}-07-01T00:00:00Z`),
          lt: new Date(`${endYear}-07-01T00:00:00Z`),
        };
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;

    // Get all plots for this farm to include names
    const plots = await tx.fieldPlot.findMany({
      where: { farmId, deletedAt: null },
      select: { id: true, name: true },
    });
    const plotMap = new Map(plots.map((p) => [p.id, p.name]));

    // Group by fieldPlotId
    const groups = await tx.fertilizerApplication.groupBy({
      by: ['fieldPlotId'],
      where: whereClause,
      _sum: {
        nitrogenN: true,
        phosphorusP: true,
        potassiumK: true,
      },
      _count: { id: true },
    });

    return groups.map((g) => ({
      fieldPlotId: g.fieldPlotId,
      fieldPlotName: plotMap.get(g.fieldPlotId) ?? '',
      totalN: Number(g._sum.nitrogenN ?? 0),
      totalP: Number(g._sum.phosphorusP ?? 0),
      totalK: Number(g._sum.potassiumK ?? 0),
      applicationCount: g._count.id,
    }));
  });
}

// ─── Report / Export ────────────────────────────────────────────────

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  fieldPlotId?: string;
  applicationType?: string;
  productName?: string;
}

export async function getApplicationsReport(
  ctx: RlsContext,
  farmId: string,
  filters: ReportFilters = {},
): Promise<FertilizerApplicationItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };

    if (filters.dateFrom || filters.dateTo) {
      const appliedAt: Record<string, Date> = {};
      if (filters.dateFrom) appliedAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) appliedAt.lte = new Date(filters.dateTo);
      where.appliedAt = appliedAt;
    }
    if (filters.fieldPlotId) where.fieldPlotId = filters.fieldPlotId;
    if (
      filters.applicationType &&
      (FERTILIZER_APPLICATION_TYPES as readonly string[]).includes(filters.applicationType)
    ) {
      where.applicationType = filters.applicationType;
    }
    if (filters.productName) {
      where.productName = { contains: filters.productName, mode: 'insensitive' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const rows = await tx.fertilizerApplication.findMany({
      where: whereClause,
      orderBy: { appliedAt: 'desc' },
      include: {
        fieldPlot: { select: { name: true } },
        recorder: { select: { name: true } },
      },
    });

    return rows.map((r) => toItem(r as unknown as Record<string, unknown>));
  });
}

export function applicationsToCsv(items: FertilizerApplicationItem[]): string {
  const headers = [
    'Data/Hora',
    'Talhão',
    'Tipo Aplicação',
    'Produto',
    'Formulação',
    'Dose',
    'Unidade',
    'Fonte Nutriente',
    'Estádio Fenológico',
    'N (kg/ha)',
    'P2O5 (kg/ha)',
    'K2O (kg/ha)',
    'Máquina',
    'Operador',
    'Área Aplicada (ha)',
    'Plantas/ha',
    'Dose/Planta (g)',
    'Observações',
    'Foto URL',
    'Latitude',
    'Longitude',
    'Registrado por',
  ];

  const esc = (v: string | null | undefined) => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = items.map((i) =>
    [
      i.appliedAt,
      i.fieldPlotName,
      i.applicationType,
      i.productName,
      i.formulation,
      i.dose,
      i.doseUnit,
      i.nutrientSource,
      i.phenologicalStage,
      i.nitrogenN,
      i.phosphorusP,
      i.potassiumK,
      i.machineName,
      i.operatorName,
      i.areaAppliedHa,
      i.plantsPerHa,
      i.dosePerPlantG,
      i.notes,
      i.photoUrl,
      i.latitude,
      i.longitude,
      i.recorderName,
    ]
      .map((v) => esc(v != null ? String(v) : null))
      .join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}
