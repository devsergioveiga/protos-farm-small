import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  MonitoringReportError,
  type MonitoringReportQuery,
  type MonitoringReportResponse,
  type ReportSummary,
  type ReportPestSummary,
  type ReportPestDetail,
  type ReportTimelineEntry,
  type ReportControlDecision,
  type ReportPlotSummary,
} from './monitoring-reports.types';
import {
  INFESTATION_LEVEL_LABELS,
  TREND_LABELS,
  URGENCY_LABELS,
  type InfestationLevel,
} from '../monitoring-records/monitoring-records.types';
import { PEST_CATEGORY_LABELS } from '../pests/pests.types';

// ─── Helpers ────────────────────────────────────────────────────────

const LEVEL_WEIGHT: Record<InfestationLevel, number> = {
  AUSENTE: 0,
  BAIXO: 0.25,
  MODERADO: 0.5,
  ALTO: 0.75,
  CRITICO: 1,
};

function computeTrend(
  levels: { level: InfestationLevel; date: Date }[],
): 'increasing' | 'stable' | 'decreasing' | 'unknown' {
  if (levels.length < 3) return 'unknown';
  const sorted = [...levels].sort((a, b) => a.date.getTime() - b.date.getTime());
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

function getWeekBucket(date: Date): string {
  const year = date.getUTCFullYear();
  const d = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  const wy = d.getUTCFullYear();
  const wm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const wd = String(d.getUTCDate()).padStart(2, '0');
  return `${wy}-${wm}-${wd}`;
}

function parseOptionalDate(value: string | undefined, fallbackDaysAgo?: number): Date | undefined {
  if (value) {
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new MonitoringReportError('Data inválida', 400);
    return d;
  }
  if (fallbackDaysAgo !== undefined) {
    const d = new Date();
    d.setDate(d.getDate() - fallbackDaysAgo);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return undefined;
}

// ─── Generate Report ────────────────────────────────────────────────

export async function generateMonitoringReport(
  ctx: RlsContext,
  farmId: string,
  query: MonitoringReportQuery,
): Promise<MonitoringReportResponse> {
  const startDate = parseOptionalDate(query.startDate, 90)!;
  const endDate = query.endDate ? parseOptionalDate(query.endDate)! : new Date();

  if (startDate > endDate) {
    throw new MonitoringReportError('Data inicial deve ser anterior à data final', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Verify farm exists
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!farm) {
      throw new MonitoringReportError('Fazenda não encontrada', 404);
    }

    // Build field plot filter
    let fieldPlotIds: string[] | undefined;
    if (query.fieldPlotIds) {
      fieldPlotIds = query.fieldPlotIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }

    // Get all monitoring records for the farm in the period
    const recordWhere: Record<string, unknown> = {
      farmId,
      deletedAt: null,
      observedAt: { gte: startDate, lte: endDate },
    };
    if (fieldPlotIds && fieldPlotIds.length > 0) {
      recordWhere.fieldPlotId = { in: fieldPlotIds };
    }

    const records = await tx.monitoringRecord.findMany({
      where: recordWhere,
      include: {
        monitoringPoint: { select: { code: true, latitude: true, longitude: true } },
        pest: {
          select: {
            commonName: true,
            scientificName: true,
            category: true,
            affectedCrops: true,
            controlThreshold: true,
            ndeDescription: true,
            ncDescription: true,
            recommendedProducts: true,
          },
        },
      },
      orderBy: { observedAt: 'asc' },
    });

    // Get monitoring points count
    const pointWhere: Record<string, unknown> = { farmId, deletedAt: null };
    if (fieldPlotIds && fieldPlotIds.length > 0) {
      pointWhere.fieldPlotId = { in: fieldPlotIds };
    }
    const totalPoints = await tx.monitoringPoint.count({ where: pointWhere });

    // Get field plots involved
    const plotIds = [...new Set(records.map((r) => r.fieldPlotId))];
    const plots = await tx.fieldPlot.findMany({
      where: { id: { in: plotIds }, farmId, deletedAt: null },
      select: { id: true, name: true },
    });

    // Build per-plot summaries
    const plotRecordCounts = new Map<string, number>();
    const plotPointSets = new Map<string, Set<string>>();
    for (const rec of records) {
      plotRecordCounts.set(rec.fieldPlotId, (plotRecordCounts.get(rec.fieldPlotId) ?? 0) + 1);
      if (!plotPointSets.has(rec.fieldPlotId)) plotPointSets.set(rec.fieldPlotId, new Set());
      plotPointSets.get(rec.fieldPlotId)!.add(rec.monitoringPointId);
    }

    const plotSummaries: ReportPlotSummary[] = plots.map((p) => ({
      id: p.id,
      name: p.name,
      monitoringPointCount: plotPointSets.get(p.id)?.size ?? 0,
      recordCount: plotRecordCounts.get(p.id) ?? 0,
    }));

    // ─── Per-pest aggregation ─────────────────────────────────────
    type PestAgg = {
      commonName: string;
      scientificName: string | null;
      category: string;
      affectedCrops: unknown;
      controlThreshold: string | null;
      ndeDescription: string | null;
      ncDescription: string | null;
      recommendedProducts: string | null;
      levels: { level: InfestationLevel; date: Date }[];
      points: Set<string>;
      firstDate: Date;
      lastDate: Date;
      hasNaturalEnemies: boolean;
      weeklyBuckets: Map<string, { totalWeight: number; count: number }>;
    };

    const pestAgg = new Map<string, PestAgg>();

    for (const rec of records) {
      const pest = rec.pest as {
        commonName: string;
        scientificName: string | null;
        category: string;
        affectedCrops: unknown;
        controlThreshold: string | null;
        ndeDescription: string | null;
        ncDescription: string | null;
        recommendedProducts: string | null;
      };
      const level = rec.infestationLevel as InfestationLevel;
      const observedAt = rec.observedAt as Date;
      const bucket = getWeekBucket(observedAt);

      if (!pestAgg.has(rec.pestId)) {
        pestAgg.set(rec.pestId, {
          commonName: pest.commonName,
          scientificName: pest.scientificName,
          category: pest.category,
          affectedCrops: pest.affectedCrops,
          controlThreshold: pest.controlThreshold,
          ndeDescription: pest.ndeDescription,
          ncDescription: pest.ncDescription,
          recommendedProducts: pest.recommendedProducts,
          levels: [],
          points: new Set(),
          firstDate: observedAt,
          lastDate: observedAt,
          hasNaturalEnemies: false,
          weeklyBuckets: new Map(),
        });
      }

      const agg = pestAgg.get(rec.pestId)!;
      agg.levels.push({ level, date: observedAt });
      agg.points.add(rec.monitoringPointId);
      if (observedAt < agg.firstDate) agg.firstDate = observedAt;
      if (observedAt > agg.lastDate) agg.lastDate = observedAt;
      if (rec.hasNaturalEnemies) agg.hasNaturalEnemies = true;

      if (!agg.weeklyBuckets.has(bucket)) {
        agg.weeklyBuckets.set(bucket, { totalWeight: 0, count: 0 });
      }
      const wb = agg.weeklyBuckets.get(bucket)!;
      wb.totalWeight += LEVEL_WEIGHT[level];
      wb.count += 1;
    }

    // ─── Build pest summary ───────────────────────────────────────
    const allPestIds = [...pestAgg.keys()];

    const pestSummary: ReportPestSummary[] = allPestIds.map((pestId) => {
      const agg = pestAgg.get(pestId)!;
      const peakLevel = agg.levels.reduce((max, l) => {
        return LEVEL_WEIGHT[l.level] > LEVEL_WEIGHT[max] ? l.level : max;
      }, 'AUSENTE' as InfestationLevel);

      const crops = Array.isArray(agg.affectedCrops) ? (agg.affectedCrops as string[]) : [];

      return {
        pestId,
        commonName: agg.commonName,
        scientificName: agg.scientificName,
        category: agg.category,
        categoryLabel: PEST_CATEGORY_LABELS[agg.category] ?? agg.category,
        affectedCrops: crops,
        peakLevel,
        peakLevelLabel: INFESTATION_LEVEL_LABELS[peakLevel] ?? peakLevel,
        firstDetected: agg.firstDate.toISOString().split('T')[0],
        lastDetected: agg.lastDate.toISOString().split('T')[0],
        recordCount: agg.levels.length,
        affectedPointCount: agg.points.size,
        hasNaturalEnemies: agg.hasNaturalEnemies,
      };
    });

    // Sort by record count descending
    pestSummary.sort((a, b) => b.recordCount - a.recordCount);

    // ─── Build detailed analysis ──────────────────────────────────
    const detailedAnalysis: ReportPestDetail[] = allPestIds.map((pestId) => {
      const agg = pestAgg.get(pestId)!;
      const trend = computeTrend(agg.levels);

      // Weekly timeline
      const sortedBuckets = [...agg.weeklyBuckets.keys()].sort();
      const timeline: ReportTimelineEntry[] = sortedBuckets.map((bucket) => {
        const wb = agg.weeklyBuckets.get(bucket)!;
        return {
          date: bucket,
          avgIntensity: Math.round((wb.totalWeight / wb.count) * 100) / 100,
          recordCount: wb.count,
        };
      });

      // Control decisions: find points where level exceeded threshold
      const controlDecisions: ReportControlDecision[] = [];
      if (agg.controlThreshold) {
        const threshold = agg.controlThreshold as InfestationLevel;
        const thresholdWeight = LEVEL_WEIGHT[threshold];

        // Group records by week, check which weeks had threshold exceedances
        const weekExceedances = new Map<string, { count: number; maxLevel: InfestationLevel }>();

        for (const { level, date } of agg.levels) {
          if (LEVEL_WEIGHT[level] >= thresholdWeight) {
            const bucket = getWeekBucket(date);
            const existing = weekExceedances.get(bucket);
            if (!existing) {
              weekExceedances.set(bucket, { count: 1, maxLevel: level });
            } else {
              existing.count++;
              if (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[existing.maxLevel]) {
                existing.maxLevel = level;
              }
            }
          }
        }

        for (const [date, exc] of weekExceedances) {
          const urgency = LEVEL_WEIGHT[exc.maxLevel] >= LEVEL_WEIGHT.CRITICO ? 'CRITICO' : 'ALERTA';
          controlDecisions.push({
            date,
            urgency,
            urgencyLabel: URGENCY_LABELS[urgency as 'ALERTA' | 'CRITICO'],
            affectedPointCount: exc.count,
            maxLevel: exc.maxLevel,
            maxLevelLabel: INFESTATION_LEVEL_LABELS[exc.maxLevel] ?? exc.maxLevel,
            justification: `Infestação atingiu nível ${INFESTATION_LEVEL_LABELS[exc.maxLevel]}, acima do NC (${INFESTATION_LEVEL_LABELS[threshold]}). ${exc.count} registro(s) na semana.`,
          });
        }

        controlDecisions.sort((a, b) => a.date.localeCompare(b.date));
      }

      return {
        pestId,
        pestName: agg.commonName,
        scientificName: agg.scientificName,
        category: agg.category,
        timeline,
        trend,
        trendLabel: TREND_LABELS[trend],
        controlDecisions,
        naturalEnemiesObserved: agg.hasNaturalEnemies,
        ndeDescription: agg.ndeDescription,
        ncDescription: agg.ncDescription,
        recommendedProducts: agg.recommendedProducts,
      };
    });

    // Sort detailed: pests with control decisions first
    detailedAnalysis.sort((a, b) => b.controlDecisions.length - a.controlDecisions.length);

    // ─── Build summary ────────────────────────────────────────────
    const summary: ReportSummary = {
      farmName: farm.name,
      reportPeriod: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      generatedAt: new Date().toISOString(),
      totalMonitoringPoints: totalPoints,
      totalPestsMonitored: pestAgg.size,
      totalMonitoringRecords: records.length,
      plotsIncluded: plotSummaries,
    };

    return { summary, pestSummary, detailedAnalysis };
  });
}

// ─── Excel Export ────────────────────────────────────────────────────

export async function generateMonitoringReportExcel(
  ctx: RlsContext,
  farmId: string,
  query: MonitoringReportQuery,
): Promise<Buffer> {
  const report = await generateMonitoringReport(ctx, farmId, query);
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();

  // ─── Sheet 1: Resumo ──────────────────────────────────────────
  const wsResumo = wb.addWorksheet('Resumo');
  wsResumo.addRow(['RELATÓRIO MIP — MONITORAMENTO INTEGRADO DE PRAGAS']);
  wsResumo.getRow(1).font = { bold: true, size: 14 };
  wsResumo.addRow([]);
  wsResumo.addRow(['Fazenda:', report.summary.farmName]);
  wsResumo.addRow([
    'Período:',
    `${report.summary.reportPeriod.start} a ${report.summary.reportPeriod.end}`,
  ]);
  wsResumo.addRow(['Gerado em:', new Date(report.summary.generatedAt).toLocaleString('pt-BR')]);
  wsResumo.addRow([]);
  wsResumo.addRow(['Pontos de monitoramento:', report.summary.totalMonitoringPoints]);
  wsResumo.addRow(['Pragas monitoradas:', report.summary.totalPestsMonitored]);
  wsResumo.addRow(['Total de registros:', report.summary.totalMonitoringRecords]);
  wsResumo.addRow([]);
  wsResumo.addRow(['TALHÕES INCLUÍDOS']);
  wsResumo.getRow(wsResumo.rowCount).font = { bold: true };

  const plotHeader = wsResumo.addRow(['Talhão', 'Pontos', 'Registros']);
  plotHeader.font = { bold: true };
  for (const plot of report.summary.plotsIncluded) {
    wsResumo.addRow([plot.name, plot.monitoringPointCount, plot.recordCount]);
  }

  wsResumo.getColumn(1).width = 30;
  wsResumo.getColumn(2).width = 40;

  // ─── Sheet 2: Pragas Monitoradas ──────────────────────────────
  const wsPragas = wb.addWorksheet('Pragas Monitoradas');
  const pestHeaders = [
    'Praga',
    'Nome Científico',
    'Categoria',
    'Culturas Afetadas',
    'Nível Máx.',
    'Primeira Detecção',
    'Última Detecção',
    'Nº Registros',
    'Pontos Afetados',
    'Inimigos Naturais',
  ];
  const pestHeaderRow = wsPragas.addRow(pestHeaders);
  pestHeaderRow.font = { bold: true };

  for (const pest of report.pestSummary) {
    wsPragas.addRow([
      pest.commonName,
      pest.scientificName ?? '—',
      pest.categoryLabel,
      pest.affectedCrops.join(', ') || '—',
      pest.peakLevelLabel,
      pest.firstDetected,
      pest.lastDetected,
      pest.recordCount,
      pest.affectedPointCount,
      pest.hasNaturalEnemies ? 'Sim' : 'Não',
    ]);
  }

  wsPragas.columns.forEach((col) => {
    col.width = 18;
  });

  // ─── Sheet 3: Decisões de Controle ────────────────────────────
  const wsDecisoes = wb.addWorksheet('Decisões de Controle');
  const decHeaders = [
    'Praga',
    'Semana',
    'Urgência',
    'Nível Máx.',
    'Registros',
    'Justificativa',
    'NDE',
    'NC',
    'Produtos Recomendados',
  ];
  const decHeaderRow = wsDecisoes.addRow(decHeaders);
  decHeaderRow.font = { bold: true };

  for (const detail of report.detailedAnalysis) {
    for (const dec of detail.controlDecisions) {
      wsDecisoes.addRow([
        detail.pestName,
        dec.date,
        dec.urgencyLabel,
        dec.maxLevelLabel,
        dec.affectedPointCount,
        dec.justification,
        detail.ndeDescription ?? '—',
        detail.ncDescription ?? '—',
        detail.recommendedProducts ?? '—',
      ]);
    }
  }

  wsDecisoes.columns.forEach((col) => {
    col.width = 20;
  });
  if (wsDecisoes.getColumn(6)) wsDecisoes.getColumn(6).width = 50;

  // ─── Sheet 4: Evolução Temporal ───────────────────────────────
  const wsTimeline = wb.addWorksheet('Evolução Temporal');
  const tlHeaders = ['Praga', 'Tendência', 'Semana', 'Intensidade Média', 'Nº Registros'];
  const tlHeaderRow = wsTimeline.addRow(tlHeaders);
  tlHeaderRow.font = { bold: true };

  for (const detail of report.detailedAnalysis) {
    for (const entry of detail.timeline) {
      wsTimeline.addRow([
        detail.pestName,
        detail.trendLabel,
        entry.date,
        entry.avgIntensity,
        entry.recordCount,
      ]);
    }
  }

  wsTimeline.columns.forEach((col) => {
    col.width = 20;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
