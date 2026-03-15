import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  NaturalMatingError,
  MATING_REASON_LABELS,
  PATERNITY_TYPE_LABELS,
  DEFAULT_MAX_STAY_DAYS,
  isValidMatingReason,
  type CreateNaturalMatingInput,
  type UpdateNaturalMatingInput,
  type ListNaturalMatingsQuery,
  type NaturalMatingItem,
  type NaturalMatingDetail,
  type NaturalMatingAnimalItem,
  type OverstayAlertItem,
  type MatingIndicators,
  type MatingReasonValue,
  type PaternityTypeValue,
} from './natural-matings.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

const MATING_INCLUDE = {
  bull: { select: { name: true } },
  recorder: { select: { name: true } },
  animals: {
    select: {
      id: true,
      animalId: true,
      animal: { select: { earTag: true, name: true } },
    },
  },
};

const MATING_LIST_INCLUDE = {
  bull: { select: { name: true } },
  recorder: { select: { name: true } },
  _count: { select: { animals: true } },
};

function calcStayDays(entryDate: Date, exitDate: Date | null): number | null {
  const end = exitDate ?? new Date();
  const diffMs = end.getTime() - entryDate.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function calcIsOverstay(
  entryDate: Date,
  exitDate: Date | null,
  maxStayDays: number | null,
): boolean {
  if (exitDate) return false; // already completed
  if (!maxStayDays) return false;
  const days = calcStayDays(entryDate, null);
  return days !== null && days > maxStayDays;
}

function toMatingItem(row: any): NaturalMatingItem {
  const reason = row.reason as MatingReasonValue;
  const paternityType = row.paternityType as PaternityTypeValue;
  const entryDate = row.entryDate as Date;
  const exitDate = row.exitDate as Date | null;

  return {
    id: row.id,
    farmId: row.farmId,
    bullId: row.bullId ?? null,
    bullName: row.bull?.name ?? null,
    bullBreedName: row.bullBreedName ?? null,
    reason,
    reasonLabel: MATING_REASON_LABELS[reason] ?? reason,
    entryDate: entryDate.toISOString().slice(0, 10),
    exitDate: exitDate ? exitDate.toISOString().slice(0, 10) : null,
    maxStayDays: row.maxStayDays ?? null,
    isOverstay: calcIsOverstay(entryDate, exitDate, row.maxStayDays),
    stayDays: calcStayDays(entryDate, exitDate),
    paternityType,
    paternityTypeLabel: PATERNITY_TYPE_LABELS[paternityType] ?? paternityType,
    animalCount: row._count?.animals ?? row.animals?.length ?? 0,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toMatingDetail(row: any): NaturalMatingDetail {
  const item = toMatingItem(row);
  const animals: NaturalMatingAnimalItem[] = (row.animals ?? []).map((a: any) => ({
    id: a.id,
    animalId: a.animalId,
    animalEarTag: a.animal?.earTag ?? '',
    animalName: a.animal?.name ?? null,
  }));

  return { ...item, animals };
}

function validateCreateInput(input: CreateNaturalMatingInput): void {
  if (!input.reason || !isValidMatingReason(input.reason)) {
    throw new NaturalMatingError('Motivo da monta inválido', 400);
  }
  if (!input.entryDate) {
    throw new NaturalMatingError('Data de entrada é obrigatória', 400);
  }
  const entryDate = new Date(input.entryDate);
  if (isNaN(entryDate.getTime())) {
    throw new NaturalMatingError('Data de entrada inválida', 400);
  }
  if (!input.bullId && !input.bullBreedName?.trim()) {
    throw new NaturalMatingError('Informe o touro ou, quando desconhecido, a raça do touro', 400);
  }
  if (!Array.isArray(input.animalIds) || input.animalIds.length === 0) {
    throw new NaturalMatingError('Pelo menos uma fêmea deve ser informada', 400);
  }
  if (input.exitDate) {
    const exitDate = new Date(input.exitDate);
    if (isNaN(exitDate.getTime())) {
      throw new NaturalMatingError('Data de saída inválida', 400);
    }
    if (exitDate < entryDate) {
      throw new NaturalMatingError('Data de saída não pode ser anterior à data de entrada', 400);
    }
  }
  if (input.maxStayDays !== undefined && input.maxStayDays !== null) {
    if (typeof input.maxStayDays !== 'number' || input.maxStayDays < 1) {
      throw new NaturalMatingError('Período máximo de permanência deve ser maior que zero', 400);
    }
  }
}

// ─── CREATE (CA1, CA2, CA3) ─────────────────────────────────────────

export async function createNaturalMating(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateNaturalMatingInput,
): Promise<NaturalMatingDetail> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Validate bull if provided
    if (input.bullId) {
      const bull = await (tx as any).bull.findFirst({
        where: { id: input.bullId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!bull) {
        throw new NaturalMatingError('Touro não encontrado', 404);
      }
    }

    // Validate all animals: must exist, be female, and reproductivelyReleased
    for (const animalId of input.animalIds) {
      const animal = await (tx as any).animal.findFirst({
        where: { id: animalId, farmId, deletedAt: null },
        select: { id: true, sex: true, reproductivelyReleased: true, earTag: true },
      });
      if (!animal) {
        throw new NaturalMatingError(`Animal ${animalId} não encontrado`, 404);
      }
      if (animal.sex !== 'FEMALE') {
        throw new NaturalMatingError(
          `Animal ${animal.earTag} não é fêmea. Monta natural é apenas para fêmeas`,
          400,
        );
      }
      if (!animal.reproductivelyReleased) {
        throw new NaturalMatingError(
          `Animal ${animal.earTag} não possui liberação reprodutiva`,
          400,
        );
      }
    }

    const entryDate = new Date(input.entryDate);
    const exitDate = input.exitDate ? new Date(input.exitDate) : null;
    const maxStayDays = input.maxStayDays ?? DEFAULT_MAX_STAY_DAYS;
    const paternityType = input.bullId ? 'PROBABLE_NATURAL' : 'UNKNOWN_BREED_ONLY';
    const isOverstay = calcIsOverstay(entryDate, exitDate, maxStayDays);

    const row = await (tx as any).naturalMating.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        bullId: input.bullId ?? null,
        bullBreedName: input.bullId ? null : (input.bullBreedName?.trim() ?? null),
        reason: input.reason,
        entryDate,
        exitDate,
        maxStayDays,
        isOverstay,
        paternityType,
        notes: input.notes ?? null,
        recordedBy: userId,
        animals: {
          create: input.animalIds.map((animalId) => ({ animalId })),
        },
      },
      include: MATING_INCLUDE,
    });

    return toMatingDetail(row);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listNaturalMatings(
  ctx: RlsContext,
  farmId: string,
  query: ListNaturalMatingsQuery,
): Promise<{ data: NaturalMatingItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.bullId) where.bullId = query.bullId;
    if (query.reason) where.reason = query.reason;
    if (query.paternityType) where.paternityType = query.paternityType;
    if (query.overstayOnly) {
      where.isOverstay = true;
      where.exitDate = null;
    }
    if (query.dateFrom || query.dateTo) {
      where.entryDate = {};
      if (query.dateFrom) where.entryDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.entryDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).naturalMating.findMany({
        where,
        include: MATING_LIST_INCLUDE,
        orderBy: { entryDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).naturalMating.count({ where }),
    ]);

    return {
      data: rows.map(toMatingItem),
      total,
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getNaturalMating(
  ctx: RlsContext,
  farmId: string,
  matingId: string,
): Promise<NaturalMatingDetail> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).naturalMating.findFirst({
      where: { id: matingId, farmId },
      include: MATING_INCLUDE,
    });
    if (!row) {
      throw new NaturalMatingError('Registro de monta natural não encontrado', 404);
    }
    return toMatingDetail(row);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateNaturalMating(
  ctx: RlsContext,
  farmId: string,
  matingId: string,
  input: UpdateNaturalMatingInput,
): Promise<NaturalMatingDetail> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).naturalMating.findFirst({
      where: { id: matingId, farmId },
    });
    if (!existing) {
      throw new NaturalMatingError('Registro de monta natural não encontrado', 404);
    }

    const data: any = {};

    // Handle bull change
    if (input.bullId !== undefined) {
      if (input.bullId) {
        const bull = await (tx as any).bull.findFirst({
          where: { id: input.bullId, farmId, deletedAt: null },
          select: { id: true },
        });
        if (!bull) {
          throw new NaturalMatingError('Touro não encontrado', 404);
        }
        data.bullId = input.bullId;
        data.bullBreedName = null;
        data.paternityType = 'PROBABLE_NATURAL';
      } else {
        // Clearing bull — need bullBreedName
        if (!input.bullBreedName?.trim()) {
          throw new NaturalMatingError(
            'Informe a raça do touro quando o touro é desconhecido',
            400,
          );
        }
        data.bullId = null;
        data.bullBreedName = input.bullBreedName.trim();
        data.paternityType = 'UNKNOWN_BREED_ONLY';
      }
    } else if (input.bullBreedName !== undefined) {
      if (!existing.bullId) {
        data.bullBreedName = input.bullBreedName?.trim() ?? null;
      }
    }

    if (input.reason !== undefined) {
      if (!isValidMatingReason(input.reason)) {
        throw new NaturalMatingError('Motivo da monta inválido', 400);
      }
      data.reason = input.reason;
    }

    if (input.exitDate !== undefined) {
      if (input.exitDate) {
        const exitDate = new Date(input.exitDate);
        if (isNaN(exitDate.getTime())) {
          throw new NaturalMatingError('Data de saída inválida', 400);
        }
        const entryDate = existing.entryDate as Date;
        if (exitDate < entryDate) {
          throw new NaturalMatingError(
            'Data de saída não pode ser anterior à data de entrada',
            400,
          );
        }
        data.exitDate = exitDate;
      } else {
        data.exitDate = null;
      }
    }

    if (input.maxStayDays !== undefined) {
      if (
        input.maxStayDays !== null &&
        (typeof input.maxStayDays !== 'number' || input.maxStayDays < 1)
      ) {
        throw new NaturalMatingError('Período máximo de permanência deve ser maior que zero', 400);
      }
      data.maxStayDays = input.maxStayDays;
    }

    if (input.notes !== undefined) data.notes = input.notes;

    // Recalculate isOverstay
    const entryDate = existing.entryDate as Date;
    const exitDate =
      data.exitDate !== undefined ? data.exitDate : (existing.exitDate as Date | null);
    const maxStayDays = data.maxStayDays !== undefined ? data.maxStayDays : existing.maxStayDays;
    data.isOverstay = calcIsOverstay(entryDate, exitDate, maxStayDays);

    // Handle animal list update
    if (input.animalIds !== undefined) {
      if (!Array.isArray(input.animalIds) || input.animalIds.length === 0) {
        throw new NaturalMatingError('Pelo menos uma fêmea deve ser informada', 400);
      }

      for (const animalId of input.animalIds) {
        const animal = await (tx as any).animal.findFirst({
          where: { id: animalId, farmId, deletedAt: null },
          select: { id: true, sex: true, reproductivelyReleased: true, earTag: true },
        });
        if (!animal) {
          throw new NaturalMatingError(`Animal ${animalId} não encontrado`, 404);
        }
        if (animal.sex !== 'FEMALE') {
          throw new NaturalMatingError(
            `Animal ${animal.earTag} não é fêmea. Monta natural é apenas para fêmeas`,
            400,
          );
        }
        if (!animal.reproductivelyReleased) {
          throw new NaturalMatingError(
            `Animal ${animal.earTag} não possui liberação reprodutiva`,
            400,
          );
        }
      }

      // Delete existing and recreate
      await (tx as any).naturalMatingAnimal.deleteMany({ where: { matingId } });
      await (tx as any).naturalMatingAnimal.createMany({
        data: input.animalIds.map((animalId) => ({ matingId, animalId })),
      });
    }

    const row = await (tx as any).naturalMating.update({
      where: { id: matingId },
      data,
      include: MATING_INCLUDE,
    });

    return toMatingDetail(row);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteNaturalMating(
  ctx: RlsContext,
  farmId: string,
  matingId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).naturalMating.findFirst({
      where: { id: matingId, farmId },
    });
    if (!existing) {
      throw new NaturalMatingError('Registro de monta natural não encontrado', 404);
    }

    await (tx as any).naturalMating.delete({ where: { id: matingId } });
  });
}

