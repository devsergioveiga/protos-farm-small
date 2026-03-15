import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  MilkingRecordError,
  MILKING_SHIFT_LABELS,
  isValidMilkingShift,
  type CreateMilkingInput,
  type BulkMilkingInput,
  type UpdateMilkingInput,
  type ListMilkingsQuery,
  type MilkingRecordItem,
  type BulkMilkingResult,
  type DailyProductionSummary,
  type ProductionTrendItem,
  type LactatingAnimalItem,
  type MilkingShiftValue,
} from './milking-records.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Constants ──────────────────────────────────────────────────────

const VARIATION_THRESHOLD = 30; // percent

const MILKING_INCLUDE = {
  animal: { select: { earTag: true, name: true, category: true, lot: { select: { name: true } } } },
  recorder: { select: { name: true } },
};

// Lactating categories (not dry cows)
const LACTATING_CATEGORIES = ['VACA_LACTACAO', 'NOVILHA'];

// ─── Helpers ────────────────────────────────────────────────────────

function toMilkingRecordItem(row: any): MilkingRecordItem {
  const shift = row.shift as MilkingShiftValue;
  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    animalCategory: row.animal?.category ?? '',
    lotName: row.animal?.lot?.name ?? null,
    milkingDate: (row.milkingDate as Date).toISOString().slice(0, 10),
    shift,
    shiftLabel: MILKING_SHIFT_LABELS[shift] ?? shift,
    liters: row.liters,
    variationPercent: row.variationPercent ?? null,
    variationAlert: row.variationAlert ?? false,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function validateCreateInput(input: CreateMilkingInput): void {
  if (!input.animalId?.trim()) {
    throw new MilkingRecordError('Animal é obrigatório', 400);
  }
  if (!input.milkingDate) {
    throw new MilkingRecordError('Data da ordenha é obrigatória', 400);
  }
  const date = new Date(input.milkingDate);
  if (isNaN(date.getTime())) {
    throw new MilkingRecordError('Data da ordenha inválida', 400);
  }
  if (date > new Date()) {
    throw new MilkingRecordError('Data da ordenha não pode ser no futuro', 400);
  }
  if (!input.shift || !isValidMilkingShift(input.shift)) {
    throw new MilkingRecordError('Turno inválido. Use MORNING, AFTERNOON ou NIGHT', 400);
  }
  if (input.liters == null || input.liters < 0) {
    throw new MilkingRecordError('Litros produzidos deve ser maior ou igual a zero', 400);
  }
}

async function calcVariation(
  tx: any,
  animalId: string,
  milkingDate: Date,
  shift: MilkingShiftValue,
  liters: number,
): Promise<{ variationPercent: number | null; variationAlert: boolean }> {
  const previousDay = new Date(milkingDate);
  previousDay.setDate(previousDay.getDate() - 1);

  const previous = await tx.milkingRecord.findUnique({
    where: {
      animalId_milkingDate_shift: {
        animalId,
        milkingDate: previousDay,
        shift,
      },
    },
    select: { liters: true },
  });

  if (!previous || previous.liters === 0) {
    return { variationPercent: null, variationAlert: false };
  }

  const variationPercent =
    Math.round(((liters - previous.liters) / previous.liters) * 100 * 100) / 100;
  const variationAlert = Math.abs(variationPercent) > VARIATION_THRESHOLD;

  return { variationPercent, variationAlert };
}

async function validateAnimalForMilking(tx: any, animalId: string, farmId: string): Promise<any> {
  const animal = await tx.animal.findFirst({
    where: { id: animalId, farmId, deletedAt: null },
    select: { id: true, earTag: true, name: true, category: true, sex: true },
  });

  if (!animal) {
    throw new MilkingRecordError('Animal não encontrado', 404);
  }

  if (animal.category === 'VACA_SECA') {
    throw new MilkingRecordError(
      `Animal ${animal.earTag} está classificado como vaca seca e não pode ser ordenhado`,
      400,
    );
  }

  if (animal.sex === 'MALE') {
    throw new MilkingRecordError(`Animal ${animal.earTag} é macho e não pode ser ordenhado`, 400);
  }

  return animal;
}

// ─── CREATE (CA1) ───────────────────────────────────────────────────

export async function createMilking(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateMilkingInput,
): Promise<MilkingRecordItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    await validateAnimalForMilking(tx, input.animalId, farmId);

    const milkingDate = new Date(input.milkingDate);
    const { variationPercent, variationAlert } = await calcVariation(
      tx,
      input.animalId,
      milkingDate,
      input.shift,
      input.liters,
    );

    const row = await (tx as any).milkingRecord.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        milkingDate,
        shift: input.shift,
        liters: input.liters,
        variationPercent,
        variationAlert,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: MILKING_INCLUDE,
    });

    return toMilkingRecordItem(row);
  });
}

