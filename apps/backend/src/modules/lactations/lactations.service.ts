import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  LactationError,
  LACTATION_ORIGIN_LABELS,
  LACTATION_STATUS_LABELS,
  DRYING_REASON_LABELS,
  isValidOrigin,
  isValidDryingReason,
  type LactationOriginValue,
  type LactationStatusValue,
  type DryingReasonValue,
  type CreateLactationInput,
  type InduceLactationInput,
  type DryOffInput,
  type UpdateLactationInput,
  type ListLactationsQuery,
  type LactationItem,
  type LactationCurvePoint,
  type LactationIndicators,
  type DryingAlertItem,
  type LactationHistoryItem,
} from './lactations.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Constants ──────────────────────────────────────────────────────

// Configurable thresholds for drying alerts (CA9)
const DEFAULT_MAX_DEL = 305;
const DEFAULT_MIN_PRODUCTION_LITERS = 5;
const DEFAULT_MAX_GESTATION_DAYS = 220;

const LACTATION_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
};

// ─── Helpers ────────────────────────────────────────────────────────

function calcDel(startDate: Date, endDate?: Date | null): number {
  const end = endDate ?? new Date();
  const diffMs = end.getTime() - startDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function toLactationItem(row: any): LactationItem {
  const origin = row.origin as LactationOriginValue;
  const status = row.status as LactationStatusValue;
  const dryingReason = row.dryingReason as DryingReasonValue | null;
  const startDate = row.startDate as Date;
  const endDate = row.endDate as Date | null;

  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    lactationNumber: row.lactationNumber,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
    origin,
    originLabel: LACTATION_ORIGIN_LABELS[origin] ?? origin,
    status,
    statusLabel: LACTATION_STATUS_LABELS[status] ?? status,
    del: calcDel(startDate, endDate),
    inductionProtocol: row.inductionProtocol ?? null,
    inductionReason: row.inductionReason ?? null,
    inductionVet: row.inductionVet ?? null,
    firstMilkingDate: row.firstMilkingDate
      ? (row.firstMilkingDate as Date).toISOString().slice(0, 10)
      : null,
    dryingReason,
    dryingReasonLabel: dryingReason ? (DRYING_REASON_LABELS[dryingReason] ?? dryingReason) : null,
    dryingProtocol: row.dryingProtocol ?? null,
    dryingVet: row.dryingVet ?? null,
    peakLiters: row.peakLiters ?? null,
    peakDel: row.peakDel ?? null,
    accumulated305: row.accumulated305 ?? null,
    totalAccumulated: row.totalAccumulated ?? null,
    durationDays: row.durationDays ?? null,
    calvingEventId: row.calvingEventId ?? null,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

async function validateAnimalForLactation(tx: any, animalId: string, farmId: string): Promise<any> {
  const animal = await tx.animal.findFirst({
    where: { id: animalId, farmId, deletedAt: null },
    select: { id: true, earTag: true, name: true, sex: true },
  });

  if (!animal) {
    throw new LactationError('Animal não encontrado', 404);
  }

  if (animal.sex === 'MALE') {
    throw new LactationError(
      `Animal ${animal.earTag} é macho e não pode ter lactação registrada`,
      400,
    );
  }

  return animal;
}

async function getNextLactationNumber(tx: any, animalId: string): Promise<number> {
  const count = await (tx as any).lactation.count({
    where: { animalId },
  });
  return count + 1;
}

// ─── CREATE (CA1) ───────────────────────────────────────────────────

export async function createLactation(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateLactationInput,
): Promise<LactationItem> {
  if (!input.animalId?.trim()) {
    throw new LactationError('Animal é obrigatório', 400);
  }
  if (!input.startDate) {
    throw new LactationError('Data de início é obrigatória', 400);
  }
  const startDate = new Date(input.startDate);
  if (isNaN(startDate.getTime())) {
    throw new LactationError('Data de início inválida', 400);
  }
  if (!input.origin || !isValidOrigin(input.origin)) {
    throw new LactationError('Origem inválida. Use BIRTH ou INDUCTION', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    await validateAnimalForLactation(tx, input.animalId, farmId);

    // Check no active lactation
    const active = await (tx as any).lactation.findFirst({
      where: { animalId: input.animalId, status: 'IN_PROGRESS' },
    });
    if (active) {
      throw new LactationError(
        'Animal já possui lactação em andamento. Encerre a lactação atual antes de iniciar nova',
        409,
      );
    }

    const lactationNumber = await getNextLactationNumber(tx, input.animalId);

    const row = await (tx as any).lactation.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        lactationNumber,
        startDate,
        origin: input.origin,
        calvingEventId: input.calvingEventId ?? null,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: LACTATION_INCLUDE,
    });

    return toLactationItem(row);
  });
}

