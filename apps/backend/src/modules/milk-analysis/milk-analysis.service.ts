import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  MilkAnalysisError,
  ANALYSIS_TYPE_LABELS,
  CMT_ALERT_VALUES,
  isValidAnalysisType,
  isValidCmtResult,
  type AnalysisTypeValue,
  type CmtResultValue,
  type AlertLevelValue,
  type CreateAnalysisInput,
  type UpdateAnalysisInput,
  type SetQualityConfigInput,
  type ListAnalysesQuery,
  type MilkAnalysisItem,
  type QualityConfigItem,
  type HighSccCowItem,
  type QualityTrendItem,
  type BonusCalcResult,
  type BonusTableEntry,
} from './milk-analysis.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Constants ──────────────────────────────────────────────────────

const ANALYSIS_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
};

const DEFAULT_SCC_LIMIT = 500000;
const DEFAULT_SCC_WARNING = 400000;
const DEFAULT_TBC_LIMIT = 300000;
const DEFAULT_TBC_WARNING = 200000;
const DEFAULT_INDIVIDUAL_SCC_LIMIT = 200000;

// ─── Helpers ────────────────────────────────────────────────────────

function toAnalysisItem(row: any): MilkAnalysisItem {
  const analysisType = row.analysisType as AnalysisTypeValue;
  return {
    id: row.id,
    farmId: row.farmId,
    analysisType,
    analysisTypeLabel: ANALYSIS_TYPE_LABELS[analysisType] ?? analysisType,
    animalId: row.animalId ?? null,
    animalEarTag: row.animal?.earTag ?? null,
    animalName: row.animal?.name ?? null,
    analysisDate: (row.analysisDate as Date).toISOString().slice(0, 10),
    laboratory: row.laboratory ?? null,
    dairyCompany: row.dairyCompany ?? null,
    cmtFrontLeft: row.cmtFrontLeft ?? null,
    cmtFrontRight: row.cmtFrontRight ?? null,
    cmtRearLeft: row.cmtRearLeft ?? null,
    cmtRearRight: row.cmtRearRight ?? null,
    cmtAlert: row.cmtAlert ?? false,
    scc: row.scc ?? null,
    tbc: row.tbc ?? null,
    fatPercent: row.fatPercent ?? null,
    proteinPercent: row.proteinPercent ?? null,
    lactosePercent: row.lactosePercent ?? null,
    caseinPercent: row.caseinPercent ?? null,
    totalSolidsPercent: row.totalSolidsPercent ?? null,
    snfPercent: row.snfPercent ?? null,
    munMgDl: row.munMgDl ?? null,
    fatProteinRatio: row.fatProteinRatio ?? null,
    antibioticResidue: row.antibioticResidue ?? null,
    temperature: row.temperature ?? null,
    acidityDornic: row.acidityDornic ?? null,
    cryoscopy: row.cryoscopy ?? null,
    productionAmLiters: row.productionAmLiters ?? null,
    productionPmLiters: row.productionPmLiters ?? null,
    projected305Liters: row.projected305Liters ?? null,
    sccAlert: (row.sccAlert as AlertLevelValue) ?? null,
    tbcAlert: (row.tbcAlert as AlertLevelValue) ?? null,
    reportFileName: row.reportFileName ?? null,
    reportPath: row.reportPath ?? null,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function calcAlertLevel(
  value: number | null | undefined,
  warning: number | null | undefined,
  limit: number | null | undefined,
): AlertLevelValue | null {
  if (value == null) return null;
  const lim = limit ?? Infinity;
  const warn = warning ?? lim;
  if (value > lim) return 'RED';
  if (value > warn) return 'YELLOW';
  return 'GREEN';
}

function calcCmtAlert(
  fl: string | null | undefined,
  fr: string | null | undefined,
  rl: string | null | undefined,
  rr: string | null | undefined,
): boolean {
  const quarters = [fl, fr, rl, rr].filter(Boolean) as CmtResultValue[];
  return quarters.some((q) => CMT_ALERT_VALUES.includes(q));
}

function calcFatProteinRatio(
  fat: number | null | undefined,
  protein: number | null | undefined,
): number | null {
  if (fat == null || protein == null || protein === 0) return null;
  return Math.round((fat / protein) * 100) / 100;
}

function validateCreateInput(input: CreateAnalysisInput): void {
  if (!input.analysisType || !isValidAnalysisType(input.analysisType)) {
    throw new MilkAnalysisError(
      'Tipo de análise inválido. Use INDIVIDUAL_CMT, INDIVIDUAL_LAB, TANK ou OFFICIAL_RECORDING',
      400,
    );
  }
  if (!input.analysisDate) {
    throw new MilkAnalysisError('Data da análise é obrigatória', 400);
  }
  const date = new Date(input.analysisDate);
  if (isNaN(date.getTime())) {
    throw new MilkAnalysisError('Data da análise inválida', 400);
  }
  if (date > new Date()) {
    throw new MilkAnalysisError('Data da análise não pode ser no futuro', 400);
  }

  // Individual types require animalId
  if (
    (input.analysisType === 'INDIVIDUAL_CMT' ||
      input.analysisType === 'INDIVIDUAL_LAB' ||
      input.analysisType === 'OFFICIAL_RECORDING') &&
    !input.animalId?.trim()
  ) {
    throw new MilkAnalysisError(
      'Animal é obrigatório para análises individuais e controle leiteiro',
      400,
    );
  }

  // Tank analysis must NOT have animalId
  if (input.analysisType === 'TANK' && input.animalId?.trim()) {
    throw new MilkAnalysisError('Análise de tanque não deve ter animal vinculado', 400);
  }

  // CMT: validate quarter values
  if (input.analysisType === 'INDIVIDUAL_CMT') {
    const quarters = [
      input.cmtFrontLeft,
      input.cmtFrontRight,
      input.cmtRearLeft,
      input.cmtRearRight,
    ];
    for (const q of quarters) {
      if (q && !isValidCmtResult(q)) {
        throw new MilkAnalysisError(
          'Resultado CMT inválido. Use NEGATIVE, TRACE, PLUS_1, PLUS_2 ou PLUS_3',
          400,
        );
      }
    }
    if (!quarters.some((q) => q != null)) {
      throw new MilkAnalysisError('Pelo menos um quarto deve ter resultado no teste CMT', 400);
    }
  }

  // Validate numeric fields are non-negative
  const numericFields: Array<[string, number | null | undefined]> = [
    ['CCS', input.scc],
    ['CBT', input.tbc],
    ['Gordura %', input.fatPercent],
    ['Proteína %', input.proteinPercent],
    ['Lactose %', input.lactosePercent],
    ['Caseína %', input.caseinPercent],
    ['Sólidos totais %', input.totalSolidsPercent],
    ['ESD %', input.snfPercent],
    ['NUL', input.munMgDl],
    ['Produção AM', input.productionAmLiters],
    ['Produção PM', input.productionPmLiters],
    ['Projeção 305d', input.projected305Liters],
  ];

  for (const [label, value] of numericFields) {
    if (value != null && value < 0) {
      throw new MilkAnalysisError(`${label} não pode ser negativo`, 400);
    }
  }
}

// ─── CREATE (CA1-CA5) ───────────────────────────────────────────────

export async function createAnalysis(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateAnalysisInput,
): Promise<MilkAnalysisItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Validate animal exists if provided
    if (input.animalId) {
      const animal = await (tx as any).animal.findFirst({
        where: { id: input.animalId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!animal) {
        throw new MilkAnalysisError('Animal não encontrado', 404);
      }
    }

    // Get quality config for alert calculation
    const config = await (tx as any).milkQualityConfig.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    const sccLimit = config?.sccLimit ?? DEFAULT_SCC_LIMIT;
    const sccWarning = config?.sccWarning ?? DEFAULT_SCC_WARNING;
    const tbcLimit = config?.tbcLimit ?? DEFAULT_TBC_LIMIT;
    const tbcWarning = config?.tbcWarning ?? DEFAULT_TBC_WARNING;

    // Calculate derived fields
    const fatProteinRatio = calcFatProteinRatio(input.fatPercent, input.proteinPercent);
    const cmtAlert = calcCmtAlert(
      input.cmtFrontLeft,
      input.cmtFrontRight,
      input.cmtRearLeft,
      input.cmtRearRight,
    );
    const sccAlert = calcAlertLevel(input.scc, sccWarning, sccLimit);
    const tbcAlert = calcAlertLevel(input.tbc, tbcWarning, tbcLimit);

    const row = await (tx as any).milkAnalysis.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        analysisType: input.analysisType,
        animalId: input.animalId ?? null,
        analysisDate: new Date(input.analysisDate),
        laboratory: input.laboratory ?? null,
        dairyCompany: input.dairyCompany ?? null,
        cmtFrontLeft: input.cmtFrontLeft ?? null,
        cmtFrontRight: input.cmtFrontRight ?? null,
        cmtRearLeft: input.cmtRearLeft ?? null,
        cmtRearRight: input.cmtRearRight ?? null,
        cmtAlert,
        scc: input.scc ?? null,
        tbc: input.tbc ?? null,
        fatPercent: input.fatPercent ?? null,
        proteinPercent: input.proteinPercent ?? null,
        lactosePercent: input.lactosePercent ?? null,
        caseinPercent: input.caseinPercent ?? null,
        totalSolidsPercent: input.totalSolidsPercent ?? null,
        snfPercent: input.snfPercent ?? null,
        munMgDl: input.munMgDl ?? null,
        fatProteinRatio,
        antibioticResidue: input.antibioticResidue ?? null,
        temperature: input.temperature ?? null,
        acidityDornic: input.acidityDornic ?? null,
        cryoscopy: input.cryoscopy ?? null,
        productionAmLiters: input.productionAmLiters ?? null,
        productionPmLiters: input.productionPmLiters ?? null,
        projected305Liters: input.projected305Liters ?? null,
        sccAlert,
        tbcAlert,
        reportFileName: input.reportFileName ?? null,
        reportPath: input.reportPath ?? null,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: ANALYSIS_INCLUDE,
    });

    return toAnalysisItem(row);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listAnalyses(
  ctx: RlsContext,
  farmId: string,
  query: ListAnalysesQuery,
): Promise<{ data: MilkAnalysisItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.analysisType) where.analysisType = query.analysisType;
    if (query.animalId) where.animalId = query.animalId;
    if (query.sccAlert) where.sccAlert = query.sccAlert;
    if (query.tbcAlert) where.tbcAlert = query.tbcAlert;
    if (query.dateFrom || query.dateTo) {
      where.analysisDate = {};
      if (query.dateFrom) where.analysisDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.analysisDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).milkAnalysis.findMany({
        where,
        include: ANALYSIS_INCLUDE,
        orderBy: [{ analysisDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      (tx as any).milkAnalysis.count({ where }),
    ]);

    return {
      data: rows.map(toAnalysisItem),
      total,
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getAnalysis(
  ctx: RlsContext,
  farmId: string,
  analysisId: string,
): Promise<MilkAnalysisItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).milkAnalysis.findFirst({
      where: { id: analysisId, farmId },
      include: ANALYSIS_INCLUDE,
    });
    if (!row) {
      throw new MilkAnalysisError('Análise de leite não encontrada', 404);
    }
    return toAnalysisItem(row);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateAnalysis(
  ctx: RlsContext,
  farmId: string,
  analysisId: string,
  input: UpdateAnalysisInput,
): Promise<MilkAnalysisItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).milkAnalysis.findFirst({
      where: { id: analysisId, farmId },
    });
    if (!existing) {
      throw new MilkAnalysisError('Análise de leite não encontrada', 404);
    }

    const data: any = {};

    // Simple nullable fields
    const simpleFields: Array<keyof UpdateAnalysisInput> = [
      'laboratory',
      'dairyCompany',
      'scc',
      'tbc',
      'fatPercent',
      'proteinPercent',
      'lactosePercent',
      'caseinPercent',
      'totalSolidsPercent',
      'snfPercent',
      'munMgDl',
      'antibioticResidue',
      'temperature',
      'acidityDornic',
      'cryoscopy',
      'productionAmLiters',
      'productionPmLiters',
      'projected305Liters',
      'reportFileName',
      'reportPath',
      'notes',
    ];

    for (const field of simpleFields) {
      if (input[field] !== undefined) {
        data[field] = input[field];
      }
    }

    // CMT fields
    const cmtFields: Array<keyof UpdateAnalysisInput> = [
      'cmtFrontLeft',
      'cmtFrontRight',
      'cmtRearLeft',
      'cmtRearRight',
    ];
    for (const field of cmtFields) {
      if (input[field] !== undefined) {
        const val = input[field] as string | null;
        if (val && !isValidCmtResult(val)) {
          throw new MilkAnalysisError(
            'Resultado CMT inválido. Use NEGATIVE, TRACE, PLUS_1, PLUS_2 ou PLUS_3',
            400,
          );
        }
        data[field] = val;
      }
    }

    // Recalculate derived fields
    const fat = input.fatPercent !== undefined ? input.fatPercent : existing.fatPercent;
    const protein =
      input.proteinPercent !== undefined ? input.proteinPercent : existing.proteinPercent;
    data.fatProteinRatio = calcFatProteinRatio(fat, protein);

    const fl = input.cmtFrontLeft !== undefined ? input.cmtFrontLeft : existing.cmtFrontLeft;
    const fr = input.cmtFrontRight !== undefined ? input.cmtFrontRight : existing.cmtFrontRight;
    const rl = input.cmtRearLeft !== undefined ? input.cmtRearLeft : existing.cmtRearLeft;
    const rr = input.cmtRearRight !== undefined ? input.cmtRearRight : existing.cmtRearRight;
    data.cmtAlert = calcCmtAlert(fl, fr, rl, rr);

    // Recalculate alerts
    const config = await (tx as any).milkQualityConfig.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    const sccVal = input.scc !== undefined ? input.scc : existing.scc;
    const tbcVal = input.tbc !== undefined ? input.tbc : existing.tbc;
    data.sccAlert = calcAlertLevel(
      sccVal,
      config?.sccWarning ?? DEFAULT_SCC_WARNING,
      config?.sccLimit ?? DEFAULT_SCC_LIMIT,
    );
    data.tbcAlert = calcAlertLevel(
      tbcVal,
      config?.tbcWarning ?? DEFAULT_TBC_WARNING,
      config?.tbcLimit ?? DEFAULT_TBC_LIMIT,
    );

    const row = await (tx as any).milkAnalysis.update({
      where: { id: analysisId },
      data,
      include: ANALYSIS_INCLUDE,
    });

    return toAnalysisItem(row);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteAnalysis(
  ctx: RlsContext,
  farmId: string,
  analysisId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).milkAnalysis.findFirst({
      where: { id: analysisId, farmId },
    });
    if (!existing) {
      throw new MilkAnalysisError('Análise de leite não encontrada', 404);
    }

    await (tx as any).milkAnalysis.delete({ where: { id: analysisId } });
  });
}

