import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  DietError,
  ANIMAL_CATEGORY_LABELS,
  type CreateDietInput,
  type UpdateDietInput,
  type ListDietsQuery,
  type ListDietsResult,
  type DietItem,
  type DietDetail,
  type DietIngredientItem,
  type DietLotAssignmentItem,
  type NutrientCalculation,
  type AssignLotInput,
  type SimulateDietInput,
  type SimulationResult,
  type DietVersionItem,
  type DietIngredientInput,
} from './diets.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function validateCreateDiet(input: CreateDietInput): void {
  if (!input.name?.trim()) {
    throw new DietError('Nome é obrigatório', 400);
  }
  if (!input.targetCategory?.trim()) {
    throw new DietError('Categoria alvo é obrigatória', 400);
  }
  if (!input.ingredients || input.ingredients.length === 0) {
    throw new DietError('Ao menos um ingrediente é obrigatório', 400);
  }
  for (const ing of input.ingredients) {
    if (!ing.feedIngredientId?.trim()) {
      throw new DietError('ID do ingrediente é obrigatório', 400);
    }
    if (ing.quantityKgDay == null || ing.quantityKgDay <= 0) {
      throw new DietError('Quantidade (kg/dia) deve ser positiva', 400);
    }
  }
  if (input.startDate && input.endDate) {
    if (new Date(input.endDate) < new Date(input.startDate)) {
      throw new DietError('Data final não pode ser anterior à data inicial', 400);
    }
  }
}

function validateUpdateDiet(input: UpdateDietInput): void {
  if (input.name !== undefined && !input.name?.trim()) {
    throw new DietError('Nome não pode ser vazio', 400);
  }
  if (input.ingredients) {
    for (const ing of input.ingredients) {
      if (!ing.feedIngredientId?.trim()) {
        throw new DietError('ID do ingrediente é obrigatório', 400);
      }
      if (ing.quantityKgDay == null || ing.quantityKgDay <= 0) {
        throw new DietError('Quantidade (kg/dia) deve ser positiva', 400);
      }
    }
  }
  if (input.startDate && input.endDate) {
    if (new Date(input.endDate) < new Date(input.startDate)) {
      throw new DietError('Data final não pode ser anterior à data inicial', 400);
    }
  }
}

