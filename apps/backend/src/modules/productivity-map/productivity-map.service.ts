import { withRlsContext, type RlsContext } from '../../database/rls';
import { resolveStandardMoisture } from '../grain-harvests/moisture-standards.service';
import { SACA_KG } from '../grain-harvests/grain-harvests.types';
import {
  ProductivityMapError,
  type CultureType,
  type PlotProductivity,
  type PlotProductivityWithLevel,
  type ProductivityLevel,
  type ProductivityMapResponse,
  type PlotSeasonComparison,
  type SeasonEntry,
} from './productivity-map.types';

// ─── Helpers ────────────────────────────────────────────────────────

function computeGrainProductivitySc(
  grossProductionKg: number,
  moisturePct: number,
  impurityPct: number,
  standardMoisturePct: number,
): number {
  const netKg = grossProductionKg * (1 - impurityPct / 100);
  const correctedKg = netKg * ((100 - moisturePct) / (100 - standardMoisturePct));
  return correctedKg / SACA_KG;
}

function classifyProductivity(
  plotValue: number,
  avgValue: number,
): { level: ProductivityLevel; deviation: number } {
  if (avgValue === 0) return { level: 'SEM_DADOS', deviation: 0 };
  const deviation = ((plotValue - avgValue) / avgValue) * 100;

  if (deviation >= 10) return { level: 'ALTA', deviation: Math.round(deviation * 10) / 10 };
  if (deviation >= -10) return { level: 'MEDIA', deviation: Math.round(deviation * 10) / 10 };
  return { level: 'BAIXA', deviation: Math.round(deviation * 10) / 10 };
}

// ─── Main Service ───────────────────────────────────────────────────

interface ProductivityMapOptions {
  cultureType?: CultureType;
  crop?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getProductivityMap(
  ctx: RlsContext,
  farmId: string,
  options: ProductivityMapOptions = {},
): Promise<ProductivityMapResponse> {
  return withRlsContext(ctx, async (tx) => {
    // Verify farm exists
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new ProductivityMapError('Fazenda não encontrada', 404);
    }

    // Get all active field plots for this farm
    const fieldPlots = await tx.fieldPlot.findMany({
      where: { farmId, deletedAt: null },
      select: { id: true, name: true, boundaryAreaHa: true, currentCrop: true },
      orderBy: { name: 'asc' },
    });

    const plotMap = new Map(
      fieldPlots.map((p) => [
        p.id,
        {
          name: p.name,
          areaHa: Number(p.boundaryAreaHa),
          currentCrop: p.currentCrop,
        },
      ]),
    );

    // Build date filters
    const dateFilter: Record<string, Date> = {};
    if (options.dateFrom) dateFilter.gte = new Date(options.dateFrom);
    if (options.dateTo) dateFilter.lte = new Date(options.dateTo);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const plots: PlotProductivity[] = [];

    // ─── Grain harvests ──────────────────────────────────────────
    if (!options.cultureType || options.cultureType === 'GRAOS') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const grainWhere: any = { farmId, deletedAt: null };
      if (hasDateFilter) grainWhere.harvestDate = dateFilter;
      if (options.crop) grainWhere.crop = { equals: options.crop, mode: 'insensitive' };

      const grainHarvests = await tx.grainHarvest.findMany({
        where: grainWhere,
        include: { fieldPlot: { select: { id: true, name: true, boundaryAreaHa: true } } },
        orderBy: { harvestDate: 'asc' },
      });

      // Group by fieldPlotId
      const grainByPlot = new Map<
        string,
        {
          name: string;
          areaHa: number;
          crop: string;
          totalSc: number;
          count: number;
          firstDate: string;
          lastDate: string;
        }
      >();

      for (const h of grainHarvests) {
        const row = h as unknown as Record<string, unknown>;
        const plotId = row.fieldPlotId as string;
        const plotInfo = row.fieldPlot as { id: string; name: string; boundaryAreaHa: unknown };
        const crop = row.crop as string;
        const date = (row.harvestDate as Date).toISOString().split('T')[0];

        const stdMoisture = await resolveStandardMoisture(ctx, crop);
        const sc = computeGrainProductivitySc(
          Number(row.grossProductionKg),
          Number(row.moisturePct),
          Number(row.impurityPct),
          stdMoisture,
        );

        let acc = grainByPlot.get(plotId);
        if (!acc) {
          acc = {
            name: plotInfo.name,
            areaHa: Number(plotInfo.boundaryAreaHa),
            crop,
            totalSc: 0,
            count: 0,
            firstDate: date,
            lastDate: date,
          };
          grainByPlot.set(plotId, acc);
        }
        acc.totalSc += sc;
        acc.count += 1;
        if (date < acc.firstDate) acc.firstDate = date;
        if (date > acc.lastDate) acc.lastDate = date;
      }

      for (const [plotId, acc] of grainByPlot) {
        const areaHa = acc.areaHa > 0 ? acc.areaHa : 1;
        plots.push({
          fieldPlotId: plotId,
          fieldPlotName: acc.name,
          fieldPlotAreaHa: acc.areaHa,
          cultureType: 'GRAOS',
          crop: acc.crop,
          totalProduction: Math.round(acc.totalSc * 100) / 100,
          productionUnit: 'sc',
          productivityPerHa: Math.round((acc.totalSc / areaHa) * 100) / 100,
          productivityUnit: 'sc/ha',
          harvestCount: acc.count,
          dateRange: { first: acc.firstDate, last: acc.lastDate },
        });
      }
    }

    // ─── Coffee harvests ─────────────────────────────────────────
    if (!options.cultureType || options.cultureType === 'CAFE') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coffeeWhere: any = { farmId, deletedAt: null };
      if (hasDateFilter) coffeeWhere.harvestDate = dateFilter;

      const coffeeHarvests = await tx.coffeeHarvest.findMany({
        where: coffeeWhere,
        include: { fieldPlot: { select: { id: true, name: true, boundaryAreaHa: true } } },
        orderBy: { harvestDate: 'asc' },
      });

      // Group by fieldPlotId
      const coffeeByPlot = new Map<
        string,
        {
          name: string;
          areaHa: number;
          totalSacs: number;
          count: number;
          firstDate: string;
          lastDate: string;
        }
      >();

      for (const h of coffeeHarvests) {
        const row = h as unknown as Record<string, unknown>;
        const plotId = row.fieldPlotId as string;
        const plotInfo = row.fieldPlot as { id: string; name: string; boundaryAreaHa: unknown };
        const date = (row.harvestDate as Date).toISOString().split('T')[0];
        const vol = Number(row.volumeLiters);
        const yld = row.yieldLitersPerSac != null ? Number(row.yieldLitersPerSac) : 480;
        const sacs = yld > 0 ? vol / yld : 0;

        let acc = coffeeByPlot.get(plotId);
        if (!acc) {
          acc = {
            name: plotInfo.name,
            areaHa: Number(plotInfo.boundaryAreaHa),
            totalSacs: 0,
            count: 0,
            firstDate: date,
            lastDate: date,
          };
          coffeeByPlot.set(plotId, acc);
        }
        acc.totalSacs += sacs;
        acc.count += 1;
        if (date < acc.firstDate) acc.firstDate = date;
        if (date > acc.lastDate) acc.lastDate = date;
      }

      for (const [plotId, acc] of coffeeByPlot) {
        const areaHa = acc.areaHa > 0 ? acc.areaHa : 1;
        plots.push({
          fieldPlotId: plotId,
          fieldPlotName: acc.name,
          fieldPlotAreaHa: acc.areaHa,
          cultureType: 'CAFE',
          crop: 'Café',
          totalProduction: Math.round(acc.totalSacs * 100) / 100,
          productionUnit: 'sc',
          productivityPerHa: Math.round((acc.totalSacs / areaHa) * 100) / 100,
          productivityUnit: 'sc/ha',
          harvestCount: acc.count,
          dateRange: { first: acc.firstDate, last: acc.lastDate },
        });
      }
    }