// ─── QUALITY CONFIG (CA6, CA9) ──────────────────────────────────────

export async function getQualityConfig(ctx: RlsContext): Promise<QualityConfigItem> {
  return withRlsContext(ctx, async (tx) => {
    const config = await (tx as any).milkQualityConfig.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    if (!config) {
      return {
        id: '',
        organizationId: ctx.organizationId,
        sccLimit: DEFAULT_SCC_LIMIT,
        sccWarning: DEFAULT_SCC_WARNING,
        tbcLimit: DEFAULT_TBC_LIMIT,
        tbcWarning: DEFAULT_TBC_WARNING,
        individualSccLimit: DEFAULT_INDIVIDUAL_SCC_LIMIT,
        bonusTable: null,
      };
    }

    return {
      id: config.id,
      organizationId: config.organizationId,
      sccLimit: config.sccLimit,
      sccWarning: config.sccWarning,
      tbcLimit: config.tbcLimit,
      tbcWarning: config.tbcWarning,
      individualSccLimit: config.individualSccLimit,
      bonusTable: config.bonusTable as BonusTableEntry[] | null,
    };
  });
}

export async function setQualityConfig(
  ctx: RlsContext,
  input: SetQualityConfigInput,
): Promise<QualityConfigItem> {
  return withRlsContext(ctx, async (tx) => {
    const data: any = {};

    if (input.sccLimit !== undefined) data.sccLimit = input.sccLimit;
    if (input.sccWarning !== undefined) data.sccWarning = input.sccWarning;
    if (input.tbcLimit !== undefined) data.tbcLimit = input.tbcLimit;
    if (input.tbcWarning !== undefined) data.tbcWarning = input.tbcWarning;
    if (input.individualSccLimit !== undefined) data.individualSccLimit = input.individualSccLimit;
    if (input.bonusTable !== undefined) data.bonusTable = input.bonusTable;

    const config = await (tx as any).milkQualityConfig.upsert({
      where: { organizationId: ctx.organizationId },
      create: {
        organizationId: ctx.organizationId,
        ...data,
      },
      update: data,
    });

    return {
      id: config.id,
      organizationId: config.organizationId,
      sccLimit: config.sccLimit,
      sccWarning: config.sccWarning,
      tbcLimit: config.tbcLimit,
      tbcWarning: config.tbcWarning,
      individualSccLimit: config.individualSccLimit,
      bonusTable: config.bonusTable as BonusTableEntry[] | null,
    };
  });
}