// Calculate nutrients from ingredients + their feed ingredient data + latest analyses
async function calculateNutrientsFromIngredients(
  tx: any,
  organizationId: string,
  ingredients: Array<{ feedIngredientId: string; quantityKgDay: number }>,
): Promise<{
  nutrients: NutrientCalculation;
  ingredientDetails: Array<{
    feedIngredientId: string;
    feedIngredientName: string;
    feedIngredientType: string;
    quantityKgDay: number;
    dmKgDay: number | null;
    cpGDay: number | null;
    costPerDay: number | null;
  }>;
}> {
  const feedIds = ingredients.map((i) => i.feedIngredientId);

  // Fetch all feed ingredients
  const feeds = await tx.feedIngredient.findMany({
    where: { id: { in: feedIds }, organizationId, deletedAt: null },
  });

  const feedMap = new Map<string, any>();
  for (const f of feeds) feedMap.set(f.id, f);

  // Fetch latest analysis for each ingredient
  const analysisMap = new Map<string, any>();
  for (const feedId of feedIds) {
    const latest = await tx.bromatologicalAnalysis.findFirst({
      where: { feedIngredientId: feedId, organizationId },
      orderBy: { collectionDate: 'desc' },
    });
    if (latest) analysisMap.set(feedId, latest);
  }

  let totalDmKgDay = 0;
  let totalCpGDay = 0;
  let totalNdfGDay = 0;
  let totalAdfGDay = 0;
  let totalEeGDay = 0;
  let totalTdnGDay = 0;
  let totalNelMcalDay = 0;
  let totalCaGDay = 0;
  let totalPGDay = 0;
  let totalCost = 0;
  let roughageDmKg = 0;
  let hasDm = false;

  const ingredientDetails: Array<{
    feedIngredientId: string;
    feedIngredientName: string;
    feedIngredientType: string;
    quantityKgDay: number;
    dmKgDay: number | null;
    cpGDay: number | null;
    costPerDay: number | null;
  }> = [];

  for (const ing of ingredients) {
    const feed = feedMap.get(ing.feedIngredientId);
    if (!feed) continue;

    const analysis = analysisMap.get(ing.feedIngredientId);
    const qty = ing.quantityKgDay;

    // Use analysis values if available, otherwise reference values
    const dmPct =
      analysis?.dmPercent != null
        ? Number(analysis.dmPercent)
        : feed.refDmPercent != null
          ? Number(feed.refDmPercent)
          : null;
    const cpPct =
      analysis?.cpPercent != null
        ? Number(analysis.cpPercent)
        : feed.refCpPercent != null
          ? Number(feed.refCpPercent)
          : null;
    const ndfPct =
      analysis?.ndfPercent != null
        ? Number(analysis.ndfPercent)
        : feed.refNdfPercent != null
          ? Number(feed.refNdfPercent)
          : null;
    const adfPct =
      analysis?.adfPercent != null
        ? Number(analysis.adfPercent)
        : feed.refAdfPercent != null
          ? Number(feed.refAdfPercent)
          : null;
    const eePct =
      analysis?.eePercent != null
        ? Number(analysis.eePercent)
        : feed.refEePercent != null
          ? Number(feed.refEePercent)
          : null;
    const tdnPct =
      analysis?.tdnPercent != null
        ? Number(analysis.tdnPercent)
        : feed.refTdnPercent != null
          ? Number(feed.refTdnPercent)
          : null;
    const nelMcalKg =
      analysis?.nelMcalKg != null
        ? Number(analysis.nelMcalKg)
        : feed.refNelMcalKg != null
          ? Number(feed.refNelMcalKg)
          : null;
    const caPct =
      analysis?.caPercent != null
        ? Number(analysis.caPercent)
        : feed.refCaPercent != null
          ? Number(feed.refCaPercent)
          : null;
    const pPct =
      analysis?.pPercent != null
        ? Number(analysis.pPercent)
        : feed.refPPercent != null
          ? Number(feed.refPPercent)
          : null;
    const costPerKg = feed.costPerKg != null ? Number(feed.costPerKg) : null;

    let dmKg: number | null = null;
    let cpG: number | null = null;
    let costDay: number | null = null;

    if (dmPct != null) {
      dmKg = qty * (dmPct / 100);
      totalDmKgDay += dmKg;
      hasDm = true;

      if (feed.type === 'ROUGHAGE') {
        roughageDmKg += dmKg;
      }
    }

    if (cpPct != null && dmPct != null) {
      cpG = qty * (dmPct / 100) * (cpPct / 100) * 1000;
      totalCpGDay += cpG;
    }

    if (ndfPct != null && dmPct != null) {
      totalNdfGDay += qty * (dmPct / 100) * (ndfPct / 100) * 1000;
    }
    if (adfPct != null && dmPct != null) {
      totalAdfGDay += qty * (dmPct / 100) * (adfPct / 100) * 1000;
    }
    if (eePct != null && dmPct != null) {
      totalEeGDay += qty * (dmPct / 100) * (eePct / 100) * 1000;
    }
    if (tdnPct != null && dmPct != null) {
      totalTdnGDay += qty * (dmPct / 100) * (tdnPct / 100) * 1000;
    }
    if (nelMcalKg != null && dmPct != null) {
      totalNelMcalDay += qty * (dmPct / 100) * nelMcalKg;
    }
    if (caPct != null && dmPct != null) {
      totalCaGDay += qty * (dmPct / 100) * (caPct / 100) * 1000;
    }
    if (pPct != null && dmPct != null) {
      totalPGDay += qty * (dmPct / 100) * (pPct / 100) * 1000;
    }
    if (costPerKg != null) {
      costDay = qty * costPerKg;
      totalCost += costDay;
    }

    ingredientDetails.push({
      feedIngredientId: ing.feedIngredientId,
      feedIngredientName: feed.name,
      feedIngredientType: feed.type,
      quantityKgDay: qty,
      dmKgDay: dmKg != null ? round4(dmKg) : null,
      cpGDay: cpG != null ? round2(cpG) : null,
      costPerDay: costDay != null ? round4(costDay) : null,
    });
  }

  const totalDmG = totalDmKgDay * 1000;

  const nutrients: NutrientCalculation = {
    totalDmKgDay: hasDm ? round4(totalDmKgDay) : null,
    totalCpGDay: totalCpGDay > 0 ? round2(totalCpGDay) : null,
    cpPercentDm: hasDm && totalDmG > 0 ? round2((totalCpGDay / totalDmG) * 100) : null,
    ndfPercentDm: hasDm && totalDmG > 0 ? round2((totalNdfGDay / totalDmG) * 100) : null,
    adfPercentDm: hasDm && totalDmG > 0 ? round2((totalAdfGDay / totalDmG) * 100) : null,
    eePercentDm: hasDm && totalDmG > 0 ? round2((totalEeGDay / totalDmG) * 100) : null,
    tdnPercentDm: hasDm && totalDmG > 0 ? round2((totalTdnGDay / totalDmG) * 100) : null,
    nelMcalDay: totalNelMcalDay > 0 ? round4(totalNelMcalDay) : null,
    nelMcalKgDm: hasDm && totalDmKgDay > 0 ? round4(totalNelMcalDay / totalDmKgDay) : null,
    caGDay: totalCaGDay > 0 ? round2(totalCaGDay) : null,
    pGDay: totalPGDay > 0 ? round2(totalPGDay) : null,
    roughageConcentrateRatio:
      hasDm && totalDmKgDay > 0 ? round2((roughageDmKg / totalDmKgDay) * 100) : null,
    costPerAnimalDay: totalCost > 0 ? round4(totalCost) : null,
    costPerKgDm:
      hasDm && totalDmKgDay > 0 && totalCost > 0 ? round4(totalCost / totalDmKgDay) : null,
  };

  return { nutrients, ingredientDetails };
}

