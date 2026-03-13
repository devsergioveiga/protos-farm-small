import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  GrainHarvestError,
  STANDARD_MOISTURE,
  SACA_KG,
  ARROBA_KG,
  DESTINATIONS,
  DESTINATION_LABELS,
  WEIGHING_METHODS,
  type CreateGrainHarvestInput,
  type GrainHarvestItem,
  type CommercialUnits,
  type PlotHarvestSummary,
  type PlotCostSummary,
} from './grain-harvests.types';
import { resolveStandardMoisture } from './moisture-standards.service';

// ─── Helpers ────────────────────────────────────────────────────────

function validateInput(input: CreateGrainHarvestInput): void {
  if (!input.fieldPlotId?.trim()) {
    throw new GrainHarvestError('Talhão é obrigatório', 400);
  }
  if (!input.crop?.trim()) {
    throw new GrainHarvestError('Cultura é obrigatória', 400);
  }
  if (!input.harvestDate) {
    throw new GrainHarvestError('Data de colheita é obrigatória', 400);
  }
  const d = new Date(input.harvestDate);
  if (isNaN(d.getTime())) {
    throw new GrainHarvestError('Data de colheita inválida', 400);
  }
  if (input.harvestedAreaHa == null || input.harvestedAreaHa <= 0) {
    throw new GrainHarvestError('Área colhida deve ser maior que zero', 400);
  }
  if (input.grossProductionKg == null || input.grossProductionKg <= 0) {
    throw new GrainHarvestError('Produção bruta deve ser maior que zero', 400);
  }
  if (input.moisturePct == null || input.moisturePct < 0 || input.moisturePct > 100) {
    throw new GrainHarvestError('Umidade deve estar entre 0 e 100%', 400);
  }
  if (input.impurityPct == null || input.impurityPct < 0 || input.impurityPct > 100) {
    throw new GrainHarvestError('Impureza deve estar entre 0 e 100%', 400);
  }
  if (input.destination && !(DESTINATIONS as readonly string[]).includes(input.destination)) {
    throw new GrainHarvestError(`Destino inválido. Use: ${DESTINATIONS.join(', ')}`, 400);
  }
  // CA6 — weighing validation
  if (
    input.weighingMethod &&
    !(WEIGHING_METHODS as readonly string[]).includes(input.weighingMethod)
  ) {
    throw new GrainHarvestError(
      `Método de pesagem inválido. Use: ${WEIGHING_METHODS.join(', ')}`,
      400,
    );
  }
  if (input.grossWeightKg != null && input.grossWeightKg <= 0) {
    throw new GrainHarvestError('Peso bruto deve ser maior que zero', 400);
  }
  if (input.tareWeightKg != null && input.tareWeightKg < 0) {
    throw new GrainHarvestError('Tara deve ser zero ou maior', 400);
  }
  if (
    input.grossWeightKg != null &&
    input.tareWeightKg != null &&
    input.tareWeightKg >= input.grossWeightKg
  ) {
    throw new GrainHarvestError('Tara deve ser menor que o peso bruto', 400);
  }
  // CA9 — cost validation
  if (input.harvesterHours != null && input.harvesterHours < 0) {
    throw new GrainHarvestError('Horas de colheitadeira deve ser zero ou maior', 400);
  }
  if (input.harvesterCostPerHour != null && input.harvesterCostPerHour < 0) {
    throw new GrainHarvestError('Custo/hora de colheitadeira deve ser zero ou maior', 400);
  }
  if (input.transhipmentCost != null && input.transhipmentCost < 0) {
    throw new GrainHarvestError('Custo de transbordo deve ser zero ou maior', 400);
  }
  if (input.transportCost != null && input.transportCost < 0) {
    throw new GrainHarvestError('Custo de transporte deve ser zero ou maior', 400);
  }
}

