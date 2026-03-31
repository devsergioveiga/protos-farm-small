import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import {
  ReproductiveReleaseError,
  type CreateReleaseInput,
  type BulkReleaseInput,
  type SetCriteriaInput,
  type ListReleasesQuery,
  type ReleaseItem,
  type CriteriaItem,
  type CandidateItem,
  type BulkReleaseResult,
  type ReleaseIndicators,
} from './reproductive-releases.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

const RELEASE_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
};

function toReleaseItem(
  row: any,
  previousLotName?: string | null,
  targetLotName?: string | null,
): ReleaseItem {
  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    releaseDate: (row.releaseDate as Date).toISOString().slice(0, 10),
    weightKg: row.weightKg != null ? toNumber(row.weightKg) : null,
    ageMonths: row.ageMonths ?? null,
    bodyConditionScore: row.bodyConditionScore != null ? toNumber(row.bodyConditionScore) : null,
    previousCategory: row.previousCategory ?? null,
    previousLotId: row.previousLotId ?? null,
    previousLotName: previousLotName ?? null,
    targetLotId: row.targetLotId ?? null,
    targetLotName: targetLotName ?? null,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function validateCreateInput(input: CreateReleaseInput): void {
  if (!input.animalId?.trim()) {
    throw new ReproductiveReleaseError('Animal é obrigatório', 400);
  }
  if (!input.releaseDate) {
    throw new ReproductiveReleaseError('Data de liberação é obrigatória', 400);
  }
  const date = new Date(input.releaseDate);
  if (isNaN(date.getTime())) {
    throw new ReproductiveReleaseError('Data de liberação inválida', 400);
  }
  if (date > new Date()) {
    throw new ReproductiveReleaseError('Data de liberação não pode ser no futuro', 400);
  }
  if (input.bodyConditionScore != null) {
    const score = Number(input.bodyConditionScore);
    if (score < 1 || score > 5) {
      throw new ReproductiveReleaseError('Escore de condição corporal deve estar entre 1 e 5', 400);
    }
  }
}

function calcAgeMonths(birthDate: Date | null, referenceDate: Date): number | null {
  if (!birthDate) return null;
  const years = referenceDate.getFullYear() - birthDate.getFullYear();
  const months = referenceDate.getMonth() - birthDate.getMonth();
  const dayDiff = referenceDate.getDate() - birthDate.getDate();
  let wholeMonths = years * 12 + months;
  if (dayDiff < 0) wholeMonths -= 1;
  // Fraction: days elapsed in the current partial month / days in that month
  const monthStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    birthDate.getDate(),
  );
  if (monthStart > referenceDate) monthStart.setMonth(monthStart.getMonth() - 1);
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    birthDate.getDate(),
  );
  const totalDaysInPeriod = (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = (referenceDate.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24);
  const fraction = totalDaysInPeriod > 0 ? elapsedDays / totalDaysInPeriod : 0;
  return Math.max(0, Math.round((wholeMonths + fraction) * 10) / 10);
}

// Female categories eligible for reproductive release
const CANDIDATE_CATEGORIES = ['BEZERRA', 'NOVILHA'];

// ─── GET CRITERIA (CA2) ─────────────────────────────────────────────

export async function getCriteria(ctx: RlsContext): Promise<CriteriaItem | null> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).reproductiveCriteria.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    if (!row) return null;

    let targetLotName: string | null = null;
    if (row.targetLotId) {
      const lot = await (tx as any).animalLot.findFirst({
        where: { id: row.targetLotId, deletedAt: null },
        select: { name: true },
      });
      targetLotName = lot?.name ?? null;
    }

    return {
      id: row.id,
      organizationId: row.organizationId,
      minWeightKg: row.minWeightKg != null ? toNumber(row.minWeightKg) : null,
      minAgeMonths: row.minAgeMonths ?? null,
      minBodyScore: row.minBodyScore != null ? toNumber(row.minBodyScore) : null,
      targetLotId: row.targetLotId ?? null,
      targetLotName,
      createdAt: (row.createdAt as Date).toISOString(),
      updatedAt: (row.updatedAt as Date).toISOString(),
    };
  });
}

// ─── SET CRITERIA (CA2) ─────────────────────────────────────────────