function toDietItem(row: any): DietItem {
  const category = row.targetCategory as string;
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    targetCategory: category,
    targetCategoryLabel: ANIMAL_CATEGORY_LABELS[category] ?? category,
    startDate: row.startDate ? (row.startDate as Date).toISOString().slice(0, 10) : null,
    endDate: row.endDate ? (row.endDate as Date).toISOString().slice(0, 10) : null,
    nutritionist: row.nutritionist ?? null,
    objective: row.objective ?? null,
    version: row.version,
    parentId: row.parentId ?? null,
    isActive: row.isActive,
    nutrients: {
      totalDmKgDay: row.totalDmKgDay != null ? Number(row.totalDmKgDay) : null,
      totalCpGDay: row.totalCpGDay != null ? Number(row.totalCpGDay) : null,
      cpPercentDm: row.cpPercentDm != null ? Number(row.cpPercentDm) : null,
      ndfPercentDm: row.ndfPercentDm != null ? Number(row.ndfPercentDm) : null,
      adfPercentDm: row.adfPercentDm != null ? Number(row.adfPercentDm) : null,
      eePercentDm: row.eePercentDm != null ? Number(row.eePercentDm) : null,
      tdnPercentDm: row.tdnPercentDm != null ? Number(row.tdnPercentDm) : null,
      nelMcalDay: row.nelMcalDay != null ? Number(row.nelMcalDay) : null,
      nelMcalKgDm: row.nelMcalKgDm != null ? Number(row.nelMcalKgDm) : null,
      caGDay: row.caGDay != null ? Number(row.caGDay) : null,
      pGDay: row.pGDay != null ? Number(row.pGDay) : null,
      roughageConcentrateRatio:
        row.roughageConcentrateRatio != null ? Number(row.roughageConcentrateRatio) : null,
      costPerAnimalDay: row.costPerAnimalDay != null ? Number(row.costPerAnimalDay) : null,
      costPerKgDm: row.costPerKgDm != null ? Number(row.costPerKgDm) : null,
    },
    ingredientCount: row._count?.ingredients ?? row.ingredients?.length ?? 0,
    lotCount: row._count?.lotAssignments ?? row.lotAssignments?.length ?? 0,
    notes: row.notes ?? null,
    createdBy: row.createdBy,
    creatorName: row.creator?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toIngredientItem(row: any): DietIngredientItem {
  return {
    id: row.id,
    feedIngredientId: row.feedIngredientId,
    feedIngredientName: row.feedIngredient?.name ?? '',
    feedIngredientType: row.feedIngredient?.type ?? '',
    quantityKgDay: Number(row.quantityKgDay),
    sortOrder: row.sortOrder,
    dmKgDay: null, // filled by caller
    cpGDay: null,
    costPerDay: null,
    notes: row.notes ?? null,
  };
}

function toLotAssignmentItem(row: any): DietLotAssignmentItem {
  return {
    id: row.id,
    lotId: row.lotId,
    lotName: row.lot?.name ?? '',
    animalCount: row.lot?._count?.animals ?? row.lot?.animals?.length ?? 0,
    startDate: (row.startDate as Date).toISOString().slice(0, 10),
    endDate: row.endDate ? (row.endDate as Date).toISOString().slice(0, 10) : null,
  };
}

const DIET_INCLUDE = {
  creator: { select: { name: true } },
  _count: { select: { ingredients: true, lotAssignments: true } },
} as const;

const DIET_DETAIL_INCLUDE = {
  creator: { select: { name: true } },
  ingredients: {
    include: {
      feedIngredient: { select: { id: true, name: true, type: true, costPerKg: true } },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  lotAssignments: {
    include: {
      lot: {
        select: { id: true, name: true, _count: { select: { animals: true } } },
      },
    },
    orderBy: { startDate: 'desc' as const },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════

export async function createDiet(
  ctx: RlsContext,
  createdBy: string,
  input: CreateDietInput,
): Promise<DietDetail> {
  validateCreateDiet(input);

  return withRlsContext(ctx, async (tx) => {
    // Validate feed ingredients exist
    const feedIds = input.ingredients.map((i) => i.feedIngredientId);
    const feeds = await tx.feedIngredient.findMany({
      where: { id: { in: feedIds }, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });
    const foundIds = new Set(feeds.map((f: any) => f.id));
    for (const id of feedIds) {
      if (!foundIds.has(id)) {
        throw new DietError('Ingrediente não encontrado: ' + id, 404);
      }
    }

    // Calculate nutrients
    const { nutrients } = await calculateNutrientsFromIngredients(
      tx,
      ctx.organizationId,
      input.ingredients,
    );

    const row = await tx.diet.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        targetCategory: input.targetCategory.trim(),
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        nutritionist: input.nutritionist?.trim() || null,
        objective: input.objective?.trim() || null,
        notes: input.notes?.trim() || null,
        createdBy,
        ...nutrients,
        ingredients: {
          create: input.ingredients.map((ing, idx) => ({
            feedIngredientId: ing.feedIngredientId,
            quantityKgDay: ing.quantityKgDay,
            sortOrder: ing.sortOrder ?? idx,
            notes: ing.notes?.trim() || null,
          })),
        },
      },
      include: DIET_DETAIL_INCLUDE,
    });

    return buildDietDetail(tx, ctx.organizationId, row);
  });
}

export async function listDiets(ctx: RlsContext, query: ListDietsQuery): Promise<ListDietsResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };

    if (query.targetCategory) where.targetCategory = query.targetCategory;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { nutritionist: { contains: query.search, mode: 'insensitive' } },
        { objective: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      tx.diet.findMany({
        where: where as any,
        include: DIET_INCLUDE,
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      tx.diet.count({ where: where as any }),
    ]);

    return {
      data: rows.map(toDietItem),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function getDiet(ctx: RlsContext, id: string): Promise<DietDetail> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.diet.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: DIET_DETAIL_INCLUDE,
    });
    if (!row) {
      throw new DietError('Dieta não encontrada', 404);
    }
    return buildDietDetail(tx, ctx.organizationId, row);
  });
}