/** Resolve standard moisture for a crop name (case-insensitive, accent-insensitive) */
function getStandardMoisture(crop: string): number {
  const key = crop
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return STANDARD_MOISTURE[key] ?? 13; // default 13% if crop not mapped
}

/** CA2 — Compute productivity in sc/ha corrected by standard moisture */
function computeProductivity(
  grossKg: number,
  moisturePct: number,
  impurityPct: number,
  standardMoisturePct: number,
  areaHa: number,
): {
  netProductionKg: number;
  correctedProductionKg: number;
  productionSc: number;
  productivityScHa: number;
} {
  // 1. Discount impurity
  const netProductionKg = Math.round(grossKg * (1 - impurityPct / 100) * 100) / 100;
  // 2. Correct moisture to standard
  const correctedProductionKg =
    Math.round(((netProductionKg * (100 - moisturePct)) / (100 - standardMoisturePct)) * 100) / 100;
  // 3. Convert to sacas (60kg)
  const productionSc = Math.round((correctedProductionKg / SACA_KG) * 100) / 100;
  // 4. Productivity per hectare
  const productivityScHa = areaHa > 0 ? Math.round((productionSc / areaHa) * 100) / 100 : 0;

  return { netProductionKg, correctedProductionKg, productionSc, productivityScHa };
}

/** US-098 CA1 — Compute commercial unit conversions from corrected production (kg) */
function computeCommercialUnits(correctedProductionKg: number): CommercialUnits {
  return {
    kg: Math.round(correctedProductionKg * 100) / 100,
    sc: Math.round((correctedProductionKg / SACA_KG) * 100) / 100,
    arroba: Math.round((correctedProductionKg / ARROBA_KG) * 100) / 100,
    t: Math.round((correctedProductionKg / 1000) * 10000) / 10000,
  };
}

/** CA9 — compute total harvest cost from components */
function computeTotalCost(
  harvesterHours: number | null,
  harvesterCostPerHour: number | null,
  transhipmentCost: number | null,
  transportCost: number | null,
): number | null {
  const harvesterCost =
    harvesterHours != null && harvesterCostPerHour != null
      ? Math.round(harvesterHours * harvesterCostPerHour * 100) / 100
      : 0;
  const tranship = transhipmentCost ?? 0;
  const transport = transportCost ?? 0;
  const total = harvesterCost + tranship + transport;
  return total > 0 ? total : null;
}

