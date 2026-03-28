import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  WeaningError,
  type CreateWeaningInput,
  type BulkWeaningInput,
  type WeaningConfigInput,
  type ListWeaningsQuery,
  type WeaningItem,
  type WeaningConfigItem,
  type UnweanedAnimalItem,
  type BulkWeaningResultItem,
} from './weaning.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

const WEANING_INCLUDE = {
  calf: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
};

function toWeaningItem(row: any): WeaningItem {
  return {
    id: row.id,
    farmId: row.farmId,
    calfId: row.calfId,
    calfEarTag: row.calf?.earTag ?? '',
    calfName: row.calf?.name ?? null,
    weaningDate: (row.weaningDate as Date).toISOString().slice(0, 10),
    weightKg: row.weightKg ?? null,
    targetLotId: row.targetLotId ?? null,
    observations: row.observations ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── WEANING CONFIG ─────────────────────────────────────────────────

export async function getWeaningConfig(ctx: RlsContext): Promise<WeaningConfigItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).weaningCriteria.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    return {
      weaningDaysMale: row?.weaningDaysMale ?? null,
      weaningDaysFemale: row?.weaningDaysFemale ?? null,
      minWeightKgMale: row?.minWeightKgMale ?? null,
      minWeightKgFemale: row?.minWeightKgFemale ?? null,
    };
  });
}

export async function setWeaningConfig(
  ctx: RlsContext,
  input: WeaningConfigInput,
): Promise<WeaningConfigItem> {
  if (
    input.weaningDaysMale !== undefined &&
    input.weaningDaysMale !== null &&
    input.weaningDaysMale < 1
  ) {
    throw new WeaningError('Dias para desmame (macho) deve ser pelo menos 1', 400);
  }
  if (
    input.weaningDaysFemale !== undefined &&
    input.weaningDaysFemale !== null &&
    input.weaningDaysFemale < 1
  ) {
    throw new WeaningError('Dias para desmame (fêmea) deve ser pelo menos 1', 400);
  }
  if (
    input.minWeightKgMale !== undefined &&
    input.minWeightKgMale !== null &&
    input.minWeightKgMale <= 0
  ) {
    throw new WeaningError('Peso mínimo (macho) deve ser maior que 0', 400);
  }
  if (
    input.minWeightKgFemale !== undefined &&
    input.minWeightKgFemale !== null &&
    input.minWeightKgFemale <= 0
  ) {
    throw new WeaningError('Peso mínimo (fêmea) deve ser maior que 0', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const data = {
      weaningDaysMale: input.weaningDaysMale ?? null,
      weaningDaysFemale: input.weaningDaysFemale ?? null,
      minWeightKgMale: input.minWeightKgMale ?? null,
      minWeightKgFemale: input.minWeightKgFemale ?? null,
    };

    const row = await (tx as any).weaningCriteria.upsert({
      where: { organizationId: ctx.organizationId },
      create: { organizationId: ctx.organizationId, ...data },
      update: data,
    });

    return {
      weaningDaysMale: row.weaningDaysMale ?? null,
      weaningDaysFemale: row.weaningDaysFemale ?? null,
      minWeightKgMale: row.minWeightKgMale ?? null,
      minWeightKgFemale: row.minWeightKgFemale ?? null,
    };
  });
}

// ─── UNWEANED ANIMALS ───────────────────────────────────────────────

