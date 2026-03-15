import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  HeatRecordError,
  HEAT_INTENSITY_LABELS,
  HEAT_DETECTION_METHOD_LABELS,
  HEAT_STATUS_LABELS,
  HEAT_PERIOD_LABELS,
  HEAT_SIGN_LABELS,
  CYCLICITY_STATUS_LABELS,
  DEFAULT_AI_WINDOW_HOURS,
  MIN_REGULAR_INTERVAL_DAYS,
  MAX_REGULAR_INTERVAL_DAYS,
  isValidHeatIntensity,
  isValidHeatDetectionMethod,
  isValidHeatStatus,
  isValidHeatSign,
  isValidHeatPeriod,
  isValidCyclicityStatus,
  type CreateHeatInput,
  type UpdateHeatInput,
  type ListHeatsQuery,
  type HeatRecordItem,
  type DailyHeatItem,
  type HeatIndicators,
  type HeatIntensityValue,
  type HeatDetectionMethodValue,
  type HeatStatusValue,
  type HeatPeriodValue,
  type HeatSignValue,
  type CyclicityStatusValue,
} from './heat-records.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

const HEAT_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
};

function toHeatRecordItem(row: any): HeatRecordItem {
  const intensity = row.intensity as HeatIntensityValue;
  const method = row.detectionMethod as HeatDetectionMethodValue;
  const status = row.status as HeatStatusValue;
  const period = row.heatPeriod as HeatPeriodValue | null;
  const cyclicity = row.cyclicityStatus as CyclicityStatusValue | null;
  const signs = (Array.isArray(row.signs) ? row.signs : []) as HeatSignValue[];

  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    heatDate: (row.heatDate as Date).toISOString().slice(0, 10),
    heatTime: row.heatTime ?? null,
    heatPeriod: period,
    heatPeriodLabel: period ? (HEAT_PERIOD_LABELS[period] ?? period) : null,
    intensity,
    intensityLabel: HEAT_INTENSITY_LABELS[intensity] ?? intensity,
    signs,
    signLabels: signs.map((s) => HEAT_SIGN_LABELS[s] ?? s),
    detectionMethod: method,
    detectionMethodLabel: HEAT_DETECTION_METHOD_LABELS[method] ?? method,
    status,
    statusLabel: HEAT_STATUS_LABELS[status] ?? status,
    recommendedAiTime: row.recommendedAiTime ? (row.recommendedAiTime as Date).toISOString() : null,
    recommendedBullId: row.recommendedBullId ?? null,
    cyclicityStatus: cyclicity,
    cyclicityStatusLabel: cyclicity ? (CYCLICITY_STATUS_LABELS[cyclicity] ?? cyclicity) : null,
    previousHeatDate: row.previousHeatDate
      ? (row.previousHeatDate as Date).toISOString().slice(0, 10)
      : null,
    interHeatDays: row.interHeatDays ?? null,
    isIntervalIrregular: row.isIntervalIrregular ?? false,
    inseminationId: row.inseminationId ?? null,
    notInseminatedReason: row.notInseminatedReason ?? null,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function validateCreateInput(input: CreateHeatInput): void {
  if (!input.animalId?.trim()) {
    throw new HeatRecordError('Animal é obrigatório', 400);
  }
  if (!input.heatDate) {
    throw new HeatRecordError('Data do cio é obrigatória', 400);
  }
  const date = new Date(input.heatDate);
  if (isNaN(date.getTime())) {
    throw new HeatRecordError('Data do cio inválida', 400);
  }
  if (date > new Date()) {
    throw new HeatRecordError('Data do cio não pode ser no futuro', 400);
  }
  if (!input.intensity || !isValidHeatIntensity(input.intensity)) {
    throw new HeatRecordError('Intensidade do cio inválida', 400);
  }
  if (!input.detectionMethod || !isValidHeatDetectionMethod(input.detectionMethod)) {
    throw new HeatRecordError('Método de detecção inválido', 400);
  }
  if (!Array.isArray(input.signs) || input.signs.length === 0) {
    throw new HeatRecordError('Pelo menos um sinal de cio deve ser informado', 400);
  }
  for (const sign of input.signs) {
    if (!isValidHeatSign(sign)) {
      throw new HeatRecordError(`Sinal de cio inválido: ${sign}`, 400);
    }
  }
  if (input.heatPeriod && !isValidHeatPeriod(input.heatPeriod)) {
    throw new HeatRecordError('Período do cio inválido', 400);
  }
  if (input.cyclicityStatus && !isValidCyclicityStatus(input.cyclicityStatus)) {
    throw new HeatRecordError('Status de ciclicidade inválido', 400);
  }
}

// ─── CREATE (CA1, CA2, CA3) ─────────────────────────────────────────

export async function createHeat(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateHeatInput,
): Promise<HeatRecordItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Validate animal: must exist, be female, and reproductivelyReleased
    const animal = await (tx as any).animal.findFirst({
      where: { id: input.animalId, farmId, deletedAt: null },
      select: { id: true, sex: true, reproductivelyReleased: true, earTag: true },
    });
    if (!animal) {
      throw new HeatRecordError('Animal não encontrado', 404);
    }
    if (animal.sex !== 'FEMALE') {
      throw new HeatRecordError('Registro de cio é permitido apenas para fêmeas', 400);
    }
    if (!animal.reproductivelyReleased) {
      throw new HeatRecordError('Animal não possui liberação reprodutiva', 400);
    }

    const heatDate = new Date(input.heatDate);

    // Find previous heat for the same animal to calculate inter-heat interval (CA4)
    const previousHeat = await (tx as any).heatRecord.findFirst({
      where: {
        animalId: input.animalId,
        farmId,
        heatDate: { lt: heatDate },
      },
      orderBy: { heatDate: 'desc' },
      select: { heatDate: true },
    });

    let previousHeatDate: Date | null = null;
    let interHeatDays: number | null = null;
    let isIntervalIrregular = false;

    if (previousHeat) {
      previousHeatDate = previousHeat.heatDate as Date;
      const diffMs = heatDate.getTime() - previousHeatDate.getTime();
      interHeatDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      isIntervalIrregular =
        interHeatDays < MIN_REGULAR_INTERVAL_DAYS || interHeatDays > MAX_REGULAR_INTERVAL_DAYS;
    }

    // Calculate recommended AI time (CA3): heatDate + DEFAULT_AI_WINDOW_HOURS
    const recommendedAiTime = new Date(heatDate);
    if (input.heatTime) {
      const [hours, minutes] = input.heatTime.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        recommendedAiTime.setHours(hours, minutes, 0, 0);
      }
    } else if (input.heatPeriod) {
      // Approximate times for periods
      const periodHours: Record<string, number> = { MORNING: 8, AFTERNOON: 14, NIGHT: 20 };
      recommendedAiTime.setHours(periodHours[input.heatPeriod] ?? 12, 0, 0, 0);
    }
    recommendedAiTime.setHours(recommendedAiTime.getHours() + DEFAULT_AI_WINDOW_HOURS);

    const row = await (tx as any).heatRecord.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        heatDate,
        heatTime: input.heatTime ?? null,
        heatPeriod: input.heatPeriod ?? null,
        intensity: input.intensity,
        signs: input.signs,
        detectionMethod: input.detectionMethod,
        status: 'AWAITING_AI',
        recommendedAiTime,
        recommendedBullId: null,
        cyclicityStatus: input.cyclicityStatus ?? null,
        previousHeatDate,
        interHeatDays,
        isIntervalIrregular,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: HEAT_INCLUDE,
    });

    return toHeatRecordItem(row);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listHeats(
  ctx: RlsContext,
  farmId: string,
  query: ListHeatsQuery,
): Promise<{ data: HeatRecordItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.animalId) where.animalId = query.animalId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.heatDate = {};
      if (query.dateFrom) where.heatDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.heatDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).heatRecord.findMany({
        where,
        include: HEAT_INCLUDE,
        orderBy: { heatDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).heatRecord.count({ where }),
    ]);

    return {
      data: rows.map(toHeatRecordItem),
      total,
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getHeat(
  ctx: RlsContext,
  farmId: string,
  heatId: string,
): Promise<HeatRecordItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).heatRecord.findFirst({
      where: { id: heatId, farmId },
      include: HEAT_INCLUDE,
    });
    if (!row) {
      throw new HeatRecordError('Registro de cio não encontrado', 404);
    }
    return toHeatRecordItem(row);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateHeat(
  ctx: RlsContext,
  farmId: string,
  heatId: string,
  input: UpdateHeatInput,
): Promise<HeatRecordItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).heatRecord.findFirst({
      where: { id: heatId, farmId },
    });
    if (!existing) {
      throw new HeatRecordError('Registro de cio não encontrado', 404);
    }

    if (input.status && !isValidHeatStatus(input.status)) {
      throw new HeatRecordError('Status inválido', 400);
    }
    if (input.intensity && !isValidHeatIntensity(input.intensity)) {
      throw new HeatRecordError('Intensidade do cio inválida', 400);
    }
    if (input.detectionMethod && !isValidHeatDetectionMethod(input.detectionMethod)) {
      throw new HeatRecordError('Método de detecção inválido', 400);
    }
    if (input.cyclicityStatus && !isValidCyclicityStatus(input.cyclicityStatus)) {
      throw new HeatRecordError('Status de ciclicidade inválido', 400);
    }
    if (input.heatPeriod && !isValidHeatPeriod(input.heatPeriod)) {
      throw new HeatRecordError('Período do cio inválido', 400);
    }
    if (input.signs) {
      if (!Array.isArray(input.signs) || input.signs.length === 0) {
        throw new HeatRecordError('Pelo menos um sinal de cio deve ser informado', 400);
      }
      for (const sign of input.signs) {
        if (!isValidHeatSign(sign)) {
          throw new HeatRecordError(`Sinal de cio inválido: ${sign}`, 400);
        }
      }
    }

    const data: any = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.notInseminatedReason !== undefined)
      data.notInseminatedReason = input.notInseminatedReason;
    if (input.cyclicityStatus !== undefined) data.cyclicityStatus = input.cyclicityStatus;
    if (input.intensity !== undefined) data.intensity = input.intensity;
    if (input.signs !== undefined) data.signs = input.signs;
    if (input.detectionMethod !== undefined) data.detectionMethod = input.detectionMethod;
    if (input.heatTime !== undefined) data.heatTime = input.heatTime;
    if (input.heatPeriod !== undefined) data.heatPeriod = input.heatPeriod;
    if (input.recommendedBullId !== undefined) data.recommendedBullId = input.recommendedBullId;
    if (input.inseminationId !== undefined) data.inseminationId = input.inseminationId;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).heatRecord.update({
      where: { id: heatId },
      data,
      include: HEAT_INCLUDE,
    });

    return toHeatRecordItem(row);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteHeat(ctx: RlsContext, farmId: string, heatId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).heatRecord.findFirst({
      where: { id: heatId, farmId },
    });
    if (!existing) {
      throw new HeatRecordError('Registro de cio não encontrado', 404);
    }

    await (tx as any).heatRecord.delete({ where: { id: heatId } });
  });
}