    // ─── Classify productivity levels ────────────────────────────
    const avgProductivity =
      plots.length > 0 ? plots.reduce((sum, p) => sum + p.productivityPerHa, 0) / plots.length : 0;

    const classified: PlotProductivityWithLevel[] = plots.map((p) => {
      const { level, deviation } = classifyProductivity(p.productivityPerHa, avgProductivity);
      return { ...p, level, deviationFromAvg: deviation };
    });

    // Count levels
    const levels: Record<ProductivityLevel, number> = {
      ALTA: 0,
      MEDIA: 0,
      BAIXA: 0,
      SEM_DADOS: 0,
    };
    for (const p of classified) {
      levels[p.level] += 1;
    }

    // Add plots without harvest data
    const plotsWithData = new Set(plots.map((p) => p.fieldPlotId));
    for (const [plotId, info] of plotMap) {
      if (!plotsWithData.has(plotId)) {
        classified.push({
          fieldPlotId: plotId,
          fieldPlotName: info.name,
          fieldPlotAreaHa: info.areaHa,
          cultureType: 'GRAOS',
          crop: info.currentCrop ?? '',
          totalProduction: 0,
          productionUnit: 'sc',
          productivityPerHa: 0,
          productivityUnit: 'sc/ha',
          harvestCount: 0,
          dateRange: { first: '', last: '' },
          level: 'SEM_DADOS',
          deviationFromAvg: 0,
        });
        levels.SEM_DADOS += 1;
      }
    }

    // Sort by name
    classified.sort((a, b) => a.fieldPlotName.localeCompare(b.fieldPlotName));

    return {
      plots: classified,
      summary: {
        totalPlots: fieldPlots.length,
        plotsWithData: plotsWithData.size,
        avgProductivityPerHa: Math.round(avgProductivity * 100) / 100,
        productivityUnit: 'sc/ha',
        levels,
      },
      filters: {
        cultureType: options.cultureType ?? null,
        crop: options.crop ?? null,
        dateFrom: options.dateFrom ?? null,
        dateTo: options.dateTo ?? null,
      },
    };
  });
}