// ─── INDUCE LACTATION (CA3) ─────────────────────────────────────────

export async function induceLactation(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: InduceLactationInput,
): Promise<LactationItem> {
  if (!input.animalId?.trim()) {
    throw new LactationError('Animal é obrigatório', 400);
  }
  if (!input.startDate) {
    throw new LactationError('Data de início é obrigatória', 400);
  }
  const startDate = new Date(input.startDate);
  if (isNaN(startDate.getTime())) {
    throw new LactationError('Data de início inválida', 400);
  }
  if (!input.inductionProtocol?.trim()) {
    throw new LactationError('Protocolo de indução é obrigatório', 400);
  }
  if (!input.inductionReason?.trim()) {
    throw new LactationError('Motivo da indução é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    await validateAnimalForLactation(tx, input.animalId, farmId);

    // Check no active lactation
    const active = await (tx as any).lactation.findFirst({
      where: { animalId: input.animalId, status: 'IN_PROGRESS' },
    });
    if (active) {
      throw new LactationError(
        'Animal já possui lactação em andamento. Encerre a lactação atual antes de iniciar nova',
        409,
      );
    }

    const lactationNumber = await getNextLactationNumber(tx, input.animalId);

    const row = await (tx as any).lactation.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        lactationNumber,
        startDate,
        origin: 'INDUCTION',
        inductionProtocol: input.inductionProtocol,
        inductionReason: input.inductionReason,
        inductionVet: input.inductionVet ?? null,
        firstMilkingDate: input.firstMilkingDate ? new Date(input.firstMilkingDate) : null,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: LACTATION_INCLUDE,
    });

    return toLactationItem(row);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listLactations(
  ctx: RlsContext,
  farmId: string,
  query: ListLactationsQuery,
): Promise<{ data: LactationItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.animalId) where.animalId = query.animalId;
    if (query.status) where.status = query.status;

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).lactation.findMany({
        where,
        include: LACTATION_INCLUDE,
        orderBy: [{ startDate: 'desc' }],
        skip,
        take: limit,
      }),
      (tx as any).lactation.count({ where }),
    ]);

    return {
      data: rows.map(toLactationItem),
      total,
    };
  });
}

// ─── GET (CA4: includes DEL) ────────────────────────────────────────

export async function getLactation(
  ctx: RlsContext,
  farmId: string,
  lactationId: string,
): Promise<LactationItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).lactation.findFirst({
      where: { id: lactationId, farmId },
      include: LACTATION_INCLUDE,
    });
    if (!row) {
      throw new LactationError('Lactação não encontrada', 404);
    }
    return toLactationItem(row);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateLactation(
  ctx: RlsContext,
  farmId: string,
  lactationId: string,
  input: UpdateLactationInput,
): Promise<LactationItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).lactation.findFirst({
      where: { id: lactationId, farmId },
    });
    if (!existing) {
      throw new LactationError('Lactação não encontrada', 404);
    }

    const data: any = {};

    if (input.startDate !== undefined) {
      const startDate = new Date(input.startDate);
      if (isNaN(startDate.getTime())) {
        throw new LactationError('Data de início inválida', 400);
      }
      data.startDate = startDate;
    }
    if (input.inductionProtocol !== undefined) data.inductionProtocol = input.inductionProtocol;
    if (input.inductionReason !== undefined) data.inductionReason = input.inductionReason;
    if (input.inductionVet !== undefined) data.inductionVet = input.inductionVet;
    if (input.firstMilkingDate !== undefined) {
      data.firstMilkingDate = input.firstMilkingDate ? new Date(input.firstMilkingDate) : null;
    }
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).lactation.update({
      where: { id: lactationId },
      data,
      include: LACTATION_INCLUDE,
    });

    return toLactationItem(row);
  });
}

