import { withRlsContext, type RlsContext } from '../../database/rls';
import { ANIMAL_CATEGORIES } from './animals.types';
import {
  AnimalLotError,
  LOT_LOCATION_TYPES,
  type CreateLotInput,
  type UpdateLotInput,
  type MoveAnimalsInput,
  type RemoveAnimalsFromLotInput,
  type ListLotsQuery,
  type LotDashboard,
  type LotCompositionHistoryEntry,
} from './animal-lots.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateCategory(category: string): void {
  if (!(ANIMAL_CATEGORIES as readonly string[]).includes(category)) {
    throw new AnimalLotError(`Categoria inválida: ${category}`, 400);
  }
}

function validateLocationType(locationType: string): void {
  if (!(LOT_LOCATION_TYPES as readonly string[]).includes(locationType)) {
    throw new AnimalLotError(`Tipo de local inválido: ${locationType}`, 400);
  }
}

// ─── CRUD ───────────────────────────────────────────────────────────

export async function createLot(ctx: RlsContext, farmId: string, input: CreateLotInput) {
  validateCategory(input.predominantCategory);
  validateLocationType(input.locationType);

  if (!input.name?.trim()) {
    throw new AnimalLotError('Nome do lote é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Check farm exists
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
    });
    if (!farm) {
      throw new AnimalLotError('Fazenda não encontrada', 404);
    }

    // Check unique name
    const existing = await tx.animalLot.findFirst({
      where: { farmId, name: input.name.trim(), deletedAt: null },
    });
    if (existing) {
      throw new AnimalLotError(`Lote '${input.name.trim()}' já existe nesta fazenda`, 422);
    }

    return tx.animalLot.create({
      data: {
        farmId,
        name: input.name.trim(),
        predominantCategory: input.predominantCategory as never,
        currentLocation: input.currentLocation.trim(),
        locationType: input.locationType as never,
        maxCapacity: input.maxCapacity ?? null,
        description: input.description ?? null,
        notes: input.notes ?? null,
      },
      include: {
        _count: { select: { animals: { where: { deletedAt: null } } } },
      },
    });
  });
}

export async function listLots(ctx: RlsContext, farmId: string, query: ListLotsQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId, deletedAt: null };

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.category) {
      where.predominantCategory = query.category;
    }
    if (query.locationType) {
      where.locationType = query.locationType;
    }

    const [data, total] = await Promise.all([
      tx.animalLot.findMany({
        where: where as never,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { animals: { where: { deletedAt: null } } } },
        },
      }),
      tx.animalLot.count({ where: where as never }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

export async function getLot(ctx: RlsContext, farmId: string, lotId: string) {
  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.animalLot.findFirst({
      where: { id: lotId, farmId, deletedAt: null },
      include: {
        _count: { select: { animals: { where: { deletedAt: null } } } },
      },
    });
    if (!lot) {
      throw new AnimalLotError('Lote não encontrado', 404);
    }
    return lot;
  });
}

export async function updateLot(
  ctx: RlsContext,
  farmId: string,
  lotId: string,
  input: UpdateLotInput,
) {
  if (input.predominantCategory) validateCategory(input.predominantCategory);
  if (input.locationType) validateLocationType(input.locationType);

  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.animalLot.findFirst({
      where: { id: lotId, farmId, deletedAt: null },
    });
    if (!lot) {
      throw new AnimalLotError('Lote não encontrado', 404);
    }

    // Check unique name if changing
    if (input.name && input.name.trim() !== lot.name) {
      const existing = await tx.animalLot.findFirst({
        where: { farmId, name: input.name.trim(), deletedAt: null, id: { not: lotId } },
      });
      if (existing) {
        throw new AnimalLotError(`Lote '${input.name.trim()}' já existe nesta fazenda`, 422);
      }
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.predominantCategory !== undefined)
      data.predominantCategory = input.predominantCategory;
    if (input.currentLocation !== undefined) data.currentLocation = input.currentLocation.trim();
    if (input.locationType !== undefined) data.locationType = input.locationType;
    if (input.maxCapacity !== undefined) data.maxCapacity = input.maxCapacity;
    if (input.description !== undefined) data.description = input.description;
    if (input.notes !== undefined) data.notes = input.notes;

    return tx.animalLot.update({
      where: { id: lotId },
      data: data as never,
      include: {
        _count: { select: { animals: { where: { deletedAt: null } } } },
      },
    });
  });
}