function toItem(row: Record<string, unknown>, standardMoistureOverride?: number): GrainHarvestItem {
  const fieldPlot = row.fieldPlot as { name: string; boundaryAreaHa: unknown } | undefined;
  const cultivar = row.cultivar as { name: string } | null | undefined;
  const recorder = row.recorder as { name: string } | undefined;

  const crop = row.crop as string;
  const grossProductionKg = Number(row.grossProductionKg);
  const moisturePct = Number(row.moisturePct);
  const impurityPct = Number(row.impurityPct);
  const harvestedAreaHa = Number(row.harvestedAreaHa);
  const standardMoisturePct = standardMoistureOverride ?? getStandardMoisture(crop);

  const productivity = computeProductivity(
    grossProductionKg,
    moisturePct,
    impurityPct,
    standardMoisturePct,
    harvestedAreaHa,
  );

  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    fieldPlotName: fieldPlot?.name ?? '',
    fieldPlotAreaHa: fieldPlot?.boundaryAreaHa != null ? Number(fieldPlot.boundaryAreaHa) : 0,
    cultivarId: (row.cultivarId as string) ?? null,
    cultivarName: cultivar?.name ?? null,
    crop,
    harvestDate: (row.harvestDate as Date).toISOString().split('T')[0],
    loadNumber: (row.loadNumber as number) ?? 0,
    harvestedAreaHa,
    grossProductionKg,
    moisturePct,
    impurityPct,
    standardMoisturePct,
    ...productivity,
    harvesterName: (row.harvesterName as string) ?? null,
    operatorName: (row.operatorName as string) ?? null,
    destination: (row.destination as string) ?? null,
    destinationLabel: row.destination
      ? (DESTINATION_LABELS[row.destination as string] ?? (row.destination as string))
      : null,
    destinationName: (row.destinationName as string) ?? null,
    romaneioNumber: (row.romaneioNumber as string) ?? null,
    grossWeightKg: row.grossWeightKg != null ? Number(row.grossWeightKg) : null,
    tareWeightKg: row.tareWeightKg != null ? Number(row.tareWeightKg) : null,
    netWeightKg: row.netWeightKg != null ? Number(row.netWeightKg) : null,
    weighingMethod: (row.weighingMethod as string) ?? null,
    // CA9 — costs
    harvesterHours: row.harvesterHours != null ? Number(row.harvesterHours) : null,
    harvesterCostPerHour:
      row.harvesterCostPerHour != null ? Number(row.harvesterCostPerHour) : null,
    transhipmentCost: row.transhipmentCost != null ? Number(row.transhipmentCost) : null,
    transportCost: row.transportCost != null ? Number(row.transportCost) : null,
    totalHarvestCost: computeTotalCost(
      row.harvesterHours != null ? Number(row.harvesterHours) : null,
      row.harvesterCostPerHour != null ? Number(row.harvesterCostPerHour) : null,
      row.transhipmentCost != null ? Number(row.transhipmentCost) : null,
      row.transportCost != null ? Number(row.transportCost) : null,
    ),
    // US-098 CA1 — commercial unit conversions
    commercialUnits: computeCommercialUnits(productivity.correctedProductionKg),
    notes: (row.notes as string) ?? null,
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

// ─── CREATE (CA1) ───────────────────────────────────────────────────

export async function createGrainHarvest(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateGrainHarvestInput,
): Promise<GrainHarvestItem> {
  validateInput(input);

  // CA3 — resolve custom moisture standard from org config
  const stdMoisture = await resolveStandardMoisture(ctx, input.crop);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new GrainHarvestError('Fazenda não encontrada', 404);
    }

    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!plot) {
      throw new GrainHarvestError('Talhão não encontrado nesta fazenda', 404);
    }

    if (input.cultivarId) {
      const cultivar = await tx.cultivar.findFirst({
        where: { id: input.cultivarId, deletedAt: null },
        select: { id: true },
      });
      if (!cultivar) {
        throw new GrainHarvestError('Cultivar não encontrada', 404);
      }
    }

    // CA7 — auto-increment load number per fieldPlot
    const lastLoad = await tx.grainHarvest.findFirst({
      where: { fieldPlotId: input.fieldPlotId, farmId, deletedAt: null },
      orderBy: { loadNumber: 'desc' },
      select: { loadNumber: true },
    });
    const nextLoadNumber = (lastLoad?.loadNumber ?? 0) + 1;

    const data: Record<string, unknown> = {
      farmId,
      fieldPlotId: input.fieldPlotId,
      loadNumber: nextLoadNumber,
      cultivarId: input.cultivarId ?? null,
      crop: input.crop.trim(),
      harvestDate: new Date(input.harvestDate),
      harvestedAreaHa: input.harvestedAreaHa,
      grossProductionKg: input.grossProductionKg,
      moisturePct: input.moisturePct,
      impurityPct: input.impurityPct,
      harvesterName: input.harvesterName?.trim() ?? null,
      operatorName: input.operatorName?.trim() ?? null,
      destination: input.destination ?? null,
      destinationName: input.destinationName?.trim() ?? null,
      romaneioNumber: input.romaneioNumber?.trim() ?? null,
      grossWeightKg: input.grossWeightKg ?? null,
      tareWeightKg: input.tareWeightKg ?? null,
      netWeightKg:
        input.netWeightKg ??
        (input.grossWeightKg != null && input.tareWeightKg != null
          ? Math.round((input.grossWeightKg - input.tareWeightKg) * 100) / 100
          : null),
      weighingMethod: input.weighingMethod ?? null,
      // CA9 — costs
      harvesterHours: input.harvesterHours ?? null,
      harvesterCostPerHour: input.harvesterCostPerHour ?? null,
      transhipmentCost: input.transhipmentCost ?? null,
      transportCost: input.transportCost ?? null,
      notes: input.notes?.trim() ?? null,
      recordedBy: userId,
    };

    if (input.id) {
      data.id = input.id;
    }

    const row = await tx.grainHarvest.create({
      data: data as Parameters<typeof tx.grainHarvest.create>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    // CA8 — mark plot as 'COLHIDO' when harvest is complete
    if (input.harvestComplete) {
      await tx.fieldPlot.update({
        where: { id: input.fieldPlotId },
        data: { status: 'COLHIDO' },
      });
    }

    return toItem(row as unknown as Record<string, unknown>, stdMoisture);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

/** CA3 — Load all org moisture standards into a lookup map */
async function loadMoistureLookup(ctx: RlsContext): Promise<Map<string, number>> {
  return withRlsContext(ctx, async (tx) => {
    const customs = await tx.moistureStandard.findMany({
      where: { organizationId: ctx.organizationId },
      select: { crop: true, moisturePct: true },
    });
    const map = new Map<string, number>();
    for (const c of customs) {
      map.set(c.crop, Number(c.moisturePct));
    }
    return map;
  });
}

function resolveMoistureFromLookup(crop: string, lookup: Map<string, number>): number {
  const key = crop
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return lookup.get(key) ?? STANDARD_MOISTURE[key] ?? 13;
}

export async function listGrainHarvests(
  ctx: RlsContext,
  farmId: string,
  options: {
    page?: number;
    limit?: number;
    fieldPlotId?: string;
    crop?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  } = {},
): Promise<{
  data: GrainHarvestItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  // CA3 — load org moisture standards once for the list
  const moistureLookup = await loadMoistureLookup(ctx);

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.fieldPlotId) {
      where.fieldPlotId = options.fieldPlotId;
    }
    if (options.crop) {
      where.crop = { contains: options.crop, mode: 'insensitive' };
    }
    if (options.search) {
      where.OR = [
        { crop: { contains: options.search, mode: 'insensitive' } },
        { notes: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    if (options.dateFrom || options.dateTo) {
      const harvestDate: Record<string, Date> = {};
      if (options.dateFrom) harvestDate.gte = new Date(options.dateFrom);
      if (options.dateTo) harvestDate.lte = new Date(options.dateTo);
      where.harvestDate = harvestDate;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const [rows, total] = await Promise.all([
      tx.grainHarvest.findMany({
        where: whereClause,
        orderBy: { harvestDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_RELATIONS,
      }),
      tx.grainHarvest.count({ where: whereClause }),
    ]);

    return {
      data: rows.map((r) => {
        const row = r as unknown as Record<string, unknown>;
        const stdMoisture = resolveMoistureFromLookup(row.crop as string, moistureLookup);
        return toItem(row, stdMoisture);
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      // CA7 — plot accumulation summary
      ...(options.fieldPlotId
        ? {
            plotSummary: await buildPlotSummary(tx, farmId, options.fieldPlotId),
          }
        : {}),
    };
  });
}

// CA7 — build plot-level accumulation
async function buildPlotSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  farmId: string,
  fieldPlotId: string,
): Promise<PlotHarvestSummary> {
  const plot = await tx.fieldPlot.findFirst({
    where: { id: fieldPlotId, deletedAt: null },
    select: { name: true },
  });
  const agg = await tx.grainHarvest.aggregate({
    where: { farmId, fieldPlotId, deletedAt: null },
    _count: { id: true },
    _sum: { grossProductionKg: true, harvestedAreaHa: true },
  });
  return {
    fieldPlotId,
    fieldPlotName: plot?.name ?? '',
    totalLoads: agg._count.id ?? 0,
    totalGrossProductionKg:
      agg._sum.grossProductionKg != null ? Number(agg._sum.grossProductionKg) : 0,
    totalHarvestedAreaHa: agg._sum.harvestedAreaHa != null ? Number(agg._sum.harvestedAreaHa) : 0,
  };
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getGrainHarvest(
  ctx: RlsContext,
  farmId: string,
  harvestId: string,
): Promise<GrainHarvestItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.grainHarvest.findFirst({
      where: { id: harvestId, farmId, deletedAt: null },
      include: INCLUDE_RELATIONS,
    });
    if (!row) {
      throw new GrainHarvestError('Colheita não encontrada', 404);
    }
    // CA3 — resolve custom moisture
    const stdMoisture = await resolveStandardMoisture(ctx, row.crop);
    return toItem(row as unknown as Record<string, unknown>, stdMoisture);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateGrainHarvest(
  ctx: RlsContext,
  farmId: string,
  harvestId: string,
  input: Partial<CreateGrainHarvestInput>,
): Promise<GrainHarvestItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.grainHarvest.findFirst({
      where: { id: harvestId, farmId, deletedAt: null },
      select: { id: true, crop: true, fieldPlotId: true },
    });
    if (!existing) {
      throw new GrainHarvestError('Colheita não encontrada', 404);
    }

    if (input.fieldPlotId) {
      const plot = await tx.fieldPlot.findFirst({
        where: { id: input.fieldPlotId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!plot) {
        throw new GrainHarvestError('Talhão não encontrado nesta fazenda', 404);
      }
    }

    if (input.cultivarId) {
      const cultivar = await tx.cultivar.findFirst({
        where: { id: input.cultivarId, deletedAt: null },
        select: { id: true },
      });
      if (!cultivar) {
        throw new GrainHarvestError('Cultivar não encontrada', 404);
      }
    }

    if (input.harvestDate) {
      const d = new Date(input.harvestDate);
      if (isNaN(d.getTime())) {
        throw new GrainHarvestError('Data de colheita inválida', 400);
      }
    }
    if (input.harvestedAreaHa != null && input.harvestedAreaHa <= 0) {
      throw new GrainHarvestError('Área colhida deve ser maior que zero', 400);
    }
    if (input.grossProductionKg != null && input.grossProductionKg <= 0) {
      throw new GrainHarvestError('Produção bruta deve ser maior que zero', 400);
    }
    if (input.moisturePct != null && (input.moisturePct < 0 || input.moisturePct > 100)) {
      throw new GrainHarvestError('Umidade deve estar entre 0 e 100%', 400);
    }
    if (input.impurityPct != null && (input.impurityPct < 0 || input.impurityPct > 100)) {
      throw new GrainHarvestError('Impureza deve estar entre 0 e 100%', 400);
    }

    const data: Record<string, unknown> = {};
    if (input.fieldPlotId) data.fieldPlotId = input.fieldPlotId;
    if (input.cultivarId !== undefined) data.cultivarId = input.cultivarId ?? null;
    if (input.crop !== undefined) data.crop = input.crop?.trim();
    if (input.harvestDate) data.harvestDate = new Date(input.harvestDate);
    if (input.harvestedAreaHa !== undefined) data.harvestedAreaHa = input.harvestedAreaHa;
    if (input.grossProductionKg !== undefined) data.grossProductionKg = input.grossProductionKg;
    if (input.moisturePct !== undefined) data.moisturePct = input.moisturePct;
    if (input.impurityPct !== undefined) data.impurityPct = input.impurityPct;
    if (input.harvesterName !== undefined) data.harvesterName = input.harvesterName?.trim() ?? null;
    if (input.operatorName !== undefined) data.operatorName = input.operatorName?.trim() ?? null;
    if (input.destination !== undefined) {
      if (input.destination && !(DESTINATIONS as readonly string[]).includes(input.destination)) {
        throw new GrainHarvestError(`Destino inválido. Use: ${DESTINATIONS.join(', ')}`, 400);
      }
      data.destination = input.destination ?? null;
    }
    if (input.destinationName !== undefined)
      data.destinationName = input.destinationName?.trim() ?? null;
    if (input.romaneioNumber !== undefined)
      data.romaneioNumber = input.romaneioNumber?.trim() ?? null;
    // CA6 — weighing
    if (input.weighingMethod !== undefined) {
      if (
        input.weighingMethod &&
        !(WEIGHING_METHODS as readonly string[]).includes(input.weighingMethod)
      ) {
        throw new GrainHarvestError(
          `Método de pesagem inválido. Use: ${WEIGHING_METHODS.join(', ')}`,
          400,
        );
      }
      data.weighingMethod = input.weighingMethod ?? null;
    }
    if (input.grossWeightKg !== undefined) {
      if (input.grossWeightKg != null && input.grossWeightKg <= 0) {
        throw new GrainHarvestError('Peso bruto deve ser maior que zero', 400);
      }
      data.grossWeightKg = input.grossWeightKg ?? null;
    }
    if (input.tareWeightKg !== undefined) {
      if (input.tareWeightKg != null && input.tareWeightKg < 0) {
        throw new GrainHarvestError('Tara deve ser zero ou maior', 400);
      }
      data.tareWeightKg = input.tareWeightKg ?? null;
    }
    if (input.netWeightKg !== undefined) {
      data.netWeightKg = input.netWeightKg ?? null;
    } else if (input.grossWeightKg != null && input.tareWeightKg != null) {
      data.netWeightKg = Math.round((input.grossWeightKg - input.tareWeightKg) * 100) / 100;
    }
    // CA9 — costs
    if (input.harvesterHours !== undefined) {
      if (input.harvesterHours != null && input.harvesterHours < 0) {
        throw new GrainHarvestError('Horas de colheitadeira deve ser zero ou maior', 400);
      }
      data.harvesterHours = input.harvesterHours ?? null;
    }
    if (input.harvesterCostPerHour !== undefined) {
      if (input.harvesterCostPerHour != null && input.harvesterCostPerHour < 0) {
        throw new GrainHarvestError('Custo/hora de colheitadeira deve ser zero ou maior', 400);
      }
      data.harvesterCostPerHour = input.harvesterCostPerHour ?? null;
    }
    if (input.transhipmentCost !== undefined) {
      if (input.transhipmentCost != null && input.transhipmentCost < 0) {
        throw new GrainHarvestError('Custo de transbordo deve ser zero ou maior', 400);
      }
      data.transhipmentCost = input.transhipmentCost ?? null;
    }
    if (input.transportCost !== undefined) {
      if (input.transportCost != null && input.transportCost < 0) {
        throw new GrainHarvestError('Custo de transporte deve ser zero ou maior', 400);
      }
      data.transportCost = input.transportCost ?? null;
    }
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;

    const row = await tx.grainHarvest.update({
      where: { id: harvestId },
      data: data as Parameters<typeof tx.grainHarvest.update>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    // CA8 — mark plot as 'COLHIDO' when harvest is complete
    if (input.harvestComplete) {
      const targetPlotId = input.fieldPlotId ?? existing.fieldPlotId;
      await tx.fieldPlot.update({
        where: { id: targetPlotId },
        data: { status: 'COLHIDO' },
      });
    }

    // CA3 — resolve custom moisture for the (possibly updated) crop
    const finalCrop = input.crop?.trim() ?? existing.crop;
    const stdMoisture = await resolveStandardMoisture(ctx, finalCrop);
    return toItem(row as unknown as Record<string, unknown>, stdMoisture);
  });
}

// ─── CA9: COST SUMMARY BY PLOT ──────────────────────────────────────

export async function getCostSummary(
  ctx: RlsContext,
  farmId: string,
  options: { dateFrom?: string; dateTo?: string } = {},
): Promise<PlotCostSummary[]> {
  // CA3 — load org moisture standards for productivity calc
  const moistureLookup = await loadMoistureLookup(ctx);

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.dateFrom || options.dateTo) {
      const harvestDate: Record<string, Date> = {};
      if (options.dateFrom) harvestDate.gte = new Date(options.dateFrom);
      if (options.dateTo) harvestDate.lte = new Date(options.dateTo);
      where.harvestDate = harvestDate;
    }

    const harvests = await tx.grainHarvest.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: where as any,
      include: { fieldPlot: { select: { id: true, name: true } } },
      orderBy: { harvestDate: 'desc' },
    });

    const plotMap = new Map<
      string,
      {
        name: string;
        loads: number;
        areaHa: number;
        harvesterCost: number;
        transhipmentCost: number;
        transportCost: number;
        productionSc: number;
      }
    >();

    for (const h of harvests) {
      const row = h as unknown as Record<string, unknown>;
      const plotId = row.fieldPlotId as string;
      const plotName = ((row.fieldPlot as { name: string }) ?? { name: '' }).name;

      let acc = plotMap.get(plotId);
      if (!acc) {
        acc = {
          name: plotName,
          loads: 0,
          areaHa: 0,
          harvesterCost: 0,
          transhipmentCost: 0,
          transportCost: 0,
          productionSc: 0,
        };
        plotMap.set(plotId, acc);
      }
      acc.loads += 1;
      acc.areaHa += Number(row.harvestedAreaHa);

      // harvester cost
      const hHours = row.harvesterHours != null ? Number(row.harvesterHours) : 0;
      const hRate = row.harvesterCostPerHour != null ? Number(row.harvesterCostPerHour) : 0;
      acc.harvesterCost += hHours * hRate;
      acc.transhipmentCost += row.transhipmentCost != null ? Number(row.transhipmentCost) : 0;
      acc.transportCost += row.transportCost != null ? Number(row.transportCost) : 0;

      // productivity for cost/sc
      const crop = row.crop as string;
      const stdMoisture = resolveMoistureFromLookup(crop, moistureLookup);
      const prod = computeProductivity(
        Number(row.grossProductionKg),
        Number(row.moisturePct),
        Number(row.impurityPct),
        stdMoisture,
        Number(row.harvestedAreaHa),
      );
      acc.productionSc += prod.productionSc;
    }

    return Array.from(plotMap.entries())
      .map(([plotId, acc]) => {
        const totalCost =
          Math.round((acc.harvesterCost + acc.transhipmentCost + acc.transportCost) * 100) / 100;
        return {
          fieldPlotId: plotId,
          fieldPlotName: acc.name,
          totalLoads: acc.loads,
          totalHarvestedAreaHa: Math.round(acc.areaHa * 100) / 100,
          totalHarvesterCost: Math.round(acc.harvesterCost * 100) / 100,
          totalTranshipmentCost: Math.round(acc.transhipmentCost * 100) / 100,
          totalTransportCost: Math.round(acc.transportCost * 100) / 100,
          totalCost,
          costPerHa: acc.areaHa > 0 ? Math.round((totalCost / acc.areaHa) * 100) / 100 : 0,
          costPerSc:
            acc.productionSc > 0 ? Math.round((totalCost / acc.productionSc) * 100) / 100 : 0,
          totalProductionSc: Math.round(acc.productionSc * 100) / 100,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);
  });
}

// ─── DELETE (soft) ──────────────────────────────────────────────────

export async function deleteGrainHarvest(
  ctx: RlsContext,
  farmId: string,
  harvestId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.grainHarvest.findFirst({
      where: { id: harvestId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new GrainHarvestError('Colheita não encontrada', 404);
    }
    await tx.grainHarvest.update({
      where: { id: harvestId },
      data: { deletedAt: new Date() },
    });
  });
}