export async function setCriteria(ctx: RlsContext, input: SetCriteriaInput): Promise<CriteriaItem> {
  if (input.minWeightKg != null && input.minWeightKg <= 0) {
    throw new ReproductiveReleaseError('Peso mínimo deve ser maior que zero', 400);
  }
  if (input.minAgeMonths != null && input.minAgeMonths <= 0) {
    throw new ReproductiveReleaseError('Idade mínima deve ser maior que zero', 400);
  }
  if (input.minBodyScore != null) {
    const score = Number(input.minBodyScore);
    if (score < 1 || score > 5) {
      throw new ReproductiveReleaseError('Escore corporal mínimo deve estar entre 1 e 5', 400);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate target lot if provided
    if (input.targetLotId) {
      const lot = await (tx as any).animalLot.findFirst({
        where: { id: input.targetLotId, deletedAt: null },
        select: { id: true },
      });
      if (!lot) {
        throw new ReproductiveReleaseError('Lote de destino não encontrado', 404);
      }
    }

    const row = await (tx as any).reproductiveCriteria.upsert({
      where: { organizationId: ctx.organizationId },
      create: {
        organizationId: ctx.organizationId,
        minWeightKg: input.minWeightKg ?? null,
        minAgeMonths: input.minAgeMonths ?? null,
        minBodyScore: input.minBodyScore ?? null,
        targetLotId: input.targetLotId ?? null,
      },
      update: {
        minWeightKg: input.minWeightKg ?? null,
        minAgeMonths: input.minAgeMonths ?? null,
        minBodyScore: input.minBodyScore ?? null,
        targetLotId: input.targetLotId ?? null,
      },
    });

    let targetLotName: string | null = null;
    if (row.targetLotId) {
      const lot = await (tx as any).animalLot.findFirst({
        where: { id: row.targetLotId, deletedAt: null },
        select: { name: true },
      });
      targetLotName = lot?.name ?? null;
    }

    return {
      id: row.id,
      organizationId: row.organizationId,
      minWeightKg: row.minWeightKg != null ? toNumber(row.minWeightKg) : null,
      minAgeMonths: row.minAgeMonths ?? null,
      minBodyScore: row.minBodyScore != null ? toNumber(row.minBodyScore) : null,
      targetLotId: row.targetLotId ?? null,
      targetLotName,
      createdAt: (row.createdAt as Date).toISOString(),
      updatedAt: (row.updatedAt as Date).toISOString(),
    };
  });
}

// ─── GET CANDIDATES (CA6) ───────────────────────────────────────────

export async function getCandidates(ctx: RlsContext, farmId: string): Promise<CandidateItem[]> {
  return withRlsContext(ctx, async (tx) => {
    // Get criteria
    const criteria = await (tx as any).reproductiveCriteria.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    // Find female animals in recria-related categories that are not yet released
    const animals = await (tx as any).animal.findMany({
      where: {
        farmId,
        deletedAt: null,
        sex: 'FEMALE',
        reproductivelyReleased: false,
        category: { in: CANDIDATE_CATEGORIES },
      },
      select: {
        id: true,
        earTag: true,
        name: true,
        category: true,
        birthDate: true,
        lotId: true,
        lot: { select: { name: true } },
        weighings: {
          orderBy: { measuredAt: 'desc' },
          take: 1,
          select: {
            weightKg: true,
            measuredAt: true,
            bodyConditionScore: true,
          },
        },
      },
      orderBy: { earTag: 'asc' },
    });

    const now = new Date();
    const candidates: CandidateItem[] = animals.map((a: any) => {
      const latestWeighing = a.weighings[0] ?? null;
      const lastWeightKg = latestWeighing ? toNumber(latestWeighing.weightKg) : null;
      const bodyConditionScore = latestWeighing?.bodyConditionScore ?? null;
      const lastWeighingDate = latestWeighing
        ? (latestWeighing.measuredAt as Date).toISOString().slice(0, 10)
        : null;
      const ageMonths = calcAgeMonths(a.birthDate, now);

      const meetsWeight =
        criteria?.minWeightKg == null ||
        (lastWeightKg != null && lastWeightKg >= toNumber(criteria.minWeightKg));
      const meetsAge =
        criteria?.minAgeMonths == null || (ageMonths != null && ageMonths >= criteria.minAgeMonths);
      const meetsScore =
        criteria?.minBodyScore == null ||
        (bodyConditionScore != null && bodyConditionScore >= toNumber(criteria.minBodyScore));
      const meetsAll = meetsWeight && meetsAge && meetsScore;

      return {
        animalId: a.id,
        earTag: a.earTag,
        animalName: a.name ?? null,
        category: a.category,
        birthDate: a.birthDate ? (a.birthDate as Date).toISOString().slice(0, 10) : null,
        ageMonths,
        lastWeightKg,
        lastWeighingDate,
        bodyConditionScore,
        lotId: a.lotId ?? null,
        lotName: a.lot?.name ?? null,
        meetsWeight,
        meetsAge,
        meetsScore,
        meetsAll,
      };
    });

    // Sort: those that meet all criteria first, then by weight desc
    candidates.sort((a, b) => {
      if (a.meetsAll !== b.meetsAll) return a.meetsAll ? -1 : 1;
      const wa = a.lastWeightKg ?? 0;
      const wb = b.lastWeightKg ?? 0;
      return wb - wa;
    });

    return candidates;
  });
}