// ─── BULK CREATE (CA2) ──────────────────────────────────────────────

export async function bulkCreateMilkings(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: BulkMilkingInput,
): Promise<BulkMilkingResult> {
  if (!input.milkingDate) {
    throw new MilkingRecordError('Data da ordenha é obrigatória', 400);
  }
  const milkingDate = new Date(input.milkingDate);
  if (isNaN(milkingDate.getTime())) {
    throw new MilkingRecordError('Data da ordenha inválida', 400);
  }
  if (milkingDate > new Date()) {
    throw new MilkingRecordError('Data da ordenha não pode ser no futuro', 400);
  }
  if (!input.shift || !isValidMilkingShift(input.shift)) {
    throw new MilkingRecordError('Turno inválido. Use MORNING, AFTERNOON ou NIGHT', 400);
  }
  if (!input.entries || input.entries.length === 0) {
    throw new MilkingRecordError('Pelo menos uma entrada é obrigatória', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const alerts: BulkMilkingResult['alerts'] = [];
    const dataToCreate: any[] = [];

    for (const entry of input.entries) {
      if (entry.liters == null || entry.liters < 0) {
        throw new MilkingRecordError(`Litros inválidos para o animal ${entry.animalId}`, 400);
      }

      const animal = await validateAnimalForMilking(tx, entry.animalId, farmId);

      const { variationPercent, variationAlert } = await calcVariation(
        tx,
        entry.animalId,
        milkingDate,
        input.shift,
        entry.liters,
      );

      if (variationAlert && variationPercent != null) {
        // Get previous day liters for the alert
        const previousDay = new Date(milkingDate);
        previousDay.setDate(previousDay.getDate() - 1);
        const previous = await (tx as any).milkingRecord.findUnique({
          where: {
            animalId_milkingDate_shift: {
              animalId: entry.animalId,
              milkingDate: previousDay,
              shift: input.shift,
            },
          },
          select: { liters: true },
        });

        alerts.push({
          animalId: entry.animalId,
          animalEarTag: animal.earTag,
          liters: entry.liters,
          previousLiters: previous?.liters ?? 0,
          variationPercent,
        });
      }

      dataToCreate.push({
        organizationId: ctx.organizationId,
        farmId,
        animalId: entry.animalId,
        milkingDate,
        shift: input.shift,
        liters: entry.liters,
        variationPercent,
        variationAlert,
        notes: entry.notes ?? null,
        recordedBy: userId,
      });
    }

    await (tx as any).milkingRecord.createMany({ data: dataToCreate });

    return {
      created: dataToCreate.length,
      alerts,
    };
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listMilkings(
  ctx: RlsContext,
  farmId: string,
  query: ListMilkingsQuery,
): Promise<{ data: MilkingRecordItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.animalId) where.animalId = query.animalId;
    if (query.shift) where.shift = query.shift;
    if (query.variationAlert !== undefined) where.variationAlert = query.variationAlert;
    if (query.dateFrom || query.dateTo) {
      where.milkingDate = {};
      if (query.dateFrom) where.milkingDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.milkingDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).milkingRecord.findMany({
        where,
        include: MILKING_INCLUDE,
        orderBy: [{ milkingDate: 'desc' }, { shift: 'asc' }],
        skip,
        take: limit,
      }),
      (tx as any).milkingRecord.count({ where }),
    ]);

    return {
      data: rows.map(toMilkingRecordItem),
      total,
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getMilking(
  ctx: RlsContext,
  farmId: string,
  milkingId: string,
): Promise<MilkingRecordItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).milkingRecord.findFirst({
      where: { id: milkingId, farmId },
      include: MILKING_INCLUDE,
    });
    if (!row) {
      throw new MilkingRecordError('Registro de ordenha não encontrado', 404);
    }
    return toMilkingRecordItem(row);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateMilking(
  ctx: RlsContext,
  farmId: string,
  milkingId: string,
  input: UpdateMilkingInput,
): Promise<MilkingRecordItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).milkingRecord.findFirst({
      where: { id: milkingId, farmId },
    });
    if (!existing) {
      throw new MilkingRecordError('Registro de ordenha não encontrado', 404);
    }

    const data: any = {};

    if (input.liters !== undefined) {
      if (input.liters < 0) {
        throw new MilkingRecordError('Litros produzidos deve ser maior ou igual a zero', 400);
      }
      data.liters = input.liters;

      // Recalculate variation
      const { variationPercent, variationAlert } = await calcVariation(
        tx,
        existing.animalId,
        existing.milkingDate,
        existing.shift,
        input.liters,
      );
      data.variationPercent = variationPercent;
      data.variationAlert = variationAlert;
    }
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).milkingRecord.update({
      where: { id: milkingId },
      data,
      include: MILKING_INCLUDE,
    });

    return toMilkingRecordItem(row);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteMilking(
  ctx: RlsContext,
  farmId: string,
  milkingId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).milkingRecord.findFirst({
      where: { id: milkingId, farmId },
    });
    if (!existing) {
      throw new MilkingRecordError('Registro de ordenha não encontrado', 404);
    }

    await (tx as any).milkingRecord.delete({ where: { id: milkingId } });
  });
}