// ─── CA5: Season Comparison ─────────────────────────────────────

function harvestYear(date: Date): string {
  const month = date.getMonth();
  const year = date.getFullYear();
  // Brazilian harvest seasons: Jul-Jun cycle
  if (month >= 6) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
}

export async function getSeasonComparison(
  ctx: RlsContext,
  farmId: string,
  fieldPlotId?: string,
): Promise<PlotSeasonComparison[]> {
  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) throw new ProductivityMapError('Fazenda não encontrada', 404);

    // Grain harvests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grainWhere: any = { farmId, deletedAt: null };
    if (fieldPlotId) grainWhere.fieldPlotId = fieldPlotId;

    const grainHarvests = await tx.grainHarvest.findMany({
      where: grainWhere,
      include: { fieldPlot: { select: { id: true, name: true, boundaryAreaHa: true } } },
      orderBy: { harvestDate: 'asc' },
    });

    // Coffee harvests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coffeeWhere: any = { farmId, deletedAt: null };
    if (fieldPlotId) coffeeWhere.fieldPlotId = fieldPlotId;

    const coffeeHarvests = await tx.coffeeHarvest.findMany({
      where: coffeeWhere,
      include: { fieldPlot: { select: { id: true, name: true, boundaryAreaHa: true } } },
      orderBy: { harvestDate: 'asc' },
    });

    // Accumulate: plotId -> season -> metrics
    const plotSeasons = new Map<
      string,
      {
        name: string;
        areaHa: number;
        seasons: Map<string, { totalSc: number; count: number }>;
      }
    >();

    function ensurePlot(plotId: string, name: string, areaHa: number) {
      if (!plotSeasons.has(plotId)) {
        plotSeasons.set(plotId, { name, areaHa, seasons: new Map() });
      }
      return plotSeasons.get(plotId)!;
    }

    function ensureSeason(
      acc: { seasons: Map<string, { totalSc: number; count: number }> },
      season: string,
    ) {
      if (!acc.seasons.has(season)) acc.seasons.set(season, { totalSc: 0, count: 0 });
      return acc.seasons.get(season)!;
    }

    for (const h of grainHarvests) {
      const row = h as unknown as Record<string, unknown>;
      const plotId = row.fieldPlotId as string;
      const plotInfo = row.fieldPlot as { id: string; name: string; boundaryAreaHa: unknown };
      const date = row.harvestDate as Date;
      const season = harvestYear(date);
      const crop = row.crop as string;
      const stdMoisture = await resolveStandardMoisture(ctx, crop);
      const sc = computeGrainProductivitySc(
        Number(row.grossProductionKg),
        Number(row.moisturePct),
        Number(row.impurityPct),
        stdMoisture,
      );
      const acc = ensurePlot(plotId, plotInfo.name, Number(plotInfo.boundaryAreaHa));
      const s = ensureSeason(acc, season);
      s.totalSc += sc;
      s.count += 1;
    }

    for (const h of coffeeHarvests) {
      const row = h as unknown as Record<string, unknown>;
      const plotId = row.fieldPlotId as string;
      const plotInfo = row.fieldPlot as { id: string; name: string; boundaryAreaHa: unknown };
      const date = row.harvestDate as Date;
      const season = harvestYear(date);
      const vol = Number(row.volumeLiters);
      const yld = row.yieldLitersPerSac != null ? Number(row.yieldLitersPerSac) : 480;
      const sacs = yld > 0 ? vol / yld : 0;
      const acc = ensurePlot(plotId, plotInfo.name, Number(plotInfo.boundaryAreaHa));
      const s = ensureSeason(acc, season);
      s.totalSc += sacs;
      s.count += 1;
    }

    // Build response
    const result: PlotSeasonComparison[] = [];
    for (const [plotId, plotData] of plotSeasons) {
      const areaHa = plotData.areaHa > 0 ? plotData.areaHa : 1;
      const seasons: SeasonEntry[] = Array.from(plotData.seasons.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([season, data]) => ({
          season,
          productivityPerHa: Math.round((data.totalSc / areaHa) * 100) / 100,
          productivityUnit: 'sc/ha',
          totalProduction: Math.round(data.totalSc * 100) / 100,
          productionUnit: 'sc',
          harvestCount: data.count,
        }));

      let variationPct: number | null = null;
      if (seasons.length >= 2) {
        const prev = seasons[seasons.length - 2].productivityPerHa;
        const curr = seasons[seasons.length - 1].productivityPerHa;
        if (prev > 0) {
          variationPct = Math.round(((curr - prev) / prev) * 1000) / 10;
        }
      }

      result.push({
        fieldPlotId: plotId,
        fieldPlotName: plotData.name,
        fieldPlotAreaHa: plotData.areaHa,
        seasons,
        variationPct,
      });
    }

    return result.sort((a, b) => a.fieldPlotName.localeCompare(b.fieldPlotName));
  });
}
