import type { PestCategory, PestSeverity, InfestationLevel } from '@prisma/client';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PestError,
  PEST_CATEGORIES,
  PEST_CATEGORY_LABELS,
  PEST_SEVERITY_LEVELS,
  PEST_SEVERITY_LABELS,
  type CreatePestInput,
  type UpdatePestInput,
  type ListPestsQuery,
  type PestItem,
} from './pests.types';
import {
  INFESTATION_LEVELS,
  INFESTATION_LEVEL_LABELS,
} from '../monitoring-records/monitoring-records.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toItem(row: Record<string, unknown>): PestItem {
  const category = row.category as string;
  const severity = (row.severity as string) ?? null;
  const affectedCropsRaw = row.affectedCrops;
  const affectedCrops: string[] = Array.isArray(affectedCropsRaw)
    ? (affectedCropsRaw as string[])
    : typeof affectedCropsRaw === 'string'
      ? JSON.parse(affectedCropsRaw as string)
      : [];

  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    commonName: row.commonName as string,
    scientificName: (row.scientificName as string) ?? null,
    category,
    categoryLabel: PEST_CATEGORY_LABELS[category] ?? category,
    affectedCrops,
    severity,
    severityLabel: severity ? (PEST_SEVERITY_LABELS[severity] ?? severity) : null,
    ndeDescription: (row.ndeDescription as string) ?? null,
    ncDescription: (row.ncDescription as string) ?? null,
    controlThreshold: (row.controlThreshold as string) ?? null,
    controlThresholdLabel: row.controlThreshold
      ? (INFESTATION_LEVEL_LABELS[row.controlThreshold as (typeof INFESTATION_LEVELS)[number]] ??
        (row.controlThreshold as string))
      : null,
    recommendedProducts: (row.recommendedProducts as string) ?? null,
    lifecycle: (row.lifecycle as string) ?? null,
    symptoms: (row.symptoms as string) ?? null,
    photoUrl: (row.photoUrl as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function validateInput(input: CreatePestInput, isUpdate = false): void {
  if (!isUpdate) {
    if (!input.commonName?.trim()) {
      throw new PestError('Nome popular é obrigatório', 400);
    }
    if (!input.category) {
      throw new PestError('Categoria é obrigatória', 400);
    }
  }
  if (input.category !== undefined) {
    if (!PEST_CATEGORIES.includes(input.category as (typeof PEST_CATEGORIES)[number])) {
      throw new PestError(`Categoria inválida. Use: ${PEST_CATEGORIES.join(', ')}`, 400);
    }
  }
  if (input.severity !== undefined && input.severity !== null) {
    if (!PEST_SEVERITY_LEVELS.includes(input.severity as (typeof PEST_SEVERITY_LEVELS)[number])) {
      throw new PestError(`Severidade inválida. Use: ${PEST_SEVERITY_LEVELS.join(', ')}`, 400);
    }
  }
  if (input.affectedCrops !== undefined) {
    if (!Array.isArray(input.affectedCrops)) {
      throw new PestError('affectedCrops deve ser um array de strings', 400);
    }
  }
  if (input.controlThreshold !== undefined && input.controlThreshold !== null) {
    if (
      !INFESTATION_LEVELS.includes(input.controlThreshold as (typeof INFESTATION_LEVELS)[number])
    ) {
      throw new PestError(
        `Limiar de controle inválido. Use: ${INFESTATION_LEVELS.join(', ')}`,
        400,
      );
    }
  }
}

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createPest(ctx: RlsContext, input: CreatePestInput): Promise<PestItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Check unique name within organization
    const existing = await tx.pest.findFirst({
      where: {
        organizationId: ctx.organizationId,
        commonName: input.commonName.trim(),
        deletedAt: null,
      },
    });
    if (existing) {
      throw new PestError('Já existe uma praga/doença com esse nome', 409);
    }

    const row = await tx.pest.create({
      data: {
        organizationId: ctx.organizationId,
        commonName: input.commonName.trim(),
        scientificName: input.scientificName?.trim() || null,
        category: input.category as PestCategory,
        affectedCrops: input.affectedCrops ?? [],
        severity: (input.severity as PestSeverity) || null,
        ndeDescription: input.ndeDescription?.trim() || null,
        ncDescription: input.ncDescription?.trim() || null,
        controlThreshold: (input.controlThreshold as InfestationLevel) || null,
        recommendedProducts: input.recommendedProducts?.trim() || null,
        lifecycle: input.lifecycle?.trim() || null,
        symptoms: input.symptoms?.trim() || null,
        photoUrl: input.photoUrl?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listPests(
  ctx: RlsContext,
  query: ListPestsQuery,
): Promise<{
  data: PestItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.crop) {
      where.affectedCrops = { has: query.crop };
    }

    if (query.search) {
      where.OR = [
        { commonName: { contains: query.search, mode: 'insensitive' } },
        { scientificName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      tx.pest.findMany({
        where,
        orderBy: { commonName: 'asc' },
        skip,
        take: limit,
      }),
      tx.pest.count({ where }),
    ]);

    return {
      data: rows.map((r: unknown) => toItem(r as Record<string, unknown>)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getPest(ctx: RlsContext, pestId: string): Promise<PestItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.pest.findFirst({
      where: {
        id: pestId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!row) {
      throw new PestError('Praga/doença não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updatePest(
  ctx: RlsContext,
  pestId: string,
  input: UpdatePestInput,
): Promise<PestItem> {
  validateInput(input as CreatePestInput, true);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.pest.findFirst({
      where: {
        id: pestId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new PestError('Praga/doença não encontrada', 404);
    }

    // Check name uniqueness if changing
    if (input.commonName !== undefined) {
      const duplicate = await tx.pest.findFirst({
        where: {
          organizationId: ctx.organizationId,
          commonName: input.commonName.trim(),
          deletedAt: null,
          id: { not: pestId },
        },
      });
      if (duplicate) {
        throw new PestError('Já existe uma praga/doença com esse nome', 409);
      }
    }

    const data: Record<string, unknown> = {};
    if (input.commonName !== undefined) data.commonName = input.commonName.trim();
    if (input.scientificName !== undefined)
      data.scientificName = input.scientificName?.trim() || null;
    if (input.category !== undefined) data.category = input.category;
    if (input.affectedCrops !== undefined) data.affectedCrops = input.affectedCrops;
    if (input.severity !== undefined) data.severity = input.severity || null;
    if (input.ndeDescription !== undefined)
      data.ndeDescription = input.ndeDescription?.trim() || null;
    if (input.ncDescription !== undefined) data.ncDescription = input.ncDescription?.trim() || null;
    if (input.controlThreshold !== undefined)
      data.controlThreshold = (input.controlThreshold as InfestationLevel) || null;
    if (input.recommendedProducts !== undefined)
      data.recommendedProducts = input.recommendedProducts?.trim() || null;
    if (input.lifecycle !== undefined) data.lifecycle = input.lifecycle?.trim() || null;
    if (input.symptoms !== undefined) data.symptoms = input.symptoms?.trim() || null;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    const row = await tx.pest.update({
      where: { id: pestId },
      data,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deletePest(ctx: RlsContext, pestId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.pest.findFirst({
      where: {
        id: pestId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new PestError('Praga/doença não encontrada', 404);
    }

    await tx.pest.update({
      where: { id: pestId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── CATEGORIES ─────────────────────────────────────────────────────

export function listCategories(): { value: string; label: string }[] {
  return PEST_CATEGORIES.map((c) => ({ value: c, label: PEST_CATEGORY_LABELS[c] }));
}
