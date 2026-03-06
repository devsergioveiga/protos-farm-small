import { withRlsContext, type RlsContext } from '../../database/rls';
import { AnimalMovementsError } from './animal-movements.types';
import type { AnimalMovementItem, AnimalMovementStats } from './animal-movements.types';

// ─── Helpers ────────────────────────────────────────────────────────

function daysBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function toMovementItem(row: Record<string, unknown>): AnimalMovementItem {
  const lot = row.lot as Record<string, unknown>;
  const location = lot.location as Record<string, unknown> | null;
  const previousLot = row.previousLot as Record<string, unknown> | null;
  const mover = row.mover as Record<string, unknown>;
  const enteredAt = row.enteredAt as Date;
  const exitedAt = (row.exitedAt as Date) ?? null;

  return {
    id: row.id as string,
    lotName: lot.name as string,
    lotLocationType: lot.locationType as string,
    locationName: location ? (location.name as string) : null,
    previousLotName: previousLot ? (previousLot.name as string) : null,
    enteredAt: enteredAt.toISOString(),
    exitedAt: exitedAt ? exitedAt.toISOString() : null,
    durationDays: daysBetween(enteredAt, exitedAt ?? new Date()),
    reason: (row.reason as string) ?? null,
    movedByName: mover.name as string,
  };
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listAnimalMovements(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<AnimalMovementItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new AnimalMovementsError('Animal não encontrado', 404);
    }

    const rows = await tx.animalLotMovement.findMany({
      where: { animalId },
      orderBy: { enteredAt: 'desc' },
      include: {
        lot: {
          select: {
            name: true,
            locationType: true,
            location: { select: { name: true } },
          },
        },
        previousLot: { select: { name: true } },
        mover: { select: { name: true } },
      },
    });

    return rows.map((r) => toMovementItem(r as unknown as Record<string, unknown>));
  });
}

// ─── STATS ──────────────────────────────────────────────────────────

export async function getAnimalMovementStats(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<AnimalMovementStats> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new AnimalMovementsError('Animal não encontrado', 404);
    }

    const movements = await tx.animalLotMovement.findMany({
      where: { animalId },
      orderBy: { enteredAt: 'desc' },
      include: {
        lot: {
          select: {
            name: true,
            location: { select: { name: true } },
          },
        },
      },
    });

    if (movements.length === 0) {
      return {
        totalMovements: 0,
        currentLotName: null,
        currentLocationName: null,
        daysInCurrentLot: null,
        distinctLots: 0,
      };
    }

    // Current = most recent movement without exitedAt
    const current = movements.find((m) => m.exitedAt === null);
    const distinctLotIds = new Set(movements.map((m) => m.lotId));

    return {
      totalMovements: movements.length,
      currentLotName: current ? current.lot.name : null,
      currentLocationName: current?.lot.location?.name ?? null,
      daysInCurrentLot: current ? daysBetween(current.enteredAt, new Date()) : null,
      distinctLots: distinctLotIds.size,
    };
  });
}
