import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  createConsumptionOutput,
  cancelConsumptionOutput,
} from '../stock-deduction/stock-deduction';
import {
  FeedingRecordError,
  FEEDING_SHIFT_LABELS,
  FEEDING_SHIFTS,
  type FeedingShiftValue,
  type CreateFeedingRecordInput,
  type RecordLeftoversInput,
  type UpdateFeedingRecordInput,
  type ListFeedingRecordsQuery,
  type IndicatorsQuery,
  type FeedingRecordResponse,
  type FeedingRecordListItem,
  type FeedingRecordItemResponse,
  type ConsumptionIndicators,
  type LeftoverAlertType,
  LEFTOVER_ALERT_LABELS,
} from './feeding-records.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function toDateStr(val: unknown): string {
  if (!val) return '';
  return (val as Date).toISOString().slice(0, 10);
}

function getLeftoverAlertType(leftoverPercent: number | null): LeftoverAlertType {
  if (leftoverPercent == null) return 'NONE';
  if (leftoverPercent === 0) return 'RESTRICTION';
  if (leftoverPercent > 10) return 'EXCESS';
  return 'NONE';
}

function toItemResponse(row: any): FeedingRecordItemResponse {
  return {
    id: row.id,
    feedingRecordId: row.feedingRecordId,
    feedIngredientId: row.feedIngredientId,
    feedIngredientName: row.feedIngredientName,
    productId: row.productId ?? null,
    quantityProvidedKg: toNumber(row.quantityProvidedKg),
    quantityLeftoverKg: row.quantityLeftoverKg != null ? toNumber(row.quantityLeftoverKg) : null,
    quantityConsumedKg: row.quantityConsumedKg != null ? toNumber(row.quantityConsumedKg) : null,
  };
}