// ─── HIGH SCC COWS (CA7) ───────────────────────────────────────────

export async function getHighSccCows(ctx: RlsContext, farmId: string): Promise<HighSccCowItem[]> {
  return withRlsContext(ctx, async (tx) => {
    // Get config for limit
    const config = await (tx as any).milkQualityConfig.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    const sccLimit = config?.individualSccLimit ?? DEFAULT_INDIVIDUAL_SCC_LIMIT;

    // Find latest lab analyses per cow with SCC above limit
    const analyses = await (tx as any).milkAnalysis.findMany({
      where: {
        farmId,
        analysisType: { in: ['INDIVIDUAL_LAB', 'OFFICIAL_RECORDING'] },
        scc: { gt: sccLimit },
        animalId: { not: null },
      },
      include: {
        animal: { select: { earTag: true, name: true } },
      },
      orderBy: { analysisDate: 'desc' },
    });

    // Group by animal
    const animalMap = new Map<
      string,
      {
        earTag: string;
        name: string | null;
        records: Array<{ date: string; scc: number }>;
      }
    >();

    for (const a of analyses) {
      if (!a.animalId || a.scc == null) continue;
      const existing = animalMap.get(a.animalId);
      const record = {
        date: (a.analysisDate as Date).toISOString().slice(0, 10),
        scc: a.scc,
      };

      if (existing) {
        existing.records.push(record);
      } else {
        animalMap.set(a.animalId, {
          earTag: a.animal?.earTag ?? '',
          name: a.animal?.name ?? null,
          records: [record],
        });
      }
    }

    // Also check CMT alerts for mastitis
    const cmtAlerts = await (tx as any).milkAnalysis.findMany({
      where: {
        farmId,
        analysisType: 'INDIVIDUAL_CMT',
        cmtAlert: true,
        animalId: { not: null },
      },
      select: { animalId: true },
      distinct: ['animalId'],
    });
    const cmtAlertAnimalIds = new Set(cmtAlerts.map((c: any) => c.animalId));

    return Array.from(animalMap.entries()).map(([animalId, data]) => ({
      animalId,
      earTag: data.earTag,
      name: data.name,
      latestScc: data.records[0].scc,
      latestDate: data.records[0].date,
      sccHistory: data.records.slice(0, 10), // last 10 records
      mastitisAlert: cmtAlertAnimalIds.has(animalId) || data.records[0].scc > sccLimit * 2,
    }));
  });
}

