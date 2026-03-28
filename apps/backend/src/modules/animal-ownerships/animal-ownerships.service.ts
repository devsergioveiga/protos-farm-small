import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  AnimalOwnershipError,
  OWNERSHIP_TYPES,
  type CreateOwnershipInput,
  type UpdateOwnershipInput,
  type BulkAssignOwnerInput,
  type ListOwnershipsQuery,
  type OwnershipItem,
} from './animal-ownerships.types';

// ─── Helpers ────────────────────────────────────────────────────────

const PRODUCER_SELECT = {
  id: true,
  name: true,
  document: true,
  type: true,
} as const;


function toItem(row: Record<string, unknown>): OwnershipItem {
  const r = row as Record<string, unknown> & {
    producer: { id: string; name: string; document: string | null; type: string };
    animal?: { id: string; earTag: string; name: string | null };
  };
  return {
    id: r.id as string,
    animalId: r.animalId as string,
    producerId: r.producerId as string,
    ownershipType: r.ownershipType as string,
    participationPct: r.participationPct != null ? Number(r.participationPct) : null,
    startDate: (r.startDate as Date).toISOString().split('T')[0],
    endDate: r.endDate ? (r.endDate as Date).toISOString().split('T')[0] : null,
    notes: r.notes as string | null,
    createdAt: (r.createdAt as Date).toISOString(),
    producer: r.producer,
    animal: r.animal,
  };
}

function validateInput(input: CreateOwnershipInput) {
  if (!input.animalId) throw new AnimalOwnershipError('animalId é obrigatório', 400);
  if (!input.producerId) throw new AnimalOwnershipError('producerId é obrigatório', 400);
  if (!input.startDate) throw new AnimalOwnershipError('startDate é obrigatório', 400);

  if (
    input.ownershipType &&
    !(OWNERSHIP_TYPES as readonly string[]).includes(input.ownershipType)
  ) {
    throw new AnimalOwnershipError(
      `Tipo de propriedade inválido. Opções: ${OWNERSHIP_TYPES.join(', ')}`,
      400,
    );
  }

  if (input.participationPct != null) {
    if (input.participationPct < 0 || input.participationPct > 100) {
      throw new AnimalOwnershipError('Percentual de participação deve estar entre 0 e 100', 400);
    }
  }

  if (input.endDate && input.startDate > input.endDate) {
    throw new AnimalOwnershipError('Data de fim deve ser posterior à data de início', 400);
  }
}

// ─── Create ─────────────────────────────────────────────────────────

export async function createOwnership(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateOwnershipInput,
) {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Verify animal belongs to farm
    const animal = await tx.animal.findFirst({
      where: { id: input.animalId, farmId, deletedAt: null },
    });
    if (!animal) throw new AnimalOwnershipError('Animal não encontrado nesta fazenda', 404);

    // Verify producer belongs to org
    const producer = await tx.producer.findFirst({
      where: { id: input.producerId },
    });
    if (!producer) throw new AnimalOwnershipError('Produtor não encontrado', 404);

    const ownership = await tx.animalOwnership.create({
      data: {
        animalId: input.animalId,
        producerId: input.producerId,
        ownershipType: (input.ownershipType as never) ?? 'PROPRIETARIO',
        participationPct: input.participationPct,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        notes: input.notes,
        createdBy: userId,
      },
      include: { producer: { select: PRODUCER_SELECT } },
    });

    return toItem(ownership as unknown as Record<string, unknown>);
  });
}

// ─── List by Animal ─────────────────────────────────────────────────

export async function listOwnershipsByAnimal(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  query: ListOwnershipsQuery,
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    // Verify animal belongs to farm
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) throw new AnimalOwnershipError('Animal não encontrado nesta fazenda', 404);

    const where: Record<string, unknown> = { animalId };

    if (query.ownershipType) where.ownershipType = query.ownershipType;
    if (query.producerId) where.producerId = query.producerId;
    if (query.activeOnly) where.endDate = null;

    const [rows, total] = await Promise.all([
      tx.animalOwnership.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: { producer: { select: PRODUCER_SELECT } },
      }),
      tx.animalOwnership.count({ where }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── Update ─────────────────────────────────────────────────────────

export async function updateOwnership(
  ctx: RlsContext,
  farmId: string,
  ownershipId: string,
  input: UpdateOwnershipInput,
) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalOwnership.findFirst({
      where: { id: ownershipId },
      include: { animal: { select: { farmId: true, deletedAt: true } } },
    });

    if (!existing || existing.animal.farmId !== farmId || existing.animal.deletedAt) {
      throw new AnimalOwnershipError('Vínculo de propriedade não encontrado', 404);
    }

    if (
      input.ownershipType &&
      !(OWNERSHIP_TYPES as readonly string[]).includes(input.ownershipType)
    ) {
      throw new AnimalOwnershipError(
        `Tipo de propriedade inválido. Opções: ${OWNERSHIP_TYPES.join(', ')}`,
        400,
      );
    }

    if (input.participationPct != null && (input.participationPct < 0 || input.participationPct > 100)) {
      throw new AnimalOwnershipError('Percentual de participação deve estar entre 0 e 100', 400);
    }

    const data: Record<string, unknown> = {};
    if (input.ownershipType !== undefined) data.ownershipType = input.ownershipType;
    if (input.participationPct !== undefined) data.participationPct = input.participationPct;
    if (input.startDate !== undefined) data.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) data.endDate = input.endDate ? new Date(input.endDate) : null;
    if (input.notes !== undefined) data.notes = input.notes;

    const updated = await tx.animalOwnership.update({
      where: { id: ownershipId },
      data,
      include: { producer: { select: PRODUCER_SELECT } },
    });

    return toItem(updated as unknown as Record<string, unknown>);
  });
}