function toResponse(row: any): FeedingRecordResponse {
  const shift = row.shift as FeedingShiftValue;
  const leftoverPercent = row.leftoverPercent != null ? toNumber(row.leftoverPercent) : null;
  const alertType = getLeftoverAlertType(leftoverPercent);
  const items = (row.items ?? []).map(toItemResponse);

  return {
    id: row.id,
    farmId: row.farmId,
    organizationId: row.organizationId,
    lotId: row.lotId,
    lotName: row.lot?.name ?? '',
    feedingDate: toDateStr(row.feedingDate),
    shift,
    shiftLabel: FEEDING_SHIFT_LABELS[shift] ?? shift,
    dietId: row.dietId ?? null,
    dietName: row.dietName ?? null,
    animalCount: toNumber(row.animalCount),
    totalProvidedKg: toNumber(row.totalProvidedKg),
    totalLeftoverKg: row.totalLeftoverKg != null ? toNumber(row.totalLeftoverKg) : null,
    totalConsumedKg: row.totalConsumedKg != null ? toNumber(row.totalConsumedKg) : null,
    leftoverPercent,
    leftoverAlert: row.leftoverAlert ?? false,
    leftoverAlertType: alertType,
    leftoverAlertLabel: LEFTOVER_ALERT_LABELS[alertType],
    consumptionPerAnimalKg:
      row.consumptionPerAnimalKg != null ? toNumber(row.consumptionPerAnimalKg) : null,
    responsibleName: row.responsibleName,
    stockOutputId: row.stockOutputId ?? null,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    items,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toListItem(row: any): FeedingRecordListItem {
  const shift = row.shift as FeedingShiftValue;
  const leftoverPercent = row.leftoverPercent != null ? toNumber(row.leftoverPercent) : null;
  const alertType = getLeftoverAlertType(leftoverPercent);

  return {
    id: row.id,
    farmId: row.farmId,
    lotId: row.lotId,
    lotName: row.lot?.name ?? '',
    feedingDate: toDateStr(row.feedingDate),
    shift,
    shiftLabel: FEEDING_SHIFT_LABELS[shift] ?? shift,
    dietName: row.dietName ?? null,
    animalCount: toNumber(row.animalCount),
    totalProvidedKg: toNumber(row.totalProvidedKg),
    totalLeftoverKg: row.totalLeftoverKg != null ? toNumber(row.totalLeftoverKg) : null,
    totalConsumedKg: row.totalConsumedKg != null ? toNumber(row.totalConsumedKg) : null,
    leftoverPercent,
    leftoverAlert: row.leftoverAlert ?? false,
    leftoverAlertType: alertType,
    consumptionPerAnimalKg:
      row.consumptionPerAnimalKg != null ? toNumber(row.consumptionPerAnimalKg) : null,
    responsibleName: row.responsibleName,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// ─── CREATE (CA1) ───────────────────────────────────────────────────

export async function createFeedingRecord(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateFeedingRecordInput,
): Promise<FeedingRecordResponse> {
  // Validate shift
  if (!FEEDING_SHIFTS.includes(input.shift)) {
    throw new FeedingRecordError(
      `Turno inválido: ${input.shift}. Valores aceitos: ${FEEDING_SHIFTS.join(', ')}`,
      400,
    );
  }

  if (!input.lotId) {
    throw new FeedingRecordError('Lote é obrigatório', 400);
  }
  if (!input.feedingDate) {
    throw new FeedingRecordError('Data do trato é obrigatória', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new FeedingRecordError('Nome do responsável é obrigatório', 400);
  }
  if (!input.items || input.items.length === 0) {
    throw new FeedingRecordError('Ao menos um ingrediente é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate lot belongs to farm
    const lot = await (tx as any).animalLot.findFirst({
      where: { id: input.lotId, farmId, deletedAt: null },
      include: { animals: { where: { deletedAt: null }, select: { id: true } } },
    });
    if (!lot) {
      throw new FeedingRecordError('Lote não encontrado nesta fazenda', 404);
    }

    const animalCount = lot.animals.length;
    if (animalCount === 0) {
      throw new FeedingRecordError('Lote não possui animais ativos', 400);
    }

    // If dietId provided, validate it
    let dietName = input.dietName ?? null;
    if (input.dietId) {
      const diet = await (tx as any).diet.findFirst({
        where: { id: input.dietId, organizationId: ctx.organizationId },
      });
      if (!diet) {
        throw new FeedingRecordError('Dieta não encontrada', 404);
      }
      dietName = diet.name;
    }

    // Validate ingredients
    for (const item of input.items) {
      if (!item.feedIngredientId) {
        throw new FeedingRecordError('ID do ingrediente é obrigatório', 400);
      }
      if (!item.quantityProvidedKg || item.quantityProvidedKg <= 0) {
        throw new FeedingRecordError(
          `Quantidade fornecida para ${item.feedIngredientName || 'ingrediente'} deve ser positiva`,
          400,
        );
      }
      const ingredient = await (tx as any).feedIngredient.findFirst({
        where: { id: item.feedIngredientId, organizationId: ctx.organizationId, deletedAt: null },
      });
      if (!ingredient) {
        throw new FeedingRecordError(
          `Ingrediente "${item.feedIngredientName || item.feedIngredientId}" não encontrado`,
          404,
        );
      }
    }

    // Calculate totals
    const totalProvidedKg = input.items.reduce((sum, i) => sum + i.quantityProvidedKg, 0);

    // Stock deduction (CA5)
    let stockOutputId: string | null = null;
    if (input.deductStock !== false) {
      const stockItems = input.items
        .filter((i) => i.productId)
        .map((i) => ({
          productId: i.productId!,
          quantity: i.quantityProvidedKg,
        }));

      if (stockItems.length > 0) {
        const result = await createConsumptionOutput(tx, {
          organizationId: ctx.organizationId,
          items: stockItems,
          fieldOperationRef: `feeding-record:pending`,
          outputDate: new Date(input.feedingDate),
          responsibleName: input.responsibleName,
          notes: `Trato automático - ${lot.name} - ${input.feedingDate}`,
        });
        if (result) {
          stockOutputId = result.stockOutputId;
        }
      }
    }

    // Create feeding record
    const created = await (tx as any).feedingRecord.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        lotId: input.lotId,
        feedingDate: new Date(input.feedingDate),
        shift: input.shift,
        dietId: input.dietId ?? null,
        dietName,
        animalCount,
        totalProvidedKg,
        totalLeftoverKg: null,
        totalConsumedKg: null,
        leftoverPercent: null,
        leftoverAlert: false,
        consumptionPerAnimalKg: null,
        responsibleName: input.responsibleName.trim(),
        stockOutputId,
        notes: input.notes?.trim() || null,
        recordedBy: userId,
        items: {
          create: input.items.map((item) => ({
            feedIngredientId: item.feedIngredientId,
            feedIngredientName: item.feedIngredientName,
            productId: item.productId ?? null,
            quantityProvidedKg: item.quantityProvidedKg,
            quantityLeftoverKg: null,
            quantityConsumedKg: null,
          })),
        },
      },
      include: {
        lot: { select: { name: true } },
        recorder: { select: { name: true } },
        items: true,
      },
    });

    // Update stock output ref
    if (stockOutputId) {
      await (tx as any).stockOutput.update({
        where: { id: stockOutputId },
        data: { fieldOperationRef: `feeding-record:${created.id}` },
      });
    }

    return toResponse(created);
  });
}

// ─── RECORD LEFTOVERS (CA2, CA3) ────────────────────────────────────

export async function recordLeftovers(
  ctx: RlsContext,
  farmId: string,
  feedingId: string,
  input: RecordLeftoversInput,
): Promise<FeedingRecordResponse> {
  return withRlsContext(ctx, async (tx) => {
    const feeding = await (tx as any).feedingRecord.findFirst({
      where: { id: feedingId, farmId, organizationId: ctx.organizationId },
      include: { items: true },
    });
    if (!feeding) {
      throw new FeedingRecordError('Registro de trato não encontrado', 404);
    }

    // Update each item with leftovers
    for (const leftoverItem of input.items) {
      const item = feeding.items.find((i: any) => i.id === leftoverItem.feedingRecordItemId);
      if (!item) {
        throw new FeedingRecordError(
          `Item ${leftoverItem.feedingRecordItemId} não encontrado no registro`,
          404,
        );
      }
      if (leftoverItem.quantityLeftoverKg < 0) {
        throw new FeedingRecordError('Quantidade de sobra não pode ser negativa', 400);
      }
      const provided = toNumber(item.quantityProvidedKg);
      if (leftoverItem.quantityLeftoverKg > provided) {
        throw new FeedingRecordError(
          `Sobra de ${item.feedIngredientName} (${leftoverItem.quantityLeftoverKg}kg) excede o fornecido (${provided}kg)`,
          400,
        );
      }

      const consumed = provided - leftoverItem.quantityLeftoverKg;
      await (tx as any).feedingRecordItem.update({
        where: { id: leftoverItem.feedingRecordItemId },
        data: {
          quantityLeftoverKg: leftoverItem.quantityLeftoverKg,
          quantityConsumedKg: consumed,
        },
      });
    }

    // Recalculate totals
    const updatedItems = await (tx as any).feedingRecordItem.findMany({
      where: { feedingRecordId: feedingId },
    });

    const totalProvided = toNumber(feeding.totalProvidedKg);
    const totalLeftover =
      input.totalLeftoverKg ??
      updatedItems.reduce(
        (sum: number, i: any) =>
          sum + (i.quantityLeftoverKg != null ? toNumber(i.quantityLeftoverKg) : 0),
        0,
      );
    const totalConsumed = totalProvided - totalLeftover;
    const leftoverPercent = totalProvided > 0 ? (totalLeftover / totalProvided) * 100 : 0;
    const leftoverAlert = leftoverPercent > 10 || leftoverPercent === 0;
    const animalCount = toNumber(feeding.animalCount);
    const consumptionPerAnimal = animalCount > 0 ? totalConsumed / animalCount : null;

    const updated = await (tx as any).feedingRecord.update({
      where: { id: feedingId },
      data: {
        totalLeftoverKg: Math.round(totalLeftover * 1000) / 1000,
        totalConsumedKg: Math.round(totalConsumed * 1000) / 1000,
        leftoverPercent: Math.round(leftoverPercent * 100) / 100,
        leftoverAlert,
        consumptionPerAnimalKg: consumptionPerAnimal
          ? Math.round(consumptionPerAnimal * 1000) / 1000
          : null,
      },
      include: {
        lot: { select: { name: true } },
        recorder: { select: { name: true } },
        items: true,
      },
    });

    return toResponse(updated);
  });
}

// ─── LIST (CA1) ─────────────────────────────────────────────────────

export async function listFeedingRecords(
  ctx: RlsContext,
  farmId: string,
  query: ListFeedingRecordsQuery,
): Promise<{
  data: FeedingRecordListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: any = {
      farmId,
      organizationId: ctx.organizationId,
    };
    if (query.lotId) where.lotId = query.lotId;
    if (query.shift && FEEDING_SHIFTS.includes(query.shift as FeedingShiftValue)) {
      where.shift = query.shift;
    }
    if (query.dateFrom || query.dateTo) {
      where.feedingDate = {};
      if (query.dateFrom) where.feedingDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.feedingDate.lte = new Date(query.dateTo);
    }

    const [rows, total] = await Promise.all([
      (tx as any).feedingRecord.findMany({
        where,
        include: {
          lot: { select: { name: true } },
        },
        orderBy: [{ feedingDate: 'desc' }, { shift: 'asc' }],
        skip,
        take: limit,
      }),
      (tx as any).feedingRecord.count({ where }),
    ]);

    return {
      data: rows.map(toListItem),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getFeedingRecord(
  ctx: RlsContext,
  farmId: string,
  feedingId: string,
): Promise<FeedingRecordResponse> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).feedingRecord.findFirst({
      where: { id: feedingId, farmId, organizationId: ctx.organizationId },
      include: {
        lot: { select: { name: true } },
        recorder: { select: { name: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) {
      throw new FeedingRecordError('Registro de trato não encontrado', 404);
    }
    return toResponse(row);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateFeedingRecord(
  ctx: RlsContext,
  farmId: string,
  feedingId: string,
  input: UpdateFeedingRecordInput,
): Promise<FeedingRecordResponse> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).feedingRecord.findFirst({
      where: { id: feedingId, farmId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new FeedingRecordError('Registro de trato não encontrado', 404);
    }

    const data: any = {};
    if (input.responsibleName !== undefined) data.responsibleName = input.responsibleName.trim();
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    const updated = await (tx as any).feedingRecord.update({
      where: { id: feedingId },
      data,
      include: {
        lot: { select: { name: true } },
        recorder: { select: { name: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    });

    return toResponse(updated);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteFeedingRecord(
  ctx: RlsContext,
  farmId: string,
  feedingId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).feedingRecord.findFirst({
      where: { id: feedingId, farmId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new FeedingRecordError('Registro de trato não encontrado', 404);
    }

    // Cancel stock output if exists
    if (existing.stockOutputId) {
      await cancelConsumptionOutput(tx, ctx.organizationId, existing.stockOutputId);
    }

    await (tx as any).feedingRecord.delete({ where: { id: feedingId } });
  });
}

// ─── INDICATORS (CA7) ───────────────────────────────────────────────

export async function getConsumptionIndicators(
  ctx: RlsContext,
  farmId: string,
  query: IndicatorsQuery,
): Promise<ConsumptionIndicators> {
  const dateFrom =
    query.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dateTo = query.dateTo || new Date().toISOString().slice(0, 10);

  return withRlsContext(ctx, async (tx) => {
    const where: any = {
      farmId,
      organizationId: ctx.organizationId,
      feedingDate: {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      },
    };
    if (query.lotId) where.lotId = query.lotId;

    const records = await (tx as any).feedingRecord.findMany({
      where,
      include: {
        lot: { select: { name: true } },
        items: {
          include: {
            feedIngredient: { select: { refDmPercent: true, costPerKg: true } },
          },
        },
      },
      orderBy: { feedingDate: 'asc' },
    });

    // Consumption evolution
    const consumptionEvolution: ConsumptionIndicators['consumptionEvolution'] = [];
    let totalDmConsumed = 0;
    let totalAnimalDays = 0;
    let totalCostCents = 0;

    for (const r of records) {
      const dateStr = toDateStr(r.feedingDate);
      const consumed =
        r.totalConsumedKg != null ? toNumber(r.totalConsumedKg) : toNumber(r.totalProvidedKg);
      const count = toNumber(r.animalCount);
      const perAnimal = count > 0 ? consumed / count : 0;

      consumptionEvolution.push({
        date: dateStr,
        totalProvidedKg: toNumber(r.totalProvidedKg),
        totalConsumedKg: consumed,
        animalCount: count,
        consumptionPerAnimalKg: Math.round(perAnimal * 1000) / 1000,
      });

      // DM calculation
      for (const item of r.items) {
        const itemConsumed =
          item.quantityConsumedKg != null
            ? toNumber(item.quantityConsumedKg)
            : toNumber(item.quantityProvidedKg);
        const dmPercent = item.feedIngredient?.refDmPercent ?? 100;
        totalDmConsumed += itemConsumed * (dmPercent / 100);
        const costPerKg = item.feedIngredient?.costPerKg ?? 0;
        totalCostCents += itemConsumed * costPerKg * 100;
      }
      totalAnimalDays += count;
    }

    const avgDmPerAnimalDay =
      totalAnimalDays > 0 ? Math.round((totalDmConsumed / totalAnimalDays) * 1000) / 1000 : null;

    // Planned DM from diet
    let plannedDmPerAnimalDay: number | null = null;
    let lotName: string | null = null;
    if (query.lotId) {
      const assignment = await (tx as any).dietLotAssignment.findFirst({
        where: {
          lotId: query.lotId,
          OR: [{ endDate: null }, { endDate: { gte: new Date(dateFrom) } }],
        },
        include: { diet: { select: { totalDmKgDay: true, name: true } } },
        orderBy: { startDate: 'desc' },
      });
      if (assignment?.diet?.totalDmKgDay) {
        plannedDmPerAnimalDay = toNumber(assignment.diet.totalDmKgDay);
      }
      const lot = await (tx as any).animalLot.findUnique({
        where: { id: query.lotId },
        select: { name: true },
      });
      lotName = lot?.name ?? null;
    }

    const dmVariancePercent =
      avgDmPerAnimalDay != null && plannedDmPerAnimalDay != null && plannedDmPerAnimalDay > 0
        ? Math.round(
            ((avgDmPerAnimalDay - plannedDmPerAnimalDay) / plannedDmPerAnimalDay) * 10000,
          ) / 100
        : null;

    const costPerAnimalDay =
      totalAnimalDays > 0 ? Math.round(totalCostCents / totalAnimalDays) / 100 : null;

    // Cost per liter milk — check milking records
    let costPerLiterMilk: number | null = null;
    if (query.lotId) {
      try {
        const milkRecords = await (tx as any).milkingRecord.findMany({
          where: {
            farmId,
            animal: { lotId: query.lotId },
            milkingDate: {
              gte: new Date(dateFrom),
              lte: new Date(dateTo),
            },
          },
          select: { totalLiters: true },
        });
        const totalLiters = milkRecords.reduce(
          (sum: number, r: any) => sum + toNumber(r.totalLiters),
          0,
        );
        if (totalLiters > 0 && totalCostCents > 0) {
          costPerLiterMilk = Math.round(totalCostCents / totalLiters) / 100;
        }
      } catch {
        // milkingRecord may not exist — ignore
      }
    }

    return {
      period: { from: dateFrom, to: dateTo },
      lotId: query.lotId ?? null,
      lotName,
      averageDmPerAnimalDay: avgDmPerAnimalDay,
      plannedDmPerAnimalDay,
      dmVariancePercent,
      costPerAnimalDay,
      costPerLiterMilk,
      consumptionEvolution,
    };
  });
}

// ─── EXPORT CSV ─────────────────────────────────────────────────────

export async function exportFeedingsCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListFeedingRecordsQuery,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = {
      farmId,
      organizationId: ctx.organizationId,
    };
    if (query.lotId) where.lotId = query.lotId;
    if (query.shift && FEEDING_SHIFTS.includes(query.shift as FeedingShiftValue)) {
      where.shift = query.shift;
    }
    if (query.dateFrom || query.dateTo) {
      where.feedingDate = {};
      if (query.dateFrom) where.feedingDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.feedingDate.lte = new Date(query.dateTo);
    }

    const rows = await (tx as any).feedingRecord.findMany({
      where,
      include: {
        lot: { select: { name: true } },
        items: true,
      },
      orderBy: [{ feedingDate: 'desc' }, { shift: 'asc' }],
    });

    const header =
      'Data,Turno,Lote,Animais,Total Fornecido (kg),Total Sobra (kg),Total Consumido (kg),Sobra %,Alerta,Consumo/Animal (kg),Responsável';
    const lines = rows.map((r: any) => {
      const shift = FEEDING_SHIFT_LABELS[r.shift as FeedingShiftValue] ?? r.shift;
      const lotName = r.lot?.name ?? '';
      const leftoverPct = r.leftoverPercent != null ? toNumber(r.leftoverPercent).toFixed(1) : '';
      const alert = r.leftoverAlert ? 'Sim' : 'Não';
      const perAnimal =
        r.consumptionPerAnimalKg != null ? toNumber(r.consumptionPerAnimalKg).toFixed(2) : '';
      return [
        toDateStr(r.feedingDate),
        shift,
        `"${lotName}"`,
        toNumber(r.animalCount),
        toNumber(r.totalProvidedKg).toFixed(2),
        r.totalLeftoverKg != null ? toNumber(r.totalLeftoverKg).toFixed(2) : '',
        r.totalConsumedKg != null ? toNumber(r.totalConsumedKg).toFixed(2) : '',
        leftoverPct,
        alert,
        perAnimal,
        `"${r.responsibleName}"`,
      ].join(',');
    });

    return [header, ...lines].join('\n');
  });
}