// ─── QUALITY TREND (CA8) ───────────────────────────────────────────

export async function getQualityTrend(
  ctx: RlsContext,
  farmId: string,
  months?: number,
): Promise<QualityTrendItem[]> {
  const numMonths = months ?? 12;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - numMonths);
  startDate.setDate(1);

  return withRlsContext(ctx, async (tx) => {
    const analyses = await (tx as any).milkAnalysis.findMany({
      where: {
        farmId,
        analysisType: { in: ['INDIVIDUAL_LAB', 'TANK', 'OFFICIAL_RECORDING'] },
        analysisDate: { gte: startDate },
      },
      select: {
        analysisDate: true,
        scc: true,
        tbc: true,
        fatPercent: true,
        proteinPercent: true,
      },
      orderBy: { analysisDate: 'asc' },
    });

    // Group by month
    const monthMap = new Map<
      string,
      {
        sccSum: number;
        sccCount: number;
        tbcSum: number;
        tbcCount: number;
        fatSum: number;
        fatCount: number;
        proteinSum: number;
        proteinCount: number;
        sampleCount: number;
      }
    >();

    for (const a of analyses) {
      const monthKey = (a.analysisDate as Date).toISOString().slice(0, 7);
      const entry = monthMap.get(monthKey) ?? {
        sccSum: 0,
        sccCount: 0,
        tbcSum: 0,
        tbcCount: 0,
        fatSum: 0,
        fatCount: 0,
        proteinSum: 0,
        proteinCount: 0,
        sampleCount: 0,
      };

      entry.sampleCount++;
      if (a.scc != null) {
        entry.sccSum += a.scc;
        entry.sccCount++;
      }
      if (a.tbc != null) {
        entry.tbcSum += a.tbc;
        entry.tbcCount++;
      }
      if (a.fatPercent != null) {
        entry.fatSum += a.fatPercent;
        entry.fatCount++;
      }
      if (a.proteinPercent != null) {
        entry.proteinSum += a.proteinPercent;
        entry.proteinCount++;
      }
      monthMap.set(monthKey, entry);
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        avgScc: data.sccCount > 0 ? Math.round(data.sccSum / data.sccCount) : null,
        avgTbc: data.tbcCount > 0 ? Math.round(data.tbcSum / data.tbcCount) : null,
        avgFat: data.fatCount > 0 ? Math.round((data.fatSum / data.fatCount) * 100) / 100 : null,
        avgProtein:
          data.proteinCount > 0
            ? Math.round((data.proteinSum / data.proteinCount) * 100) / 100
            : null,
        sampleCount: data.sampleCount,
      }));
  });
}