async function buildDietDetail(tx: any, organizationId: string, row: any): Promise<DietDetail> {
  const base = toDietItem(row);

  // Enrich ingredient items with calculated per-ingredient values
  const ingredientInputs = (row.ingredients as any[]).map((i: any) => ({
    feedIngredientId: i.feedIngredientId,
    quantityKgDay: Number(i.quantityKgDay),
  }));

  const { ingredientDetails } = await calculateNutrientsFromIngredients(
    tx,
    organizationId,
    ingredientInputs,
  );

  const detailMap = new Map<string, (typeof ingredientDetails)[0]>();
  for (const d of ingredientDetails) {
    detailMap.set(d.feedIngredientId, d);
  }

  const ingredients: DietIngredientItem[] = (row.ingredients as any[]).map((i: any) => {
    const base = toIngredientItem(i);
    const detail = detailMap.get(i.feedIngredientId);
    if (detail) {
      base.dmKgDay = detail.dmKgDay;
      base.cpGDay = detail.cpGDay;
      base.costPerDay = detail.costPerDay;
    }
    return base;
  });

  const lotAssignments: DietLotAssignmentItem[] = (row.lotAssignments as any[]).map(
    toLotAssignmentItem,
  );

  return {
    ...base,
    ingredientCount: ingredients.length,
    lotCount: lotAssignments.length,
    ingredients,
    lotAssignments,
  };
}