// ─── DRY OFF (CA8) ─────────────────────────────────────────────────

export async function dryOff(
  ctx: RlsContext,
  farmId: string,
  lactationId: string,
  input: DryOffInput,
): Promise<LactationItem> {
  if (!input.endDate) {
    throw new LactationError('Data de secagem é obrigatória', 400);
  }
  const endDate = new Date(input.endDate);
  if (isNaN(endDate.getTime())) {
    throw new LactationError('Data de secagem inválida', 400);
  }
  if (!input.dryingReason || !isValidDryingReason(input.dryingReason)) {
    throw new LactationError(
      'Motivo da secagem inválido. Use SCHEDULED, LOW_PRODUCTION, TREATMENT ou ADVANCED_GESTATION',
      400,
    );
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).lactation.findFirst({
      where: { id: lactationId, farmId },
    });
    if (!existing) {
      throw new LactationError('Lactação não encontrada', 404);
    }
    if (existing.status === 'DRIED') {
      throw new LactationError('Lactação já está encerrada', 400);
    }

    const startDate = existing.startDate as Date;
    if (endDate < startDate) {
      throw new LactationError('Data de secagem não pode ser anterior à data de início', 400);
    }

    const durationDays = calcDel(startDate, endDate);

    const [row] = await Promise.all([
      (tx as any).lactation.update({
        where: { id: lactationId },
        data: {
          endDate,
          status: 'DRIED',
          dryingReason: input.dryingReason,
          dryingProtocol: input.dryingProtocol ?? null,
          dryingVet: input.dryingVet ?? null,
          durationDays,
          notes: input.notes !== undefined ? input.notes : existing.notes,
        },
        include: LACTATION_INCLUDE,
      }),
      (tx as any).animal.update({
        where: { id: existing.animalId },
        data: { category: 'VACA_SECA' },
      }),
    ]);

    return toLactationItem(row);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteLactation(
  ctx: RlsContext,
  farmId: string,
  lactationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).lactation.findFirst({
      where: { id: lactationId, farmId },
    });
    if (!existing) {
      throw new LactationError('Lactação não encontrada', 404);
    }

    await (tx as any).lactation.delete({ where: { id: lactationId } });
  });
}

// ─── LACTATION CURVE (CA5) ──────────────────────────────────────────

export async function getLactationCurve(
  ctx: RlsContext,
  farmId: string,
  lactationId: string,
): Promise<LactationCurvePoint[]> {
  return withRlsContext(ctx, async (tx) => {
    const lactation = await (tx as any).lactation.findFirst({
      where: { id: lactationId, farmId },
    });
    if (!lactation) {
      throw new LactationError('Lactação não encontrada', 404);
    }

    const startDate = lactation.startDate as Date;
    const endDate = (lactation.endDate as Date | null) ?? new Date();

    // Get milking records for this animal in the lactation period
    const records = await (tx as any).milkingRecord.findMany({
      where: {
        farmId,
        animalId: lactation.animalId,
        milkingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        milkingDate: true,
        liters: true,
      },
      orderBy: { milkingDate: 'asc' },
    });

    // Group by date (sum shifts for daily total)
    const dateMap = new Map<string, { totalLiters: number; date: Date }>();
    for (const r of records) {
      const dateKey = (r.milkingDate as Date).toISOString().slice(0, 10);
      const entry = dateMap.get(dateKey) ?? { totalLiters: 0, date: r.milkingDate as Date };
      entry.totalLiters += r.liters;
      dateMap.set(dateKey, entry);
    }

    // Convert to curve points with DEL
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, data]) => ({
        del: calcDel(startDate, data.date),
        liters: Math.round(data.totalLiters * 100) / 100,
        date: dateKey,
      }));
  });
}