// ─── OVERSTAY ALERTS (CA4) ──────────────────────────────────────────

export async function getOverstayAlerts(
  ctx: RlsContext,
  farmId: string,
): Promise<OverstayAlertItem[]> {
  return withRlsContext(ctx, async (tx) => {
    // Find all active matings (no exitDate) where stay exceeds maxStayDays
    const rows = await (tx as any).naturalMating.findMany({
      where: {
        farmId,
        exitDate: null,
      },
      include: {
        bull: { select: { name: true } },
        _count: { select: { animals: true } },
      },
      orderBy: { entryDate: 'asc' },
    });

    const now = new Date();
    const alerts: OverstayAlertItem[] = [];

    for (const row of rows) {
      const entryDate = row.entryDate as Date;
      const maxStayDays = row.maxStayDays ?? DEFAULT_MAX_STAY_DAYS;
      const currentStayDays = Math.round(
        (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (currentStayDays > maxStayDays) {
        const reason = row.reason as MatingReasonValue;
        alerts.push({
          id: row.id,
          bullId: row.bullId ?? null,
          bullName: row.bull?.name ?? null,
          bullBreedName: row.bullBreedName ?? null,
          entryDate: entryDate.toISOString().slice(0, 10),
          maxStayDays,
          currentStayDays,
          daysOverstay: currentStayDays - maxStayDays,
          animalCount: row._count?.animals ?? 0,
          reason,
          reasonLabel: MATING_REASON_LABELS[reason] ?? reason,
        });
      }
    }

    return alerts;
  });
}

// ─── INDICATORS (CA5) ──────────────────────────────────────────────

export async function getMatingIndicators(
  ctx: RlsContext,
  farmId: string,
): Promise<MatingIndicators> {
  return withRlsContext(ctx, async (tx) => {
    // Last 180 days
    const now = new Date();
    const periodEnd = now.toISOString().slice(0, 10);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 180);
    const periodStartStr = periodStart.toISOString().slice(0, 10);

    const rows = await (tx as any).naturalMating.findMany({
      where: {
        farmId,
        entryDate: {
          gte: new Date(periodStartStr),
          lte: new Date(periodEnd),
        },
      },
      select: {
        id: true,
        reason: true,
        entryDate: true,
        exitDate: true,
        maxStayDays: true,
        isOverstay: true,
      },
    });

    const totalMatings = rows.length;
    const activeMatings = rows.filter((r: any) => !r.exitDate).length;
    const completedMatings = rows.filter((r: any) => !!r.exitDate).length;

    // Overstay count (among active)
    const overstayCount = rows.filter((r: any) => {
      if (r.exitDate) return false;
      const maxDays = r.maxStayDays ?? DEFAULT_MAX_STAY_DAYS;
      const stayDays = calcStayDays(r.entryDate as Date, null);
      return stayDays !== null && stayDays > maxDays;
    }).length;

    // Average stay days (for completed only)
    const completedRows = rows.filter((r: any) => !!r.exitDate);
    const stayDaysValues = completedRows
      .map((r: any) => calcStayDays(r.entryDate as Date, r.exitDate as Date))
      .filter((d: number | null): d is number => d !== null);
    const avgStayDays =
      stayDaysValues.length > 0
        ? Math.round(
            (stayDaysValues.reduce((sum: number, d: number) => sum + d, 0) /
              stayDaysValues.length) *
              10,
          ) / 10
        : null;

    // By reason
    const reasonCounts = new Map<MatingReasonValue, number>();
    for (const row of rows) {
      const reason = row.reason as MatingReasonValue;
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    const byReason = Array.from(reasonCounts.entries()).map(([reason, count]) => ({
      reason,
      reasonLabel: MATING_REASON_LABELS[reason] ?? reason,
      count,
    }));

    // Pregnancy rate placeholders (CA5)
    const pregnancyRateNaturalPlaceholder: number | null = null;
    const pregnancyRateAiPlaceholder: number | null = null;

    return {
      totalMatings,
      activeMatings,
      completedMatings,
      overstayCount,
      avgStayDays,
      pregnancyRateNaturalPlaceholder,
      pregnancyRateAiPlaceholder,
      byReason,
      periodStart: periodStartStr,
      periodEnd,
    };
  });
}
