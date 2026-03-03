import { withRlsContext, type RlsContext } from '../../database/rls';
import { FarmError } from './farms.types';
import {
  VALID_SEASON_TYPES,
  type CreateCropSeasonInput,
  type UpdateCropSeasonInput,
  type CropSeasonItem,
  type CreateSoilAnalysisInput,
  type UpdateSoilAnalysisInput,
  type SoilAnalysisItem,
  type RotationIndicator,
} from './plot-history.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number | null {
  if (val == null) return null;
  return Number(val);
}

function toDateStr(val: unknown): string | null {
  if (val == null) return null;
  return new Date(val as string | number | Date).toISOString().split('T')[0];
}

function validatePlotExists(plot: { id: string; deletedAt: Date | null } | null): void {
  if (!plot || plot.deletedAt) {
    throw new FarmError('Talhão não encontrado', 404);
  }
}

function validateSeasonType(seasonType: string): void {
  if (!(VALID_SEASON_TYPES as readonly string[]).includes(seasonType)) {
    throw new FarmError(
      `Tipo de safra inválido. Valores permitidos: ${VALID_SEASON_TYPES.join(', ')}`,
      400,
    );
  }
}

function validateDates(startDate?: string | null, endDate?: string | null): void {
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    throw new FarmError('Data de início deve ser anterior à data de término', 400);
  }
}

function validatePositive(value: number | undefined | null, label: string): void {
  if (value != null && value < 0) {
    throw new FarmError(`${label} deve ser maior ou igual a zero`, 400);
  }
}

function validateRange(
  value: number | undefined | null,
  min: number,
  max: number,
  label: string,
): void {
  if (value != null && (value < min || value > max)) {
    throw new FarmError(`${label} deve estar entre ${min} e ${max}`, 400);
  }
}

// ─── Crop Seasons ───────────────────────────────────────────────────

function mapCropSeason(row: Record<string, unknown>): CropSeasonItem {
  return {
    id: row.id as string,
    plotId: row.plotId as string,
    farmId: row.farmId as string,
    seasonType: row.seasonType as string,
    seasonYear: row.seasonYear as string,
    crop: row.crop as string,
    varietyName: (row.varietyName as string) ?? null,
    startDate: toDateStr(row.startDate),
    endDate: toDateStr(row.endDate),
    plantedAreaHa: toNumber(row.plantedAreaHa),
    productivityKgHa: toNumber(row.productivityKgHa),
    totalProductionKg: toNumber(row.totalProductionKg),
    operations: (row.operations as unknown[]) ?? [],
    notes: (row.notes as string) ?? null,
    createdBy: row.createdBy as string,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

export async function listCropSeasons(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
): Promise<CropSeasonItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({ where: { id: plotId, farmId } });
    validatePlotExists(plot);

    const seasons = await tx.plotCropSeason.findMany({
      where: { plotId, farmId },
      orderBy: [{ startDate: 'desc' }, { seasonYear: 'desc' }],
    });

    return seasons.map((s) => mapCropSeason(s as unknown as Record<string, unknown>));
  });
}

export async function createCropSeason(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
  userId: string,
  input: CreateCropSeasonInput,
): Promise<CropSeasonItem> {
  validateSeasonType(input.seasonType);
  if (!input.seasonYear || !input.crop) {
    throw new FarmError('Ano da safra e cultura são obrigatórios', 400);
  }
  validateDates(input.startDate, input.endDate);
  validatePositive(input.productivityKgHa, 'Produtividade');
  validatePositive(input.totalProductionKg, 'Produção total');
  validatePositive(input.plantedAreaHa, 'Área plantada');

  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({ where: { id: plotId, farmId } });
    validatePlotExists(plot);

    const season = await tx.plotCropSeason.create({
      data: {
        plotId,
        farmId,
        seasonType: input.seasonType as 'SAFRA' | 'SAFRINHA' | 'INVERNO',
        seasonYear: input.seasonYear,
        crop: input.crop,
        varietyName: input.varietyName ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        plantedAreaHa: input.plantedAreaHa ?? null,
        productivityKgHa: input.productivityKgHa ?? null,
        totalProductionKg: input.totalProductionKg ?? null,
        operations: (input.operations ??
          []) as unknown as import('@prisma/client').Prisma.InputJsonValue,
        notes: input.notes ?? null,
        createdBy: userId,
      },
    });

    return mapCropSeason(season as unknown as Record<string, unknown>);
  });
}

