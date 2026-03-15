import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  WeaningError,
  FEED_TYPE_LABELS,
  FEEDING_METHOD_LABELS,
  DESTINATION_LABELS,
  isValidFeedType,
  isValidFeedingMethod,
  isValidDestination,
  type FeedTypeValue,
  type FeedingMethodValue,
  type DestinationValue,
  type CreateSeparationInput,
  type SetFeedingProtocolInput,
  type CreateWeaningInput,
  type SetCriteriaInput,
  type ListSeparationsQuery,
  type ListWeaningsQuery,
  type SeparationItem,
  type FeedingProtocolItem,
  type WeaningItem,
  type WeaningCriteriaItem,
  type WeaningCandidateItem,
  type WeaningIndicators,
} from './weaning.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

const SEPARATION_INCLUDE = {
  calf: { select: { earTag: true, name: true } },
  mother: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
  feedingProtocol: true,
};

const WEANING_INCLUDE = {
  calf: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
};

function toFeedingProtocolItem(row: any): FeedingProtocolItem | null {
  if (!row) return null;
  const feedType = row.feedType as FeedTypeValue;
  const feedingMethod = row.feedingMethod as FeedingMethodValue;

  return {
    id: row.id,
    separationId: row.separationId,
    feedType,
    feedTypeLabel: FEED_TYPE_LABELS[feedType] ?? feedType,
    dailyVolumeLiters: row.dailyVolumeLiters,
    frequencyPerDay: row.frequencyPerDay,
    feedingMethod,
    feedingMethodLabel: FEEDING_METHOD_LABELS[feedingMethod] ?? feedingMethod,
    concentrateStartDate: row.concentrateStartDate
      ? (row.concentrateStartDate as Date).toISOString().slice(0, 10)
      : null,
    concentrateGramsPerDay: row.concentrateGramsPerDay ?? null,
    roughageType: row.roughageType ?? null,
    targetWeaningWeightKg: row.targetWeaningWeightKg ?? null,
    notes: row.notes ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toSeparationItem(row: any): SeparationItem {
  const destination = row.destination as DestinationValue | null;

  return {
    id: row.id,
    farmId: row.farmId,
    calfId: row.calfId,
    calfEarTag: row.calf?.earTag ?? '',
    calfName: row.calf?.name ?? null,
    motherId: row.motherId,
    motherEarTag: row.mother?.earTag ?? '',
    motherName: row.mother?.name ?? null,
    separationDate: (row.separationDate as Date).toISOString().slice(0, 10),
    reason: row.reason ?? null,
    destination: destination ?? null,
    destinationLabel: destination ? (DESTINATION_LABELS[destination] ?? destination) : null,
    feedingProtocol: toFeedingProtocolItem(row.feedingProtocol),
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toWeaningItem(row: any): WeaningItem {
  return {
    id: row.id,
    farmId: row.farmId,
    calfId: row.calfId,
    calfEarTag: row.calf?.earTag ?? '',
    calfName: row.calf?.name ?? null,
    weaningDate: (row.weaningDate as Date).toISOString().slice(0, 10),
    weightKg: row.weightKg ?? null,
    ageMonths: row.ageMonths ?? null,
    concentrateConsumptionGrams: row.concentrateConsumptionGrams ?? null,
    previousCategory: row.previousCategory ?? null,
    targetLotId: row.targetLotId ?? null,
    observations: row.observations ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// ─── CREATE SEPARATION (CA1) ────────────────────────────────────────

export async function createSeparation(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateSeparationInput,
): Promise<SeparationItem> {
  if (!input.calfId) {
    throw new WeaningError('Bezerro é obrigatório', 400);
  }
  if (!input.motherId) {
    throw new WeaningError('Mãe é obrigatória', 400);
  }
  if (!input.separationDate) {
    throw new WeaningError('Data de separação é obrigatória', 400);
  }
  const sepDate = new Date(input.separationDate);
  if (isNaN(sepDate.getTime())) {
    throw new WeaningError('Data de separação inválida', 400);
  }
  if (input.destination && !isValidDestination(input.destination)) {
    throw new WeaningError('Destino inválido. Use CALF_PEN, INDIVIDUAL_STALL ou CALF_PADDOCK', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate calf
    const calf = await (tx as any).animal.findFirst({
      where: { id: input.calfId, farmId, deletedAt: null },
      select: { id: true, earTag: true, category: true, damId: true },
    });
    if (!calf) {
      throw new WeaningError('Bezerro não encontrado', 404);
    }
    if (!['BEZERRO', 'BEZERRA'].includes(calf.category)) {
      throw new WeaningError(`Animal ${calf.earTag} não é um bezerro/bezerra`, 400);
    }

    // Validate mother
    const mother = await (tx as any).animal.findFirst({
      where: { id: input.motherId, farmId, deletedAt: null },
      select: { id: true, sex: true, earTag: true },
    });
    if (!mother) {
      throw new WeaningError('Mãe não encontrada', 404);
    }
    if (mother.sex !== 'FEMALE') {
      throw new WeaningError(`Animal ${mother.earTag} não é fêmea`, 400);
    }

    // Check for existing separation
    const existing = await (tx as any).calfSeparation.findFirst({
      where: { calfId: input.calfId, farmId },
    });
    if (existing) {
      throw new WeaningError(`Bezerro ${calf.earTag} já possui registro de separação`, 409);
    }

    const row = await (tx as any).calfSeparation.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        calfId: input.calfId,
        motherId: input.motherId,
        separationDate: sepDate,
        reason: input.reason?.trim() ?? null,
        destination: input.destination ?? null,
        recordedBy: userId,
      },
      include: SEPARATION_INCLUDE,
    });

    return toSeparationItem(row);
  });
}

// ─── SET FEEDING PROTOCOL (CA2) ─────────────────────────────────────

export async function setFeedingProtocol(
  ctx: RlsContext,
  separationId: string,
  input: SetFeedingProtocolInput,
): Promise<FeedingProtocolItem> {
  if (!input.feedType || !isValidFeedType(input.feedType)) {
    throw new WeaningError(
      'Tipo de alimento inválido. Use WHOLE_MILK, PASTEURIZED_DISCARD_MILK ou MILK_REPLACER',
      400,
    );
  }
  if (input.dailyVolumeLiters === undefined || input.dailyVolumeLiters <= 0) {
    throw new WeaningError('Volume diário deve ser maior que 0', 400);
  }
  if (!input.feedingMethod || !isValidFeedingMethod(input.feedingMethod)) {
    throw new WeaningError(
      'Método de aleitamento inválido. Use BUCKET_NIPPLE, BOTTLE ou FOSTER_COLLECTIVE',
      400,
    );
  }
  if (
    input.frequencyPerDay !== undefined &&
    (input.frequencyPerDay < 1 || input.frequencyPerDay > 6)
  ) {
    throw new WeaningError('Frequência diária deve ser entre 1 e 6', 400);
  }
  if (
    input.concentrateGramsPerDay !== undefined &&
    input.concentrateGramsPerDay !== null &&
    input.concentrateGramsPerDay < 0
  ) {
    throw new WeaningError('Consumo de concentrado deve ser >= 0', 400);
  }
  if (
    input.targetWeaningWeightKg !== undefined &&
    input.targetWeaningWeightKg !== null &&
    input.targetWeaningWeightKg <= 0
  ) {
    throw new WeaningError('Peso alvo para desmame deve ser maior que 0', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate separation exists
    const separation = await (tx as any).calfSeparation.findFirst({
      where: { id: separationId },
    });
    if (!separation) {
      throw new WeaningError('Registro de separação não encontrado', 404);
    }

    const data: any = {
      feedType: input.feedType,
      dailyVolumeLiters: input.dailyVolumeLiters,
      frequencyPerDay: input.frequencyPerDay ?? 2,
      feedingMethod: input.feedingMethod,
      concentrateStartDate: input.concentrateStartDate
        ? new Date(input.concentrateStartDate)
        : null,
      concentrateGramsPerDay: input.concentrateGramsPerDay ?? null,
      roughageType: input.roughageType?.trim() ?? null,
      targetWeaningWeightKg: input.targetWeaningWeightKg ?? null,
      notes: input.notes?.trim() ?? null,
    };

    const row = await (tx as any).calfFeedingProtocol.upsert({
      where: { separationId },
      create: {
        separationId,
        ...data,
      },
      update: data,
    });

    return toFeedingProtocolItem(row)!;
  });
}

// ─── LIST SEPARATIONS ───────────────────────────────────────────────

export async function listSeparations(
  ctx: RlsContext,
  farmId: string,
  query: ListSeparationsQuery,
): Promise<{ data: SeparationItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.calfId) where.calfId = query.calfId;
    if (query.motherId) where.motherId = query.motherId;
    if (query.dateFrom || query.dateTo) {
      where.separationDate = {};
      if (query.dateFrom) where.separationDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.separationDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).calfSeparation.findMany({
        where,
        include: SEPARATION_INCLUDE,
        orderBy: { separationDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).calfSeparation.count({ where }),
    ]);

    return {
      data: rows.map(toSeparationItem),
      total,
    };
  });
}

