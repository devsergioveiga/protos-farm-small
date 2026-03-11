import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  OrangeHarvestError,
  DESTINATIONS,
  DESTINATION_LABELS,
  BOX_WEIGHT_KG,
  type CreateOrangeHarvestInput,
  type OrangeHarvestItem,
  type PlotDailySummary,
} from './orange-harvests.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateInput(input: CreateOrangeHarvestInput): void {
  if (!input.fieldPlotId?.trim()) {
    throw new OrangeHarvestError('Talhão é obrigatório', 400);
  }
  if (!input.harvestDate) {
    throw new OrangeHarvestError('Data de colheita é obrigatória', 400);
  }
  const d = new Date(input.harvestDate);
  if (isNaN(d.getTime())) {
    throw new OrangeHarvestError('Data de colheita inválida', 400);
  }
  // CA1 — numberOfBoxes
  if (input.numberOfBoxes == null || input.numberOfBoxes <= 0) {
    throw new OrangeHarvestError('Número de caixas deve ser maior que zero', 400);
  }
  // totalWeightKg
  if (input.totalWeightKg != null && input.totalWeightKg <= 0) {
    throw new OrangeHarvestError('Peso total deve ser maior que zero', 400);
  }
  // treesHarvested
  if (input.treesHarvested != null && input.treesHarvested <= 0) {
    throw new OrangeHarvestError('Número de árvores deve ser maior que zero', 400);
  }
  // CA3 — quality percentages
  if (input.ratioSS != null && input.ratioSS < 0) {
    throw new OrangeHarvestError('Ratio (sólidos solúveis) deve ser zero ou maior', 400);
  }
  if (input.acidityPct != null && (input.acidityPct < 0 || input.acidityPct > 100)) {
    throw new OrangeHarvestError('Acidez deve estar entre 0 e 100', 400);
  }
  if (input.refusalPct != null && (input.refusalPct < 0 || input.refusalPct > 100)) {
    throw new OrangeHarvestError('Percentual de refugo deve estar entre 0 e 100', 400);
  }
  // CA4 — destination
  if (input.destination && !(DESTINATIONS as readonly string[]).includes(input.destination)) {
    throw new OrangeHarvestError(`Destino inválido. Use: ${DESTINATIONS.join(', ')}`, 400);
  }
  // CA5 — team
  if (input.numberOfHarvesters != null && input.numberOfHarvesters <= 0) {
    throw new OrangeHarvestError('Número de colhedores deve ser maior que zero', 400);
  }
  if (input.harvestersProductivity != null && input.harvestersProductivity < 0) {
    throw new OrangeHarvestError('Produtividade dos colhedores deve ser zero ou maior', 400);
  }
}

/** CA2 — Compute boxes per tree */
function computeBoxesPerTree(numberOfBoxes: number, treesHarvested: number | null): number | null {
  if (treesHarvested == null || treesHarvested <= 0) return null;
  return Math.round((numberOfBoxes / treesHarvested) * 100) / 100;
}

/** CA2 — Compute boxes per hectare */
function computeBoxesPerHa(numberOfBoxes: number, areaHa: number | null): number | null {
  if (areaHa == null || areaHa <= 0) return null;
  return Math.round((numberOfBoxes / areaHa) * 100) / 100;
}

/** CA2 — Compute tons per hectare */
function computeTonsPerHa(totalWeightKg: number, areaHa: number | null): number | null {
  if (areaHa == null || areaHa <= 0) return null;
  return Math.round((totalWeightKg / 1000 / areaHa) * 100) / 100;
}

/** CA5 — Compute productivity (caixas/pessoa/dia) */
function computeProductivity(
  numberOfBoxes: number,
  numberOfHarvesters: number | null,
): number | null {
  if (numberOfHarvesters == null || numberOfHarvesters <= 0) return null;
  return Math.round((numberOfBoxes / numberOfHarvesters) * 100) / 100;
}

