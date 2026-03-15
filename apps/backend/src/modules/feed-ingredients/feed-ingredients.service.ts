import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  FeedIngredientError,
  FEED_INGREDIENT_TYPES,
  FEED_TYPE_LABELS,
  NUTRITIONAL_PARAMS,
  NUTRITIONAL_PARAM_LABELS,
  REF_PARAM_MAP,
  DEVIATION_THRESHOLDS,
  type FeedIngredientType,
  type DeviationLevel,
  type CreateFeedIngredientInput,
  type UpdateFeedIngredientInput,
  type FeedIngredientItem,
  type ListFeedIngredientsQuery,
  type ListFeedIngredientsResult,
  type CreateAnalysisInput,
  type UpdateAnalysisInput,
  type AnalysisItem,
  type ListAnalysesQuery,
  type ListAnalysesResult,
  type ComparisonResult,
  type ParamComparison,
  type QualityTrendResult,
  type QualityTrendPoint,
  type ImportAnalysesResult,
} from './feed-ingredients.types';
import { parseAnalysisFile } from './analysis-file-parser';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function validatePercentField(value: number | null | undefined, fieldName: string): void {
  if (value != null && (value < 0 || value > 100)) {
    throw new FeedIngredientError(`${fieldName} deve estar entre 0 e 100%`, 400);
  }
}

function validateNelField(value: number | null | undefined): void {
  if (value != null && value < 0) {
    throw new FeedIngredientError('ELl (Mcal/kg) não pode ser negativo', 400);
  }
}