// ─── GET SEPARATION ─────────────────────────────────────────────────

export async function getSeparation(
  ctx: RlsContext,
  farmId: string,
  separationId: string,
): Promise<SeparationItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).calfSeparation.findFirst({
      where: { id: separationId, farmId },
      include: SEPARATION_INCLUDE,
    });
    if (!row) {
      throw new WeaningError('Registro de separação não encontrado', 404);
    }
    return toSeparationItem(row);
  });
}

// ─── DELETE SEPARATION ──────────────────────────────────────────────

export async function deleteSeparation(
  ctx: RlsContext,
  farmId: string,
  separationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).calfSeparation.findFirst({
      where: { id: separationId, farmId },
    });
    if (!existing) {
      throw new WeaningError('Registro de separação não encontrado', 404);
    }
    await (tx as any).calfSeparation.delete({ where: { id: separationId } });
  });
}

// ─── SET CRITERIA (CA4) ─────────────────────────────────────────────

export async function setCriteria(
  ctx: RlsContext,
  input: SetCriteriaInput,
): Promise<WeaningCriteriaItem> {
  if (input.minAgeDays !== undefined && input.minAgeDays !== null && input.minAgeDays < 1) {
    throw new WeaningError('Idade mínima deve ser pelo menos 1 dia', 400);
  }
  if (input.minWeightKg !== undefined && input.minWeightKg !== null && input.minWeightKg <= 0) {
    throw new WeaningError('Peso mínimo deve ser maior que 0', 400);
  }
  if (
    input.minConcentrateGrams !== undefined &&
    input.minConcentrateGrams !== null &&
    input.minConcentrateGrams <= 0
  ) {
    throw new WeaningError('Consumo mínimo de concentrado deve ser maior que 0', 400);
  }
  if (
    input.consecutiveDays !== undefined &&
    input.consecutiveDays !== null &&
    input.consecutiveDays < 1
  ) {
    throw new WeaningError('Dias consecutivos deve ser pelo menos 1', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const data: any = {
      minAgeDays: input.minAgeDays ?? null,
      minWeightKg: input.minWeightKg ?? null,
      minConcentrateGrams: input.minConcentrateGrams ?? null,
      consecutiveDays: input.consecutiveDays ?? 3,
      targetLotId: input.targetLotId ?? null,
    };

    const row = await (tx as any).weaningCriteria.upsert({
      where: { organizationId: ctx.organizationId },
      create: {
        organizationId: ctx.organizationId,
        ...data,
      },
      update: data,
    });

    return toCriteriaItem(row);
  });
}