// ─── IATF LOT HELPER ───────────────────────────────────────────────

async function createIatfLotForAnimals(
  tx: TxClient,
  ctx: RlsContext,
  farmId: string,
  userId: string,
  animalIds: string[],
  iatfInput: { protocolId: string; lotName?: string | null },
  releaseDate: string,
): Promise<void> {
  const protocol = await (tx as any).iatfProtocol.findFirst({
    where: { id: iatfInput.protocolId, organizationId: ctx.organizationId, status: 'ACTIVE' },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!protocol) {
    throw new ReproductiveReleaseError('Protocolo IATF não encontrado ou inativo', 404);
  }

  const d0 = new Date(releaseDate);
  const lotName =
    iatfInput.lotName?.trim() || `Liberação ${d0.toLocaleDateString('pt-BR')} — ${protocol.name}`;

  const lot = await (tx as any).reproductiveLot.create({
    data: {
      organizationId: ctx.organizationId,
      farmId,
      name: lotName,
      protocolId: protocol.id,
      d0Date: d0,
      status: 'ACTIVE',
      createdBy: userId,
    },
  });

  // Enroll animals
  await (tx as any).reproductiveLotAnimal.createMany({
    data: animalIds.map((animalId) => ({
      lotId: lot.id,
      animalId,
    })),
  });

  // Create steps with scheduled dates
  for (const step of protocol.steps) {
    const scheduledDate = new Date(d0);
    scheduledDate.setDate(scheduledDate.getDate() + step.dayNumber);
    await (tx as any).reproductiveLotStep.create({
      data: {
        lotId: lot.id,
        protocolStepId: step.id,
        dayNumber: step.dayNumber,
        scheduledDate,
        description: step.description,
        isAiDay: step.isAiDay,
        status: 'PENDING',
      },
    });
  }
}

// ─── CREATE RELEASE (CA1, CA3, CA4, CA5) ────────────────────────────

async function performRelease(
  tx: TxClient,
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateReleaseInput,
): Promise<ReleaseItem> {
  validateCreateInput(input);

  // Validate animal
  const animal = await (tx as any).animal.findFirst({
    where: { id: input.animalId, farmId, deletedAt: null },
    select: {
      id: true,
      earTag: true,
      category: true,
      lotId: true,
      birthDate: true,
      reproductivelyReleased: true,
      sex: true,
    },
  });
  if (!animal) {
    throw new ReproductiveReleaseError('Animal não encontrado', 404);
  }

  if (animal.sex !== 'FEMALE') {
    throw new ReproductiveReleaseError('Apenas fêmeas podem ser liberadas para reprodução', 400);
  }

  if (animal.reproductivelyReleased) {
    throw new ReproductiveReleaseError(
      `Animal ${animal.earTag} já foi liberado para reprodução`,
      409,
    );
  }

  const releaseDate = new Date(input.releaseDate);
  const ageMonths = input.ageMonths ?? calcAgeMonths(animal.birthDate, releaseDate);

  // Determine target lot: from input, or from criteria config
  let targetLotId = input.targetLotId ?? null;
  if (!targetLotId) {
    const criteria = await (tx as any).reproductiveCriteria.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    if (criteria?.targetLotId) {
      targetLotId = criteria.targetLotId;
    }
  }

  // Validate target lot if specified
  if (targetLotId) {
    const lot = await (tx as any).animalLot.findFirst({
      where: { id: targetLotId, deletedAt: null },
      select: { id: true },
    });
    if (!lot) {
      throw new ReproductiveReleaseError('Lote de destino não encontrado', 404);
    }
  }

  const previousCategory = animal.category;
  const previousLotId = animal.lotId ?? null;

  // Create release record
  const row = await (tx as any).reproductiveRelease.create({
    data: {
      organizationId: ctx.organizationId,
      farmId,
      animalId: input.animalId,
      releaseDate,
      weightKg: input.weightKg ?? null,
      ageMonths: ageMonths ?? null,
      bodyConditionScore: input.bodyConditionScore ?? null,
      previousCategory,
      previousLotId,
      targetLotId,
      notes: input.notes ?? null,
      recordedBy: userId,
    },
    include: RELEASE_INCLUDE,
  });

  // CA3: Update animal category and set reproductivelyReleased flag
  const newCategory = animal.sex === 'MALE' ? 'NOVILHO' : 'NOVILHA';
  const updateData: any = { reproductivelyReleased: true };
  if (animal.category !== newCategory) {
    updateData.category = newCategory;
  }

  // CA4: Move to target lot if configured
  if (targetLotId && targetLotId !== animal.lotId) {
    updateData.lotId = targetLotId;

    // Close previous lot movement
    if (animal.lotId) {
      await (tx as any).animalLotMovement.updateMany({
        where: { animalId: input.animalId, lotId: animal.lotId, exitedAt: null },
        data: { exitedAt: new Date() },
      });
    }

    // Create new lot movement
    await (tx as any).animalLotMovement.create({
      data: {
        animalId: input.animalId,
        lotId: targetLotId,
        previousLotId: animal.lotId ?? null,
        movedBy: userId,
        reason: 'Liberação para reprodução',
      },
    });
  }

  await (tx as any).animal.update({
    where: { id: input.animalId },
    data: updateData,
  });

  // Optional: create vaccination record
  if (input.vaccination) {
    const vac = input.vaccination;
    await (tx as any).vaccination.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        productId: vac.productId ?? null,
        productName: vac.productName,
        dosageMl: vac.dosageMl,
        administrationRoute: vac.administrationRoute,
        productBatchNumber: vac.productBatchNumber ?? null,
        vaccinationDate: releaseDate,
        recordedBy: userId,
      },
    });
  }

  // Resolve lot names for response
  let previousLotName: string | null = null;
  let targetLotName: string | null = null;
  if (previousLotId) {
    const prevLot = await (tx as any).animalLot.findFirst({
      where: { id: previousLotId },
      select: { name: true },
    });
    previousLotName = prevLot?.name ?? null;
  }
  if (targetLotId) {
    const tgtLot = await (tx as any).animalLot.findFirst({
      where: { id: targetLotId },
      select: { name: true },
    });
    targetLotName = tgtLot?.name ?? null;
  }

  return toReleaseItem(row, previousLotName, targetLotName);
}