// ─── BONUS CALCULATION (CA9) ────────────────────────────────────────

export async function calculateBonus(
  ctx: RlsContext,
  farmId: string,
  month?: string,
): Promise<BonusCalcResult> {
  const targetMonth = month ?? new Date().toISOString().slice(0, 7);
  const [year, mon] = targetMonth.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 0); // last day of month

  return withRlsContext(ctx, async (tx) => {
    // Get latest tank analysis for the month
    const latestTank = await (tx as any).milkAnalysis.findFirst({
      where: {
        farmId,
        analysisType: 'TANK',
        analysisDate: { gte: startDate, lte: endDate },
      },
      orderBy: { analysisDate: 'desc' },
    });

    // Get config
    const config = await (tx as any).milkQualityConfig.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    const bonusTable = (config?.bonusTable as BonusTableEntry[] | null) ?? [];

    const scc = latestTank?.scc ?? null;
    const tbc = latestTank?.tbc ?? null;
    const fatPercent = latestTank?.fatPercent ?? null;
    const proteinPercent = latestTank?.proteinPercent ?? null;

    const parameterValues: Record<string, number | null> = {
      SCC: scc,
      TBC: tbc,
      FAT: fatPercent,
      PROTEIN: proteinPercent,
    };

    const bonusDetails: BonusCalcResult['bonusDetails'] = [];

    for (const entry of bonusTable) {
      const value = parameterValues[entry.parameter] ?? null;
      let bonusPerLiter = 0;
      let rangeLabel = 'Sem dados';

      if (value != null) {
        for (const range of entry.ranges) {
          if (value >= range.min && value <= range.max) {
            bonusPerLiter = range.bonusPerLiter;
            rangeLabel = `${range.min} - ${range.max}`;
            break;
          }
        }
        if (bonusPerLiter === 0 && rangeLabel === 'Sem dados') {
          rangeLabel = 'Fora das faixas';
        }
      }

      bonusDetails.push({
        parameter: entry.parameter,
        value,
        bonusPerLiter,
        rangeLabel,
      });
    }

    const totalBonusPerLiter = bonusDetails.reduce((sum, d) => sum + d.bonusPerLiter, 0);

    return {
      month: targetMonth,
      tankAnalysisId: latestTank?.id ?? null,
      scc,
      tbc,
      fatPercent,
      proteinPercent,
      bonusDetails,
      totalBonusPerLiter: Math.round(totalBonusPerLiter * 10000) / 10000,
    };
  });
}