export async function updateCropSeason(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
  seasonId: string,
  input: UpdateCropSeasonInput,
): Promise<CropSeasonItem> {
  if (input.seasonType != null) validateSeasonType(input.seasonType);
  validateDates(input.startDate, input.endDate);
  validatePositive(input.productivityKgHa, 'Produtividade');
  validatePositive(input.totalProductionKg, 'Produção total');
  validatePositive(input.plantedAreaHa, 'Área plantada');

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.plotCropSeason.findFirst({
      where: { id: seasonId, plotId, farmId },
    });
    if (!existing) throw new FarmError('Safra não encontrada', 404);

    const data: Record<string, unknown> = {};
    if (input.seasonType !== undefined) data.seasonType = input.seasonType;
    if (input.seasonYear !== undefined) data.seasonYear = input.seasonYear;
    if (input.crop !== undefined) data.crop = input.crop;
    if (input.varietyName !== undefined) data.varietyName = input.varietyName;
    if (input.startDate !== undefined)
      data.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.endDate !== undefined) data.endDate = input.endDate ? new Date(input.endDate) : null;
    if (input.plantedAreaHa !== undefined) data.plantedAreaHa = input.plantedAreaHa;
    if (input.productivityKgHa !== undefined) data.productivityKgHa = input.productivityKgHa;
    if (input.totalProductionKg !== undefined) data.totalProductionKg = input.totalProductionKg;
    if (input.operations !== undefined) data.operations = input.operations;
    if (input.notes !== undefined) data.notes = input.notes;

    const season = await tx.plotCropSeason.update({
      where: { id: seasonId },
      data,
    });

    return mapCropSeason(season as unknown as Record<string, unknown>);
  });
}

export async function deleteCropSeason(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
  seasonId: string,
): Promise<{ deleted: true }> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.plotCropSeason.findFirst({
      where: { id: seasonId, plotId, farmId },
    });
    if (!existing) throw new FarmError('Safra não encontrada', 404);

    await tx.plotCropSeason.delete({ where: { id: seasonId } });
    return { deleted: true };
  });
}

// ─── Soil Analyses ──────────────────────────────────────────────────

function mapSoilAnalysis(row: Record<string, unknown>): SoilAnalysisItem {
  return {
    id: row.id as string,
    plotId: row.plotId as string,
    farmId: row.farmId as string,
    analysisDate: toDateStr(row.analysisDate) as string,
    labName: (row.labName as string) ?? null,
    sampleDepthCm: (row.sampleDepthCm as string) ?? null,
    phH2o: toNumber(row.phH2o),
    organicMatterPct: toNumber(row.organicMatterPct),
    phosphorusMgDm3: toNumber(row.phosphorusMgDm3),
    potassiumMgDm3: toNumber(row.potassiumMgDm3),
    calciumCmolcDm3: toNumber(row.calciumCmolcDm3),
    magnesiumCmolcDm3: toNumber(row.magnesiumCmolcDm3),
    aluminumCmolcDm3: toNumber(row.aluminumCmolcDm3),
    ctcCmolcDm3: toNumber(row.ctcCmolcDm3),
    baseSaturationPct: toNumber(row.baseSaturationPct),
    sulfurMgDm3: toNumber(row.sulfurMgDm3),
    clayContentPct: toNumber(row.clayContentPct),
    notes: (row.notes as string) ?? null,
    createdBy: row.createdBy as string,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function validateSoilInput(input: CreateSoilAnalysisInput | UpdateSoilAnalysisInput): void {
  validateRange(input.phH2o, 0, 14, 'pH');
  validateRange(input.baseSaturationPct, 0, 100, 'Saturação por bases (V%)');
  validateRange(input.clayContentPct, 0, 100, 'Teor de argila');
  validateRange(input.organicMatterPct, 0, 100, 'Matéria orgânica');
  validatePositive(input.phosphorusMgDm3, 'Fósforo');
  validatePositive(input.potassiumMgDm3, 'Potássio');
  validatePositive(input.calciumCmolcDm3, 'Cálcio');
  validatePositive(input.magnesiumCmolcDm3, 'Magnésio');
  validatePositive(input.aluminumCmolcDm3, 'Alumínio');
  validatePositive(input.ctcCmolcDm3, 'CTC');
  validatePositive(input.sulfurMgDm3, 'Enxofre');
}

export async function listSoilAnalyses(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
): Promise<SoilAnalysisItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({ where: { id: plotId, farmId } });
    validatePlotExists(plot);

    const analyses = await tx.plotSoilAnalysis.findMany({
      where: { plotId, farmId },
      orderBy: { analysisDate: 'desc' },
    });

    return analyses.map((a) => mapSoilAnalysis(a as unknown as Record<string, unknown>));
  });
}