// ─── DAILY HEATS (CA5) ─────────────────────────────────────────────

export async function getDailyHeats(
  ctx: RlsContext,
  farmId: string,
  date?: string,
): Promise<DailyHeatItem> {
  const targetDate = date ? new Date(date) : new Date();
  const dateStr = targetDate.toISOString().slice(0, 10);
  const dayStart = new Date(dateStr + 'T00:00:00.000Z');
  const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

  return withRlsContext(ctx, async (tx) => {
    const rows = await (tx as any).heatRecord.findMany({
      where: {
        farmId,
        heatDate: { gte: dayStart, lte: dayEnd },
      },
      include: HEAT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    const items = rows.map(toHeatRecordItem);

    const awaitingAi = items.filter((i: HeatRecordItem) => i.status === 'AWAITING_AI');
    const aiDone = items.filter((i: HeatRecordItem) => i.status === 'AI_DONE');
    const notInseminated = items.filter((i: HeatRecordItem) => i.status === 'NOT_INSEMINATED');

    return {
      awaitingAi,
      aiDone,
      notInseminated,
      total: items.length,
      date: dateStr,
    };
  });
}

// ─── HEAT HISTORY (CA4) ────────────────────────────────────────────

export async function getHeatHistory(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<{ data: HeatRecordItem[]; total: number; avgInterHeatDays: number | null }> {
  return withRlsContext(ctx, async (tx) => {
    // Validate animal exists
    const animal = await (tx as any).animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new HeatRecordError('Animal não encontrado', 404);
    }

    const rows = await (tx as any).heatRecord.findMany({
      where: { farmId, animalId },
      include: HEAT_INCLUDE,
      orderBy: { heatDate: 'desc' },
    });

    const items = rows.map(toHeatRecordItem);
    const intervals = items
      .map((i: HeatRecordItem) => i.interHeatDays)
      .filter((d: number | null): d is number => d !== null);

    const avgInterHeatDays =
      intervals.length > 0
        ? Math.round(
            (intervals.reduce((sum: number, d: number) => sum + d, 0) / intervals.length) * 10,
          ) / 10
        : null;

    return {
      data: items,
      total: items.length,
      avgInterHeatDays,
    };
  });
}

// ─── INDICATORS (CA6) ──────────────────────────────────────────────

export async function getHeatIndicators(ctx: RlsContext, farmId: string): Promise<HeatIndicators> {
  return withRlsContext(ctx, async (tx) => {
    // Last 90 days
    const now = new Date();
    const periodEnd = now.toISOString().slice(0, 10);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 90);
    const periodStartStr = periodStart.toISOString().slice(0, 10);

    const rows = await (tx as any).heatRecord.findMany({
      where: {
        farmId,
        heatDate: {
          gte: new Date(periodStartStr),
          lte: new Date(periodEnd),
        },
      },
      select: {
        id: true,
        status: true,
        interHeatDays: true,
        isIntervalIrregular: true,
        inseminationId: true,
      },
    });

    const totalHeatsDetected = rows.length;

    // Avg inter-heat interval
    const intervals = rows
      .map((r: any) => r.interHeatDays)
      .filter((d: number | null): d is number => d !== null);
    const avgInterHeatDays =
      intervals.length > 0
        ? Math.round(
            (intervals.reduce((sum: number, d: number) => sum + d, 0) / intervals.length) * 10,
          ) / 10
        : null;

    // Irregular interval %
    const withInterval = rows.filter((r: any) => r.interHeatDays !== null);
    const irregularCount = withInterval.filter((r: any) => r.isIntervalIrregular).length;
    const irregularIntervalPercent =
      withInterval.length > 0 ? Math.round((irregularCount / withInterval.length) * 1000) / 10 : 0;

    // % heats inseminated (AI_DONE or has inseminationId)
    const inseminatedCount = rows.filter(
      (r: any) => r.status === 'AI_DONE' || r.inseminationId,
    ).length;
    const heatsInseminatedPercent =
      totalHeatsDetected > 0 ? Math.round((inseminatedCount / totalHeatsDetected) * 1000) / 10 : 0;

    // Monthly detection rate (total / 3 months)
    const detectionRateMonthly =
      totalHeatsDetected > 0 ? Math.round((totalHeatsDetected / 3) * 10) / 10 : 0;

    // Conception rate placeholder
    const conceptionRatePlaceholder: number | null = null;

    // Count female reproductive animals for detection rate context
    return {
      totalHeatsDetected,
      avgInterHeatDays,
      irregularIntervalPercent,
      heatsInseminatedPercent,
      conceptionRatePlaceholder,
      detectionRateMonthly,
      periodStart: periodStartStr,
      periodEnd,
    };
  });
}

// ─── EXPORT CSV ─────────────────────────────────────────────────────

export async function exportHeatsCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListHeatsQuery,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.animalId) where.animalId = query.animalId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.heatDate = {};
      if (query.dateFrom) where.heatDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.heatDate.lte = new Date(query.dateTo);
    }

    const rows = await (tx as any).heatRecord.findMany({
      where,
      include: HEAT_INCLUDE,
      orderBy: { heatDate: 'desc' },
    });

    const items = rows.map(toHeatRecordItem);

    const BOM = '\uFEFF';
    const lines: string[] = [];

    lines.push('RELATÓRIO DE DETECÇÃO DE CIO');
    lines.push(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`);
    lines.push(`Total de registros: ${items.length}`);
    lines.push('');
    lines.push(
      'Brinco;Nome;Data;Hora/Período;Intensidade;Sinais;Método;Status;Intervalo (dias);Irregular;Ciclicidade;Observações',
    );

    for (const item of items) {
      lines.push(
        [
          item.animalEarTag,
          item.animalName ?? '',
          new Date(item.heatDate).toLocaleDateString('pt-BR'),
          item.heatTime ?? item.heatPeriodLabel ?? '',
          item.intensityLabel,
          item.signLabels.join(', '),
          item.detectionMethodLabel,
          item.statusLabel,
          item.interHeatDays ?? '',
          item.isIntervalIrregular ? 'Sim' : 'Não',
          item.cyclicityStatusLabel ?? '',
          item.notes ?? '',
        ].join(';'),
      );
    }

    return BOM + lines.join('\n');
  });
}