// ─── CALCULATE INDICATORS (CA6) ────────────────────────────────────

export async function calculateIndicators(
  ctx: RlsContext,
  farmId: string,
  lactationId: string,
): Promise<LactationIndicators> {
  return withRlsContext(ctx, async (tx) => {
    const lactation = await (tx as any).lactation.findFirst({
      where: { id: lactationId, farmId },
    });
    if (!lactation) {
      throw new LactationError('Lactação não encontrada', 404);
    }

    const startDate = lactation.startDate as Date;
    const endDate = (lactation.endDate as Date | null) ?? new Date();
    const durationDays = calcDel(startDate, endDate);

    // Get milking records for this lactation period
    const records = await (tx as any).milkingRecord.findMany({
      where: {
        farmId,
        animalId: lactation.animalId,
        milkingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        milkingDate: true,
        liters: true,
      },
      orderBy: { milkingDate: 'asc' },
    });

    // Group by date
    const dailyMap = new Map<string, { totalLiters: number; date: Date }>();
    for (const r of records) {
      const dateKey = (r.milkingDate as Date).toISOString().slice(0, 10);
      const entry = dailyMap.get(dateKey) ?? { totalLiters: 0, date: r.milkingDate as Date };
      entry.totalLiters += r.liters;
      dailyMap.set(dateKey, entry);
    }

    const dailyEntries = Array.from(dailyMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    // Peak (CA6)
    let peakLiters: number | null = null;
    let peakDel: number | null = null;
    for (const entry of dailyEntries) {
      if (peakLiters === null || entry.totalLiters > peakLiters) {
        peakLiters = Math.round(entry.totalLiters * 100) / 100;
        peakDel = calcDel(startDate, entry.date);
      }
    }

    // Total accumulated
    const totalAccumulated =
      dailyEntries.length > 0
        ? Math.round(dailyEntries.reduce((sum, e) => sum + e.totalLiters, 0) * 100) / 100
        : null;

    // 305-day accumulated (only sum up to DEL 305)
    let accumulated305: number | null = null;
    if (dailyEntries.length > 0) {
      let sum305 = 0;
      for (const entry of dailyEntries) {
        const del = calcDel(startDate, entry.date);
        if (del <= 305) {
          sum305 += entry.totalLiters;
        }
      }
      accumulated305 = Math.round(sum305 * 100) / 100;
    }

    // Persistency (% decline from peak per 30 days after peak)
    let persistency: number | null = null;
    if (peakDel !== null && peakLiters !== null && peakLiters > 0) {
      const postPeakEntries = dailyEntries.filter((e) => calcDel(startDate, e.date) > peakDel!);
      if (postPeakEntries.length >= 7) {
        // Get average of last 7 days after peak
        const last7 = postPeakEntries.slice(-7);
        const avgLast7 = last7.reduce((s, e) => s + e.totalLiters, 0) / last7.length;
        const daysSincePeak = calcDel(startDate, last7[last7.length - 1].date) - peakDel;
        if (daysSincePeak > 0) {
          const monthlyDecline =
            ((peakLiters - avgLast7) / peakLiters) * (30 / daysSincePeak) * 100;
          persistency = Math.round(monthlyDecline * 100) / 100;
        }
      }
    }

    // Average daily liters
    const avgDailyLiters =
      dailyEntries.length > 0
        ? Math.round((totalAccumulated! / dailyEntries.length) * 100) / 100
        : null;

    // Production projection (CA7): project to 305 days based on current avg
    let projectedTotal: number | null = null;
    if (avgDailyLiters !== null && durationDays < 305) {
      projectedTotal = Math.round(avgDailyLiters * 305 * 100) / 100;
    } else if (accumulated305 !== null) {
      projectedTotal = accumulated305;
    }

    // Update lactation with indicators
    await (tx as any).lactation.update({
      where: { id: lactationId },
      data: {
        peakLiters,
        peakDel,
        accumulated305,
        totalAccumulated,
        durationDays,
      },
    });

    return {
      lactationId,
      peakLiters,
      peakDel,
      persistency,
      accumulated305,
      totalAccumulated,
      durationDays,
      avgDailyLiters,
      projectedTotal,
    };
  });
}

// ─── DRYING ALERTS (CA9) ───────────────────────────────────────────

export async function getDryingAlerts(
  ctx: RlsContext,
  farmId: string,
  options?: {
    maxDel?: number;
    minProductionLiters?: number;
    maxGestationDays?: number;
  },
): Promise<DryingAlertItem[]> {
  const maxDel = options?.maxDel ?? DEFAULT_MAX_DEL;
  const minProduction = options?.minProductionLiters ?? DEFAULT_MIN_PRODUCTION_LITERS;
  const maxGestation = options?.maxGestationDays ?? DEFAULT_MAX_GESTATION_DAYS;

  return withRlsContext(ctx, async (tx) => {
    // Get all active lactations
    const activeLactations = await (tx as any).lactation.findMany({
      where: { farmId, status: 'IN_PROGRESS' },
      include: {
        animal: { select: { earTag: true, name: true } },
      },
    });

    const alerts: DryingAlertItem[] = [];
    const today = new Date();

    for (const lac of activeLactations) {
      const startDate = lac.startDate as Date;
      const del = calcDel(startDate, today);
      const reasons: string[] = [];

      // Check DEL threshold
      if (del > maxDel) {
        reasons.push(`DEL acima do limite (${del} dias, máximo ${maxDel})`);
      }

      // Check last production
      let lastDailyLiters: number | null = null;
      const recentRecords = await (tx as any).milkingRecord.findMany({
        where: {
          farmId,
          animalId: lac.animalId,
          milkingDate: {
            gte: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), // last 3 days
          },
        },
        select: { milkingDate: true, liters: true },
        orderBy: { milkingDate: 'desc' },
      });

      if (recentRecords.length > 0) {
        // Group by date, take latest
        const dateMap = new Map<string, number>();
        for (const r of recentRecords) {
          const dk = (r.milkingDate as Date).toISOString().slice(0, 10);
          dateMap.set(dk, (dateMap.get(dk) ?? 0) + r.liters);
        }
        const sorted = Array.from(dateMap.entries()).sort(([a], [b]) => b.localeCompare(a));
        if (sorted.length > 0) {
          lastDailyLiters = Math.round(sorted[0][1] * 100) / 100;
          if (lastDailyLiters < minProduction) {
            reasons.push(
              `Produção abaixo do mínimo (${lastDailyLiters}L/dia, mínimo ${minProduction}L)`,
            );
          }
        }
      }

      // Check gestation days (from pregnancy diagnosis)
      let gestationDays: number | null = null;
      const diagnosis = await (tx as any).pregnancyDiagnosis.findFirst({
        where: {
          farmId,
          animalId: lac.animalId,
          result: 'PREGNANT',
          lossDate: null,
        },
        orderBy: { diagnosisDate: 'desc' },
        select: { gestationDays: true, diagnosisDate: true },
      });

      if (diagnosis && diagnosis.gestationDays) {
        const diagDate = diagnosis.diagnosisDate as Date;
        const daysSinceDiag = calcDel(diagDate, today);
        gestationDays = (diagnosis.gestationDays as number) + daysSinceDiag;

        if (gestationDays! > maxGestation) {
          reasons.push(`Gestação avançada (${gestationDays} dias, limite ${maxGestation})`);
        }
      }

      if (reasons.length > 0) {
        alerts.push({
          animalId: lac.animalId,
          animalEarTag: lac.animal?.earTag ?? '',
          animalName: lac.animal?.name ?? null,
          lactationId: lac.id,
          del,
          lastDailyLiters,
          gestationDays,
          reasons,
        });
      }
    }

    return alerts;
  });
}

