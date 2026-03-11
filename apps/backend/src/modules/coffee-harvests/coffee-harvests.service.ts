import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  CoffeeHarvestError,
  HARVEST_TYPES,
  HARVEST_TYPE_LABELS,
  DESTINATIONS,
  DESTINATION_LABELS,
  DEFAULT_YIELD_LITERS_PER_SAC,
  type CreateCoffeeHarvestInput,
  type CoffeeHarvestItem,
  type PlotDailySummary,
} from './coffee-harvests.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateInput(input: CreateCoffeeHarvestInput): void {
  if (!input.fieldPlotId?.trim()) {
    throw new CoffeeHarvestError('Talhão é obrigatório', 400);
  }
  if (!input.harvestDate) {
    throw new CoffeeHarvestError('Data de colheita é obrigatória', 400);
  }
  const d = new Date(input.harvestDate);
  if (isNaN(d.getTime())) {
    throw new CoffeeHarvestError('Data de colheita inválida', 400);
  }
  // CA1 — harvest type
  if (!input.harvestType?.trim()) {
    throw new CoffeeHarvestError('Tipo de colheita é obrigatório', 400);
  }
  if (!(HARVEST_TYPES as readonly string[]).includes(input.harvestType)) {
    throw new CoffeeHarvestError(
      `Tipo de colheita inválido. Use: ${HARVEST_TYPES.join(', ')}`,
      400,
    );
  }
  // CA2 — volume
  if (input.volumeLiters == null || input.volumeLiters <= 0) {
    throw new CoffeeHarvestError('Volume em litros deve ser maior que zero', 400);
  }
  if (input.sacsBenefited != null && input.sacsBenefited < 0) {
    throw new CoffeeHarvestError('Sacas beneficiadas deve ser zero ou maior', 400);
  }
  // CA3 — yield
  if (input.yieldLitersPerSac != null && input.yieldLitersPerSac <= 0) {
    throw new CoffeeHarvestError('Rendimento (litros/saca) deve ser maior que zero', 400);
  }
  // CA4 — classification percentages
  const cherryPct = input.cherryPct ?? 0;
  const greenPct = input.greenPct ?? 0;
  const floaterPct = input.floaterPct ?? 0;
  const dryPct = input.dryPct ?? 0;
  for (const [label, val] of [
    ['Cereja', cherryPct],
    ['Verde', greenPct],
    ['Boia', floaterPct],
    ['Seco', dryPct],
  ] as const) {
    if (val < 0 || val > 100) {
      throw new CoffeeHarvestError(`Percentual de ${label} deve estar entre 0 e 100`, 400);
    }
  }
  const totalPct = cherryPct + greenPct + floaterPct + dryPct;
  if (totalPct > 0 && Math.abs(totalPct - 100) > 0.5) {
    throw new CoffeeHarvestError('A soma dos percentuais de classificação deve ser 100%', 400);
  }
  // CA5 — destination
  if (input.destination && !(DESTINATIONS as readonly string[]).includes(input.destination)) {
    throw new CoffeeHarvestError(`Destino inválido. Use: ${DESTINATIONS.join(', ')}`, 400);
  }
  // CA6 — team
  if (input.numberOfHarvesters != null && input.numberOfHarvesters <= 0) {
    throw new CoffeeHarvestError('Número de colhedores deve ser maior que zero', 400);
  }
  if (input.harvestersProductivity != null && input.harvestersProductivity < 0) {
    throw new CoffeeHarvestError('Produtividade dos colhedores deve ser zero ou maior', 400);
  }
}

/** CA2/CA3 — Compute estimated sacs from volume and yield */
function computeEstimatedSacs(volumeLiters: number, yieldLitersPerSac: number): number {
  return Math.round((volumeLiters / yieldLitersPerSac) * 100) / 100;
}

/** CA6 — Compute productivity (litros/pessoa/dia) */
function computeProductivity(
  volumeLiters: number,
  numberOfHarvesters: number | null,
): number | null {
  if (numberOfHarvesters == null || numberOfHarvesters <= 0) return null;
  return Math.round((volumeLiters / numberOfHarvesters) * 100) / 100;
}