// ─── IMPORT CSV (CA10) ──────────────────────────────────────────────

export async function importAnalysesCsv(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  csvContent: string,
): Promise<{ imported: number; errors: string[] }> {
  const lines = csvContent.split('\n').filter((l) => l.trim());
  if (lines.length < 2) {
    throw new MilkAnalysisError('Arquivo CSV vazio ou sem dados', 400);
  }

  const headerLine = lines[0].toLowerCase();
  const separator = headerLine.includes(';') ? ';' : ',';
  const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase());

  // Map common header names
  const headerMap: Record<string, string> = {
    tipo: 'analysisType',
    type: 'analysisType',
    brinco: 'earTag',
    ear_tag: 'earTag',
    eartag: 'earTag',
    data: 'analysisDate',
    date: 'analysisDate',
    analysis_date: 'analysisDate',
    laboratorio: 'laboratory',
    laboratory: 'laboratory',
    laticinio: 'dairyCompany',
    dairy_company: 'dairyCompany',
    dairy: 'dairyCompany',
    ccs: 'scc',
    scc: 'scc',
    cbt: 'tbc',
    tbc: 'tbc',
    gordura: 'fatPercent',
    fat: 'fatPercent',
    fat_percent: 'fatPercent',
    proteina: 'proteinPercent',
    protein: 'proteinPercent',
    protein_percent: 'proteinPercent',
    lactose: 'lactosePercent',
    lactose_percent: 'lactosePercent',
    caseina: 'caseinPercent',
    casein: 'caseinPercent',
    casein_percent: 'caseinPercent',
    solidos_totais: 'totalSolidsPercent',
    total_solids: 'totalSolidsPercent',
    esd: 'snfPercent',
    snf: 'snfPercent',
    snf_percent: 'snfPercent',
    nul: 'munMgDl',
    mun: 'munMgDl',
    ureia: 'munMgDl',
    producao_am: 'productionAmLiters',
    production_am: 'productionAmLiters',
    producao_pm: 'productionPmLiters',
    production_pm: 'productionPmLiters',
    projecao_305: 'projected305Liters',
    projected_305: 'projected305Liters',
    antibiotico: 'antibioticResidue',
    antibiotic: 'antibioticResidue',
    temperatura: 'temperature',
    temperature: 'temperature',
    acidez: 'acidityDornic',
    acidity: 'acidityDornic',
    crioscopia: 'cryoscopy',
    cryoscopy: 'cryoscopy',
  };

  const columnMap: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const mapped = headerMap[headers[i]];
    if (mapped) columnMap[i] = mapped;
  }

  return withRlsContext(ctx, async (tx) => {
    // Build earTag -> animalId map
    const animals = await (tx as any).animal.findMany({
      where: { farmId, deletedAt: null },
      select: { id: true, earTag: true },
    });
    const earTagMap = new Map<string, string>();
    for (const a of animals) {
      earTagMap.set(a.earTag.toLowerCase(), a.id);
    }

    // Get quality config
    const config = await (tx as any).milkQualityConfig.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    const sccLimit = config?.sccLimit ?? DEFAULT_SCC_LIMIT;
    const sccWarning = config?.sccWarning ?? DEFAULT_SCC_WARNING;
    const tbcLimit = config?.tbcLimit ?? DEFAULT_TBC_LIMIT;
    const tbcWarning = config?.tbcWarning ?? DEFAULT_TBC_WARNING;

    const errors: string[] = [];
    const toCreate: any[] = [];

    for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
      const values = lines[lineIdx].split(separator).map((v) => v.trim());
      const lineNum = lineIdx + 1;

      try {
        const row: Record<string, string> = {};
        for (let i = 0; i < values.length; i++) {
          if (columnMap[i]) {
            row[columnMap[i]] = values[i];
          }
        }

        // Determine analysis type
        let analysisType: AnalysisTypeValue = 'INDIVIDUAL_LAB';
        if (row.analysisType) {
          const typeMap: Record<string, AnalysisTypeValue> = {
            cmt: 'INDIVIDUAL_CMT',
            individual_cmt: 'INDIVIDUAL_CMT',
            lab: 'INDIVIDUAL_LAB',
            individual_lab: 'INDIVIDUAL_LAB',
            laboratorio: 'INDIVIDUAL_LAB',
            tanque: 'TANK',
            tank: 'TANK',
            controle: 'OFFICIAL_RECORDING',
            official: 'OFFICIAL_RECORDING',
            official_recording: 'OFFICIAL_RECORDING',
          };
          const mapped = typeMap[row.analysisType.toLowerCase()];
          if (mapped) analysisType = mapped;
        }

        // Date
        if (!row.analysisDate) {
          errors.push(`Linha ${lineNum}: data é obrigatória`);
          continue;
        }

        // Parse date (support DD/MM/YYYY and YYYY-MM-DD)
        let parsedDate: Date;
        if (row.analysisDate.includes('/')) {
          const parts = row.analysisDate.split('/');
          parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          parsedDate = new Date(row.analysisDate);
        }
        if (isNaN(parsedDate.getTime())) {
          errors.push(`Linha ${lineNum}: data inválida "${row.analysisDate}"`);
          continue;
        }

        // Animal
        let animalId: string | null = null;
        if (row.earTag && analysisType !== 'TANK') {
          const found = earTagMap.get(row.earTag.toLowerCase());
          if (!found) {
            errors.push(`Linha ${lineNum}: animal com brinco "${row.earTag}" não encontrado`);
            continue;
          }
          animalId = found;
        }

        if (analysisType !== 'TANK' && !animalId) {
          errors.push(`Linha ${lineNum}: brinco do animal é obrigatório para análise individual`);
          continue;
        }

        const parseNum = (v: string | undefined): number | null => {
          if (!v || v === '') return null;
          const n = parseFloat(v.replace(',', '.'));
          return isNaN(n) ? null : n;
        };

        const parseBool = (v: string | undefined): boolean | null => {
          if (!v || v === '') return null;
          const lower = v.toLowerCase();
          return (
            lower === 'sim' ||
            lower === 'yes' ||
            lower === 'true' ||
            lower === 'positivo' ||
            lower === '1'
          );
        };

        const scc = parseNum(row.scc);
        const tbc = parseNum(row.tbc);
        const fatPercent = parseNum(row.fatPercent);
        const proteinPercent = parseNum(row.proteinPercent);

        toCreate.push({
          organizationId: ctx.organizationId,
          farmId,
          analysisType,
          animalId,
          analysisDate: parsedDate,
          laboratory: row.laboratory || null,
          dairyCompany: row.dairyCompany || null,
          scc,
          tbc,
          fatPercent,
          proteinPercent,
          lactosePercent: parseNum(row.lactosePercent),
          caseinPercent: parseNum(row.caseinPercent),
          totalSolidsPercent: parseNum(row.totalSolidsPercent),
          snfPercent: parseNum(row.snfPercent),
          munMgDl: parseNum(row.munMgDl),
          fatProteinRatio: calcFatProteinRatio(fatPercent, proteinPercent),
          antibioticResidue: parseBool(row.antibioticResidue),
          temperature: parseNum(row.temperature),
          acidityDornic: parseNum(row.acidityDornic),
          cryoscopy: parseNum(row.cryoscopy),
          productionAmLiters: parseNum(row.productionAmLiters),
          productionPmLiters: parseNum(row.productionPmLiters),
          projected305Liters: parseNum(row.projected305Liters),
          sccAlert: calcAlertLevel(scc, sccWarning, sccLimit),
          tbcAlert: calcAlertLevel(tbc, tbcWarning, tbcLimit),
          cmtAlert: false,
          recordedBy: userId,
        });
      } catch (e: any) {
        errors.push(`Linha ${lineNum}: ${e.message}`);
      }
    }

    if (toCreate.length > 0) {
      await (tx as any).milkAnalysis.createMany({ data: toCreate });
    }

    return { imported: toCreate.length, errors };
  });
}

