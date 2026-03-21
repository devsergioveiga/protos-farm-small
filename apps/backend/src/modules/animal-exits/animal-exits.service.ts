import type { RlsContext } from '../../database/rls';
import { withRlsContext } from '../../database/rls';
import {
  AnimalExitError,
  EXIT_TYPE_LABELS,
  DEATH_TYPE_LABELS,
  isValidExitType,
  isValidDeathType,
} from './animal-exits.types';
import type {
  CreateAnimalExitInput,
  BulkAnimalExitInput,
  ListAnimalExitsQuery,
  AnimalExitItem,
  BulkAnimalExitResult,
  ExitTypeValue,
  DeathTypeValue,
} from './animal-exits.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toAnimalExitItem(row: any): AnimalExitItem {
  const exitType = row.exitType as ExitTypeValue;
  const deathType = row.deathType as DeathTypeValue | null;
  return {
    id: row.id,
    animalId: row.animalId,
    farmId: row.farmId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    exitType,
    exitTypeLabel: EXIT_TYPE_LABELS[exitType],
    exitDate: row.exitDate instanceof Date ? row.exitDate.toISOString().slice(0, 10) : row.exitDate,
    deathType,
    deathTypeLabel: deathType ? (DEATH_TYPE_LABELS[deathType] ?? deathType) : null,
    deathCause: row.deathCause ?? null,
    buyerName: row.buyerName ?? null,
    salePriceTotal: row.salePriceTotal != null ? Number(row.salePriceTotal) : null,
    salePricePerKg: row.salePricePerKg != null ? Number(row.salePricePerKg) : null,
    saleWeightKg: row.saleWeightKg != null ? Number(row.saleWeightKg) : null,
    gtaNumber: row.gtaNumber ?? null,
    destinationFarm: row.destinationFarm ?? null,
    notes: row.notes ?? null,
    createdBy: row.createdBy,
    creatorName: row.creator?.name ?? '',
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

function validateInput(input: CreateAnimalExitInput): void {
  if (!input.exitType || !isValidExitType(input.exitType)) {
    throw new AnimalExitError('Tipo de saída inválido', 400);
  }
  if (!input.exitDate) {
    throw new AnimalExitError('Data de saída é obrigatória', 400);
  }

  if (input.exitType === 'MORTE') {
    if (!input.deathType) {
      throw new AnimalExitError('Tipo de morte é obrigatório para saída por morte', 400);
    }
    if (!isValidDeathType(input.deathType)) {
      throw new AnimalExitError('Tipo de morte inválido', 400);
    }
    if (!input.deathCause) {
      throw new AnimalExitError('Causa da morte é obrigatória para saída por morte', 400);
    }
  }

  if (input.exitType === 'VENDA' || input.exitType === 'ABATE') {
    if (!input.buyerName) {
      throw new AnimalExitError('Nome do comprador é obrigatório para venda/abate', 400);
    }
    if (input.salePriceTotal == null || input.salePriceTotal <= 0) {
      throw new AnimalExitError('Valor total da venda é obrigatório para venda/abate', 400);
    }
  }
}

const INCLUDE_ANIMAL_AND_CREATOR = {
  animal: { select: { earTag: true, name: true } },
  creator: { select: { name: true } },
};

// ─── Service Functions ──────────────────────────────────────────────

export async function createAnimalExit(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  userId: string,
  input: CreateAnimalExitInput,
): Promise<AnimalExitItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Verify animal exists, belongs to farm, and is active
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
    });
    if (!animal) {
      throw new AnimalExitError('Animal não encontrado ou já removido do rebanho', 404);
    }

    // Check if animal already has an exit
    const existing = await tx.animalExit.findUnique({ where: { animalId } });
    if (existing) {
      throw new AnimalExitError('Este animal já possui uma saída registrada', 409);
    }

    // Create exit record + soft delete animal in a single transaction
    const exitRecord = await tx.animalExit.create({
      data: {
        organizationId: ctx.organizationId,
        animalId,
        farmId,
        exitType: input.exitType,
        exitDate: new Date(input.exitDate),
        deathType: input.deathType ?? null,
        deathCause: input.deathCause ?? null,
        buyerName: input.buyerName ?? null,
        salePriceTotal: input.salePriceTotal ?? null,
        salePricePerKg: input.salePricePerKg ?? null,
        saleWeightKg: input.saleWeightKg ?? null,
        gtaNumber: input.gtaNumber ?? null,
        destinationFarm: input.destinationFarm ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
      },
      include: INCLUDE_ANIMAL_AND_CREATOR,
    });

    // Soft delete the animal
    await tx.animal.update({
      where: { id: animalId },
      data: { deletedAt: new Date() },
    });

    return toAnimalExitItem(exitRecord);
  });
}