function validateNutritionalParams(input: Record<string, unknown>): void {
  const percentFields = [
    'dmPercent',
    'cpPercent',
    'ndfPercent',
    'adfPercent',
    'eePercent',
    'mmPercent',
    'tdnPercent',
    'nfcPercent',
    'caPercent',
    'pPercent',
    'mgPercent',
    'kPercent',
    'naPercent',
  ];
  for (const field of percentFields) {
    const prefixed = `ref${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    // Check both direct and ref-prefixed
    if (field in input) validatePercentField(input[field] as number | null, field);
    if (prefixed in input) validatePercentField(input[prefixed] as number | null, prefixed);
  }
  if ('nelMcalKg' in input) validateNelField(input.nelMcalKg as number | null);
  if ('refNelMcalKg' in input) validateNelField(input.refNelMcalKg as number | null);
}

function validateCreateIngredient(input: CreateFeedIngredientInput): void {
  if (!input.name?.trim()) {
    throw new FeedIngredientError('Nome é obrigatório', 400);
  }
  if (!input.type || !(FEED_INGREDIENT_TYPES as readonly string[]).includes(input.type)) {
    throw new FeedIngredientError(`Tipo inválido. Use: ${FEED_INGREDIENT_TYPES.join(', ')}`, 400);
  }
  if (input.costPerKg != null && input.costPerKg < 0) {
    throw new FeedIngredientError('Custo por kg não pode ser negativo', 400);
  }
  validateNutritionalParams(input as unknown as Record<string, unknown>);
}

function validateUpdateIngredient(input: UpdateFeedIngredientInput): void {
  if (input.name !== undefined && !input.name?.trim()) {
    throw new FeedIngredientError('Nome não pode ser vazio', 400);
  }
  if (input.type && !(FEED_INGREDIENT_TYPES as readonly string[]).includes(input.type)) {
    throw new FeedIngredientError(`Tipo inválido. Use: ${FEED_INGREDIENT_TYPES.join(', ')}`, 400);
  }
  if (input.costPerKg != null && input.costPerKg < 0) {
    throw new FeedIngredientError('Custo por kg não pode ser negativo', 400);
  }
  validateNutritionalParams(input as unknown as Record<string, unknown>);
}

function validateCreateAnalysis(input: CreateAnalysisInput): void {
  if (!input.feedIngredientId?.trim()) {
    throw new FeedIngredientError('Alimento/ingrediente é obrigatório', 400);
  }
  if (!input.collectionDate) {
    throw new FeedIngredientError('Data de coleta é obrigatória', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new FeedIngredientError('Responsável é obrigatório', 400);
  }
  const collDate = new Date(input.collectionDate);
  if (isNaN(collDate.getTime())) {
    throw new FeedIngredientError('Data de coleta inválida', 400);
  }
  if (input.resultDate) {
    const resDate = new Date(input.resultDate);
    if (isNaN(resDate.getTime())) {
      throw new FeedIngredientError('Data de resultado inválida', 400);
    }
    if (resDate < collDate) {
      throw new FeedIngredientError(
        'Data de resultado não pode ser anterior à data de coleta',
        400,
      );
    }
  }
  validateNutritionalParams(input as unknown as Record<string, unknown>);
}

function toIngredientItem(
  row: any,
  analysisCount: number,
  latestDate: string | null,
): FeedIngredientItem {
  const feedType = row.type as FeedIngredientType;
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    type: feedType,
    typeLabel: FEED_TYPE_LABELS[feedType] ?? feedType,
    subtype: row.subtype ?? null,
    measurementUnit: row.measurementUnit,
    costPerKg: row.costPerKg != null ? Number(row.costPerKg) : null,
    refDmPercent: row.refDmPercent != null ? Number(row.refDmPercent) : null,
    refCpPercent: row.refCpPercent != null ? Number(row.refCpPercent) : null,
    refNdfPercent: row.refNdfPercent != null ? Number(row.refNdfPercent) : null,
    refAdfPercent: row.refAdfPercent != null ? Number(row.refAdfPercent) : null,
    refEePercent: row.refEePercent != null ? Number(row.refEePercent) : null,
    refMmPercent: row.refMmPercent != null ? Number(row.refMmPercent) : null,
    refTdnPercent: row.refTdnPercent != null ? Number(row.refTdnPercent) : null,
    refNelMcalKg: row.refNelMcalKg != null ? Number(row.refNelMcalKg) : null,
    refNfcPercent: row.refNfcPercent != null ? Number(row.refNfcPercent) : null,
    refCaPercent: row.refCaPercent != null ? Number(row.refCaPercent) : null,
    refPPercent: row.refPPercent != null ? Number(row.refPPercent) : null,
    refMgPercent: row.refMgPercent != null ? Number(row.refMgPercent) : null,
    refKPercent: row.refKPercent != null ? Number(row.refKPercent) : null,
    refNaPercent: row.refNaPercent != null ? Number(row.refNaPercent) : null,
    analysisCount,
    latestAnalysisDate: latestDate,
    notes: row.notes ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toAnalysisItem(row: any): AnalysisItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    feedIngredientId: row.feedIngredientId,
    feedIngredientName: row.feedIngredient?.name ?? '',
    batchNumber: row.batchNumber ?? null,
    collectionDate: (row.collectionDate as Date).toISOString().slice(0, 10),
    resultDate: row.resultDate ? (row.resultDate as Date).toISOString().slice(0, 10) : null,
    laboratory: row.laboratory ?? null,
    protocolNumber: row.protocolNumber ?? null,
    responsibleName: row.responsibleName,
    dmPercent: row.dmPercent != null ? Number(row.dmPercent) : null,
    cpPercent: row.cpPercent != null ? Number(row.cpPercent) : null,
    ndfPercent: row.ndfPercent != null ? Number(row.ndfPercent) : null,
    adfPercent: row.adfPercent != null ? Number(row.adfPercent) : null,
    eePercent: row.eePercent != null ? Number(row.eePercent) : null,
    mmPercent: row.mmPercent != null ? Number(row.mmPercent) : null,
    tdnPercent: row.tdnPercent != null ? Number(row.tdnPercent) : null,
    nelMcalKg: row.nelMcalKg != null ? Number(row.nelMcalKg) : null,
    nfcPercent: row.nfcPercent != null ? Number(row.nfcPercent) : null,
    caPercent: row.caPercent != null ? Number(row.caPercent) : null,
    pPercent: row.pPercent != null ? Number(row.pPercent) : null,
    mgPercent: row.mgPercent != null ? Number(row.mgPercent) : null,
    kPercent: row.kPercent != null ? Number(row.kPercent) : null,
    naPercent: row.naPercent != null ? Number(row.naPercent) : null,
    reportFileName: row.reportFileName ?? null,
    reportPath: row.reportPath ?? null,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

const ANALYSIS_INCLUDE = {
  feedIngredient: { select: { id: true, name: true } },
  recorder: { select: { name: true } },
} as const;

// ═══════════════════════════════════════════════════════════════════
// FEED INGREDIENTS CRUD (CA1 + CA2)
// ═══════════════════════════════════════════════════════════════════

export async function createFeedIngredient(
  ctx: RlsContext,
  input: CreateFeedIngredientInput,
): Promise<FeedIngredientItem> {
  validateCreateIngredient(input);

  return withRlsContext(ctx, async (tx) => {
    // Check duplicate
    const existing = await tx.feedIngredient.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new FeedIngredientError('Já existe um alimento/ingrediente com este nome', 409);
    }

    const row = await tx.feedIngredient.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        type: input.type as any,
        subtype: input.subtype?.trim() || null,
        measurementUnit: input.measurementUnit?.trim() || 'kg',
        costPerKg: input.costPerKg ?? null,
        refDmPercent: input.refDmPercent ?? null,
        refCpPercent: input.refCpPercent ?? null,
        refNdfPercent: input.refNdfPercent ?? null,
        refAdfPercent: input.refAdfPercent ?? null,
        refEePercent: input.refEePercent ?? null,
        refMmPercent: input.refMmPercent ?? null,
        refTdnPercent: input.refTdnPercent ?? null,
        refNelMcalKg: input.refNelMcalKg ?? null,
        refNfcPercent: input.refNfcPercent ?? null,
        refCaPercent: input.refCaPercent ?? null,
        refPPercent: input.refPPercent ?? null,
        refMgPercent: input.refMgPercent ?? null,
        refKPercent: input.refKPercent ?? null,
        refNaPercent: input.refNaPercent ?? null,
        notes: input.notes?.trim() || null,
      },
    });

    return toIngredientItem(row, 0, null);
  });
}

export async function listFeedIngredients(
  ctx: RlsContext,
  query: ListFeedIngredientsQuery,
): Promise<ListFeedIngredientsResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    };

    if (query.type) where.type = query.type;
    if (query.subtype) where.subtype = query.subtype;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { subtype: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      tx.feedIngredient.findMany({
        where: where as any,
        include: {
          _count: { select: { analyses: true } },
          analyses: {
            select: { collectionDate: true },
            orderBy: { collectionDate: 'desc' },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      tx.feedIngredient.count({ where: where as any }),
    ]);

    return {
      data: rows.map((r: any) => {
        const analysisCount = r._count?.analyses ?? 0;
        const latestDate = r.analyses?.[0]?.collectionDate
          ? (r.analyses[0].collectionDate as Date).toISOString().slice(0, 10)
          : null;
        return toIngredientItem(r, analysisCount, latestDate);
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function getFeedIngredient(ctx: RlsContext, id: string): Promise<FeedIngredientItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.feedIngredient.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        _count: { select: { analyses: true } },
        analyses: {
          select: { collectionDate: true },
          orderBy: { collectionDate: 'desc' },
          take: 1,
        },
      },
    });
    if (!row) {
      throw new FeedIngredientError('Alimento/ingrediente não encontrado', 404);
    }
    const r = row as any;
    const analysisCount = r._count?.analyses ?? 0;
    const latestDate = r.analyses?.[0]?.collectionDate
      ? (r.analyses[0].collectionDate as Date).toISOString().slice(0, 10)
      : null;
    return toIngredientItem(r, analysisCount, latestDate);
  });
}

export async function updateFeedIngredient(
  ctx: RlsContext,
  id: string,
  input: UpdateFeedIngredientInput,
): Promise<FeedIngredientItem> {
  validateUpdateIngredient(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.feedIngredient.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        _count: { select: { analyses: true } },
        analyses: {
          select: { collectionDate: true },
          orderBy: { collectionDate: 'desc' },
          take: 1,
        },
      },
    });
    if (!existing) {
      throw new FeedIngredientError('Alimento/ingrediente não encontrado', 404);
    }

    // Check duplicate name
    if (input.name && input.name.trim() !== existing.name) {
      const dup = await tx.feedIngredient.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: input.name.trim(),
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });
      if (dup) {
        throw new FeedIngredientError('Já existe um alimento/ingrediente com este nome', 409);
      }
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.type !== undefined) data.type = input.type;
    if (input.subtype !== undefined) data.subtype = input.subtype?.trim() || null;
    if (input.measurementUnit !== undefined)
      data.measurementUnit = input.measurementUnit?.trim() || 'kg';
    if (input.costPerKg !== undefined) data.costPerKg = input.costPerKg ?? null;
    if (input.refDmPercent !== undefined) data.refDmPercent = input.refDmPercent ?? null;
    if (input.refCpPercent !== undefined) data.refCpPercent = input.refCpPercent ?? null;
    if (input.refNdfPercent !== undefined) data.refNdfPercent = input.refNdfPercent ?? null;
    if (input.refAdfPercent !== undefined) data.refAdfPercent = input.refAdfPercent ?? null;
    if (input.refEePercent !== undefined) data.refEePercent = input.refEePercent ?? null;
    if (input.refMmPercent !== undefined) data.refMmPercent = input.refMmPercent ?? null;
    if (input.refTdnPercent !== undefined) data.refTdnPercent = input.refTdnPercent ?? null;
    if (input.refNelMcalKg !== undefined) data.refNelMcalKg = input.refNelMcalKg ?? null;
    if (input.refNfcPercent !== undefined) data.refNfcPercent = input.refNfcPercent ?? null;
    if (input.refCaPercent !== undefined) data.refCaPercent = input.refCaPercent ?? null;
    if (input.refPPercent !== undefined) data.refPPercent = input.refPPercent ?? null;
    if (input.refMgPercent !== undefined) data.refMgPercent = input.refMgPercent ?? null;
    if (input.refKPercent !== undefined) data.refKPercent = input.refKPercent ?? null;
    if (input.refNaPercent !== undefined) data.refNaPercent = input.refNaPercent ?? null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    const row = await tx.feedIngredient.update({
      where: { id },
      data: data as any,
      include: {
        _count: { select: { analyses: true } },
        analyses: {
          select: { collectionDate: true },
          orderBy: { collectionDate: 'desc' },
          take: 1,
        },
      },
    });

    const r = row as any;
    const analysisCount = r._count?.analyses ?? 0;
    const latestDate = r.analyses?.[0]?.collectionDate
      ? (r.analyses[0].collectionDate as Date).toISOString().slice(0, 10)
      : null;
    return toIngredientItem(r, analysisCount, latestDate);
  });
}

export async function deleteFeedIngredient(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.feedIngredient.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new FeedIngredientError('Alimento/ingrediente não encontrado', 404);
    }

    await tx.feedIngredient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// BROMATOLOGICAL ANALYSES CRUD (CA3 + CA4)
// ═══════════════════════════════════════════════════════════════════

export async function createAnalysis(
  ctx: RlsContext,
  recordedBy: string,
  input: CreateAnalysisInput,
): Promise<AnalysisItem> {
  validateCreateAnalysis(input);

  return withRlsContext(ctx, async (tx) => {
    // Verify feed ingredient exists
    const feed = await tx.feedIngredient.findFirst({
      where: { id: input.feedIngredientId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!feed) {
      throw new FeedIngredientError('Alimento/ingrediente não encontrado', 404);
    }

    const row = await tx.bromatologicalAnalysis.create({
      data: {
        organizationId: ctx.organizationId,
        feedIngredientId: input.feedIngredientId,
        batchNumber: input.batchNumber?.trim() || null,
        collectionDate: new Date(input.collectionDate),
        resultDate: input.resultDate ? new Date(input.resultDate) : null,
        laboratory: input.laboratory?.trim() || null,
        protocolNumber: input.protocolNumber?.trim() || null,
        responsibleName: input.responsibleName.trim(),
        dmPercent: input.dmPercent ?? null,
        cpPercent: input.cpPercent ?? null,
        ndfPercent: input.ndfPercent ?? null,
        adfPercent: input.adfPercent ?? null,
        eePercent: input.eePercent ?? null,
        mmPercent: input.mmPercent ?? null,
        tdnPercent: input.tdnPercent ?? null,
        nelMcalKg: input.nelMcalKg ?? null,
        nfcPercent: input.nfcPercent ?? null,
        caPercent: input.caPercent ?? null,
        pPercent: input.pPercent ?? null,
        mgPercent: input.mgPercent ?? null,
        kPercent: input.kPercent ?? null,
        naPercent: input.naPercent ?? null,
        notes: input.notes?.trim() || null,
        recordedBy,
      },
      include: ANALYSIS_INCLUDE,
    });

    return toAnalysisItem(row);
  });
}

export async function listAnalyses(
  ctx: RlsContext,
  query: ListAnalysesQuery,
): Promise<ListAnalysesResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };

    if (query.feedIngredientId) where.feedIngredientId = query.feedIngredientId;
    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
      if (query.dateTo) dateFilter.lte = new Date(query.dateTo);
      where.collectionDate = dateFilter;
    }

    const [rows, total] = await Promise.all([
      tx.bromatologicalAnalysis.findMany({
        where: where as any,
        include: ANALYSIS_INCLUDE,
        orderBy: { collectionDate: 'desc' },
        skip,
        take: limit,
      }),
      tx.bromatologicalAnalysis.count({ where: where as any }),
    ]);

    return {
      data: rows.map(toAnalysisItem),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

export async function getAnalysis(ctx: RlsContext, id: string): Promise<AnalysisItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.bromatologicalAnalysis.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: ANALYSIS_INCLUDE,
    });
    if (!row) {
      throw new FeedIngredientError('Análise bromatológica não encontrada', 404);
    }
    return toAnalysisItem(row);
  });
}

export async function updateAnalysis(
  ctx: RlsContext,
  id: string,
  input: UpdateAnalysisInput,
): Promise<AnalysisItem> {
  if (input.responsibleName !== undefined && !input.responsibleName?.trim()) {
    throw new FeedIngredientError('Responsável não pode ser vazio', 400);
  }
  if (input.collectionDate) {
    const d = new Date(input.collectionDate);
    if (isNaN(d.getTime())) throw new FeedIngredientError('Data de coleta inválida', 400);
  }
  if (input.resultDate) {
    const d = new Date(input.resultDate);
    if (isNaN(d.getTime())) throw new FeedIngredientError('Data de resultado inválida', 400);
  }
  validateNutritionalParams(input as unknown as Record<string, unknown>);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.bromatologicalAnalysis.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true, collectionDate: true },
    });
    if (!existing) {
      throw new FeedIngredientError('Análise bromatológica não encontrada', 404);
    }

    // Validate resultDate >= collectionDate
    if (input.resultDate && input.collectionDate) {
      if (new Date(input.resultDate) < new Date(input.collectionDate)) {
        throw new FeedIngredientError(
          'Data de resultado não pode ser anterior à data de coleta',
          400,
        );
      }
    } else if (input.resultDate) {
      if (new Date(input.resultDate) < existing.collectionDate) {
        throw new FeedIngredientError(
          'Data de resultado não pode ser anterior à data de coleta',
          400,
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (input.batchNumber !== undefined) data.batchNumber = input.batchNumber?.trim() || null;
    if (input.collectionDate !== undefined) data.collectionDate = new Date(input.collectionDate);
    if (input.resultDate !== undefined)
      data.resultDate = input.resultDate ? new Date(input.resultDate) : null;
    if (input.laboratory !== undefined) data.laboratory = input.laboratory?.trim() || null;
    if (input.protocolNumber !== undefined)
      data.protocolNumber = input.protocolNumber?.trim() || null;
    if (input.responsibleName !== undefined) data.responsibleName = input.responsibleName!.trim();
    if (input.dmPercent !== undefined) data.dmPercent = input.dmPercent ?? null;
    if (input.cpPercent !== undefined) data.cpPercent = input.cpPercent ?? null;
    if (input.ndfPercent !== undefined) data.ndfPercent = input.ndfPercent ?? null;
    if (input.adfPercent !== undefined) data.adfPercent = input.adfPercent ?? null;
    if (input.eePercent !== undefined) data.eePercent = input.eePercent ?? null;
    if (input.mmPercent !== undefined) data.mmPercent = input.mmPercent ?? null;
    if (input.tdnPercent !== undefined) data.tdnPercent = input.tdnPercent ?? null;
    if (input.nelMcalKg !== undefined) data.nelMcalKg = input.nelMcalKg ?? null;
    if (input.nfcPercent !== undefined) data.nfcPercent = input.nfcPercent ?? null;
    if (input.caPercent !== undefined) data.caPercent = input.caPercent ?? null;
    if (input.pPercent !== undefined) data.pPercent = input.pPercent ?? null;
    if (input.mgPercent !== undefined) data.mgPercent = input.mgPercent ?? null;
    if (input.kPercent !== undefined) data.kPercent = input.kPercent ?? null;
    if (input.naPercent !== undefined) data.naPercent = input.naPercent ?? null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    const row = await tx.bromatologicalAnalysis.update({
      where: { id },
      data: data as any,
      include: ANALYSIS_INCLUDE,
    });

    return toAnalysisItem(row);
  });
}

export async function deleteAnalysis(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.bromatologicalAnalysis.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new FeedIngredientError('Análise bromatológica não encontrada', 404);
    }

    await tx.bromatologicalAnalysis.delete({ where: { id } });
  });
}

// ═══════════════════════════════════════════════════════════════════
// CA4: Latest analysis for diet calculations
// ═══════════════════════════════════════════════════════════════════

export async function getLatestAnalysis(
  ctx: RlsContext,
  feedIngredientId: string,
): Promise<AnalysisItem | null> {
  return withRlsContext(ctx, async (tx) => {
    const feed = await tx.feedIngredient.findFirst({
      where: { id: feedIngredientId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!feed) {
      throw new FeedIngredientError('Alimento/ingrediente não encontrado', 404);
    }

    const row = await tx.bromatologicalAnalysis.findFirst({
      where: { feedIngredientId, organizationId: ctx.organizationId },
      include: ANALYSIS_INCLUDE,
      orderBy: { collectionDate: 'desc' },
    });

    return row ? toAnalysisItem(row) : null;
  });
}

// ═══════════════════════════════════════════════════════════════════
// CA5: Compare analysis with reference values
// ═══════════════════════════════════════════════════════════════════

export async function compareWithReference(
  ctx: RlsContext,
  analysisId: string,
): Promise<ComparisonResult> {
  return withRlsContext(ctx, async (tx) => {
    const analysis = await tx.bromatologicalAnalysis.findFirst({
      where: { id: analysisId, organizationId: ctx.organizationId },
      include: { feedIngredient: true },
    });
    if (!analysis) {
      throw new FeedIngredientError('Análise bromatológica não encontrada', 404);
    }

    const feed = analysis.feedIngredient as any;
    const comparisons: ParamComparison[] = [];

    for (const param of NUTRITIONAL_PARAMS) {
      const refField = REF_PARAM_MAP[param];
      const refValue = feed[refField] != null ? Number(feed[refField]) : null;
      const analysisValue =
        (analysis as any)[param] != null ? Number((analysis as any)[param]) : null;

      let deviationPercent: number | null = null;
      let level: DeviationLevel = 'NORMAL';

      if (refValue != null && analysisValue != null && refValue !== 0) {
        deviationPercent = Math.round(((analysisValue - refValue) / refValue) * 1000) / 10;
        const absDeviation = Math.abs(deviationPercent);
        if (absDeviation >= DEVIATION_THRESHOLDS.CRITICAL) {
          level = 'CRITICAL';
        } else if (absDeviation >= DEVIATION_THRESHOLDS.WARNING) {
          level = 'WARNING';
        }
      }

      comparisons.push({
        param,
        label: NUTRITIONAL_PARAM_LABELS[param],
        referenceValue: refValue,
        analysisValue,
        deviationPercent,
        level,
      });
    }

    return {
      analysisId,
      feedIngredientId: analysis.feedIngredientId,
      feedIngredientName: feed.name,
      comparisons,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════
// CA6: Import analyses from CSV/Excel
// ═══════════════════════════════════════════════════════════════════

export async function importAnalysesCsv(
  ctx: RlsContext,
  recordedBy: string,
  file: { buffer: Buffer; originalname: string },
): Promise<ImportAnalysesResult> {
  const parsed = await parseAnalysisFile(file.buffer, file.originalname);

  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    throw new FeedIngredientError(`Erro ao processar arquivo: ${parsed.errors.join('; ')}`, 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Build feed ingredient name -> id map
    const feedNames = [...new Set(parsed.rows.map((r) => r.feedName.toLowerCase()))];
    const feeds = await tx.feedIngredient.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        name: { in: feedNames, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });

    const feedMap = new Map<string, string>();
    for (const f of feeds) {
      feedMap.set(f.name.toLowerCase(), f.id);
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [...parsed.errors];

    for (const row of parsed.rows) {
      const feedId = feedMap.get(row.feedName.toLowerCase());
      if (!feedId) {
        errors.push(`Linha ${row.index + 1}: alimento "${row.feedName}" não encontrado`);
        skipped++;
        continue;
      }

      if (!row.collectionDate) {
        errors.push(`Linha ${row.index + 1}: data de coleta não encontrada ou inválida`);
        skipped++;
        continue;
      }

      try {
        await tx.bromatologicalAnalysis.create({
          data: {
            organizationId: ctx.organizationId,
            feedIngredientId: feedId,
            batchNumber: row.batchNumber,
            collectionDate: new Date(row.collectionDate),
            laboratory: row.laboratory,
            protocolNumber: row.protocolNumber,
            responsibleName: row.responsibleName || 'Importação automática',
            dmPercent: row.dmPercent,
            cpPercent: row.cpPercent,
            ndfPercent: row.ndfPercent,
            adfPercent: row.adfPercent,
            eePercent: row.eePercent,
            mmPercent: row.mmPercent,
            tdnPercent: row.tdnPercent,
            nelMcalKg: row.nelMcalKg,
            nfcPercent: row.nfcPercent,
            caPercent: row.caPercent,
            pPercent: row.pPercent,
            mgPercent: row.mgPercent,
            kPercent: row.kPercent,
            naPercent: row.naPercent,
            recordedBy,
          },
        });
        imported++;
      } catch {
        errors.push(`Linha ${row.index + 1}: erro ao salvar análise`);
        skipped++;
      }
    }

    return { imported, skipped, errors };
  });
}

// ═══════════════════════════════════════════════════════════════════
// CA7: Quality trend + cost indicators
// ═══════════════════════════════════════════════════════════════════

export async function getQualityTrend(
  ctx: RlsContext,
  feedIngredientId: string,
): Promise<QualityTrendResult> {
  return withRlsContext(ctx, async (tx) => {
    const feed = await tx.feedIngredient.findFirst({
      where: { id: feedIngredientId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, name: true, costPerKg: true },
    });
    if (!feed) {
      throw new FeedIngredientError('Alimento/ingrediente não encontrado', 404);
    }

    const analyses = await tx.bromatologicalAnalysis.findMany({
      where: { feedIngredientId, organizationId: ctx.organizationId },
      orderBy: { collectionDate: 'asc' },
      take: 50, // last 50 analyses
    });

    const costPerKg = feed.costPerKg != null ? Number(feed.costPerKg) : null;

    const points: QualityTrendPoint[] = analyses.map((a: any) => {
      const dm = a.dmPercent != null ? Number(a.dmPercent) : null;
      const cp = a.cpPercent != null ? Number(a.cpPercent) : null;

      let costPerKgDm: number | null = null;
      let costPerKgCp: number | null = null;

      if (costPerKg != null && dm != null && dm > 0) {
        // Cost per kg of dry matter = costPerKg / (dm/100)
        costPerKgDm = Math.round((costPerKg / (dm / 100)) * 100) / 100;
      }
      if (costPerKg != null && cp != null && cp > 0 && dm != null && dm > 0) {
        // Cost per kg of crude protein = costPerKg / ((dm/100) * (cp/100))
        costPerKgCp = Math.round((costPerKg / ((dm / 100) * (cp / 100))) * 100) / 100;
      }

      return {
        analysisId: a.id,
        collectionDate: (a.collectionDate as Date).toISOString().slice(0, 10),
        dmPercent: dm,
        cpPercent: cp,
        ndfPercent: a.ndfPercent != null ? Number(a.ndfPercent) : null,
        tdnPercent: a.tdnPercent != null ? Number(a.tdnPercent) : null,
        nelMcalKg: a.nelMcalKg != null ? Number(a.nelMcalKg) : null,
        costPerKgDm,
        costPerKgCp,
      };
    });

    return {
      feedIngredientId,
      feedIngredientName: feed.name,
      points,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════
// Report upload (CA3)
// ═══════════════════════════════════════════════════════════════════

export async function uploadAnalysisReport(
  ctx: RlsContext,
  analysisId: string,
  file: Express.Multer.File,
): Promise<AnalysisItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.bromatologicalAnalysis.findFirst({
      where: { id: analysisId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new FeedIngredientError('Análise bromatológica não encontrada', 404);
    }

    // Store file on disk
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'bromatological-reports');
    await fs.mkdir(uploadsDir, { recursive: true });

    const ext = path.extname(file.originalname) || '.pdf';
    const filename = `${analysisId}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, file.buffer);

    const row = await tx.bromatologicalAnalysis.update({
      where: { id: analysisId },
      data: {
        reportFileName: file.originalname,
        reportPath: filePath,
      },
      include: ANALYSIS_INCLUDE,
    });

    return toAnalysisItem(row);
  });
}