function toItem(row: Record<string, unknown>): OrangeHarvestItem {
  const fieldPlot = row.fieldPlot as { name: string; boundaryAreaHa: unknown } | undefined;
  const cultivar = row.cultivar as { name: string } | null | undefined;
  const recorder = row.recorder as { name: string } | undefined;

  const numberOfBoxes = Number(row.numberOfBoxes);
  const areaHa = fieldPlot?.boundaryAreaHa != null ? Number(fieldPlot.boundaryAreaHa) : 0;
  const totalWeightKg =
    row.totalWeightKg != null ? Number(row.totalWeightKg) : numberOfBoxes * BOX_WEIGHT_KG;
  const treesHarvested = row.treesHarvested != null ? Number(row.treesHarvested) : null;

  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    fieldPlotName: fieldPlot?.name ?? '',
    fieldPlotAreaHa: areaHa,
    cultivarId: (row.cultivarId as string) ?? null,
    cultivarName: cultivar?.name ?? null,
    harvestDate: (row.harvestDate as Date).toISOString().split('T')[0],
    variety: (row.variety as string) ?? null,
    // CA1
    numberOfBoxes,
    totalWeightKg: Math.round(totalWeightKg * 100) / 100,
    treesHarvested,
    // CA2 — computed
    boxesPerTree: computeBoxesPerTree(numberOfBoxes, treesHarvested),
    boxesPerHa: computeBoxesPerHa(numberOfBoxes, areaHa),
    tonsPerHa: computeTonsPerHa(totalWeightKg, areaHa),
    // CA3
    ratioSS: row.ratioSS != null ? Number(row.ratioSS) : null,
    acidityPct: row.acidityPct != null ? Number(row.acidityPct) : null,
    refusalPct: row.refusalPct != null ? Number(row.refusalPct) : null,
    // CA4
    destination: (row.destination as string) ?? null,
    destinationLabel: row.destination
      ? (DESTINATION_LABELS[row.destination as string] ?? (row.destination as string))
      : null,
    destinationName: (row.destinationName as string) ?? null,
    // CA5
    numberOfHarvesters: row.numberOfHarvesters != null ? Number(row.numberOfHarvesters) : null,
    harvestersProductivity:
      row.harvestersProductivity != null
        ? Number(row.harvestersProductivity)
        : computeProductivity(numberOfBoxes, row.numberOfHarvesters as number | null),
    // CA6
    saleContractRef: (row.saleContractRef as string) ?? null,
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

// ─── CREATE (CA1-CA6) ───────────────────────────────────────────────

export async function createOrangeHarvest(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateOrangeHarvestInput,
): Promise<OrangeHarvestItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new OrangeHarvestError('Fazenda não encontrada', 404);
    }

    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
      select: { id: true, boundaryAreaHa: true },
    });
    if (!plot) {
      throw new OrangeHarvestError('Talhão não encontrado nesta fazenda', 404);
    }

    if (input.cultivarId) {
      const cultivar = await tx.cultivar.findFirst({
        where: { id: input.cultivarId, deletedAt: null },
        select: { id: true },
      });
      if (!cultivar) {
        throw new OrangeHarvestError('Cultivar não encontrada', 404);
      }
    }

    // Compute weight if not provided
    const totalWeightKg = input.totalWeightKg ?? input.numberOfBoxes * BOX_WEIGHT_KG;

    // CA2 — compute productivity metrics
    const areaHa = plot.boundaryAreaHa != null ? Number(plot.boundaryAreaHa) : null;
    const boxesPerTree = computeBoxesPerTree(input.numberOfBoxes, input.treesHarvested ?? null);
    const boxesPerHa = computeBoxesPerHa(input.numberOfBoxes, areaHa);
    const tonsPerHa = computeTonsPerHa(totalWeightKg, areaHa);

    // CA5 — compute productivity if team provided
    const productivity = computeProductivity(input.numberOfBoxes, input.numberOfHarvesters ?? null);

    const data: Record<string, unknown> = {
      farmId,
      fieldPlotId: input.fieldPlotId,
      cultivarId: input.cultivarId ?? null,
      harvestDate: new Date(input.harvestDate),
      variety: input.variety?.trim() ?? null,
      // CA1
      numberOfBoxes: input.numberOfBoxes,
      totalWeightKg,
      treesHarvested: input.treesHarvested ?? null,
      // CA2
      boxesPerTree,
      boxesPerHa,
      tonsPerHa,
      // CA3
      ratioSS: input.ratioSS ?? null,
      acidityPct: input.acidityPct ?? null,
      refusalPct: input.refusalPct ?? null,
      // CA4
      destination: input.destination ?? null,
      destinationName: input.destinationName?.trim() ?? null,
      // CA5
      numberOfHarvesters: input.numberOfHarvesters ?? null,
      harvestersProductivity: input.harvestersProductivity ?? productivity,
      // CA6
      saleContractRef: input.saleContractRef?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      recordedBy: userId,
    };

    if (input.id) {
      data.id = input.id;
    }

    const row = await tx.orangeHarvest.create({
      data: data as Parameters<typeof tx.orangeHarvest.create>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listOrangeHarvests(
  ctx: RlsContext,
  farmId: string,
  options: {
    page?: number;
    limit?: number;
    fieldPlotId?: string;
    destination?: string;
    dateFrom?: string;
    dateTo?: string;
    saleContractRef?: string;
    search?: string;
  } = {},
): Promise<{
  data: OrangeHarvestItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.fieldPlotId) {
      where.fieldPlotId = options.fieldPlotId;
    }
    if (options.destination) {
      where.destination = options.destination;
    }
    if (options.saleContractRef) {
      where.saleContractRef = { contains: options.saleContractRef, mode: 'insensitive' };
    }
    if (options.search) {
      where.OR = [
        { notes: { contains: options.search, mode: 'insensitive' } },
        { variety: { contains: options.search, mode: 'insensitive' } },
        { destinationName: { contains: options.search, mode: 'insensitive' } },
        { saleContractRef: { contains: options.search, mode: 'insensitive' } },
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
      tx.orangeHarvest.findMany({
        where: whereClause,
        orderBy: { harvestDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_RELATIONS,
      }),
      tx.orangeHarvest.count({ where: whereClause }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getOrangeHarvest(
  ctx: RlsContext,
  farmId: string,
  harvestId: string,
): Promise<OrangeHarvestItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.orangeHarvest.findFirst({
      where: { id: harvestId, farmId, deletedAt: null },
      include: INCLUDE_RELATIONS,
    });
    if (!row) {
      throw new OrangeHarvestError('Colheita não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateOrangeHarvest(
  ctx: RlsContext,
  farmId: string,
  harvestId: string,
  input: Partial<CreateOrangeHarvestInput>,
): Promise<OrangeHarvestItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.orangeHarvest.findFirst({
      where: { id: harvestId, farmId, deletedAt: null },
      include: { fieldPlot: { select: { boundaryAreaHa: true } } },
    });
    if (!existing) {
      throw new OrangeHarvestError('Colheita não encontrada', 404);
    }

    // Validate fields being updated
    if (input.fieldPlotId) {
      const plot = await tx.fieldPlot.findFirst({
        where: { id: input.fieldPlotId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!plot) {
        throw new OrangeHarvestError('Talhão não encontrado nesta fazenda', 404);
      }
    }
    if (input.cultivarId) {
      const cultivar = await tx.cultivar.findFirst({
        where: { id: input.cultivarId, deletedAt: null },
        select: { id: true },
      });
      if (!cultivar) {
        throw new OrangeHarvestError('Cultivar não encontrada', 404);
      }
    }
    if (input.harvestDate) {
      const d = new Date(input.harvestDate);
      if (isNaN(d.getTime())) {
        throw new OrangeHarvestError('Data de colheita inválida', 400);
      }
    }
    if (input.numberOfBoxes != null && input.numberOfBoxes <= 0) {
      throw new OrangeHarvestError('Número de caixas deve ser maior que zero', 400);
    }
    if (input.totalWeightKg != null && input.totalWeightKg <= 0) {
      throw new OrangeHarvestError('Peso total deve ser maior que zero', 400);
    }
    if (input.treesHarvested != null && input.treesHarvested <= 0) {
      throw new OrangeHarvestError('Número de árvores deve ser maior que zero', 400);
    }
    if (input.ratioSS != null && input.ratioSS < 0) {
      throw new OrangeHarvestError('Ratio (sólidos solúveis) deve ser zero ou maior', 400);
    }
    if (input.acidityPct != null && (input.acidityPct < 0 || input.acidityPct > 100)) {
      throw new OrangeHarvestError('Acidez deve estar entre 0 e 100', 400);
    }
    if (input.refusalPct != null && (input.refusalPct < 0 || input.refusalPct > 100)) {
      throw new OrangeHarvestError('Percentual de refugo deve estar entre 0 e 100', 400);
    }
    if (input.destination && !(DESTINATIONS as readonly string[]).includes(input.destination)) {
      throw new OrangeHarvestError(`Destino inválido. Use: ${DESTINATIONS.join(', ')}`, 400);
    }
    if (input.numberOfHarvesters != null && input.numberOfHarvesters <= 0) {
      throw new OrangeHarvestError('Número de colhedores deve ser maior que zero', 400);
    }

    const data: Record<string, unknown> = {};
    if (input.fieldPlotId) data.fieldPlotId = input.fieldPlotId;
    if (input.cultivarId !== undefined) data.cultivarId = input.cultivarId ?? null;
    if (input.harvestDate) data.harvestDate = new Date(input.harvestDate);
    if (input.variety !== undefined) data.variety = input.variety?.trim() ?? null;
    if (input.numberOfBoxes !== undefined) data.numberOfBoxes = input.numberOfBoxes;
    if (input.totalWeightKg !== undefined) data.totalWeightKg = input.totalWeightKg ?? null;
    if (input.treesHarvested !== undefined) data.treesHarvested = input.treesHarvested ?? null;
    if (input.ratioSS !== undefined) data.ratioSS = input.ratioSS ?? null;
    if (input.acidityPct !== undefined) data.acidityPct = input.acidityPct ?? null;
    if (input.refusalPct !== undefined) data.refusalPct = input.refusalPct ?? null;
    if (input.destination !== undefined) data.destination = input.destination ?? null;
    if (input.destinationName !== undefined)
      data.destinationName = input.destinationName?.trim() ?? null;
    if (input.numberOfHarvesters !== undefined)
      data.numberOfHarvesters = input.numberOfHarvesters ?? null;
    if (input.harvestersProductivity !== undefined)
      data.harvestersProductivity = input.harvestersProductivity ?? null;
    if (input.saleContractRef !== undefined)
      data.saleContractRef = input.saleContractRef?.trim() ?? null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;

    // Recompute CA2 metrics if relevant fields changed
    const finalBoxes =
      input.numberOfBoxes !== undefined ? input.numberOfBoxes : Number(existing.numberOfBoxes);
    const finalTrees =
      input.treesHarvested !== undefined
        ? input.treesHarvested
        : (existing.treesHarvested as number | null);
    const finalWeightKg =
      input.totalWeightKg !== undefined
        ? (input.totalWeightKg ?? finalBoxes * BOX_WEIGHT_KG)
        : Number(existing.totalWeightKg ?? Number(existing.numberOfBoxes) * BOX_WEIGHT_KG);
    const areaHa =
      existing.fieldPlot?.boundaryAreaHa != null ? Number(existing.fieldPlot.boundaryAreaHa) : null;

    if (
      input.numberOfBoxes !== undefined ||
      input.treesHarvested !== undefined ||
      input.totalWeightKg !== undefined
    ) {
      data.boxesPerTree = computeBoxesPerTree(finalBoxes, finalTrees);
      data.boxesPerHa = computeBoxesPerHa(finalBoxes, areaHa);
      data.tonsPerHa = computeTonsPerHa(finalWeightKg, areaHa);
      if (input.totalWeightKg === undefined && input.numberOfBoxes !== undefined) {
        data.totalWeightKg = finalBoxes * BOX_WEIGHT_KG;
      }
    }

    const row = await tx.orangeHarvest.update({
      where: { id: harvestId },
      data: data as Parameters<typeof tx.orangeHarvest.update>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DAILY SUMMARY (CA5 — totalizador diário por talhão) ────────────

export async function getDailySummary(
  ctx: RlsContext,
  farmId: string,
  options: { fieldPlotId?: string; dateFrom?: string; dateTo?: string } = {},
): Promise<PlotDailySummary[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.fieldPlotId) where.fieldPlotId = options.fieldPlotId;
    if (options.dateFrom || options.dateTo) {
      const harvestDate: Record<string, Date> = {};
      if (options.dateFrom) harvestDate.gte = new Date(options.dateFrom);
      if (options.dateTo) harvestDate.lte = new Date(options.dateTo);
      where.harvestDate = harvestDate;
    }

    const harvests = await tx.orangeHarvest.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: where as any,
      include: { fieldPlot: { select: { name: true } } },
      orderBy: { harvestDate: 'desc' },
    });

    // Group by fieldPlotId + date
    const groupMap = new Map<
      string,
      {
        fieldPlotId: string;
        fieldPlotName: string;
        date: string;
        totalBoxes: number;
        totalWeightKg: number;
        totalHarvesters: number;
        productivitySum: number;
        productivityCount: number;
        entries: number;
      }
    >();

    for (const h of harvests) {
      const row = h as unknown as Record<string, unknown>;
      const plotId = row.fieldPlotId as string;
      const plotName = ((row.fieldPlot as { name: string }) ?? { name: '' }).name;
      const date = (row.harvestDate as Date).toISOString().split('T')[0];
      const key = `${plotId}|${date}`;

      let acc = groupMap.get(key);
      if (!acc) {
        acc = {
          fieldPlotId: plotId,
          fieldPlotName: plotName,
          date,
          totalBoxes: 0,
          totalWeightKg: 0,
          totalHarvesters: 0,
          productivitySum: 0,
          productivityCount: 0,
          entries: 0,
        };
        groupMap.set(key, acc);
      }

      const boxes = Number(row.numberOfBoxes);
      const weight = row.totalWeightKg != null ? Number(row.totalWeightKg) : boxes * BOX_WEIGHT_KG;

      acc.totalBoxes += boxes;
      acc.totalWeightKg += weight;
      acc.entries += 1;

      if (row.numberOfHarvesters != null) {
        acc.totalHarvesters += Number(row.numberOfHarvesters);
      }
      if (row.harvestersProductivity != null) {
        acc.productivitySum += Number(row.harvestersProductivity);
        acc.productivityCount += 1;
      }
    }

    return Array.from(groupMap.values()).map((acc) => ({
      fieldPlotId: acc.fieldPlotId,
      fieldPlotName: acc.fieldPlotName,
      date: acc.date,
      totalBoxes: Math.round(acc.totalBoxes * 100) / 100,
      totalWeightKg: Math.round(acc.totalWeightKg * 100) / 100,
      totalHarvesters: acc.totalHarvesters,
      avgProductivity:
        acc.productivityCount > 0
          ? Math.round((acc.productivitySum / acc.productivityCount) * 100) / 100
          : 0,
      entries: acc.entries,
    }));
  });
}

// ─── DELETE (soft) ──────────────────────────────────────────────────

export async function deleteOrangeHarvest(
  ctx: RlsContext,
  farmId: string,
  harvestId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.orangeHarvest.findFirst({
      where: { id: harvestId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new OrangeHarvestError('Colheita não encontrada', 404);
    }
    await tx.orangeHarvest.update({
      where: { id: harvestId },
      data: { deletedAt: new Date() },
    });
  });
}
