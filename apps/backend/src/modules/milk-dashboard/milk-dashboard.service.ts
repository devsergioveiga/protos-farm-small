import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  type MilkDashboardQuery,
  type MilkDashboardResponse,
  type MilkDashboardKpis,
  type ProductionEvolutionPoint,
  type CowRankingItem,
  type QualityIndicators,
  type FinancialSummary,
  periodToDays,
} from './milk-dashboard.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type Trend = 'IMPROVING' | 'STABLE' | 'WORSENING';

function calcTrend(current: number | null, previous: number | null): Trend {
  if (current == null || previous == null || previous === 0) return 'STABLE';
  const change = ((current - previous) / previous) * 100;
  // For SCC/TBC, lower is better
  if (change < -5) return 'IMPROVING';
  if (change > 5) return 'WORSENING';
  return 'STABLE';
}

// ─── Main service ───────────────────────────────────────────────────

export async function getMilkDashboard(
  ctx: RlsContext,
  query: MilkDashboardQuery,
): Promise<MilkDashboardResponse> {
  return withRlsContext(ctx, async (tx) => {
    const now = new Date();
    const today = startOfDay(now);
    const monthStart = startOfMonth(now);
    const days = periodToDays(query.period);
    const periodStart = daysAgo(days);

    // ── Build animal filter for lot/breed ──────────────────────────
    const animalWhere: any = {
      farmId: query.farmId,
      deletedAt: null,
    };
    if (query.lotId) animalWhere.lotId = query.lotId;

    // If breedName is specified, get animal IDs that have that breed composition
    let breedFilteredAnimalIds: string[] | null = null;
    if (query.breedName) {
      const breedCompositions = await tx.animalBreedComposition.findMany({
        where: {
          animal: { farmId: query.farmId, deletedAt: null },
          breed: { name: query.breedName },
        },
        select: { animalId: true },
      });
      breedFilteredAnimalIds = breedCompositions.map((bc) => bc.animalId);
      if (breedFilteredAnimalIds.length === 0) {
        // No animals match breed — return empty dashboard
        return emptyDashboard();
      }
      animalWhere.id = { in: breedFilteredAnimalIds };
    }

    // Get matching animals for ranking/KPIs
    const animals = await tx.animal.findMany({
      where: animalWhere,
      select: { id: true },
    });
    const animalIds = animals.map((a) => a.id);

    if (animalIds.length === 0) {
      return emptyDashboard();
    }

    // Build milking record filter
    const milkingWhere: any = {
      farmId: query.farmId,
      organizationId: ctx.organizationId,
      animalId: { in: animalIds },
    };

    // ═══ CA1: KPIs ═══════════════════════════════════════════════

    // Today's production
    const todayRecords = await tx.milkingRecord.findMany({
      where: { ...milkingWhere, milkingDate: today },
      select: { liters: true },
    });
    const todayLiters = todayRecords.reduce((sum, r) => sum + r.liters, 0);

    // This month's production
    const monthRecords = await tx.milkingRecord.findMany({
      where: { ...milkingWhere, milkingDate: { gte: monthStart } },
      select: { liters: true },
    });
    const monthLiters = monthRecords.reduce((sum, r) => sum + r.liters, 0);

    // Accumulated (full period)
    const periodRecords = await tx.milkingRecord.findMany({
      where: { ...milkingWhere, milkingDate: { gte: periodStart } },
      select: { liters: true, milkingDate: true, animalId: true },
    });
    const accumulatedLiters = periodRecords.reduce((sum, r) => sum + r.liters, 0);

    // Cows in lactation vs dry
    const cowsInLactation = await tx.lactation.count({
      where: {
        farmId: query.farmId,
        organizationId: ctx.organizationId,
        animalId: { in: animalIds },
        status: 'IN_PROGRESS',
      },
    });

    const dryCows = await tx.lactation.count({
      where: {
        farmId: query.farmId,
        organizationId: ctx.organizationId,
        animalId: { in: animalIds },
        status: 'DRIED',
        // Only count most recent lactation per animal that is dried
        endDate: { not: null },
      },
    });

    // Avg liters per cow per day (period total / cows in lactation / days in period)
    const avgLitersPerCow =
      cowsInLactation > 0
        ? Math.round((accumulatedLiters / cowsInLactation / days) * 100) / 100
        : 0;

    const kpis: MilkDashboardKpis = {
      todayLiters: Math.round(todayLiters * 100) / 100,
      monthLiters: Math.round(monthLiters * 100) / 100,
      accumulatedLiters: Math.round(accumulatedLiters * 100) / 100,
      avgLitersPerCow,
      cowsInLactation,
      dryCows,
    };

    // ═══ CA2: Daily production evolution ═════════════════════════

    const dailyMap = new Map<string, number>();
    for (const r of periodRecords) {
      const key = dateKey(r.milkingDate as Date);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + r.liters);
    }

    const evolution: ProductionEvolutionPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = daysAgo(i);
      const key = dateKey(d);
      evolution.push({
        date: key,
        totalLiters: Math.round((dailyMap.get(key) ?? 0) * 100) / 100,
      });
    }

    // ═══ CA3: Cow ranking ═══════════════════════════════════════

    const cowTotals = new Map<string, number>();
    for (const r of periodRecords) {
      cowTotals.set(r.animalId, (cowTotals.get(r.animalId) ?? 0) + r.liters);
    }

    const cowEntries = [...cowTotals.entries()].map(([animalId, totalLiters]) => ({
      animalId,
      totalLiters,
    }));

    // Get animal details for ranking
    const rankedAnimalIds = cowEntries.map((c) => c.animalId);
    const rankedAnimals = await tx.animal.findMany({
      where: { id: { in: rankedAnimalIds } },
      select: {
        id: true,
        earTag: true,
        name: true,
        lot: { select: { name: true } },
      },
    });
    const animalMap = new Map(rankedAnimals.map((a) => [a.id, a]));

    function buildRankingItem(entry: { animalId: string; totalLiters: number }): CowRankingItem {
      const animal = animalMap.get(entry.animalId);
      return {
        animalId: entry.animalId,
        earTag: animal?.earTag ?? '',
        animalName: animal?.name ?? null,
        totalLiters: Math.round(entry.totalLiters * 100) / 100,
        avgLitersPerDay: Math.round((entry.totalLiters / days) * 100) / 100,
        lotName: animal?.lot?.name ?? null,
      };
    }

    // Top 10
    const topEntries = [...cowEntries].sort((a, b) => b.totalLiters - a.totalLiters).slice(0, 10);
    const topCows = topEntries.map(buildRankingItem);

    // Bottom 10
    const bottomEntries = [...cowEntries]
      .sort((a, b) => a.totalLiters - b.totalLiters)
      .slice(0, 10);
    const bottomCows = bottomEntries.map(buildRankingItem);

    // ═══ CA4: Quality indicators ════════════════════════════════

    // Get recent TANK analyses for the farm
    const recentAnalyses = await tx.milkAnalysis.findMany({
      where: {
        farmId: query.farmId,
        organizationId: ctx.organizationId,
        analysisType: 'TANK',
        analysisDate: { gte: periodStart },
      },
      select: {
        scc: true,
        tbc: true,
        analysisDate: true,
      },
      orderBy: { analysisDate: 'desc' },
    });

    let avgScc: number | null = null;
    let avgTbc: number | null = null;
    let sccTrend: Trend = 'STABLE';
    let tbcTrend: Trend = 'STABLE';

    if (recentAnalyses.length > 0) {
      const sccValues = recentAnalyses.filter((a) => a.scc != null).map((a) => a.scc!);
      const tbcValues = recentAnalyses.filter((a) => a.tbc != null).map((a) => a.tbc!);

      if (sccValues.length > 0) {
        avgScc = Math.round(sccValues.reduce((s, v) => s + v, 0) / sccValues.length);
      }
      if (tbcValues.length > 0) {
        avgTbc = Math.round(tbcValues.reduce((s, v) => s + v, 0) / tbcValues.length);
      }

      // Trend: compare last 3 months vs previous 3 months
      const threeMonthsAgo = daysAgo(90);
      const sixMonthsAgo = daysAgo(180);

      const recentScc = recentAnalyses
        .filter((a) => a.scc != null && (a.analysisDate as Date) >= threeMonthsAgo)
        .map((a) => a.scc!);
      const olderAnalyses = await tx.milkAnalysis.findMany({
        where: {
          farmId: query.farmId,
          organizationId: ctx.organizationId,
          analysisType: 'TANK',
          analysisDate: { gte: sixMonthsAgo, lt: threeMonthsAgo },
        },
        select: { scc: true, tbc: true },
      });

      const olderScc = olderAnalyses.filter((a) => a.scc != null).map((a) => a.scc!);
      const olderTbc = olderAnalyses.filter((a) => a.tbc != null).map((a) => a.tbc!);
      const recentTbc = recentAnalyses
        .filter((a) => a.tbc != null && (a.analysisDate as Date) >= threeMonthsAgo)
        .map((a) => a.tbc!);

      const avgRecentScc =
        recentScc.length > 0 ? recentScc.reduce((s, v) => s + v, 0) / recentScc.length : null;
      const avgOlderScc =
        olderScc.length > 0 ? olderScc.reduce((s, v) => s + v, 0) / olderScc.length : null;
      sccTrend = calcTrend(avgRecentScc, avgOlderScc);

      const avgRecentTbc =
        recentTbc.length > 0 ? recentTbc.reduce((s, v) => s + v, 0) / recentTbc.length : null;
      const avgOlderTbc =
        olderTbc.length > 0 ? olderTbc.reduce((s, v) => s + v, 0) / olderTbc.length : null;
      tbcTrend = calcTrend(avgRecentTbc, avgOlderTbc);
    }

    const quality: QualityIndicators = { avgScc, avgTbc, sccTrend, tbcTrend };

    // ═══ CA5-CA7: Financial summary ═════════════════════════════

    // Revenue from MilkCollection
    const collections = await tx.milkCollection.findMany({
      where: {
        farmId: query.farmId,
        organizationId: ctx.organizationId,
        collectionDate: { gte: periodStart },
      },
      select: {
        pricePerLiter: true,
        netValue: true,
        volumeLiters: true,
      },
    });

    let totalRevenue = 0;
    let totalVolCollected = 0;
    for (const c of collections) {
      if (c.netValue != null) totalRevenue += c.netValue;
      if (c.volumeLiters != null) totalVolCollected += c.volumeLiters;
    }

    const revenuePerLiter = totalVolCollected > 0 ? totalRevenue / totalVolCollected : 0;

    // Health costs from MastitisCase
    const mastitisCases = await tx.mastitisCase.findMany({
      where: {
        farmId: query.farmId,
        organizationId: ctx.organizationId,
        animalId: { in: animalIds },
        occurrenceDate: { gte: periodStart },
      },
      select: { totalCostCents: true },
    });
    const healthCostCents = mastitisCases.reduce((sum, c) => sum + c.totalCostCents, 0);
    const healthCost = healthCostCents / 100;

    // Feed and labor costs — placeholder estimates based on industry averages
    // In a full implementation these would come from cost-center modules
    const feedCost = accumulatedLiters > 0 ? accumulatedLiters * 0.8 : 0; // R$0.80/L placeholder
    const laborCost = accumulatedLiters > 0 ? accumulatedLiters * 0.15 : 0; // R$0.15/L placeholder

    const totalCost = feedCost + healthCost + laborCost;
    const costPerLiter = accumulatedLiters > 0 ? totalCost / accumulatedLiters : 0;
    const marginPerLiter = revenuePerLiter - costPerLiter;
    const totalMargin = totalRevenue - totalCost;

    const financial: FinancialSummary = {
      costPerLiter: Math.round(costPerLiter * 100) / 100,
      revenuePerLiter: Math.round(revenuePerLiter * 100) / 100,
      marginPerLiter: Math.round(marginPerLiter * 100) / 100,
      totalMargin: Math.round(totalMargin * 100) / 100,
      breakdown: {
        feedCost: Math.round(feedCost * 100) / 100,
        healthCost: Math.round(healthCost * 100) / 100,
        laborCost: Math.round(laborCost * 100) / 100,
      },
    };

    return {
      kpis,
      evolution,
      topCows,
      bottomCows,
      quality,
      financial,
    };
  });
}