// ─── ANIMAL LACTATION HISTORY (CA11) ────────────────────────────────

export async function getAnimalLactationHistory(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<LactationHistoryItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new LactationError('Animal não encontrado', 404);
    }

    const rows = await (tx as any).lactation.findMany({
      where: { farmId, animalId },
      orderBy: { lactationNumber: 'asc' },
    });

    return rows.map((row: any): LactationHistoryItem => {
      const origin = row.origin as LactationOriginValue;
      const status = row.status as LactationStatusValue;
      return {
        id: row.id,
        lactationNumber: row.lactationNumber,
        origin,
        originLabel: LACTATION_ORIGIN_LABELS[origin] ?? origin,
        status,
        statusLabel: LACTATION_STATUS_LABELS[status] ?? status,
        startDate: (row.startDate as Date).toISOString().slice(0, 10),
        endDate: row.endDate ? (row.endDate as Date).toISOString().slice(0, 10) : null,
        durationDays: row.durationDays ?? null,
        accumulated305: row.accumulated305 ?? null,
        totalAccumulated: row.totalAccumulated ?? null,
        peakLiters: row.peakLiters ?? null,
        peakDel: row.peakDel ?? null,
      };
    });
  });
}

// ─── ACTIVE LACTATIONS ──────────────────────────────────────────────