export async function getAnalysisReportFile(
  ctx: RlsContext,
  analysisId: string,
): Promise<{ buffer: Buffer; filename: string; mimetype: string }> {
  return withRlsContext(ctx, async (tx) => {
    const analysis = await tx.bromatologicalAnalysis.findFirst({
      where: { id: analysisId, organizationId: ctx.organizationId },
      select: { id: true, reportFileName: true, reportPath: true },
    });
    if (!analysis) {
      throw new FeedIngredientError('Análise bromatológica não encontrada', 404);
    }
    if (!analysis.reportPath || !analysis.reportFileName) {
      throw new FeedIngredientError('Laudo não encontrado para esta análise', 404);
    }

    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    try {
      const buffer = await fs.readFile(analysis.reportPath);
      const ext = path.extname(analysis.reportFileName).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
      };
      const mimetype = mimeMap[ext] || 'application/octet-stream';
      return { buffer, filename: analysis.reportFileName, mimetype };
    } catch {
      throw new FeedIngredientError('Arquivo do laudo não encontrado no servidor', 404);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// Export CSV
// ═══════════════════════════════════════════════════════════════════

export async function exportIngredientsCsv(ctx: RlsContext): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const rows = await tx.feedIngredient.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    const header = [
      'Nome',
      'Tipo',
      'Subtipo',
      'Unidade',
      'Custo/kg (R$)',
      'MS Ref (%)',
      'PB Ref (%)',
      'FDN Ref (%)',
      'FDA Ref (%)',
      'EE Ref (%)',
      'MM Ref (%)',
      'NDT Ref (%)',
      'ELl Ref (Mcal/kg)',
      'CNF Ref (%)',
      'Ca Ref (%)',
      'P Ref (%)',
      'Mg Ref (%)',
      'K Ref (%)',
      'Na Ref (%)',
    ];

    const lines = rows.map((r: any) => {
      const feedType = r.type as FeedIngredientType;
      return [
        `"${r.name}"`,
        FEED_TYPE_LABELS[feedType] ?? feedType,
        r.subtype ?? '',
        r.measurementUnit,
        r.costPerKg != null ? String(r.costPerKg) : '',
        r.refDmPercent != null ? String(r.refDmPercent) : '',
        r.refCpPercent != null ? String(r.refCpPercent) : '',
        r.refNdfPercent != null ? String(r.refNdfPercent) : '',
        r.refAdfPercent != null ? String(r.refAdfPercent) : '',
        r.refEePercent != null ? String(r.refEePercent) : '',
        r.refMmPercent != null ? String(r.refMmPercent) : '',
        r.refTdnPercent != null ? String(r.refTdnPercent) : '',
        r.refNelMcalKg != null ? String(r.refNelMcalKg) : '',
        r.refNfcPercent != null ? String(r.refNfcPercent) : '',
        r.refCaPercent != null ? String(r.refCaPercent) : '',
        r.refPPercent != null ? String(r.refPPercent) : '',
        r.refMgPercent != null ? String(r.refMgPercent) : '',
        r.refKPercent != null ? String(r.refKPercent) : '',
        r.refNaPercent != null ? String(r.refNaPercent) : '',
      ].join(';');
    });

    return [header.join(';'), ...lines].join('\n');
  });
}