// ─── EXPORT CSV ─────────────────────────────────────────────────────

export async function exportAnalysesCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListAnalysesQuery,
): Promise<string> {
  const where: any = { farmId };

  if (query.analysisType) where.analysisType = query.analysisType;
  if (query.animalId) where.animalId = query.animalId;
  if (query.dateFrom || query.dateTo) {
    where.analysisDate = {};
    if (query.dateFrom) where.analysisDate.gte = new Date(query.dateFrom);
    if (query.dateTo) where.analysisDate.lte = new Date(query.dateTo);
  }

  const rows = await withRlsContext(ctx, async (tx) => {
    return (tx as any).milkAnalysis.findMany({
      where,
      include: {
        animal: { select: { earTag: true, name: true } },
        recorder: { select: { name: true } },
      },
      orderBy: [{ analysisDate: 'desc' }, { createdAt: 'desc' }],
    });
  });

  const BOM = '\uFEFF';
  const csvLines: string[] = [];

  csvLines.push('RELATÓRIO DE ANÁLISE DE LEITE');
  csvLines.push(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`);
  csvLines.push('');
  csvLines.push(
    'Data;Tipo;Brinco;Nome;CCS;CBT;Gordura %;Proteína %;Lactose %;Caseína %;ST %;ESD %;NUL;Rel. G/P;Antibiótico;Temp.;Acidez;Crioscopia;Prod. AM;Prod. PM;Proj. 305d;Alerta CCS;Alerta CBT;Notas;Registrado por',
  );

  for (const r of rows) {
    const type = r.analysisType as AnalysisTypeValue;
    csvLines.push(
      [
        (r.analysisDate as Date).toLocaleDateString('pt-BR'),
        ANALYSIS_TYPE_LABELS[type] ?? type,
        r.animal?.earTag ?? '',
        r.animal?.name ?? '',
        r.scc != null ? r.scc.toString().replace('.', ',') : '',
        r.tbc != null ? r.tbc.toString().replace('.', ',') : '',
        r.fatPercent != null ? r.fatPercent.toString().replace('.', ',') : '',
        r.proteinPercent != null ? r.proteinPercent.toString().replace('.', ',') : '',
        r.lactosePercent != null ? r.lactosePercent.toString().replace('.', ',') : '',
        r.caseinPercent != null ? r.caseinPercent.toString().replace('.', ',') : '',
        r.totalSolidsPercent != null ? r.totalSolidsPercent.toString().replace('.', ',') : '',
        r.snfPercent != null ? r.snfPercent.toString().replace('.', ',') : '',
        r.munMgDl != null ? r.munMgDl.toString().replace('.', ',') : '',
        r.fatProteinRatio != null ? r.fatProteinRatio.toString().replace('.', ',') : '',
        r.antibioticResidue != null ? (r.antibioticResidue ? 'Positivo' : 'Negativo') : '',
        r.temperature != null ? r.temperature.toString().replace('.', ',') : '',
        r.acidityDornic != null ? r.acidityDornic.toString().replace('.', ',') : '',
        r.cryoscopy != null ? r.cryoscopy.toString().replace('.', ',') : '',
        r.productionAmLiters != null ? r.productionAmLiters.toString().replace('.', ',') : '',
        r.productionPmLiters != null ? r.productionPmLiters.toString().replace('.', ',') : '',
        r.projected305Liters != null ? r.projected305Liters.toString().replace('.', ',') : '',
        r.sccAlert ?? '',
        r.tbcAlert ?? '',
        r.notes ?? '',
        r.recorder?.name ?? '',
      ].join(';'),
    );
  }

  return BOM + csvLines.join('\n');
}