export async function createRelease(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateReleaseInput,
): Promise<ReleaseItem> {
  return withRlsContext(ctx, async (tx) => {
    const result = await performRelease(tx, ctx, farmId, userId, input);

    // Optional: create IATF reproductive lot for single animal
    if (input.iatf) {
      await createIatfLotForAnimals(
        tx,
        ctx,
        farmId,
        userId,
        [input.animalId],
        input.iatf,
        input.releaseDate,
      );
    }

    return result;
  });
}

// ─── BULK RELEASE (CA7) ─────────────────────────────────────────────

export async function bulkRelease(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: BulkReleaseInput,
): Promise<BulkReleaseResult> {
  // Support both animals[] (new) and animalIds[] (legacy) formats
  const animalEntries = input.animals?.length
    ? input.animals
    : (input.animalIds ?? []).map((id) => ({ animalId: id, weightKg: null as number | null }));

  if (animalEntries.length === 0) {
    throw new ReproductiveReleaseError('Lista de animais é obrigatória', 400);
  }
  if (!input.releaseDate) {
    throw new ReproductiveReleaseError('Data de liberação é obrigatória', 400);
  }
  return withRlsContext(ctx, async (tx) => {
    let released = 0;
    let failed = 0;
    const errors: Array<{ animalId: string; reason: string }> = [];

    const releasedAnimalIds: string[] = [];

    for (const entry of animalEntries) {
      try {
        await performRelease(tx, ctx, farmId, userId, {
          animalId: entry.animalId,
          releaseDate: input.releaseDate,
          targetLotId: input.targetLotId,
          notes: input.notes,
          weightKg: entry.weightKg ?? null,
          vaccination: input.vaccination,
        });
        released++;
        releasedAnimalIds.push(entry.animalId);
      } catch (err) {
        failed++;
        const message = err instanceof ReproductiveReleaseError ? err.message : 'Erro inesperado';
        errors.push({ animalId: entry.animalId, reason: message });
      }
    }

    // Create single IATF lot for all successfully released animals
    if (input.iatf && releasedAnimalIds.length > 0) {
      await createIatfLotForAnimals(
        tx,
        ctx,
        farmId,
        userId,
        releasedAnimalIds,
        input.iatf,
        input.releaseDate,
      );
    }

    return { released, failed, errors };
  });
}

// ─── LIST RELEASES (CA8) ───────────────────────────────────────────