export async function exportAnalysesCsv(
  ctx: RlsContext,
  feedIngredientId?: string,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { organizationId: ctx.organizationId };
    if (feedIngredientId) where.feedIngredientId = feedIngredientId;

    const rows = await tx.bromatologicalAnalysis.findMany({
      where: where as any,
      include: { feedIngredient: { select: { name: true } } },
      orderBy: { collectionDate: 'desc' },
    });

    const header = [
      'Alimento',
      'Lote',
      'Data Coleta',
      'Data Resultado',
      'Laboratório',
      'Protocolo',
      'Responsável',
      'MS (%)',
      'PB (%)',
      'FDN (%)',
      'FDA (%)',
      'EE (%)',
      'MM (%)',
      'NDT (%)',
      'ELl (Mcal/kg)',
      'CNF (%)',
      'Ca (%)',
      'P (%)',
      'Mg (%)',
      'K (%)',
      'Na (%)',
    ];

    const lines = rows.map((r: any) =>
      [
        `"${r.feedIngredient?.name ?? ''}"`,
        r.batchNumber ?? '',
        (r.collectionDate as Date).toISOString().slice(0, 10),
        r.resultDate ? (r.resultDate as Date).toISOString().slice(0, 10) : '',
        r.laboratory ?? '',
        r.protocolNumber ?? '',
        r.responsibleName,
        r.dmPercent != null ? String(r.dmPercent) : '',
        r.cpPercent != null ? String(r.cpPercent) : '',
        r.ndfPercent != null ? String(r.ndfPercent) : '',
        r.adfPercent != null ? String(r.adfPercent) : '',
        r.eePercent != null ? String(r.eePercent) : '',
        r.mmPercent != null ? String(r.mmPercent) : '',
        r.tdnPercent != null ? String(r.tdnPercent) : '',
        r.nelMcalKg != null ? String(r.nelMcalKg) : '',
        r.nfcPercent != null ? String(r.nfcPercent) : '',
        r.caPercent != null ? String(r.caPercent) : '',
        r.pPercent != null ? String(r.pPercent) : '',
        r.mgPercent != null ? String(r.mgPercent) : '',
        r.kPercent != null ? String(r.kPercent) : '',
        r.naPercent != null ? String(r.naPercent) : '',
      ].join(';'),
    );

    return [header.join(';'), ...lines].join('\n');
  });
}