// ─── DAILY SUMMARY (CA3) ───────────────────────────────────────────

export async function getDailySummary(
  ctx: RlsContext,
  farmId: string,
  date?: string,
): Promise<DailyProductionSummary> {
  const targetDate = date ? new Date(date) : new Date();
  const dateOnly = new Date(targetDate.toISOString().slice(0, 10));

  return withRlsContext(ctx, async (tx) => {
    const records = await (tx as any).milkingRecord.findMany({
      where: { farmId, milkingDate: dateOnly },
      include: {
        animal: {
          select: {
            id: true,
            lot: { select: { id: true, name: true } },
          },
        },
      },
    });

    const totalLiters = records.reduce((sum: number, r: any) => sum + r.liters, 0);
    const uniqueAnimals = new Set(records.map((r: any) => r.animalId));
    const animalCount = uniqueAnimals.size;
    const avgPerAnimal = animalCount > 0 ? Math.round((totalLiters / animalCount) * 100) / 100 : 0;

    // By shift
    const shiftMap = new Map<string, { totalLiters: number; animals: Set<string> }>();
    for (const r of records) {
      const entry = shiftMap.get(r.shift) ?? { totalLiters: 0, animals: new Set<string>() };
      entry.totalLiters += r.liters;
      entry.animals.add(r.animalId);
      shiftMap.set(r.shift, entry);
    }

    const byShift = Array.from(shiftMap.entries()).map(([shift, data]) => ({
      shift: shift as MilkingShiftValue,
      shiftLabel: MILKING_SHIFT_LABELS[shift as MilkingShiftValue] ?? shift,
      totalLiters: Math.round(data.totalLiters * 100) / 100,
      animalCount: data.animals.size,
    }));

    // By lot
    const lotMap = new Map<
      string | null,
      { name: string; totalLiters: number; animals: Set<string> }
    >();
    for (const r of records) {
      const lotId = r.animal?.lot?.id ?? null;
      const lotName = r.animal?.lot?.name ?? 'Sem lote';
      const entry = lotMap.get(lotId) ?? {
        name: lotName,
        totalLiters: 0,
        animals: new Set<string>(),
      };
      entry.totalLiters += r.liters;
      entry.animals.add(r.animalId);
      lotMap.set(lotId, entry);
    }

    const byLot = Array.from(lotMap.entries()).map(([lotId, data]) => ({
      lotId,
      lotName: data.name,
      totalLiters: Math.round(data.totalLiters * 100) / 100,
      animalCount: data.animals.size,
    }));

    return {
      date: dateOnly.toISOString().slice(0, 10),
      totalLiters: Math.round(totalLiters * 100) / 100,
      avgPerAnimal,
      animalCount,
      byShift,
      byLot,
    };
  });
}

// ─── LACTATING ANIMALS (CA7) ────────────────────────────────────────