export async function getUnweanedAnimals(
  ctx: RlsContext,
  farmId: string,
): Promise<UnweanedAnimalItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const config = await (tx as any).weaningCriteria.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    // Get all BEZERRO/BEZERRA without weaning record
    const calves = await (tx as any).animal.findMany({
      where: {
        farmId,
        category: { in: ['BEZERRO', 'BEZERRA'] },
        deletedAt: null,
        weaningRecords: { none: {} },
      },
      select: {
        id: true,
        earTag: true,
        name: true,
        sex: true,
        category: true,
        birthDate: true,
        entryWeightKg: true,
        lotId: true,
        lot: { select: { name: true } },
      },
      orderBy: { birthDate: 'asc' },
    });

    // Get latest weighings for these calves
    const calfIds = calves.map((c: any) => c.id);
    const latestWeighings =
      calfIds.length > 0
        ? await (tx as any).animalWeighing.findMany({
            where: { animalId: { in: calfIds } },
            orderBy: { measuredAt: 'desc' },
            distinct: ['animalId'],
            select: { animalId: true, weightKg: true, measuredAt: true },
          })
        : [];
    const weightMap = new Map<string, { weightKg: number; date: string }>();
    for (const w of latestWeighings) {
      weightMap.set(w.animalId, {
        weightKg: Number(w.weightKg),
        date: (w.measuredAt as Date).toISOString().slice(0, 10),
      });
    }

    const now = new Date();

    return calves.map((calf: any): UnweanedAnimalItem => {
      const birthDate = calf.birthDate as Date | null;
      const ageDays = birthDate ? diffDays(now, birthDate) : null;

      const isMale = calf.sex === 'MALE';
      const weaningDays = isMale ? config?.weaningDaysMale : config?.weaningDaysFemale;

      const expectedWeaningDate =
        birthDate && weaningDays
          ? addDays(birthDate, weaningDays).toISOString().slice(0, 10)
          : null;

      const isOverdue = expectedWeaningDate ? new Date(expectedWeaningDate) <= now : false;

      const weighing = weightMap.get(calf.id);
      const lastWeightKg =
        weighing?.weightKg ?? (calf.entryWeightKg ? Number(calf.entryWeightKg) : null);
      const lastWeighingDate = weighing?.date ?? null;

      return {
        id: calf.id,
        earTag: calf.earTag,
        name: calf.name ?? null,
        sex: calf.sex,
        category: calf.category,
        birthDate: birthDate ? birthDate.toISOString().slice(0, 10) : null,
        ageDays,
        expectedWeaningDate,
        isOverdue,
        lastWeightKg,
        lastWeighingDate,
        lotId: calf.lotId ?? null,
        lotName: calf.lot?.name ?? null,
      };
    });
  });
}

// ─── CREATE WEANING ─────────────────────────────────────────────────

export async function createWeaning(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateWeaningInput,
): Promise<WeaningItem> {
  if (!input.calfId) {
    throw new WeaningError('Bezerro é obrigatório', 400);
  }
  if (!input.weaningDate) {
    throw new WeaningError('Data de desmame é obrigatória', 400);
  }
  const wDate = new Date(input.weaningDate);
  if (isNaN(wDate.getTime())) {
    throw new WeaningError('Data de desmame inválida', 400);
  }
  if (input.weightKg !== undefined && input.weightKg !== null && input.weightKg <= 0) {
    throw new WeaningError('Peso deve ser maior que 0', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate calf
    const calf = await (tx as any).animal.findFirst({
      where: { id: input.calfId, farmId, deletedAt: null },
      select: { id: true, earTag: true, lotId: true },
    });
    if (!calf) {
      throw new WeaningError('Bezerro não encontrado', 404);
    }

    // Check for existing weaning
    const existingWeaning = await (tx as any).weaningRecord.findFirst({
      where: { calfId: input.calfId, farmId },
    });
    if (existingWeaning) {
      throw new WeaningError(`Bezerro ${calf.earTag} já possui registro de desmame`, 409);
    }

    // Move to target lot if configured
    const targetLotId = input.targetLotId ?? null;
    if (targetLotId) {
      const lot = await (tx as any).animalLot.findFirst({
        where: { id: targetLotId, farmId, deletedAt: null },
      });
      if (!lot) {
        throw new WeaningError('Lote de destino não encontrado', 404);
      }

      if (calf.lotId) {
        await (tx as any).animalLotMovement.updateMany({
          where: { animalId: input.calfId, lotId: calf.lotId, exitedAt: null },
          data: { exitedAt: new Date() },
        });
      }

      await (tx as any).animalLotMovement.create({
        data: {
          animalId: input.calfId,
          lotId: targetLotId,
          previousLotId: calf.lotId ?? null,
          movedBy: userId,
          reason: 'Desmame — movimentação automática',
        },
      });

      await (tx as any).animal.update({
        where: { id: input.calfId },
        data: { lotId: targetLotId },
      });
    }

    const row = await (tx as any).weaningRecord.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        calfId: input.calfId,
        weaningDate: wDate,
        weightKg: input.weightKg ?? null,
        targetLotId,
        observations: input.observations?.trim() ?? null,
        recordedBy: userId,
      },
      include: WEANING_INCLUDE,
    });

    return toWeaningItem(row);
  });
}