export async function createSoilAnalysis(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
  userId: string,
  input: CreateSoilAnalysisInput,
): Promise<SoilAnalysisItem> {
  if (!input.analysisDate) {
    throw new FarmError('Data da análise é obrigatória', 400);
  }
  validateSoilInput(input);

  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({ where: { id: plotId, farmId } });
    validatePlotExists(plot);

    const analysis = await tx.plotSoilAnalysis.create({
      data: {
        plotId,
        farmId,
        analysisDate: new Date(input.analysisDate),
        labName: input.labName ?? null,
        sampleDepthCm: input.sampleDepthCm ?? null,
        phH2o: input.phH2o ?? null,
        organicMatterPct: input.organicMatterPct ?? null,
        phosphorusMgDm3: input.phosphorusMgDm3 ?? null,
        potassiumMgDm3: input.potassiumMgDm3 ?? null,
        calciumCmolcDm3: input.calciumCmolcDm3 ?? null,
        magnesiumCmolcDm3: input.magnesiumCmolcDm3 ?? null,
        aluminumCmolcDm3: input.aluminumCmolcDm3 ?? null,
        ctcCmolcDm3: input.ctcCmolcDm3 ?? null,
        baseSaturationPct: input.baseSaturationPct ?? null,
        sulfurMgDm3: input.sulfurMgDm3 ?? null,
        clayContentPct: input.clayContentPct ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
      },
    });

    return mapSoilAnalysis(analysis as unknown as Record<string, unknown>);
  });
}

export async function updateSoilAnalysis(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
  analysisId: string,
  input: UpdateSoilAnalysisInput,
): Promise<SoilAnalysisItem> {
  validateSoilInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.plotSoilAnalysis.findFirst({
      where: { id: analysisId, plotId, farmId },
    });
    if (!existing) throw new FarmError('Análise de solo não encontrada', 404);

    const data: Record<string, unknown> = {};
    if (input.analysisDate !== undefined) data.analysisDate = new Date(input.analysisDate);
    if (input.labName !== undefined) data.labName = input.labName;
    if (input.sampleDepthCm !== undefined) data.sampleDepthCm = input.sampleDepthCm;
    if (input.phH2o !== undefined) data.phH2o = input.phH2o;
    if (input.organicMatterPct !== undefined) data.organicMatterPct = input.organicMatterPct;
    if (input.phosphorusMgDm3 !== undefined) data.phosphorusMgDm3 = input.phosphorusMgDm3;
    if (input.potassiumMgDm3 !== undefined) data.potassiumMgDm3 = input.potassiumMgDm3;
    if (input.calciumCmolcDm3 !== undefined) data.calciumCmolcDm3 = input.calciumCmolcDm3;
    if (input.magnesiumCmolcDm3 !== undefined) data.magnesiumCmolcDm3 = input.magnesiumCmolcDm3;
    if (input.aluminumCmolcDm3 !== undefined) data.aluminumCmolcDm3 = input.aluminumCmolcDm3;
    if (input.ctcCmolcDm3 !== undefined) data.ctcCmolcDm3 = input.ctcCmolcDm3;
    if (input.baseSaturationPct !== undefined) data.baseSaturationPct = input.baseSaturationPct;
    if (input.sulfurMgDm3 !== undefined) data.sulfurMgDm3 = input.sulfurMgDm3;
    if (input.clayContentPct !== undefined) data.clayContentPct = input.clayContentPct;
    if (input.notes !== undefined) data.notes = input.notes;

    const analysis = await tx.plotSoilAnalysis.update({
      where: { id: analysisId },
      data,
    });

    return mapSoilAnalysis(analysis as unknown as Record<string, unknown>);
  });
}

export async function deleteSoilAnalysis(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
  analysisId: string,
): Promise<{ deleted: true }> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.plotSoilAnalysis.findFirst({
      where: { id: analysisId, plotId, farmId },
    });
    if (!existing) throw new FarmError('Análise de solo não encontrada', 404);

    await tx.plotSoilAnalysis.delete({ where: { id: analysisId } });
    return { deleted: true };
  });
}