export async function listReleases(
  ctx: RlsContext,
  farmId: string,
  query: ListReleasesQuery,
): Promise<{ data: ReleaseItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.animalId) where.animalId = query.animalId;
    if (query.dateFrom || query.dateTo) {
      where.releaseDate = {};
      if (query.dateFrom) where.releaseDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.releaseDate.lte = new Date(query.dateTo);
    }
    if (query.search) {
      const term = query.search.trim();
      where.animal = {
        OR: [
          { earTag: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
        ],
      };
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).reproductiveRelease.findMany({
        where,
        include: RELEASE_INCLUDE,
        orderBy: { releaseDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).reproductiveRelease.count({ where }),
    ]);

    // Collect lot IDs for name resolution
    const lotIds = new Set<string>();
    for (const r of rows) {
      if (r.previousLotId) lotIds.add(r.previousLotId);
      if (r.targetLotId) lotIds.add(r.targetLotId);
    }

    const lotsMap = new Map<string, string>();
    if (lotIds.size > 0) {
      const lots = await (tx as any).animalLot.findMany({
        where: { id: { in: Array.from(lotIds) } },
        select: { id: true, name: true },
      });
      for (const l of lots) {
        lotsMap.set(l.id, l.name);
      }
    }

    return {
      data: rows.map((r: any) =>
        toReleaseItem(
          r,
          r.previousLotId ? (lotsMap.get(r.previousLotId) ?? null) : null,
          r.targetLotId ? (lotsMap.get(r.targetLotId) ?? null) : null,
        ),
      ),
      total,
    };
  });
}

// ─── GET RELEASE ───────────────────────────────────────────────────

export async function getRelease(
  ctx: RlsContext,
  farmId: string,
  releaseId: string,
): Promise<ReleaseItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).reproductiveRelease.findFirst({
      where: { id: releaseId, farmId },
      include: RELEASE_INCLUDE,
    });
    if (!row) {
      throw new ReproductiveReleaseError('Registro de liberação não encontrado', 404);
    }

    let previousLotName: string | null = null;
    let targetLotName: string | null = null;
    if (row.previousLotId) {
      const prevLot = await (tx as any).animalLot.findFirst({
        where: { id: row.previousLotId },
        select: { name: true },
      });
      previousLotName = prevLot?.name ?? null;
    }
    if (row.targetLotId) {
      const tgtLot = await (tx as any).animalLot.findFirst({
        where: { id: row.targetLotId },
        select: { name: true },
      });
      targetLotName = tgtLot?.name ?? null;
    }

    return toReleaseItem(row, previousLotName, targetLotName);
  });
}

// ─── INDICATORS (CA9) ──────────────────────────────────────────────

export async function getIndicators(ctx: RlsContext, farmId: string): Promise<ReleaseIndicators> {
  return withRlsContext(ctx, async (tx) => {
    const releases = await (tx as any).reproductiveRelease.findMany({
      where: { farmId },
      select: {
        animalId: true,
        weightKg: true,
        ageMonths: true,
        releaseDate: true,
        animal: {
          select: {
            birthDate: true,
            weighings: {
              orderBy: { measuredAt: 'asc' },
              take: 1,
              select: { measuredAt: true },
            },
          },
        },
      },
    });

    if (releases.length === 0) {
      return {
        totalReleased: 0,
        avgAgeMonths: null,
        avgWeightKg: null,
        avgRearingTimeDays: null,
      };
    }

    let totalAge = 0;
    let ageCount = 0;
    let totalWeight = 0;
    let weightCount = 0;
    let totalRearingDays = 0;
    let rearingCount = 0;

    for (const r of releases) {
      if (r.ageMonths != null) {
        totalAge += r.ageMonths;
        ageCount++;
      }
      if (r.weightKg != null) {
        totalWeight += toNumber(r.weightKg);
        weightCount++;
      }
      // Rearing time: from birthDate (or first weighing as proxy for weaning) to releaseDate
      // Use birthDate as baseline for rearing time calculation
      const birthDate = r.animal?.birthDate as Date | null;
      if (birthDate) {
        const releaseDate = r.releaseDate as Date;
        const diffMs = releaseDate.getTime() - birthDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        totalRearingDays += diffDays;
        rearingCount++;
      }
    }

    return {
      totalReleased: releases.length,
      avgAgeMonths: ageCount > 0 ? Math.round((totalAge / ageCount) * 10) / 10 : null,
      avgWeightKg: weightCount > 0 ? Math.round((totalWeight / weightCount) * 10) / 10 : null,
      avgRearingTimeDays: rearingCount > 0 ? Math.round(totalRearingDays / rearingCount) : null,
    };
  });
}