// ─── BULK WEANING ───────────────────────────────────────────────────

export async function createBulkWeaning(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: BulkWeaningInput,
): Promise<BulkWeaningResultItem[]> {
  if (!input.weaningDate) {
    throw new WeaningError('Data de desmame é obrigatória', 400);
  }
  const wDate = new Date(input.weaningDate);
  if (isNaN(wDate.getTime())) {
    throw new WeaningError('Data de desmame inválida', 400);
  }
  if (!input.animals || input.animals.length === 0) {
    throw new WeaningError('Selecione pelo menos um animal', 400);
  }

  // Load config for weight warnings
  const config = await withRlsContext(ctx, async (tx) => {
    return (tx as any).weaningCriteria.findUnique({
      where: { organizationId: ctx.organizationId },
    });
  });

  const results: BulkWeaningResultItem[] = [];

  for (const animal of input.animals) {
    try {
      const item = await createWeaning(ctx, farmId, userId, {
        calfId: animal.calfId,
        weaningDate: input.weaningDate,
        weightKg: animal.weightKg,
        targetLotId: input.targetLotId,
        observations: animal.observations,
      });

      // Check weight warning
      let weightWarning: string | null = null;
      if (animal.weightKg != null && config) {
        // Get animal sex to check correct threshold
        const calfData = await withRlsContext(ctx, async (tx) => {
          return (tx as any).animal.findFirst({
            where: { id: animal.calfId },
            select: { sex: true },
          });
        });
        const isMale = calfData?.sex === 'MALE';
        const minWeight = isMale ? config.minWeightKgMale : config.minWeightKgFemale;
        if (minWeight != null && animal.weightKg < minWeight) {
          weightWarning = `Peso ${animal.weightKg} kg abaixo do mínimo configurado (${minWeight} kg)`;
        }
      }

      results.push({
        calfId: animal.calfId,
        calfEarTag: item.calfEarTag,
        status: 'created',
        weaningId: item.id,
        weightWarning,
      });
    } catch (err: unknown) {
      const message = err instanceof WeaningError ? err.message : 'Erro interno';
      // Get earTag for error reporting
      const calfData = await withRlsContext(ctx, async (tx) => {
        return (tx as any).animal.findFirst({
          where: { id: animal.calfId },
          select: { earTag: true },
        });
      });
      results.push({
        calfId: animal.calfId,
        calfEarTag: calfData?.earTag ?? animal.calfId,
        status: 'error',
        error: message,
      });
    }
  }

  return results;
}

// ─── LIST WEANINGS ──────────────────────────────────────────────────

export async function listWeanings(
  ctx: RlsContext,
  farmId: string,
  query: ListWeaningsQuery,
): Promise<{ data: WeaningItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.calfId) where.calfId = query.calfId;
    if (query.dateFrom || query.dateTo) {
      where.weaningDate = {};
      if (query.dateFrom) where.weaningDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.weaningDate.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.calf = {
        OR: [
          { earTag: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).weaningRecord.findMany({
        where,
        include: WEANING_INCLUDE,
        orderBy: { weaningDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).weaningRecord.count({ where }),
    ]);

    return {
      data: rows.map(toWeaningItem),
      total,
    };
  });
}

// ─── GET WEANING ────────────────────────────────────────────────────

export async function getWeaning(
  ctx: RlsContext,
  farmId: string,
  weaningId: string,
): Promise<WeaningItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).weaningRecord.findFirst({
      where: { id: weaningId, farmId },
      include: WEANING_INCLUDE,
    });
    if (!row) {
      throw new WeaningError('Registro de desmame não encontrado', 404);
    }
    return toWeaningItem(row);
  });
}

// ─── DELETE WEANING ─────────────────────────────────────────────────

export async function deleteWeaning(
  ctx: RlsContext,
  farmId: string,
  weaningId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).weaningRecord.findFirst({
      where: { id: weaningId, farmId },
    });
    if (!existing) {
      throw new WeaningError('Registro de desmame não encontrado', 404);
    }
    await (tx as any).weaningRecord.delete({ where: { id: weaningId } });
  });
}