// ─── Rotation Indicator ─────────────────────────────────────────────

export async function getRotationIndicator(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
): Promise<RotationIndicator> {
  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({ where: { id: plotId, farmId } });
    validatePlotExists(plot);

    const seasons = await tx.plotCropSeason.findMany({
      where: { plotId, farmId },
      orderBy: [{ startDate: 'desc' }, { seasonYear: 'desc' }],
      take: 6,
      select: { crop: true },
    });

    if (seasons.length === 0) {
      return {
        level: 0,
        label: 'Sem dados',
        description: 'Nenhuma safra registrada para este talhão.',
        uniqueCrops: [],
        seasonsAnalyzed: 0,
      };
    }

    const uniqueCrops = [...new Set(seasons.map((s) => s.crop))];
    const count = uniqueCrops.length;

    if (count === 1) {
      return {
        level: 1,
        label: 'Monocultura',
        description: `Apenas ${uniqueCrops[0]} nas últimas ${seasons.length} safras.`,
        uniqueCrops,
        seasonsAnalyzed: seasons.length,
      };
    }

    if (count === 2) {
      return {
        level: 2,
        label: 'Rotação simples',
        description: `Alternância entre ${uniqueCrops.join(' e ')} nas últimas ${seasons.length} safras.`,
        uniqueCrops,
        seasonsAnalyzed: seasons.length,
      };
    }

    return {
      level: 3,
      label: 'Rotação diversificada',
      description: `${count} culturas diferentes nas últimas ${seasons.length} safras.`,
      uniqueCrops,
      seasonsAnalyzed: seasons.length,
    };
  });
}

// ─── CSV Export ──────────────────────────────────────────────────────

export async function exportPlotHistory(
  ctx: RlsContext,
  farmId: string,
  plotId: string,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const plot = await tx.fieldPlot.findFirst({ where: { id: plotId, farmId } });
    validatePlotExists(plot);

    const seasons = await tx.plotCropSeason.findMany({
      where: { plotId, farmId },
      orderBy: [{ startDate: 'desc' }, { seasonYear: 'desc' }],
    });

    const analyses = await tx.plotSoilAnalysis.findMany({
      where: { plotId, farmId },
      orderBy: { analysisDate: 'desc' },
    });

    const BOM = '\uFEFF';
    const lines: string[] = [];

    // Crop seasons section
    lines.push('SAFRAS');
    lines.push(
      'Tipo;Ano;Cultura;Variedade;Data Início;Data Fim;Área Plantada (ha);Produtividade (kg/ha);Produção Total (kg);Observações',
    );
    for (const s of seasons) {
      lines.push(
        [
          s.seasonType,
          s.seasonYear,
          s.crop,
          s.varietyName ?? '',
          toDateStr(s.startDate) ?? '',
          toDateStr(s.endDate) ?? '',
          toNumber(s.plantedAreaHa) ?? '',
          toNumber(s.productivityKgHa) ?? '',
          toNumber(s.totalProductionKg) ?? '',
          s.notes ?? '',
        ].join(';'),
      );
    }

    lines.push('');
    lines.push('ANÁLISES DE SOLO');
    lines.push(
      'Data;Laboratório;Profundidade;pH;MO (%);P (mg/dm³);K (mg/dm³);Ca (cmolc/dm³);Mg (cmolc/dm³);Al (cmolc/dm³);CTC (cmolc/dm³);V (%);S (mg/dm³);Argila (%);Observações',
    );
    for (const a of analyses) {
      lines.push(
        [
          toDateStr(a.analysisDate) ?? '',
          a.labName ?? '',
          a.sampleDepthCm ?? '',
          toNumber(a.phH2o) ?? '',
          toNumber(a.organicMatterPct) ?? '',
          toNumber(a.phosphorusMgDm3) ?? '',
          toNumber(a.potassiumMgDm3) ?? '',
          toNumber(a.calciumCmolcDm3) ?? '',
          toNumber(a.magnesiumCmolcDm3) ?? '',
          toNumber(a.aluminumCmolcDm3) ?? '',
          toNumber(a.ctcCmolcDm3) ?? '',
          toNumber(a.baseSaturationPct) ?? '',
          toNumber(a.sulfurMgDm3) ?? '',
          toNumber(a.clayContentPct) ?? '',
          a.notes ?? '',
        ].join(';'),
      );
    }

    return BOM + lines.join('\n');
  });
}