// CA5: Versioning — editing used diet creates new version
export async function updateDiet(
  ctx: RlsContext,
  id: string,
  createdBy: string,
  input: UpdateDietInput,
): Promise<DietDetail> {
  validateUpdateDiet(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.diet.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        ingredients: true,
        lotAssignments: true,
        _count: { select: { lotAssignments: true } },
      },
    });
    if (!existing) {
      throw new DietError('Dieta não encontrada', 404);
    }

    // If diet has lot assignments and ingredients are changing, create new version
    const hasLots = (existing as any)._count.lotAssignments > 0;
    const hasIngredientChanges = input.ingredients !== undefined;

    if (hasLots && hasIngredientChanges) {
      // Deactivate old version
      await tx.diet.update({
        where: { id },
        data: { isActive: false },
      });

      // Create new version
      const newIngredients = input.ingredients!;

      // Validate feed ingredients
      const feedIds = newIngredients.map((i) => i.feedIngredientId);
      const feeds = await tx.feedIngredient.findMany({
        where: { id: { in: feedIds }, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true },
      });
      const foundIds = new Set(feeds.map((f: any) => f.id));
      for (const fid of feedIds) {
        if (!foundIds.has(fid)) {
          throw new DietError('Ingrediente não encontrado: ' + fid, 404);
        }
      }

      const { nutrients } = await calculateNutrientsFromIngredients(
        tx,
        ctx.organizationId,
        newIngredients,
      );

      const parentId = existing.parentId ?? existing.id;

      const newRow = await tx.diet.create({
        data: {
          organizationId: ctx.organizationId,
          name: (input.name ?? existing.name).trim(),
          targetCategory: (input.targetCategory ?? existing.targetCategory).trim(),
          startDate:
            input.startDate !== undefined
              ? input.startDate
                ? new Date(input.startDate)
                : null
              : existing.startDate,
          endDate:
            input.endDate !== undefined
              ? input.endDate
                ? new Date(input.endDate)
                : null
              : existing.endDate,
          nutritionist:
            input.nutritionist !== undefined
              ? input.nutritionist?.trim() || null
              : existing.nutritionist,
          objective:
            input.objective !== undefined ? input.objective?.trim() || null : existing.objective,
          notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
          createdBy,
          version: existing.version + 1,
          parentId,
          ...nutrients,
          ingredients: {
            create: newIngredients.map((ing, idx) => ({
              feedIngredientId: ing.feedIngredientId,
              quantityKgDay: ing.quantityKgDay,
              sortOrder: ing.sortOrder ?? idx,
              notes: ing.notes?.trim() || null,
            })),
          },
        },
        include: DIET_DETAIL_INCLUDE,
      });

      // Move lot assignments to new version
      await tx.dietLotAssignment.updateMany({
        where: { dietId: id },
        data: { dietId: newRow.id },
      });

      // Re-fetch with updated lot assignments
      const refreshed = await tx.diet.findFirst({
        where: { id: newRow.id },
        include: DIET_DETAIL_INCLUDE,
      });

      return buildDietDetail(tx, ctx.organizationId, refreshed);
    }

    // Simple update (no versioning needed)
    if (input.ingredients) {
      const feedIds = input.ingredients.map((i) => i.feedIngredientId);
      const feeds = await tx.feedIngredient.findMany({
        where: { id: { in: feedIds }, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true },
      });
      const foundIds = new Set(feeds.map((f: any) => f.id));
      for (const fid of feedIds) {
        if (!foundIds.has(fid)) {
          throw new DietError('Ingrediente não encontrado: ' + fid, 404);
        }
      }
    }

    const ingredientsToCalc =
      input.ingredients ??
      (existing.ingredients as any[]).map((i: any) => ({
        feedIngredientId: i.feedIngredientId,
        quantityKgDay: Number(i.quantityKgDay),
      }));

    const { nutrients } = await calculateNutrientsFromIngredients(
      tx,
      ctx.organizationId,
      ingredientsToCalc,
    );

    const data: Record<string, unknown> = { ...nutrients };
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.targetCategory !== undefined) data.targetCategory = input.targetCategory.trim();
    if (input.startDate !== undefined)
      data.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.endDate !== undefined) data.endDate = input.endDate ? new Date(input.endDate) : null;
    if (input.nutritionist !== undefined) data.nutritionist = input.nutritionist?.trim() || null;
    if (input.objective !== undefined) data.objective = input.objective?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    // Replace ingredients if provided
    if (input.ingredients) {
      await tx.dietIngredient.deleteMany({ where: { dietId: id } });
      await tx.dietIngredient.createMany({
        data: input.ingredients.map((ing, idx) => ({
          dietId: id,
          feedIngredientId: ing.feedIngredientId,
          quantityKgDay: ing.quantityKgDay,
          sortOrder: ing.sortOrder ?? idx,
          notes: ing.notes?.trim() || null,
        })),
      });
    }

    await tx.diet.update({ where: { id }, data: data as any });

    const row = await tx.diet.findFirst({
      where: { id },
      include: DIET_DETAIL_INCLUDE,
    });

    return buildDietDetail(tx, ctx.organizationId, row);
  });
}