// ─── GET CRITERIA ───────────────────────────────────────────────────

export async function getCriteria(ctx: RlsContext): Promise<WeaningCriteriaItem | null> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).weaningCriteria.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    if (!row) return null;
    return toCriteriaItem(row);
  });
}

function toCriteriaItem(row: any): WeaningCriteriaItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    minAgeDays: row.minAgeDays ?? null,
    minWeightKg: row.minWeightKg ?? null,
    minConcentrateGrams: row.minConcentrateGrams ?? null,
    consecutiveDays: row.consecutiveDays ?? null,
    targetLotId: row.targetLotId ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ─── GET WEANING CANDIDATES (CA4) ───────────────────────────────────

export async function getWeaningCandidates(
  ctx: RlsContext,
  farmId: string,
): Promise<WeaningCandidateItem[]> {
  return withRlsContext(ctx, async (tx) => {
    // Get criteria
    const criteria = await (tx as any).weaningCriteria.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    // Get nursing calves (BEZERRO/BEZERRA) that have a separation but no weaning yet
    const calves = await (tx as any).animal.findMany({
      where: {
        farmId,
        category: { in: ['BEZERRO', 'BEZERRA'] },
        deletedAt: null,
        calfSeparations: { some: {} },
        weaningRecords: { none: {} },
      },
      select: {
        id: true,
        earTag: true,
        name: true,
        birthDate: true,
        entryWeightKg: true,
        damId: true,
        calfSeparations: {
          select: { motherId: true },
          take: 1,
        },
      },
    });

    // Get latest weighings for these calves
    const calfIds = calves.map((c: any) => c.id);
    const latestWeighings =
      calfIds.length > 0
        ? await (tx as any).animalWeighing.findMany({
            where: { animalId: { in: calfIds } },
            orderBy: { weighingDate: 'desc' },
            distinct: ['animalId'],
            select: { animalId: true, weightKg: true },
          })
        : [];
    const weightMap = new Map<string, number>();
    for (const w of latestWeighings) {
      weightMap.set(w.animalId, Number(w.weightKg));
    }

    // Get mother ear tags
    const motherIds = calves
      .map((c: any) => c.calfSeparations?.[0]?.motherId ?? c.damId)
      .filter(Boolean);
    const mothers =
      motherIds.length > 0
        ? await (tx as any).animal.findMany({
            where: { id: { in: motherIds }, deletedAt: null },
            select: { id: true, earTag: true },
          })
        : [];
    const motherMap = new Map<string, string>();
    for (const m of mothers) {
      motherMap.set(m.id, m.earTag);
    }

    const now = new Date();

    return calves.map((calf: any) => {
      const birthDate = calf.birthDate as Date | null;
      const ageDays = birthDate
        ? Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const currentWeight =
        weightMap.get(calf.id) ?? (calf.entryWeightKg ? Number(calf.entryWeightKg) : null);
      const motherId = calf.calfSeparations?.[0]?.motherId ?? calf.damId ?? '';

      const meetsAge =
        criteria?.minAgeDays != null && ageDays != null ? ageDays >= criteria.minAgeDays : true;
      const meetsWeight =
        criteria?.minWeightKg != null && currentWeight != null
          ? currentWeight >= criteria.minWeightKg
          : true;

      // For concentrate criterion, we use a simplified check (placeholder)
      const meetsAllCriteria = meetsAge && meetsWeight;

      return {
        calfId: calf.id,
        calfEarTag: calf.earTag,
        calfName: calf.name ?? null,
        birthDate: birthDate ? birthDate.toISOString().slice(0, 10) : null,
        ageDays,
        currentWeightKg: currentWeight,
        motherId,
        motherEarTag: motherMap.get(motherId) ?? '',
        meetsAge,
        meetsWeight,
        meetsAllCriteria,
      };
    });
  });
}