// ─── Delete ─────────────────────────────────────────────────────────

export async function deleteOwnership(ctx: RlsContext, farmId: string, ownershipId: string) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalOwnership.findFirst({
      where: { id: ownershipId },
      include: { animal: { select: { farmId: true, deletedAt: true } } },
    });

    if (!existing || existing.animal.farmId !== farmId || existing.animal.deletedAt) {
      throw new AnimalOwnershipError('Vínculo de propriedade não encontrado', 404);
    }

    await tx.animalOwnership.delete({ where: { id: ownershipId } });
  });
}

// ─── End Ownership (set endDate) ────────────────────────────────────

export async function endOwnership(
  ctx: RlsContext,
  farmId: string,
  ownershipId: string,
  endDate: string,
) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalOwnership.findFirst({
      where: { id: ownershipId },
      include: { animal: { select: { farmId: true, deletedAt: true } } },
    });

    if (!existing || existing.animal.farmId !== farmId || existing.animal.deletedAt) {
      throw new AnimalOwnershipError('Vínculo de propriedade não encontrado', 404);
    }

    if (existing.endDate) {
      throw new AnimalOwnershipError('Este vínculo já foi encerrado', 400);
    }

    const endDateParsed = new Date(endDate);
    if (endDateParsed < existing.startDate) {
      throw new AnimalOwnershipError('Data de encerramento deve ser posterior à data de início', 400);
    }

    const updated = await tx.animalOwnership.update({
      where: { id: ownershipId },
      data: { endDate: endDateParsed },
      include: { producer: { select: PRODUCER_SELECT } },
    });

    return toItem(updated as unknown as Record<string, unknown>);
  });
}

// ─── Bulk Assign ────────────────────────────────────────────────────

export async function bulkAssignOwner(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: BulkAssignOwnerInput,
) {
  if (!input.animalIds || input.animalIds.length === 0) {
    throw new AnimalOwnershipError('Selecione ao menos um animal', 400);
  }
  if (!input.producerId) throw new AnimalOwnershipError('producerId é obrigatório', 400);
  if (!input.startDate) throw new AnimalOwnershipError('startDate é obrigatório', 400);

  if (
    input.ownershipType &&
    !(OWNERSHIP_TYPES as readonly string[]).includes(input.ownershipType)
  ) {
    throw new AnimalOwnershipError(
      `Tipo de propriedade inválido. Opções: ${OWNERSHIP_TYPES.join(', ')}`,
      400,
    );
  }

  return withRlsContext(ctx, async (tx) => {
    // Verify all animals belong to this farm
    const animals = await tx.animal.findMany({
      where: { id: { in: input.animalIds }, farmId, deletedAt: null },
      select: { id: true },
    });

    const foundIds = new Set(animals.map((a) => a.id));
    const notFound = input.animalIds.filter((id) => !foundIds.has(id));
    if (notFound.length > 0) {
      throw new AnimalOwnershipError(
        `${notFound.length} animal(is) não encontrado(s) nesta fazenda`,
        404,
      );
    }

    // Verify producer
    const producer = await tx.producer.findFirst({
      where: { id: input.producerId },
    });
    if (!producer) throw new AnimalOwnershipError('Produtor não encontrado', 404);

    const ownershipType = (input.ownershipType as never) ?? 'PROPRIETARIO';
    const startDate = new Date(input.startDate);

    let created = 0;
    let skipped = 0;

    for (const animalId of input.animalIds) {
      try {
        await tx.animalOwnership.create({
          data: {
            animalId,
            producerId: input.producerId,
            ownershipType,
            participationPct: input.participationPct,
            startDate,
            notes: input.notes,
            createdBy: userId,
          },
        });
        created++;
      } catch {
        // Unique constraint violation — skip duplicates silently
        skipped++;
      }
    }

    return { created, skipped, total: input.animalIds.length };
  });
}

// ─── List owners for farm (for filter dropdown) ─────────────────────

export async function listFarmAnimalOwners(ctx: RlsContext, farmId: string) {
  return withRlsContext(ctx, async (tx) => {
    const owners = await tx.animalOwnership.findMany({
      where: {
        animal: { farmId, deletedAt: null },
        endDate: null,
      },
      select: {
        producer: { select: PRODUCER_SELECT },
      },
      distinct: ['producerId'],
    });

    return owners.map((o) => o.producer);
  });
}

// ─── Get current owner summary for animal list ──────────────────────

export async function getAnimalCurrentOwners(
  ctx: RlsContext,
  animalIds: string[],
): Promise<
  Map<
    string,
    { producerId: string; producerName: string; ownershipType: string }[]
  >
> {
  if (animalIds.length === 0) return new Map();

  return withRlsContext(ctx, async (tx) => {
    const ownerships = await tx.animalOwnership.findMany({
      where: {
        animalId: { in: animalIds },
        endDate: null,
      },
      select: {
        animalId: true,
        ownershipType: true,
        producer: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    const map = new Map<
      string,
      { producerId: string; producerName: string; ownershipType: string }[]
    >();

    for (const o of ownerships) {
      const existing = map.get(o.animalId) ?? [];
      existing.push({
        producerId: o.producer.id,
        producerName: o.producer.name,
        ownershipType: o.ownershipType,
      });
      map.set(o.animalId, existing);
    }

    return map;
  });
}