export async function getActiveLactations(
  ctx: RlsContext,
  farmId: string,
): Promise<LactationItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const rows = await (tx as any).lactation.findMany({
      where: { farmId, status: 'IN_PROGRESS' },
      include: LACTATION_INCLUDE,
      orderBy: { startDate: 'desc' },
    });

    return rows.map(toLactationItem);
  });
}

// ─── EXPORT CSV ─────────────────────────────────────────────────────

export async function exportLactationsCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListLactationsQuery,
): Promise<string> {
  const where: any = { farmId };

  if (query.animalId) where.animalId = query.animalId;
  if (query.status) where.status = query.status;

  const rows = await withRlsContext(ctx, async (tx) => {
    return (tx as any).lactation.findMany({
      where,
      include: LACTATION_INCLUDE,
      orderBy: [{ startDate: 'desc' }],
    });
  });

  const BOM = '\uFEFF';
  const lines: string[] = [];

  lines.push('RELATÓRIO DE LACTAÇÕES');
  lines.push(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`);
  lines.push('');
  lines.push(
    'Brinco;Nome;Nº Lactação;Origem;Status;Data Início;Data Secagem;DEL;Pico (L);DEL Pico;305d (L);Total (L);Duração (dias)',
  );

  for (const r of rows) {
    const origin = r.origin as LactationOriginValue;
    const status = r.status as LactationStatusValue;
    const startDate = r.startDate as Date;
    const endDate = r.endDate as Date | null;

    lines.push(
      [
        r.animal?.earTag ?? '',
        r.animal?.name ?? '',
        r.lactationNumber.toString(),
        LACTATION_ORIGIN_LABELS[origin] ?? origin,
        LACTATION_STATUS_LABELS[status] ?? status,
        startDate.toLocaleDateString('pt-BR'),
        endDate ? endDate.toLocaleDateString('pt-BR') : '',
        calcDel(startDate, endDate).toString(),
        r.peakLiters != null ? r.peakLiters.toString().replace('.', ',') : '',
        r.peakDel != null ? r.peakDel.toString() : '',
        r.accumulated305 != null ? r.accumulated305.toString().replace('.', ',') : '',
        r.totalAccumulated != null ? r.totalAccumulated.toString().replace('.', ',') : '',
        r.durationDays != null ? r.durationDays.toString() : '',
      ].join(';'),
    );
  }

  return BOM + lines.join('\n');
}