export async function deleteDiet(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.diet.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new DietError('Dieta não encontrada', 404);
    }

    await tx.diet.delete({ where: { id } });
  });
}

// CA8: Duplicate diet
export async function duplicateDiet(
  ctx: RlsContext,
  id: string,
  createdBy: string,
): Promise<DietDetail> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.diet.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: { ingredients: true },
    });
    if (!existing) {
      throw new DietError('Dieta não encontrada', 404);
    }

    const ingredients: DietIngredientInput[] = (existing.ingredients as any[]).map((i: any) => ({
      feedIngredientId: i.feedIngredientId,
      quantityKgDay: Number(i.quantityKgDay),
      sortOrder: i.sortOrder,
      notes: i.notes,
    }));

    const { nutrients } = await calculateNutrientsFromIngredients(
      tx,
      ctx.organizationId,
      ingredients,
    );

    const row = await tx.diet.create({
      data: {
        organizationId: ctx.organizationId,
        name: `${existing.name} (cópia)`,
        targetCategory: existing.targetCategory,
        startDate: existing.startDate,
        endDate: existing.endDate,
        nutritionist: existing.nutritionist,
        objective: existing.objective,
        notes: existing.notes,
        createdBy,
        ...nutrients,
        ingredients: {
          create: ingredients.map((ing, idx) => ({
            feedIngredientId: ing.feedIngredientId,
            quantityKgDay: ing.quantityKgDay,
            sortOrder: ing.sortOrder ?? idx,
            notes: ing.notes?.trim() || null,
          })),
        },
      },
      include: DIET_DETAIL_INCLUDE,
    });

    return buildDietDetail(tx, ctx.organizationId, row);
  });
}