export async function softDeleteLot(ctx: RlsContext, farmId: string, lotId: string) {
  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.animalLot.findFirst({
      where: { id: lotId, farmId, deletedAt: null },
    });
    if (!lot) {
      throw new AnimalLotError('Lote não encontrado', 404);
    }

    // Remove lotId from all animals in this lot
    await tx.animal.updateMany({
      where: { lotId, deletedAt: null },
      data: { lotId: null },
    });

    // Close open movements
    await tx.animalLotMovement.updateMany({
      where: { lotId, exitedAt: null },
      data: { exitedAt: new Date() },
    });

    return tx.animalLot.update({
      where: { id: lotId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── Movement Operations ────────────────────────────────────────────

export async function moveAnimalsToLot(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  lotId: string,
  input: MoveAnimalsInput,
) {
  if (!input.animalIds || input.animalIds.length === 0) {
    throw new AnimalLotError('Selecione ao menos um animal', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.animalLot.findFirst({
      where: { id: lotId, farmId, deletedAt: null },
    });
    if (!lot) {
      throw new AnimalLotError('Lote não encontrado', 404);
    }

    // Validate animals exist and belong to this farm
    const animals = await tx.animal.findMany({
      where: { id: { in: input.animalIds }, farmId, deletedAt: null },
    });
    if (animals.length !== input.animalIds.length) {
      throw new AnimalLotError('Um ou mais animais não encontrados nesta fazenda', 404);
    }

    const now = new Date();

    for (const animal of animals) {
      // Close previous movement if exists
      if (animal.lotId) {
        await tx.animalLotMovement.updateMany({
          where: { animalId: animal.id, exitedAt: null },
          data: { exitedAt: now },
        });
      }

      // Create new movement
      await tx.animalLotMovement.create({
        data: {
          animalId: animal.id,
          lotId,
          previousLotId: animal.lotId ?? null,
          enteredAt: now,
          movedBy: userId,
          reason: input.reason ?? null,
        },
      });

      // Update animal's lotId
      await tx.animal.update({
        where: { id: animal.id },
        data: { lotId },
      });
    }

    // Check capacity warning
    const currentCount = await tx.animal.count({
      where: { lotId, deletedAt: null },
    });

    const warning =
      lot.maxCapacity && currentCount > lot.maxCapacity
        ? `Capacidade excedida: ${currentCount}/${lot.maxCapacity} animais`
        : null;

    return { moved: animals.length, warning };
  });
}

export async function removeAnimalsFromLot(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  lotId: string,
  input: RemoveAnimalsFromLotInput,
) {
  if (!input.animalIds || input.animalIds.length === 0) {
    throw new AnimalLotError('Selecione ao menos um animal', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.animalLot.findFirst({
      where: { id: lotId, farmId, deletedAt: null },
    });
    if (!lot) {
      throw new AnimalLotError('Lote não encontrado', 404);
    }

    const animals = await tx.animal.findMany({
      where: { id: { in: input.animalIds }, farmId, lotId, deletedAt: null },
    });
    if (animals.length === 0) {
      throw new AnimalLotError('Nenhum dos animais informados está neste lote', 422);
    }

    const now = new Date();

    for (const animal of animals) {
      // Close movement
      await tx.animalLotMovement.updateMany({
        where: { animalId: animal.id, lotId, exitedAt: null },
        data: { exitedAt: now },
      });

      // Remove from lot
      await tx.animal.update({
        where: { id: animal.id },
        data: { lotId: null },
      });
    }

    void userId; // Used for audit log at route level

    return { removed: animals.length };
  });
}

// ─── Dashboard ──────────────────────────────────────────────────────

export async function getLotDashboard(
  ctx: RlsContext,
  farmId: string,
  lotId: string,
): Promise<LotDashboard> {
  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.animalLot.findFirst({
      where: { id: lotId, farmId, deletedAt: null },
    });
    if (!lot) {
      throw new AnimalLotError('Lote não encontrado', 404);
    }

    const animals = await tx.animal.findMany({
      where: { lotId, deletedAt: null },
      select: { entryWeightKg: true, id: true },
    });

    const animalCount = animals.length;

    // Average weight
    const weights = animals
      .map((a) => (a.entryWeightKg ? Number(a.entryWeightKg) : null))
      .filter((w): w is number => w !== null);
    const avgWeightKg =
      weights.length > 0
        ? Math.round((weights.reduce((s, w) => s + w, 0) / weights.length) * 100) / 100
        : null;

    // Average days in lot
    const openMovements = await tx.animalLotMovement.findMany({
      where: { lotId, exitedAt: null },
      select: { enteredAt: true },
    });

    let avgDaysInLot: number | null = null;
    if (openMovements.length > 0) {
      const now = Date.now();
      const totalDays = openMovements.reduce((sum, m) => {
        return sum + (now - new Date(m.enteredAt).getTime()) / (1000 * 60 * 60 * 24);
      }, 0);
      avgDaysInLot = Math.round(totalDays / openMovements.length);
    }

    const capacityPercent = lot.maxCapacity
      ? Math.round((animalCount / lot.maxCapacity) * 100)
      : null;

    return {
      animalCount,
      maxCapacity: lot.maxCapacity,
      capacityPercent,
      isOverCapacity: lot.maxCapacity ? animalCount > lot.maxCapacity : false,
      avgWeightKg,
      avgProductionLDay: null, // No production table yet
      avgDaysInLot,
    };
  });
}

// ─── Composition History ────────────────────────────────────────────

export async function getLotCompositionHistory(
  ctx: RlsContext,
  farmId: string,
  lotId: string,
): Promise<LotCompositionHistoryEntry[]> {
  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.animalLot.findFirst({
      where: { id: lotId, farmId, deletedAt: null },
    });
    if (!lot) {
      throw new AnimalLotError('Lote não encontrado', 404);
    }

    // Get all movements for this lot, ordered by date
    const movements = await tx.animalLotMovement.findMany({
      where: { lotId },
      orderBy: { enteredAt: 'asc' },
      include: {
        animal: { select: { category: true } },
      },
    });

    if (movements.length === 0) {
      return [];
    }

    // Build monthly snapshots
    const monthlyMap = new Map<string, { entered: string[]; exited: string[] }>();

    for (const m of movements) {
      const enteredMonth = new Date(m.enteredAt).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyMap.has(enteredMonth)) {
        monthlyMap.set(enteredMonth, { entered: [], exited: [] });
      }
      monthlyMap.get(enteredMonth)!.entered.push(m.animal.category);

      if (m.exitedAt) {
        const exitedMonth = new Date(m.exitedAt).toISOString().slice(0, 7);
        if (!monthlyMap.has(exitedMonth)) {
          monthlyMap.set(exitedMonth, { entered: [], exited: [] });
        }
        monthlyMap.get(exitedMonth)!.exited.push(m.animal.category);
      }
    }

    // Build cumulative history
    const sortedMonths = [...monthlyMap.keys()].sort();
    const history: LotCompositionHistoryEntry[] = [];
    const runningCategories: Record<string, number> = {};
    let runningCount = 0;

    for (const month of sortedMonths) {
      const data = monthlyMap.get(month)!;

      for (const cat of data.entered) {
        runningCategories[cat] = (runningCategories[cat] ?? 0) + 1;
        runningCount++;
      }
      for (const cat of data.exited) {
        runningCategories[cat] = Math.max(0, (runningCategories[cat] ?? 0) - 1);
        runningCount = Math.max(0, runningCount - 1);
      }

      history.push({
        date: month,
        animalCount: runningCount,
        categories: { ...runningCategories },
      });
    }

    return history;
  });
}

// ─── Capacity Alerts ────────────────────────────────────────────────

export async function getLotsWithCapacityAlerts(ctx: RlsContext, farmId: string) {
  return withRlsContext(ctx, async (tx) => {
    const lots = await tx.animalLot.findMany({
      where: {
        farmId,
        deletedAt: null,
        maxCapacity: { not: null },
      },
      include: {
        _count: { select: { animals: { where: { deletedAt: null } } } },
      },
    });

    return lots
      .filter((lot) => lot._count.animals > (lot.maxCapacity ?? Infinity))
      .map((lot) => ({
        id: lot.id,
        name: lot.name,
        currentCount: lot._count.animals,
        maxCapacity: lot.maxCapacity,
        overBy: lot._count.animals - (lot.maxCapacity ?? 0),
      }));
  });
}