// ─── CREATE WEANING (CA5-CA7, CA9) ──────────────────────────────────

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
  if (input.ageMonths !== undefined && input.ageMonths !== null && input.ageMonths < 0) {
    throw new WeaningError('Idade em meses deve ser >= 0', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate calf
    const calf = await (tx as any).animal.findFirst({
      where: { id: input.calfId, farmId, deletedAt: null },
      select: { id: true, earTag: true, category: true, sex: true, lotId: true, damId: true },
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

    const previousCategory = calf.category;

    // CA6: Update category — BEZERRO → NOVILHO, BEZERRA → NOVILHA
    const newCategory = calf.sex === 'MALE' ? 'NOVILHO' : 'NOVILHA';
    await (tx as any).animal.update({
      where: { id: input.calfId },
      data: { category: newCategory },
    });

    // CA7: Move to target lot if configured
    const targetLotId = input.targetLotId ?? null;
    if (targetLotId) {
      const lot = await (tx as any).animalLot.findFirst({
        where: { id: targetLotId, farmId, deletedAt: null },
      });
      if (!lot) {
        throw new WeaningError('Lote de destino não encontrado', 404);
      }

      // Close current lot movement if any
      if (calf.lotId) {
        await (tx as any).animalLotMovement.updateMany({
          where: { animalId: input.calfId, lotId: calf.lotId, exitedAt: null },
          data: { exitedAt: new Date() },
        });
      }

      // Create new lot movement
      await (tx as any).animalLotMovement.create({
        data: {
          animalId: input.calfId,
          lotId: targetLotId,
          previousLotId: calf.lotId ?? null,
          movedBy: userId,
          reason: 'Desmame — movimentação automática',
        },
      });

      // Update animal's current lot
      await (tx as any).animal.update({
        where: { id: input.calfId },
        data: { lotId: targetLotId },
      });
    }

    // CA9: Update mother status — confirm in regular milking (lactating)
    if (calf.damId) {
      await (tx as any).animal.update({
        where: { id: calf.damId },
        data: { category: 'VACA_LACTACAO' },
      });
    }

    const row = await (tx as any).weaningRecord.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        calfId: input.calfId,
        weaningDate: wDate,
        weightKg: input.weightKg ?? null,
        ageMonths: input.ageMonths ?? null,
        concentrateConsumptionGrams: input.concentrateConsumptionGrams ?? null,
        previousCategory,
        targetLotId,
        observations: input.observations?.trim() ?? null,
        recordedBy: userId,
      },
      include: WEANING_INCLUDE,
    });

    return toWeaningItem(row);
  });
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