// CA4: Assign diet to lot
export async function assignToLot(
  ctx: RlsContext,
  dietId: string,
  input: AssignLotInput,
): Promise<DietLotAssignmentItem> {
  if (!input.lotId?.trim()) {
    throw new DietError('Lote é obrigatório', 400);
  }
  if (!input.startDate) {
    throw new DietError('Data inicial é obrigatória', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const diet = await tx.diet.findFirst({
      where: { id: dietId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!diet) {
      throw new DietError('Dieta não encontrada', 404);
    }

    // Verify lot exists (lots belong to farms, which belong to org)
    const lot = await tx.animalLot.findFirst({
      where: { id: input.lotId, deletedAt: null },
      include: { farm: { select: { organizationId: true } } },
    });
    if (!lot || (lot as any).farm.organizationId !== ctx.organizationId) {
      throw new DietError('Lote não encontrado', 404);
    }

    const row = await tx.dietLotAssignment.create({
      data: {
        dietId,
        lotId: input.lotId,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
      },
      include: {
        lot: {
          select: { id: true, name: true, _count: { select: { animals: true } } },
        },
      },
    });

    return toLotAssignmentItem(row);
  });
}

export async function removeFromLot(
  ctx: RlsContext,
  dietId: string,
  assignmentId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const diet = await tx.diet.findFirst({
      where: { id: dietId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!diet) {
      throw new DietError('Dieta não encontrada', 404);
    }

    const assignment = await tx.dietLotAssignment.findFirst({
      where: { id: assignmentId, dietId },
      select: { id: true },
    });
    if (!assignment) {
      throw new DietError('Vinculação não encontrada', 404);
    }

    await tx.dietLotAssignment.delete({ where: { id: assignmentId } });
  });
}

// CA7: Simulate diet (calculate without saving)
export async function simulateDiet(
  ctx: RlsContext,
  input: SimulateDietInput,
): Promise<SimulationResult> {
  if (!input.ingredients || input.ingredients.length === 0) {
    throw new DietError('Ao menos um ingrediente é obrigatório para simulação', 400);
  }

  for (const ing of input.ingredients) {
    if (!ing.feedIngredientId?.trim()) {
      throw new DietError('ID do ingrediente é obrigatório', 400);
    }
    if (ing.quantityKgDay == null || ing.quantityKgDay <= 0) {
      throw new DietError('Quantidade (kg/dia) deve ser positiva', 400);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    const { nutrients, ingredientDetails } = await calculateNutrientsFromIngredients(
      tx,
      ctx.organizationId,
      input.ingredients,
    );

    return { nutrients, ingredients: ingredientDetails };
  });
}

// CA3: Recalculate nutrients for existing diet
export async function recalculateNutrients(ctx: RlsContext, dietId: string): Promise<DietDetail> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.diet.findFirst({
      where: { id: dietId, organizationId: ctx.organizationId },
      include: { ingredients: true },
    });
    if (!existing) {
      throw new DietError('Dieta não encontrada', 404);
    }

    const ingredientInputs = (existing.ingredients as any[]).map((i: any) => ({
      feedIngredientId: i.feedIngredientId,
      quantityKgDay: Number(i.quantityKgDay),
    }));

    const { nutrients } = await calculateNutrientsFromIngredients(
      tx,
      ctx.organizationId,
      ingredientInputs,
    );

    await tx.diet.update({
      where: { id: dietId },
      data: nutrients as any,
    });

    const row = await tx.diet.findFirst({
      where: { id: dietId },
      include: DIET_DETAIL_INCLUDE,
    });

    return buildDietDetail(tx, ctx.organizationId, row);
  });
}

