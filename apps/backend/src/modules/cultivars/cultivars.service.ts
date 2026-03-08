import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  CultivarError,
  CULTIVAR_TYPES,
  type CreateCultivarInput,
  type UpdateCultivarInput,
  type CultivarItem,
  type ListCultivarsQuery,
} from './cultivars.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateInput(input: CreateCultivarInput): void {
  if (!input.name?.trim()) {
    throw new CultivarError('Nome da cultivar é obrigatório', 400);
  }
  if (!input.crop?.trim()) {
    throw new CultivarError('Cultura é obrigatória', 400);
  }
  if (input.type && !(CULTIVAR_TYPES as readonly string[]).includes(input.type)) {
    throw new CultivarError(`Tipo inválido: ${input.type}`, 400);
  }
  if (input.cycleDays != null && (input.cycleDays < 1 || !Number.isInteger(input.cycleDays))) {
    throw new CultivarError('Ciclo deve ser um número inteiro positivo de dias', 400);
  }
}

function toItem(row: Record<string, unknown>): CultivarItem {
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    name: row.name as string,
    crop: row.crop as string,
    breeder: (row.breeder as string) ?? null,
    cycleDays: (row.cycleDays as number) ?? null,
    maturationGroup: (row.maturationGroup as string) ?? null,
    type: row.type as string,
    technology: (row.technology as string) ?? null,
    diseaseTolerances: (row.diseaseTolerances as string) ?? null,
    regionalAptitude: (row.regionalAptitude as string) ?? null,
    populationRecommendation: (row.populationRecommendation as string) ?? null,
    plantingWindowStart: row.plantingWindowStart
      ? (row.plantingWindowStart as Date).toISOString().split('T')[0]
      : null,
    plantingWindowEnd: row.plantingWindowEnd
      ? (row.plantingWindowEnd as Date).toISOString().split('T')[0]
      : null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ─── CRUD ───────────────────────────────────────────────────────────

export async function createCultivar(
  ctx: RlsContext,
  input: CreateCultivarInput,
): Promise<CultivarItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.cultivar.findFirst({
      where: {
        name: input.name.trim(),
        crop: input.crop.trim(),
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new CultivarError('Já existe uma cultivar com este nome e cultura', 409);
    }

    const row = await tx.cultivar.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        crop: input.crop.trim(),
        breeder: input.breeder?.trim() ?? null,
        cycleDays: input.cycleDays ?? null,
        maturationGroup: input.maturationGroup?.trim() ?? null,
        type: (input.type as 'CONVENCIONAL' | 'TRANSGENICO') ?? 'CONVENCIONAL',
        technology: input.technology?.trim() ?? null,
        diseaseTolerances: input.diseaseTolerances?.trim() ?? null,
        regionalAptitude: input.regionalAptitude?.trim() ?? null,
        populationRecommendation: input.populationRecommendation?.trim() ?? null,
        plantingWindowStart: input.plantingWindowStart ? new Date(input.plantingWindowStart) : null,
        plantingWindowEnd: input.plantingWindowEnd ? new Date(input.plantingWindowEnd) : null,
        notes: input.notes?.trim() ?? null,
      },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function listCultivars(
  ctx: RlsContext,
  query: ListCultivarsQuery,
): Promise<{
  data: CultivarItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    };

    if (query.crop) {
      where.crop = query.crop;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { breeder: { contains: query.search, mode: 'insensitive' } },
        { technology: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const typedWhere = where as Parameters<typeof tx.cultivar.findMany>[0] extends {
      where?: infer W;
    }
      ? W
      : never;

    const [rows, total] = await Promise.all([
      tx.cultivar.findMany({
        where: typedWhere,
        orderBy: [{ crop: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      tx.cultivar.count({ where: typedWhere }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export async function getCultivar(ctx: RlsContext, cultivarId: string): Promise<CultivarItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.cultivar.findFirst({
      where: { id: cultivarId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!row) {
      throw new CultivarError('Cultivar não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function updateCultivar(
  ctx: RlsContext,
  cultivarId: string,
  input: UpdateCultivarInput,
): Promise<CultivarItem> {
  if (input.type && !(CULTIVAR_TYPES as readonly string[]).includes(input.type)) {
    throw new CultivarError(`Tipo inválido: ${input.type}`, 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.cultivar.findFirst({
      where: { id: cultivarId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new CultivarError('Cultivar não encontrada', 404);
    }

    if (input.name || input.crop) {
      const name = input.name?.trim() ?? existing.name;
      const crop = input.crop?.trim() ?? existing.crop;
      const duplicate = await tx.cultivar.findFirst({
        where: {
          name,
          crop,
          organizationId: ctx.organizationId,
          deletedAt: null,
          id: { not: cultivarId },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new CultivarError('Já existe uma cultivar com este nome e cultura', 409);
      }
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name?.trim();
    if (input.crop !== undefined) data.crop = input.crop?.trim();
    if (input.breeder !== undefined) data.breeder = input.breeder?.trim() ?? null;
    if (input.cycleDays !== undefined) data.cycleDays = input.cycleDays;
    if (input.maturationGroup !== undefined)
      data.maturationGroup = input.maturationGroup?.trim() ?? null;
    if (input.type !== undefined) data.type = input.type;
    if (input.technology !== undefined) data.technology = input.technology?.trim() ?? null;
    if (input.diseaseTolerances !== undefined)
      data.diseaseTolerances = input.diseaseTolerances?.trim() ?? null;
    if (input.regionalAptitude !== undefined)
      data.regionalAptitude = input.regionalAptitude?.trim() ?? null;
    if (input.populationRecommendation !== undefined)
      data.populationRecommendation = input.populationRecommendation?.trim() ?? null;
    if (input.plantingWindowStart !== undefined)
      data.plantingWindowStart = input.plantingWindowStart
        ? new Date(input.plantingWindowStart)
        : null;
    if (input.plantingWindowEnd !== undefined)
      data.plantingWindowEnd = input.plantingWindowEnd ? new Date(input.plantingWindowEnd) : null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() ?? null;

    const row = await tx.cultivar.update({
      where: { id: cultivarId },
      data: data as Parameters<typeof tx.cultivar.update>[0]['data'],
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteCultivar(ctx: RlsContext, cultivarId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.cultivar.findFirst({
      where: { id: cultivarId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new CultivarError('Cultivar não encontrada', 404);
    }
    await tx.cultivar.update({
      where: { id: cultivarId },
      data: { deletedAt: new Date() },
    });
  });
}

export async function importCultivarsFromCsv(
  ctx: RlsContext,
  rows: CreateCultivarInput[],
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  return withRlsContext(ctx, async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name?.trim() || !row.crop?.trim()) {
          errors.push(`Linha ${i + 1}: nome e cultura são obrigatórios`);
          skipped++;
          continue;
        }

        const existing = await tx.cultivar.findFirst({
          where: {
            name: row.name.trim(),
            crop: row.crop.trim(),
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await tx.cultivar.create({
          data: {
            organizationId: ctx.organizationId,
            name: row.name.trim(),
            crop: row.crop.trim(),
            breeder: row.breeder?.trim() ?? null,
            cycleDays: row.cycleDays ?? null,
            maturationGroup: row.maturationGroup?.trim() ?? null,
            type: (row.type as 'CONVENCIONAL' | 'TRANSGENICO') ?? 'CONVENCIONAL',
            technology: row.technology?.trim() ?? null,
            diseaseTolerances: row.diseaseTolerances?.trim() ?? null,
            regionalAptitude: row.regionalAptitude?.trim() ?? null,
            populationRecommendation: row.populationRecommendation?.trim() ?? null,
            plantingWindowStart: row.plantingWindowStart ? new Date(row.plantingWindowStart) : null,
            plantingWindowEnd: row.plantingWindowEnd ? new Date(row.plantingWindowEnd) : null,
            notes: row.notes?.trim() ?? null,
          },
        });
        imported++;
      } catch {
        errors.push(`Linha ${i + 1}: erro ao importar "${row.name}"`);
        skipped++;
      }
    }

    return { imported, skipped, errors };
  });
}
