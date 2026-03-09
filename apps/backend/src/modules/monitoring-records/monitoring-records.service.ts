import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  MonitoringRecordError,
  INFESTATION_LEVELS,
  INFESTATION_LEVEL_LABELS,
  TREND_LABELS,
  URGENCY_LABELS,
  type CreateMonitoringRecordInput,
  type UpdateMonitoringRecordInput,
  type ListMonitoringRecordsQuery,
  type MonitoringRecordItem,
  type InfestationLevel,
  type HeatmapQuery,
  type HeatmapPoint,
  type TimelineQuery,
  type TimelineDataPoint,
  type TimelinePestEntry,
  type TimelineSummary,
  type RecommendationQuery,
  type RecommendationItem,
  type RecommendationAffectedPoint,
  type RecommendationSummary,
  type RecommendationUrgency,
} from './monitoring-records.types';
import { PEST_CATEGORY_LABELS, PEST_SEVERITY_LABELS } from '../pests/pests.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toItem(row: Record<string, unknown>): MonitoringRecordItem {
  const point = row.monitoringPoint as Record<string, unknown> | undefined;
  const pest = row.pest as Record<string, unknown> | undefined;
  const level = row.infestationLevel as InfestationLevel;

  return {
    id: row.id as string,
    farmId: row.farmId as string,
    fieldPlotId: row.fieldPlotId as string,
    monitoringPointId: row.monitoringPointId as string,
    monitoringPointCode: (point?.code as string) ?? '',
    pestId: row.pestId as string,
    pestName: (pest?.commonName as string) ?? '',
    pestCategory: (pest?.category as string) ?? '',
    observedAt: (row.observedAt as Date).toISOString(),
    infestationLevel: level,
    infestationLevelLabel: INFESTATION_LEVEL_LABELS[level] ?? level,
    sampleCount: (row.sampleCount as number) ?? null,
    pestCount: (row.pestCount as number) ?? null,
    growthStage: (row.growthStage as string) ?? null,
    hasNaturalEnemies: (row.hasNaturalEnemies as boolean) ?? false,
    naturalEnemiesDesc: (row.naturalEnemiesDesc as string) ?? null,
    damagePercentage: row.damagePercentage != null ? Number(row.damagePercentage) : null,
    photoUrl: (row.photoUrl as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function validateCreateInput(input: CreateMonitoringRecordInput): void {
  if (!input.monitoringPointId?.trim()) {
    throw new MonitoringRecordError('Ponto de monitoramento é obrigatório', 400);
  }
  if (!input.pestId?.trim()) {
    throw new MonitoringRecordError('Praga é obrigatória', 400);
  }
  if (!input.observedAt) {
    throw new MonitoringRecordError('Data da observação é obrigatória', 400);
  }
  const observedDate = new Date(input.observedAt);
  if (isNaN(observedDate.getTime())) {
    throw new MonitoringRecordError('Data da observação inválida', 400);
  }
  if (
    !input.infestationLevel ||
    !INFESTATION_LEVELS.includes(input.infestationLevel as InfestationLevel)
  ) {
    throw new MonitoringRecordError(
      `Nível de infestação inválido. Valores: ${INFESTATION_LEVELS.join(', ')}`,
      400,
    );
  }
  if (
    input.sampleCount != null &&
    (input.sampleCount < 0 || !Number.isInteger(input.sampleCount))
  ) {
    throw new MonitoringRecordError('Quantidade de amostras deve ser um inteiro positivo', 400);
  }
  if (input.pestCount != null && (input.pestCount < 0 || !Number.isInteger(input.pestCount))) {
    throw new MonitoringRecordError('Contagem de pragas deve ser um inteiro positivo', 400);
  }
  if (
    input.damagePercentage != null &&
    (input.damagePercentage < 0 || input.damagePercentage > 100)
  ) {
    throw new MonitoringRecordError('Percentual de dano deve estar entre 0 e 100', 400);
  }
}

function validateUpdateInput(input: UpdateMonitoringRecordInput): void {
  if (
    input.infestationLevel !== undefined &&
    !INFESTATION_LEVELS.includes(input.infestationLevel as InfestationLevel)
  ) {
    throw new MonitoringRecordError(
      `Nível de infestação inválido. Valores: ${INFESTATION_LEVELS.join(', ')}`,
      400,
    );
  }
  if (input.observedAt !== undefined) {
    const observedDate = new Date(input.observedAt);
    if (isNaN(observedDate.getTime())) {
      throw new MonitoringRecordError('Data da observação inválida', 400);
    }
  }
  if (
    input.sampleCount != null &&
    (input.sampleCount < 0 || !Number.isInteger(input.sampleCount))
  ) {
    throw new MonitoringRecordError('Quantidade de amostras deve ser um inteiro positivo', 400);
  }
  if (input.pestCount != null && (input.pestCount < 0 || !Number.isInteger(input.pestCount))) {
    throw new MonitoringRecordError('Contagem de pragas deve ser um inteiro positivo', 400);
  }
  if (
    input.damagePercentage != null &&
    (input.damagePercentage < 0 || input.damagePercentage > 100)
  ) {
    throw new MonitoringRecordError('Percentual de dano deve estar entre 0 e 100', 400);
  }
}

const includeRelations = {
  monitoringPoint: { select: { code: true } },
  pest: { select: { commonName: true, category: true } },
};

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createMonitoringRecord(
  ctx: RlsContext,
  farmId: string,
  fieldPlotId: string,
  input: CreateMonitoringRecordInput,
): Promise<MonitoringRecordItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Verify monitoring point belongs to this field plot + farm
    const point = await tx.monitoringPoint.findFirst({
      where: { id: input.monitoringPointId, farmId, fieldPlotId, deletedAt: null },
    });
    if (!point) {
      throw new MonitoringRecordError('Ponto de monitoramento não encontrado neste talhão', 404);
    }

    // Verify pest exists in the organization
    const pest = await tx.pest.findFirst({
      where: { id: input.pestId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!pest) {
      throw new MonitoringRecordError('Praga não encontrada na biblioteca', 404);
    }

    const row = await tx.monitoringRecord.create({
      data: {
        farmId,
        fieldPlotId,
        monitoringPointId: input.monitoringPointId,
        pestId: input.pestId,
        observedAt: new Date(input.observedAt),
        infestationLevel: input.infestationLevel as InfestationLevel,
        sampleCount: input.sampleCount ?? null,
        pestCount: input.pestCount ?? null,
        growthStage: input.growthStage?.trim() || null,
        hasNaturalEnemies: input.hasNaturalEnemies ?? false,
        naturalEnemiesDesc: input.naturalEnemiesDesc?.trim() || null,
        damagePercentage: input.damagePercentage ?? null,
        photoUrl: input.photoUrl?.trim() || null,
        notes: input.notes?.trim() || null,
      },
      include: includeRelations,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listMonitoringRecords(
  ctx: RlsContext,
  farmId: string,
  fieldPlotId: string,
  query: ListMonitoringRecordsQuery,
): Promise<{
  data: MonitoringRecordItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      farmId,
      fieldPlotId,
      deletedAt: null,
    };

    if (query.monitoringPointId) {
      where.monitoringPointId = query.monitoringPointId;
    }
    if (query.pestId) {
      where.pestId = query.pestId;
    }
    if (query.infestationLevel) {
      where.infestationLevel = query.infestationLevel;
    }
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);
      where.observedAt = dateFilter;
    }

    const [rows, total] = await Promise.all([
      tx.monitoringRecord.findMany({
        where,
        include: includeRelations,
        orderBy: { observedAt: 'desc' },
        skip,
        take: limit,
      }),
      tx.monitoringRecord.count({ where }),
    ]);

    return {
      data: rows.map((r: unknown) => toItem(r as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getMonitoringRecord(
  ctx: RlsContext,
  farmId: string,
  recordId: string,
): Promise<MonitoringRecordItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.monitoringRecord.findFirst({
      where: { id: recordId, farmId, deletedAt: null },
      include: includeRelations,
    });
    if (!row) {
      throw new MonitoringRecordError('Registro de monitoramento não encontrado', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateMonitoringRecord(
  ctx: RlsContext,
  farmId: string,
  recordId: string,
  input: UpdateMonitoringRecordInput,
): Promise<MonitoringRecordItem> {
  validateUpdateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.monitoringRecord.findFirst({
      where: { id: recordId, farmId, deletedAt: null },
    });
    if (!existing) {
      throw new MonitoringRecordError('Registro de monitoramento não encontrado', 404);
    }

    // If changing pest, verify it exists
    if (input.pestId !== undefined) {
      const pest = await tx.pest.findFirst({
        where: { id: input.pestId, organizationId: ctx.organizationId, deletedAt: null },
      });
      if (!pest) {
        throw new MonitoringRecordError('Praga não encontrada na biblioteca', 404);
      }
    }

    const data: Record<string, unknown> = {};
    if (input.pestId !== undefined) data.pestId = input.pestId;
    if (input.observedAt !== undefined) data.observedAt = new Date(input.observedAt);
    if (input.infestationLevel !== undefined) data.infestationLevel = input.infestationLevel;
    if (input.sampleCount !== undefined) data.sampleCount = input.sampleCount;
    if (input.pestCount !== undefined) data.pestCount = input.pestCount;
    if (input.growthStage !== undefined) data.growthStage = input.growthStage?.trim() || null;
    if (input.hasNaturalEnemies !== undefined) data.hasNaturalEnemies = input.hasNaturalEnemies;
    if (input.naturalEnemiesDesc !== undefined)
      data.naturalEnemiesDesc = input.naturalEnemiesDesc?.trim() || null;
    if (input.damagePercentage !== undefined) data.damagePercentage = input.damagePercentage;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    const row = await tx.monitoringRecord.update({
      where: { id: recordId },
      data,
      include: includeRelations,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── HEATMAP ────────────────────────────────────────────────────────

const LEVEL_WEIGHT: Record<InfestationLevel, number> = {
  AUSENTE: 0,
  BAIXO: 0.25,
  MODERADO: 0.5,
  ALTO: 0.75,
  CRITICO: 1,
};

export async function getMonitoringHeatmap(
  ctx: RlsContext,
  farmId: string,
  fieldPlotId: string,
  query: HeatmapQuery,
): Promise<HeatmapPoint[]> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      farmId,
      fieldPlotId,
      deletedAt: null,
    };

    if (query.pestId) {
      where.pestId = query.pestId;
    }
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);
      where.observedAt = dateFilter;
    }

    const records = await tx.monitoringRecord.findMany({
      where,
      include: {
        monitoringPoint: { select: { code: true, latitude: true, longitude: true } },
        pest: { select: { commonName: true } },
      },
      orderBy: { observedAt: 'desc' },
    });

    // Group by monitoring point
    const grouped = new Map<
      string,
      {
        code: string;
        latitude: number;
        longitude: number;
        levels: InfestationLevel[];
        pests: Map<string, { name: string; count: number }>;
      }
    >();

    for (const rec of records) {
      const point = rec.monitoringPoint as { code: string; latitude: unknown; longitude: unknown };
      const pest = rec.pest as { commonName: string };
      const pointId = rec.monitoringPointId;

      if (!grouped.has(pointId)) {
        grouped.set(pointId, {
          code: point.code,
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          levels: [],
          pests: new Map(),
        });
      }

      const group = grouped.get(pointId)!;
      group.levels.push(rec.infestationLevel as InfestationLevel);

      const pestEntry = group.pests.get(rec.pestId);
      if (pestEntry) {
        pestEntry.count++;
      } else {
        group.pests.set(rec.pestId, { name: pest.commonName, count: 1 });
      }
    }

    const result: HeatmapPoint[] = [];
    for (const [pointId, group] of grouped) {
      const maxLevel = group.levels.reduce((max, lvl) => {
        return LEVEL_WEIGHT[lvl] > LEVEL_WEIGHT[max] ? lvl : max;
      }, 'AUSENTE' as InfestationLevel);

      const avgIntensity =
        group.levels.reduce((sum, lvl) => sum + LEVEL_WEIGHT[lvl], 0) / group.levels.length;

      const topPests = Array.from(group.pests.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([pestId, { name, count }]) => ({ pestId, pestName: name, count }));

      result.push({
        monitoringPointId: pointId,
        code: group.code,
        latitude: group.latitude,
        longitude: group.longitude,
        intensity: Math.round(avgIntensity * 100) / 100,
        maxLevel,
        recordCount: group.levels.length,
        topPests,
      });
    }

    return result;
  });
}

// ─── TIMELINE ──────────────────────────────────────────────────────

function getDateBucket(date: Date, aggregation: 'daily' | 'weekly' | 'monthly'): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  switch (aggregation) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly': {
      // Start of week (Monday)
      const d = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
      const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon...
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      d.setUTCDate(d.getUTCDate() - diff);
      const wy = d.getUTCFullYear();
      const wm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const wd = String(d.getUTCDate()).padStart(2, '0');
      return `${wy}-${wm}-${wd}`;
    }
    case 'monthly':
      return `${year}-${month}-01`;
  }
}

export async function getMonitoringTimeline(
  ctx: RlsContext,
  farmId: string,
  fieldPlotId: string,
  query: TimelineQuery,
): Promise<{ data: TimelineDataPoint[]; summary: TimelineSummary }> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      farmId,
      fieldPlotId,
      deletedAt: null,
    };

    if (query.pestIds) {
      const ids = query.pestIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length > 0) {
        where.pestId = { in: ids };
      }
    }
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);
      where.observedAt = dateFilter;
    }

    const records = await tx.monitoringRecord.findMany({
      where,
      include: {
        pest: { select: { commonName: true } },
      },
      orderBy: { observedAt: 'asc' },
    });

    if (records.length === 0) {
      return {
        data: [],
        summary: {
          totalRecords: 0,
          dateRange: {
            start: query.startDate ?? '',
            end: query.endDate ?? '',
          },
          pestsFound: [],
        },
      };
    }

    const aggregation = query.aggregation ?? 'daily';
    const pestsFoundMap = new Map<string, string>(); // pestId → pestName

    // Group by date bucket → pestId
    const bucketMap = new Map<
      string,
      Map<string, { pestName: string; levels: InfestationLevel[] }>
    >();

    for (const rec of records) {
      const observedAt = rec.observedAt as Date;
      const bucket = getDateBucket(observedAt, aggregation);
      const pest = rec.pest as { commonName: string };
      const level = rec.infestationLevel as InfestationLevel;

      pestsFoundMap.set(rec.pestId, pest.commonName);

      if (!bucketMap.has(bucket)) {
        bucketMap.set(bucket, new Map());
      }
      const pestMap = bucketMap.get(bucket)!;
      if (!pestMap.has(rec.pestId)) {
        pestMap.set(rec.pestId, { pestName: pest.commonName, levels: [] });
      }
      pestMap.get(rec.pestId)!.levels.push(level);
    }

    // Build sorted data points
    const sortedBuckets = Array.from(bucketMap.keys()).sort();
    const data: TimelineDataPoint[] = sortedBuckets.map((bucket) => {
      const pestMap = bucketMap.get(bucket)!;
      const pests: TimelinePestEntry[] = Array.from(pestMap.entries()).map(
        ([pestId, { pestName, levels }]) => {
          const avgIntensity =
            Math.round(
              (levels.reduce((sum, lvl) => sum + LEVEL_WEIGHT[lvl], 0) / levels.length) * 100,
            ) / 100;

          const maxLevel = levels.reduce((max, lvl) => {
            return LEVEL_WEIGHT[lvl] > LEVEL_WEIGHT[max] ? lvl : max;
          }, 'AUSENTE' as InfestationLevel);

          return {
            pestId,
            pestName,
            avgIntensity,
            maxLevel,
            recordCount: levels.length,
          };
        },
      );

      return { date: bucket, pests };
    });

    // Calculate date range from actual records
    const firstDate = (records[0].observedAt as Date).toISOString().split('T')[0];
    const lastDate = (records[records.length - 1].observedAt as Date).toISOString().split('T')[0];

    return {
      data,
      summary: {
        totalRecords: records.length,
        dateRange: { start: firstDate, end: lastDate },
        pestsFound: Array.from(pestsFoundMap.values()),
      },
    };
  });
}