export async function getLactatingAnimals(
  ctx: RlsContext,
  farmId: string,
): Promise<LactatingAnimalItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const animals = await (tx as any).animal.findMany({
      where: {
        farmId,
        deletedAt: null,
        sex: 'FEMALE',
        category: { in: LACTATING_CATEGORIES },
      },
      select: {
        id: true,
        earTag: true,
        name: true,
        category: true,
        lotId: true,
        lot: { select: { name: true } },
        milkingRecords: {
          orderBy: { milkingDate: 'desc' },
          take: 1,
          select: { milkingDate: true, liters: true },
        },
      },
      orderBy: { earTag: 'asc' },
    });

    return animals.map((a: any) => ({
      id: a.id,
      earTag: a.earTag,
      name: a.name ?? null,
      category: a.category,
      lotId: a.lotId ?? null,
      lotName: a.lot?.name ?? null,
      lastMilkingDate:
        a.milkingRecords.length > 0
          ? (a.milkingRecords[0].milkingDate as Date).toISOString().slice(0, 10)
          : null,
      lastMilkingLiters: a.milkingRecords.length > 0 ? a.milkingRecords[0].liters : null,
    }));
  });
}

// ─── PRODUCTION TREND ───────────────────────────────────────────────

export async function getProductionTrend(
  ctx: RlsContext,
  farmId: string,
  days?: number,
): Promise<ProductionTrendItem[]> {
  const numDays = days ?? 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - numDays);
  const startDateOnly = new Date(startDate.toISOString().slice(0, 10));

  return withRlsContext(ctx, async (tx) => {
    const records = await (tx as any).milkingRecord.findMany({
      where: {
        farmId,
        milkingDate: { gte: startDateOnly },
      },
      select: {
        milkingDate: true,
        liters: true,
        animalId: true,
      },
      orderBy: { milkingDate: 'asc' },
    });

    // Group by date
    const dateMap = new Map<string, { totalLiters: number; animals: Set<string> }>();
    for (const r of records) {
      const dateKey = (r.milkingDate as Date).toISOString().slice(0, 10);
      const entry = dateMap.get(dateKey) ?? { totalLiters: 0, animals: new Set<string>() };
      entry.totalLiters += r.liters;
      entry.animals.add(r.animalId);
      dateMap.set(dateKey, entry);
    }

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        totalLiters: Math.round(data.totalLiters * 100) / 100,
        animalCount: data.animals.size,
        avgPerAnimal:
          data.animals.size > 0
            ? Math.round((data.totalLiters / data.animals.size) * 100) / 100
            : 0,
      }));
  });
}

// ─── EXPORT CSV ─────────────────────────────────────────────────────

export async function exportMilkingsCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListMilkingsQuery,
): Promise<string> {
  const where: any = { farmId };

  if (query.animalId) where.animalId = query.animalId;
  if (query.shift) where.shift = query.shift;
  if (query.dateFrom || query.dateTo) {
    where.milkingDate = {};
    if (query.dateFrom) where.milkingDate.gte = new Date(query.dateFrom);
    if (query.dateTo) where.milkingDate.lte = new Date(query.dateTo);
  }

  const rows = await withRlsContext(ctx, async (tx) => {
    return (tx as any).milkingRecord.findMany({
      where,
      include: {
        animal: {
          select: {
            earTag: true,
            name: true,
            category: true,
            lot: { select: { name: true } },
          },
        },
        recorder: { select: { name: true } },
      },
      orderBy: [{ milkingDate: 'desc' }, { shift: 'asc' }],
    });
  });

  const BOM = '\uFEFF';
  const lines: string[] = [];

  lines.push('RELATÓRIO DE ORDENHA');
  lines.push(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`);
  lines.push('');
  lines.push('Data;Turno;Brinco;Nome;Categoria;Lote;Litros;Variação %;Alerta;Notas;Registrado por');

  for (const r of rows) {
    const shift = r.shift as MilkingShiftValue;
    lines.push(
      [
        (r.milkingDate as Date).toLocaleDateString('pt-BR'),
        MILKING_SHIFT_LABELS[shift] ?? shift,
        r.animal?.earTag ?? '',
        r.animal?.name ?? '',
        r.animal?.category ?? '',
        r.animal?.lot?.name ?? '',
        r.liters.toString().replace('.', ','),
        r.variationPercent != null ? r.variationPercent.toString().replace('.', ',') : '',
        r.variationAlert ? 'SIM' : '',
        r.notes ?? '',
        r.recorder?.name ?? '',
      ].join(';'),
    );
  }

  return BOM + lines.join('\n');
}