// List versions of a diet
export async function listVersions(ctx: RlsContext, dietId: string): Promise<DietVersionItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const diet = await tx.diet.findFirst({
      where: { id: dietId, organizationId: ctx.organizationId },
      select: { id: true, parentId: true },
    });
    if (!diet) {
      throw new DietError('Dieta não encontrada', 404);
    }

    // Find root parent
    const rootId = diet.parentId ?? diet.id;

    const versions = await tx.diet.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [{ id: rootId }, { parentId: rootId }],
      },
      include: { creator: { select: { name: true } } },
      orderBy: { version: 'desc' },
    });

    return versions.map((v: any) => ({
      id: v.id,
      version: v.version,
      name: v.name,
      isActive: v.isActive,
      createdAt: (v.createdAt as Date).toISOString(),
      creatorName: v.creator?.name ?? '',
    }));
  });
}

// CA9: Export recipe as CSV
export async function exportRecipeCsv(
  ctx: RlsContext,
  dietId: string,
  lotId?: string,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const diet = await tx.diet.findFirst({
      where: { id: dietId, organizationId: ctx.organizationId },
      include: {
        ingredients: {
          include: { feedIngredient: { select: { name: true, type: true, costPerKg: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        lotAssignments: {
          include: {
            lot: { select: { name: true, _count: { select: { animals: true } } } },
          },
        },
      },
    });
    if (!diet) {
      throw new DietError('Dieta não encontrada', 404);
    }

    let animalCount = 1;
    let lotName = 'Individual';
    if (lotId) {
      const assignment = (diet.lotAssignments as any[]).find((a: any) => a.lotId === lotId);
      if (assignment) {
        animalCount = assignment.lot._count?.animals ?? 1;
        lotName = assignment.lot.name;
      }
    }

    const header = [
      'Ingrediente',
      'Tipo',
      'Qtd/Animal/Dia (kg MN)',
      `Qtd Total/Dia (${animalCount} animais, kg MN)`,
      'Custo/Animal/Dia (R$)',
      'Custo Total/Dia (R$)',
    ].join(';');

    const lines = (diet.ingredients as any[]).map((i: any) => {
      const qty = Number(i.quantityKgDay);
      const totalQty = qty * animalCount;
      const costPerKg =
        i.feedIngredient?.costPerKg != null ? Number(i.feedIngredient.costPerKg) : 0;
      const costPerAnimal = qty * costPerKg;
      const totalCost = costPerAnimal * animalCount;

      return [
        `"${i.feedIngredient?.name ?? ''}"`,
        i.feedIngredient?.type ?? '',
        qty.toFixed(3),
        totalQty.toFixed(3),
        costPerAnimal.toFixed(4),
        totalCost.toFixed(2),
      ].join(';');
    });

    // Summary lines
    const totalQtyPerAnimal = (diet.ingredients as any[]).reduce(
      (sum: number, i: any) => sum + Number(i.quantityKgDay),
      0,
    );

    lines.push('');
    lines.push(
      [
        '"TOTAL"',
        '',
        totalQtyPerAnimal.toFixed(3),
        (totalQtyPerAnimal * animalCount).toFixed(3),
        diet.costPerAnimalDay != null ? Number(diet.costPerAnimalDay).toFixed(4) : '',
        diet.costPerAnimalDay != null
          ? (Number(diet.costPerAnimalDay) * animalCount).toFixed(2)
          : '',
      ].join(';'),
    );
    lines.push('');
    lines.push(`"Dieta: ${diet.name}"`);
    lines.push(
      `"Categoria: ${ANIMAL_CATEGORY_LABELS[diet.targetCategory] ?? diet.targetCategory}"`,
    );
    lines.push(`"Lote: ${lotName}"`);
    lines.push(`"Animais: ${animalCount}"`);
    if (diet.totalDmKgDay != null)
      lines.push(`"MS Total (kg/dia): ${Number(diet.totalDmKgDay).toFixed(4)}"`);
    if (diet.costPerKgDm != null)
      lines.push(`"Custo/kg MS: R$ ${Number(diet.costPerKgDm).toFixed(4)}"`);

    return [header, ...lines].join('\n');
  });
}