function toItem(row: Record<string, unknown>): CoffeeHarvestItem {
  const fieldPlot = row.fieldPlot as { name: string; boundaryAreaHa: unknown } | undefined;
  const cultivar = row.cultivar as { name: string } | null | undefined;
  const recorder = row.recorder as { name: string } | undefined;

  const volumeLiters = Number(row.volumeLiters);
  const yieldLitersPerSac =
    row.yieldLitersPerSac != null ? Number(row.yieldLitersPerSac) : DEFAULT_YIELD_LITERS_PER_SAC;
  const harvestType = row.harvestType as string;

  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    fieldPlotName: fieldPlot?.name ?? '',
    fieldPlotAreaHa: fieldPlot?.boundaryAreaHa != null ? Number(fieldPlot.boundaryAreaHa) : 0,
    cultivarId: (row.cultivarId as string) ?? null,
    cultivarName: cultivar?.name ?? null,
    harvestDate: (row.harvestDate as Date).toISOString().split('T')[0],
    harvestType,
    harvestTypeLabel: HARVEST_TYPE_LABELS[harvestType] ?? harvestType,
    // CA2
    volumeLiters,
    sacsBenefited: row.sacsBenefited != null ? Number(row.sacsBenefited) : null,
    estimatedSacs: computeEstimatedSacs(volumeLiters, yieldLitersPerSac),
    // CA3
    yieldLitersPerSac,
    // CA4
    cherryPct: Number(row.cherryPct),
    greenPct: Number(row.greenPct),
    floaterPct: Number(row.floaterPct),
    dryPct: Number(row.dryPct),
    // CA5
    destination: (row.destination as string) ?? null,
    destinationLabel: row.destination
      ? (DESTINATION_LABELS[row.destination as string] ?? (row.destination as string))
      : null,
    destinationName: (row.destinationName as string) ?? null,
    // CA6
    numberOfHarvesters: row.numberOfHarvesters != null ? Number(row.numberOfHarvesters) : null,
    harvestersProductivity:
      row.harvestersProductivity != null
        ? Number(row.harvestersProductivity)
        : computeProductivity(volumeLiters, row.numberOfHarvesters as number | null),
    // CA7
    isSpecialLot: (row.isSpecialLot as boolean) ?? false,
    microlotCode: (row.microlotCode as string) ?? null,
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

// ─── CREATE (CA1-CA7) ───────────────────────────────────────────────

export async function createCoffeeHarvest(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateCoffeeHarvestInput,
): Promise<CoffeeHarvestItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new CoffeeHarvestError('Fazenda não encontrada', 404);
    }

    const plot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!plot) {
      throw new CoffeeHarvestError('Talhão não encontrado nesta fazenda', 404);
    }

    if (input.cultivarId) {
      const cultivar = await tx.cultivar.findFirst({
        where: { id: input.cultivarId, deletedAt: null },
        select: { id: true },
      });
      if (!cultivar) {
        throw new CoffeeHarvestError('Cultivar não encontrada', 404);
      }
    }

    // CA3 — resolve yield
    const yieldLitersPerSac = input.yieldLitersPerSac ?? DEFAULT_YIELD_LITERS_PER_SAC;

    // CA6 — compute productivity if team provided
    const productivity = computeProductivity(input.volumeLiters, input.numberOfHarvesters ?? null);

    const data: Record<string, unknown> = {
      farmId,
      fieldPlotId: input.fieldPlotId,
      cultivarId: input.cultivarId ?? null,
      harvestDate: new Date(input.harvestDate),
      harvestType: input.harvestType,
      // CA2
      volumeLiters: input.volumeLiters,
      sacsBenefited: input.sacsBenefited ?? null,
      // CA3
      yieldLitersPerSac,
      // CA4
      cherryPct: input.cherryPct ?? 0,
      greenPct: input.greenPct ?? 0,
      floaterPct: input.floaterPct ?? 0,
      dryPct: input.dryPct ?? 0,
      // CA5
      destination: input.destination ?? null,
      destinationName: input.destinationName?.trim() ?? null,
      // CA6
      numberOfHarvesters: input.numberOfHarvesters ?? null,
      harvestersProductivity: input.harvestersProductivity ?? productivity,
      // CA7
      isSpecialLot: input.isSpecialLot ?? false,
      microlotCode: input.microlotCode?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      recordedBy: userId,
    };

    if (input.id) {
      data.id = input.id;
    }

    const row = await tx.coffeeHarvest.create({
      data: data as Parameters<typeof tx.coffeeHarvest.create>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listCoffeeHarvests(
  ctx: RlsContext,
  farmId: string,
  options: {
    page?: number;
    limit?: number;
    fieldPlotId?: string;
    harvestType?: string;
    dateFrom?: string;
    dateTo?: string;
    isSpecialLot?: boolean;
    search?: string;
  } = {},
): Promise<{
  data: CoffeeHarvestItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };
    if (options.fieldPlotId) {
      where.fieldPlotId = options.fieldPlotId;
    }
    if (options.harvestType) {
      where.harvestType = options.harvestType;
    }
    if (options.isSpecialLot !== undefined) {
      where.isSpecialLot = options.isSpecialLot;
    }
    if (options.search) {
      where.OR = [
        { notes: { contains: options.search, mode: 'insensitive' } },
        { microlotCode: { contains: options.search, mode: 'insensitive' } },
        { destinationName: { contains: options.search, mode: 'insensitive' } },
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
      tx.coffeeHarvest.findMany({
        where: whereClause,
        orderBy: { harvestDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_RELATIONS,
      }),
      tx.coffeeHarvest.count({ where: whereClause }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getCoffeeHarvest(
  ctx: RlsContext,
  farmId: string,
  harvestId: string,
): Promise<CoffeeHarvestItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.coffeeHarvest.findFirst({
      where: { id: harvestId, farmId, deletedAt: null },
      include: INCLUDE_RELATIONS,
    });
    if (!row) {
      throw new CoffeeHarvestError('Colheita não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateCoffeeHarvest(
  ctx: RlsContext,
  farmId: string,
  harvestId: string,
  input: Partial<CreateCoffeeHarvestInput>,
): Promise<CoffeeHarvestItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.coffeeHarvest.findFirst({
      where: { id: harvestId, farmId, deletedAt: null },
      select: { id: true, fieldPlotId: true, volumeLiters: true, numberOfHarvesters: true },
    });
    if (!existing) {
      throw new CoffeeHarvestError('Colheita não encontrada', 404);
    }

    // Validate fields that are being updated
    if (input.fieldPlotId) {
      const plot = await tx.fieldPlot.findFirst({
        where: { id: input.fieldPlotId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!plot) {
        throw new CoffeeHarvestError('Talhão não encontrado nesta fazenda', 404);
      }
    }
    if (input.cultivarId) {
      const cultivar = await tx.cultivar.findFirst({
        where: { id: input.cultivarId, deletedAt: null },
        select: { id: true },
      });
      if (!cultivar) {
        throw new CoffeeHarvestError('Cultivar não encontrada', 404);
      }
    }
    if (input.harvestDate) {
      const d = new Date(input.harvestDate);
      if (isNaN(d.getTime())) {
        throw new CoffeeHarvestError('Data de colheita inválida', 400);
      }
    }
    if (input.harvestType) {
      if (!(HARVEST_TYPES as readonly string[]).includes(input.harvestType)) {
        throw new CoffeeHarvestError(
          `Tipo de colheita inválido. Use: ${HARVEST_TYPES.join(', ')}`,
          400,
        );
      }
    }
    if (input.volumeLiters != null && input.volumeLiters <= 0) {
      throw new CoffeeHarvestError('Volume em litros deve ser maior que zero', 400);
    }
    if (input.sacsBenefited != null && input.sacsBenefited < 0) {
      throw new CoffeeHarvestError('Sacas beneficiadas deve ser zero ou maior', 400);
    }
    if (input.yieldLitersPerSac != null && input.yieldLitersPerSac <= 0) {
      throw new CoffeeHarvestError('Rendimento (litros/saca) deve ser maior que zero', 400);
    }
    // CA4 — classification
    const pcts = ['cherryPct', 'greenPct', 'floaterPct', 'dryPct'] as const;
    const labels = ['Cereja', 'Verde', 'Boia', 'Seco'];
    for (let i = 0; i < pcts.length; i++) {
      const val = input[pcts[i]];
      if (val != null && (val < 0 || val > 100)) {
        throw new CoffeeHarvestError(`Percentual de ${labels[i]} deve estar entre 0 e 100`, 400);
      }
    }
    if (input.destination && !(DESTINATIONS as readonly string[]).includes(input.destination)) {
      throw new CoffeeHarvestError(`Destino inválido. Use: ${DESTINATIONS.join(', ')}`, 400);
    }
    if (input.numberOfHarvesters != null && input.numberOfHarvesters <= 0) {
      throw new CoffeeHarvestError('Número de colhedores deve ser maior que zero', 400);
    }

    const data: Record<string, unknown> = {};
    if (input.fieldPlotId) data.fieldPlotId = input.fieldPlotId;
    if (input.cultivarId !== undefined) data.cultivarId = input.cultivarId ?? null;
    if (input.harvestDate) data.harvestDate = new Date(input.harvestDate);
    if (input.harvestType) data.harvestType = input.harvestType;
    if (input.volumeLiters !== undefined) data.volumeLiters = input.volumeLiters;
    if (input.sacsBenefited !== undefined) data.sacsBenefited = input.sacsBenefited ?? null;
    if (input.yieldLitersPerSac !== undefined)
      data.yieldLitersPerSac = input.yieldLitersPerSac ?? null;
    if (input.cherryPct !== undefined) data.cherryPct = input.cherryPct;
    if (input.greenPct !== undefined) data.greenPct = input.greenPct;
    if (input.floaterPct !== undefined) data.floaterPct = input.floaterPct;
    if (input.dryPct !== undefined) data.dryPct = input.dryPct;
    if (input.destination !== undefined) data.destination = input.destination ?? null;
    if (input.destinationName !== undefined)
      data.destinationName = input.destinationName?.trim() ?? null;
    if (input.numberOfHarvesters !== undefined)
      data.numberOfHarvesters = input.numberOfHarvesters ?? null;
    if (input.harvestersProductivity !== undefined)
      data.harvestersProductivity = input.harvestersProductivity ?? null;
    if (input.isSpecialLot !== undefined) data.isSpecialLot = input.isSpecialLot;
    if (input.microlotCode !== undefined) data.microlotCode = input.microlotCode?.trim() ?? null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;

    const row = await tx.coffeeHarvest.update({
      where: { id: harvestId },
      data: data as Parameters<typeof tx.coffeeHarvest.update>[0]['data'],
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DAILY SUMMARY (CA6/CA9 — totalizador diário por talhão) ───────

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

    const harvests = await tx.coffeeHarvest.findMany({
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
        totalVolumeLiters: number;
        totalEstimatedSacs: number;
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
          totalVolumeLiters: 0,
          totalEstimatedSacs: 0,
          totalHarvesters: 0,
          productivitySum: 0,
          productivityCount: 0,
          entries: 0,
        };
        groupMap.set(key, acc);
      }

      const vol = Number(row.volumeLiters);
      const yld =
        row.yieldLitersPerSac != null
          ? Number(row.yieldLitersPerSac)
          : DEFAULT_YIELD_LITERS_PER_SAC;

      acc.totalVolumeLiters += vol;
      acc.totalEstimatedSacs += computeEstimatedSacs(vol, yld);
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
      totalVolumeLiters: Math.round(acc.totalVolumeLiters * 100) / 100,
      totalEstimatedSacs: Math.round(acc.totalEstimatedSacs * 100) / 100,
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

export async function deleteCoffeeHarvest(
  ctx: RlsContext,
  farmId: string,
  harvestId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.coffeeHarvest.findFirst({
      where: { id: harvestId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new CoffeeHarvestError('Colheita não encontrada', 404);
    }
    await tx.coffeeHarvest.update({
      where: { id: harvestId },
      data: { deletedAt: new Date() },
    });
  });
}