// ─── Empty dashboard ────────────────────────────────────────────────

function emptyDashboard(): MilkDashboardResponse {
  return {
    kpis: {
      todayLiters: 0,
      monthLiters: 0,
      accumulatedLiters: 0,
      avgLitersPerCow: 0,
      cowsInLactation: 0,
      dryCows: 0,
    },
    evolution: [],
    topCows: [],
    bottomCows: [],
    quality: {
      avgScc: null,
      avgTbc: null,
      sccTrend: 'STABLE',
      tbcTrend: 'STABLE',
    },
    financial: {
      costPerLiter: 0,
      revenuePerLiter: 0,
      marginPerLiter: 0,
      totalMargin: 0,
      breakdown: { feedCost: 0, healthCost: 0, laborCost: 0 },
    },
  };
}

// ─── CSV export ─────────────────────────────────────────────────────

export async function exportMilkDashboardCsv(
  ctx: RlsContext,
  query: MilkDashboardQuery,
): Promise<string> {
  const data = await getMilkDashboard(ctx, query);

  const lines: string[] = [];

  // KPIs section
  lines.push('INDICADORES DE PRODUÇÃO DE LEITE');
  lines.push(`"Produção hoje (L)";"${data.kpis.todayLiters}"`);
  lines.push(`"Produção mês (L)";"${data.kpis.monthLiters}"`);
  lines.push(`"Produção acumulada (L)";"${data.kpis.accumulatedLiters}"`);
  lines.push(`"Média L/vaca/dia";"${data.kpis.avgLitersPerCow}"`);
  lines.push(`"Vacas em lactação";"${data.kpis.cowsInLactation}"`);
  lines.push(`"Vacas secas";"${data.kpis.dryCows}"`);
  lines.push('');

  // Evolution
  lines.push('EVOLUÇÃO DIÁRIA');
  lines.push('"Data";"Litros"');
  for (const e of data.evolution) {
    lines.push(`"${e.date}";"${e.totalLiters}"`);
  }
  lines.push('');

  // Top cows
  lines.push('RANKING — TOP 10 PRODUTORAS');
  lines.push('"Brinco";"Nome";"Total (L)";"Média L/dia";"Lote"');
  for (const c of data.topCows) {
    lines.push(
      [c.earTag, c.animalName ?? '', c.totalLiters, c.avgLitersPerDay, c.lotName ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';'),
    );
  }
  lines.push('');

  // Bottom cows
  lines.push('RANKING — 10 MENORES PRODUTORAS');
  lines.push('"Brinco";"Nome";"Total (L)";"Média L/dia";"Lote"');
  for (const c of data.bottomCows) {
    lines.push(
      [c.earTag, c.animalName ?? '', c.totalLiters, c.avgLitersPerDay, c.lotName ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';'),
    );
  }
  lines.push('');

  // Quality
  lines.push('INDICADORES DE QUALIDADE');
  lines.push(`"CCS média (cél/mL)";"${data.quality.avgScc ?? 'N/A'}"`);
  lines.push(`"CBT média (UFC/mL)";"${data.quality.avgTbc ?? 'N/A'}"`);
  lines.push(`"Tendência CCS";"${trendLabel(data.quality.sccTrend)}"`);
  lines.push(`"Tendência CBT";"${trendLabel(data.quality.tbcTrend)}"`);
  lines.push('');

  // Financial
  lines.push('RESUMO FINANCEIRO');
  lines.push(`"Custo por litro (R$)";"${data.financial.costPerLiter}"`);
  lines.push(`"Receita por litro (R$)";"${data.financial.revenuePerLiter}"`);
  lines.push(`"Margem por litro (R$)";"${data.financial.marginPerLiter}"`);
  lines.push(`"Margem total (R$)";"${data.financial.totalMargin}"`);
  lines.push(`"Custo alimentação (R$)";"${data.financial.breakdown.feedCost}"`);
  lines.push(`"Custo sanidade (R$)";"${data.financial.breakdown.healthCost}"`);
  lines.push(`"Custo mão de obra (R$)";"${data.financial.breakdown.laborCost}"`);

  return '\uFEFF' + lines.join('\n');
}

function trendLabel(trend: string): string {
  switch (trend) {
    case 'IMPROVING':
      return 'Melhorando';
    case 'WORSENING':
      return 'Piorando';
    default:
      return 'Estável';
  }
}