export async function listAnimalExits(
  ctx: RlsContext,
  farmId: string,
  query: ListAnimalExitsQuery,
): Promise<{ data: AnimalExitItem[]; total: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(200, Math.max(1, query.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.exitType && isValidExitType(query.exitType)) {
      where.exitType = query.exitType;
    }
    if (query.dateFrom) {
      where.exitDate = { ...(where.exitDate ?? {}), gte: new Date(query.dateFrom) };
    }
    if (query.dateTo) {
      where.exitDate = { ...(where.exitDate ?? {}), lte: new Date(query.dateTo) };
    }
    if (query.search) {
      where.animal = {
        OR: [
          { earTag: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      tx.animalExit.findMany({
        where,
        include: INCLUDE_ANIMAL_AND_CREATOR,
        orderBy: { exitDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      tx.animalExit.count({ where }),
    ]);

    return { data: data.map(toAnimalExitItem), total };
  });
}

export async function getAnimalExit(
  ctx: RlsContext,
  farmId: string,
  exitId: string,
): Promise<AnimalExitItem> {
  return withRlsContext(ctx, async (tx) => {
    const record = await tx.animalExit.findFirst({
      where: { id: exitId, farmId },
      include: INCLUDE_ANIMAL_AND_CREATOR,
    });
    if (!record) {
      throw new AnimalExitError('Registro de saída não encontrado', 404);
    }
    return toAnimalExitItem(record);
  });
}

export async function undoAnimalExit(
  ctx: RlsContext,
  farmId: string,
  exitId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const record = await tx.animalExit.findFirst({
      where: { id: exitId, farmId },
    });
    if (!record) {
      throw new AnimalExitError('Registro de saída não encontrado', 404);
    }

    // Restore animal (remove soft delete)
    await tx.animal.update({
      where: { id: record.animalId },
      data: { deletedAt: null },
    });

    // Delete exit record
    await tx.animalExit.delete({ where: { id: exitId } });
  });
}

export async function bulkAnimalExit(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: BulkAnimalExitInput,
): Promise<BulkAnimalExitResult> {
  validateInput({
    exitType: input.exitType,
    exitDate: input.exitDate,
    deathType: input.deathType,
    deathCause: input.deathCause,
    buyerName: input.buyerName,
    salePriceTotal: input.salePriceTotal,
    salePricePerKg: input.salePricePerKg,
    saleWeightKg: input.saleWeightKg,
    gtaNumber: input.gtaNumber,
    destinationFarm: input.destinationFarm,
    notes: input.notes,
  });

  if (!input.animalIds?.length) {
    throw new AnimalExitError('Nenhum animal selecionado', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const animals = await tx.animal.findMany({
      where: { id: { in: input.animalIds }, farmId, deletedAt: null },
      select: { id: true, earTag: true },
    });

    const foundIds = new Set(animals.map((a) => a.id));
    const errors: BulkAnimalExitResult['errors'] = [];

    // Check for animals not found
    for (const animalId of input.animalIds) {
      if (!foundIds.has(animalId)) {
        errors.push({ animalId, reason: 'Animal não encontrado ou já removido' });
      }
    }

    // Check for existing exits
    const existingExits = await tx.animalExit.findMany({
      where: { animalId: { in: animals.map((a) => a.id) } },
      select: { animalId: true },
    });
    const exitedIds = new Set(existingExits.map((e) => e.animalId));

    const toCreate = animals.filter((a) => {
      if (exitedIds.has(a.id)) {
        errors.push({ animalId: a.id, earTag: a.earTag, reason: 'Já possui saída registrada' });
        return false;
      }
      return true;
    });

    // Create exit records
    if (toCreate.length > 0) {
      await tx.animalExit.createMany({
        data: toCreate.map((animal) => ({
          organizationId: ctx.organizationId,
          animalId: animal.id,
          farmId,
          exitType: input.exitType,
          exitDate: new Date(input.exitDate),
          deathType: input.deathType ?? null,
          deathCause: input.deathCause ?? null,
          buyerName: input.buyerName ?? null,
          salePriceTotal: input.salePriceTotal ?? null,
          salePricePerKg: input.salePricePerKg ?? null,
          saleWeightKg: input.saleWeightKg ?? null,
          gtaNumber: input.gtaNumber ?? null,
          destinationFarm: input.destinationFarm ?? null,
          notes: input.notes ?? null,
          createdBy: userId,
        })),
      });

      // Soft delete animals
      await tx.animal.updateMany({
        where: { id: { in: toCreate.map((a) => a.id) } },
        data: { deletedAt: new Date() },
      });
    }

    return {
      created: toCreate.length,
      failed: errors.length,
      errors,
    };
  });
}

export async function exportAnimalExitsCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListAnimalExitsQuery,
): Promise<string> {
  const { data } = await listAnimalExits(ctx, farmId, { ...query, page: 1, limit: 10000 });

  const header = 'Brinco;Nome;Tipo;Data;Tipo Morte;Causa Morte;Comprador;Valor Total;Peso (kg);Preço/kg;GTA;Destino;Observações';
  const rows = data.map((item) =>
    [
      item.animalEarTag,
      item.animalName ?? '',
      item.exitTypeLabel,
      item.exitDate,
      item.deathTypeLabel ?? '',
      item.deathCause ?? '',
      item.buyerName ?? '',
      item.salePriceTotal != null ? item.salePriceTotal.toFixed(2) : '',
      item.saleWeightKg != null ? item.saleWeightKg.toFixed(2) : '',
      item.salePricePerKg != null ? item.salePricePerKg.toFixed(4) : '',
      item.gtaNumber ?? '',
      item.destinationFarm ?? '',
      item.notes ?? '',
    ].join(';'),
  );

  return [header, ...rows].join('\n');
}