// ─── RECOMMENDATIONS ────────────────────────────────────────────────

function computeTrend(
  levels: { level: InfestationLevel; date: Date }[],
): 'increasing' | 'stable' | 'decreasing' | 'unknown' {
  if (levels.length < 3) return 'unknown';

  // Sort by date ascending
  const sorted = [...levels].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Compare average of last third vs first third
  const thirdLen = Math.max(1, Math.floor(sorted.length / 3));
  const firstThird = sorted.slice(0, thirdLen);
  const lastThird = sorted.slice(-thirdLen);

  const avgFirst = firstThird.reduce((s, r) => s + LEVEL_WEIGHT[r.level], 0) / firstThird.length;
  const avgLast = lastThird.reduce((s, r) => s + LEVEL_WEIGHT[r.level], 0) / lastThird.length;

  const diff = avgLast - avgFirst;
  if (diff > 0.1) return 'increasing';
  if (diff < -0.1) return 'decreasing';
  return 'stable';
}

export async function getMonitoringRecommendations(
  ctx: RlsContext,
  farmId: string,
  fieldPlotId: string,
  query: RecommendationQuery,
): Promise<{ data: RecommendationItem[]; summary: RecommendationSummary }> {
  return withRlsContext(ctx, async (tx) => {
    // 1. Get all pests with controlThreshold defined
    const pests = await tx.pest.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        controlThreshold: { not: null },
        ...(query.pestId ? { id: query.pestId } : {}),
      },
    });

    if (pests.length === 0) {
      return {
        data: [],
        summary: {
          totalRecommendations: 0,
          criticalCount: 0,
          alertCount: 0,
          totalAffectedPoints: 0,
        },
      };
    }

    const pestIds = pests.map((p) => p.id);

    // 2. Get latest monitoring records per pest per point (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const records = await tx.monitoringRecord.findMany({
      where: {
        farmId,
        fieldPlotId,
        pestId: { in: pestIds },
        deletedAt: null,
        observedAt: { gte: thirtyDaysAgo },
      },
      include: {
        monitoringPoint: { select: { code: true, latitude: true, longitude: true } },
      },
      orderBy: { observedAt: 'desc' },
    });

    // 3. Group records by pest → latest record per point
    const pestMap = new Map<
      string,
      {
        latestPerPoint: Map<
          string,
          {
            pointId: string;
            code: string;
            latitude: number;
            longitude: number;
            level: InfestationLevel;
            observedAt: Date;
            damagePercentage: number | null;
            hasNaturalEnemies: boolean;
          }
        >;
        allLevels: { level: InfestationLevel; date: Date }[];
        anyNaturalEnemies: boolean;
      }
    >();

    for (const rec of records) {
      const point = rec.monitoringPoint as { code: string; latitude: unknown; longitude: unknown };
      const level = rec.infestationLevel as InfestationLevel;

      if (!pestMap.has(rec.pestId)) {
        pestMap.set(rec.pestId, {
          latestPerPoint: new Map(),
          allLevels: [],
          anyNaturalEnemies: false,
        });
      }
      const entry = pestMap.get(rec.pestId)!;
      entry.allLevels.push({ level, date: rec.observedAt as Date });

      if (rec.hasNaturalEnemies) entry.anyNaturalEnemies = true;

      // Keep only latest per point
      if (!entry.latestPerPoint.has(rec.monitoringPointId)) {
        entry.latestPerPoint.set(rec.monitoringPointId, {
          pointId: rec.monitoringPointId,
          code: point.code,
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          level,
          observedAt: rec.observedAt as Date,
          damagePercentage: rec.damagePercentage != null ? Number(rec.damagePercentage) : null,
          hasNaturalEnemies: rec.hasNaturalEnemies as boolean,
        });
      }
    }

    // 4. Build recommendations
    const recommendations: RecommendationItem[] = [];

    for (const pest of pests) {
      const threshold = pest.controlThreshold as InfestationLevel;
      const thresholdWeight = LEVEL_WEIGHT[threshold];
      const pestData = pestMap.get(pest.id);
      if (!pestData) continue;

      // Filter points where latest level >= threshold
      const affectedPoints: RecommendationAffectedPoint[] = [];
      for (const [, pointData] of pestData.latestPerPoint) {
        if (LEVEL_WEIGHT[pointData.level] >= thresholdWeight) {
          affectedPoints.push({
            monitoringPointId: pointData.pointId,
            code: pointData.code,
            latitude: pointData.latitude,
            longitude: pointData.longitude,
            currentLevel: pointData.level,
            currentLevelLabel: INFESTATION_LEVEL_LABELS[pointData.level] ?? pointData.level,
            lastObservedAt: pointData.observedAt.toISOString(),
            damagePercentage: pointData.damagePercentage,
          });
        }
      }

      if (affectedPoints.length === 0) continue;

      // Determine max level and urgency
      const maxLevel = affectedPoints.reduce((max, p) => {
        return LEVEL_WEIGHT[p.currentLevel] > LEVEL_WEIGHT[max] ? p.currentLevel : max;
      }, 'AUSENTE' as InfestationLevel);

      const urgency: RecommendationUrgency =
        LEVEL_WEIGHT[maxLevel] >= LEVEL_WEIGHT.CRITICO ? 'CRITICO' : 'ALERTA';

      // Calculate avg damage
      const damageValues = affectedPoints
        .map((p) => p.damagePercentage)
        .filter((d): d is number => d !== null);
      const avgDamage =
        damageValues.length > 0
          ? Math.round((damageValues.reduce((s, d) => s + d, 0) / damageValues.length) * 100) / 100
          : null;

      const trend = computeTrend(pestData.allLevels);
      const category = pest.category as string;
      const severity = (pest.severity as string) ?? null;

      recommendations.push({
        pestId: pest.id,
        pestName: pest.commonName,
        pestCategory: category,
        pestCategoryLabel: PEST_CATEGORY_LABELS[category] ?? category,
        severity,
        severityLabel: severity ? (PEST_SEVERITY_LABELS[severity] ?? severity) : null,
        controlThreshold: threshold,
        controlThresholdLabel: INFESTATION_LEVEL_LABELS[threshold] ?? threshold,
        ndeDescription: (pest.ndeDescription as string) ?? null,
        ncDescription: (pest.ncDescription as string) ?? null,
        recommendedProducts: (pest.recommendedProducts as string) ?? null,
        urgency,
        urgencyLabel: URGENCY_LABELS[urgency],
        affectedPoints: affectedPoints.sort(
          (a, b) => LEVEL_WEIGHT[b.currentLevel] - LEVEL_WEIGHT[a.currentLevel],
        ),
        affectedPointCount: affectedPoints.length,
        maxLevel,
        maxLevelLabel: INFESTATION_LEVEL_LABELS[maxLevel] ?? maxLevel,
        avgDamagePercentage: avgDamage,
        hasNaturalEnemies: pestData.anyNaturalEnemies,
        trend,
        trendLabel: TREND_LABELS[trend],
      });
    }

    // Sort: CRITICO first, then by affected points count
    recommendations.sort((a, b) => {
      if (a.urgency !== b.urgency) return a.urgency === 'CRITICO' ? -1 : 1;
      return b.affectedPointCount - a.affectedPointCount;
    });

    // Apply urgency filter
    const filtered = query.urgency
      ? recommendations.filter((r) => r.urgency === query.urgency)
      : recommendations;

    const criticalCount = recommendations.filter((r) => r.urgency === 'CRITICO').length;
    const alertCount = recommendations.filter((r) => r.urgency === 'ALERTA').length;
    const totalAffectedPoints = new Set(
      recommendations.flatMap((r) => r.affectedPoints.map((p) => p.monitoringPointId)),
    ).size;

    return {
      data: filtered,
      summary: {
        totalRecommendations: recommendations.length,
        criticalCount,
        alertCount,
        totalAffectedPoints,
      },
    };
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteMonitoringRecord(
  ctx: RlsContext,
  farmId: string,
  recordId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.monitoringRecord.findFirst({
      where: { id: recordId, farmId, deletedAt: null },
    });
    if (!existing) {
      throw new MonitoringRecordError('Registro de monitoramento não encontrado', 404);
    }

    await tx.monitoringRecord.update({
      where: { id: recordId },
      data: { deletedAt: new Date() },
    });
  });
}