// ─── INDICATORS (CA8) ──────────────────────────────────────────────

export async function getWeaningIndicators(
  ctx: RlsContext,
  farmId: string,
): Promise<WeaningIndicators> {
  return withRlsContext(ctx, async (tx) => {
    // Last 365 days
    const now = new Date();
    const periodEnd = now.toISOString().slice(0, 10);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 365);
    const periodStartStr = periodStart.toISOString().slice(0, 10);

    const dateFilter = {
      gte: new Date(periodStartStr),
      lte: new Date(periodEnd),
    };

    // Weanings in period
    const weanings = await (tx as any).weaningRecord.findMany({
      where: {
        farmId,
        weaningDate: dateFilter,
      },
      select: { weightKg: true, ageMonths: true },
    });

    const totalWeanings = weanings.length;

    // Avg weaning weight
    const weights = weanings
      .filter((w: any) => w.weightKg != null)
      .map((w: any) => w.weightKg as number);
    const avgWeaningWeightKg =
      weights.length > 0
        ? Math.round((weights.reduce((a: number, b: number) => a + b, 0) / weights.length) * 10) /
          10
        : null;

    // Avg weaning age
    const ages = weanings
      .filter((w: any) => w.ageMonths != null)
      .map((w: any) => w.ageMonths as number);
    const avgWeaningAgeMonths =
      ages.length > 0
        ? Math.round((ages.reduce((a: number, b: number) => a + b, 0) / ages.length) * 10) / 10
        : null;

    // Total separations in period
    const totalSeparations = await (tx as any).calfSeparation.count({
      where: {
        farmId,
        separationDate: dateFilter,
      },
    });

    // Nursing calves (separated but not weaned)
    const nursingCalves = await (tx as any).animal.count({
      where: {
        farmId,
        category: { in: ['BEZERRO', 'BEZERRA'] },
        deletedAt: null,
        calfSeparations: { some: {} },
        weaningRecords: { none: {} },
      },
    });

    // Mortality rate: dead calves (deletedAt not null) that were in nursing phase
    // Simplified: calves born in period that are now deleted / total born
    const bornInPeriod = await (tx as any).animal.count({
      where: {
        farmId,
        origin: 'BORN',
        createdAt: dateFilter,
      },
    });
    const deadInPeriod = await (tx as any).animal.count({
      where: {
        farmId,
        origin: 'BORN',
        createdAt: dateFilter,
        deletedAt: { not: null },
      },
    });
    const mortalityRate =
      bornInPeriod > 0 ? Math.round((deadInPeriod / bornInPeriod) * 1000) / 10 : null;

    return {
      totalWeanings,
      avgWeaningWeightKg,
      avgWeaningAgeMonths,
      totalSeparations,
      nursingCalves,
      mortalityRate,
      feedingCostPlaceholder: null, // CA8: placeholder para custo de aleitamento
      periodStart: periodStartStr,
      periodEnd,
    };
  });
}
