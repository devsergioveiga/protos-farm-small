import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import {
  MeasurementUnitError,
  UNIT_CATEGORIES,
  SYSTEM_UNITS,
  SYSTEM_CONVERSIONS,
  type CreateUnitInput,
  type UpdateUnitInput,
  type ListUnitsQuery,
  type UnitItem,
  type CreateConversionInput,
  type UpdateConversionInput,
  type ListConversionsQuery,
  type ConversionItem,
  type ConvertResult,
} from './measurement-units.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toUnitItem(row: Record<string, unknown>): UnitItem {
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    name: row.name as string,
    abbreviation: row.abbreviation as string,
    category: row.category as string,
    isSystem: row.isSystem as boolean,
    isActive: row.isActive as boolean,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toConversionItem(row: Record<string, unknown>): ConversionItem {
  const from = row.fromUnit as Record<string, unknown>;
  const to = row.toUnit as Record<string, unknown>;
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    fromUnitId: row.fromUnitId as string,
    fromUnitName: from.name as string,
    fromUnitAbbreviation: from.abbreviation as string,
    toUnitId: row.toUnitId as string,
    toUnitName: to.name as string,
    toUnitAbbreviation: to.abbreviation as string,
    factor: Number(row.factor),
    isSystem: row.isSystem as boolean,
    isActive: row.isActive as boolean,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ─── Seed system units (idempotent) ──────────────────────────────────

export async function ensureSystemUnits(ctx: RlsContext): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.measurementUnit.findFirst({
      where: { organizationId: ctx.organizationId, isSystem: true },
      select: { id: true },
    });
    if (existing) return; // already seeded

    // Create all system units
    const unitMap = new Map<string, string>(); // abbreviation → id
    for (const u of SYSTEM_UNITS) {
      const row = await tx.measurementUnit.create({
        data: {
          organizationId: ctx.organizationId,
          name: u.name,
          abbreviation: u.abbreviation,
          category: u.category as 'WEIGHT' | 'VOLUME' | 'COUNT' | 'AREA',
          isSystem: true,
        },
      });
      unitMap.set(u.abbreviation, row.id);
    }

    // Create system conversions (both directions)
    for (const c of SYSTEM_CONVERSIONS) {
      const fromId = unitMap.get(c.from);
      const toId = unitMap.get(c.to);
      if (!fromId || !toId) continue;

      // Forward: from → to
      await tx.unitConversion.create({
        data: {
          organizationId: ctx.organizationId,
          fromUnitId: fromId,
          toUnitId: toId,
          factor: c.factor,
          isSystem: true,
        },
      });

      // Reverse: to → from (CA5 — bidirecional)
      await tx.unitConversion.create({
        data: {
          organizationId: ctx.organizationId,
          fromUnitId: toId,
          toUnitId: fromId,
          factor: 1 / c.factor,
          isSystem: true,
        },
      });
    }
  });
}

// ─── Units CRUD ─────────────────────────────────────────────────────

export async function createUnit(ctx: RlsContext, input: CreateUnitInput): Promise<UnitItem> {
  if (!input.name?.trim()) {
    throw new MeasurementUnitError('Nome da unidade é obrigatório', 400);
  }
  if (!input.abbreviation?.trim()) {
    throw new MeasurementUnitError('Abreviação é obrigatória', 400);
  }
  if (!(UNIT_CATEGORIES as readonly string[]).includes(input.category)) {
    throw new MeasurementUnitError(`Categoria inválida: ${input.category}`, 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.measurementUnit.findFirst({
      where: {
        organizationId: ctx.organizationId,
        abbreviation: input.abbreviation.trim(),
      },
      select: { id: true },
    });
    if (existing) {
      throw new MeasurementUnitError(
        `Já existe uma unidade com a abreviação "${input.abbreviation}"`,
        409,
      );
    }

    const row = await tx.measurementUnit.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        abbreviation: input.abbreviation.trim(),
        category: input.category as 'WEIGHT' | 'VOLUME' | 'COUNT' | 'AREA',
        isSystem: false,
      },
    });

    return toUnitItem(row as unknown as Record<string, unknown>);
  });
}

export async function listUnits(
  ctx: RlsContext,
  query: ListUnitsQuery,
): Promise<{
  data: UnitItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  await ensureSystemUnits(ctx);

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };

    if (!query.includeInactive) {
      where.isActive = true;
    }
    if (query.category && (UNIT_CATEGORIES as readonly string[]).includes(query.category)) {
      where.category = query.category;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { abbreviation: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const typedWhere = where as Parameters<typeof tx.measurementUnit.findMany>[0] extends {
      where?: infer W;
    }
      ? W
      : never;

    const [rows, total] = await Promise.all([
      tx.measurementUnit.findMany({
        where: typedWhere,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      tx.measurementUnit.count({ where: typedWhere }),
    ]);

    return {
      data: rows.map((r) => toUnitItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export async function getUnit(ctx: RlsContext, unitId: string): Promise<UnitItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.measurementUnit.findFirst({
      where: { id: unitId, organizationId: ctx.organizationId },
    });
    if (!row) {
      throw new MeasurementUnitError('Unidade não encontrada', 404);
    }
    return toUnitItem(row as unknown as Record<string, unknown>);
  });
}

export async function updateUnit(
  ctx: RlsContext,
  unitId: string,
  input: UpdateUnitInput,
): Promise<UnitItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.measurementUnit.findFirst({
      where: { id: unitId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new MeasurementUnitError('Unidade não encontrada', 404);
    }
    if (existing.isSystem && (input.name || input.abbreviation || input.category)) {
      throw new MeasurementUnitError(
        'Unidades do sistema não podem ter nome, abreviação ou categoria alterados',
        403,
      );
    }

    if (input.abbreviation) {
      const dup = await tx.measurementUnit.findFirst({
        where: {
          organizationId: ctx.organizationId,
          abbreviation: input.abbreviation.trim(),
          id: { not: unitId },
        },
        select: { id: true },
      });
      if (dup) {
        throw new MeasurementUnitError(
          `Já existe uma unidade com a abreviação "${input.abbreviation}"`,
          409,
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name?.trim();
    if (input.abbreviation !== undefined) data.abbreviation = input.abbreviation?.trim();
    if (
      input.category !== undefined &&
      (UNIT_CATEGORIES as readonly string[]).includes(input.category)
    ) {
      data.category = input.category;
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const row = await tx.measurementUnit.update({
      where: { id: unitId },
      data: data as Parameters<typeof tx.measurementUnit.update>[0]['data'],
    });

    return toUnitItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteUnit(ctx: RlsContext, unitId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.measurementUnit.findFirst({
      where: { id: unitId, organizationId: ctx.organizationId },
    });
    if (!row) {
      throw new MeasurementUnitError('Unidade não encontrada', 404);
    }
    if (row.isSystem) {
      throw new MeasurementUnitError('Unidades do sistema não podem ser excluídas', 403);
    }

    // Delete related conversions first (cascade should handle, but be explicit)
    await tx.unitConversion.deleteMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [{ fromUnitId: unitId }, { toUnitId: unitId }],
      },
    });
    await tx.measurementUnit.delete({ where: { id: unitId } });
  });
}

// ─── Conversions CRUD ────────────────────────────────────────────────

export async function createConversion(
  ctx: RlsContext,
  input: CreateConversionInput,
): Promise<ConversionItem> {
  if (!input.fromUnitId || !input.toUnitId) {
    throw new MeasurementUnitError('Unidades de origem e destino são obrigatórias', 400);
  }
  if (input.fromUnitId === input.toUnitId) {
    throw new MeasurementUnitError('Unidades de origem e destino devem ser diferentes', 400);
  }
  if (input.factor == null || input.factor <= 0) {
    throw new MeasurementUnitError('Fator de conversão deve ser um número positivo', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate both units exist and belong to org
    const [fromUnit, toUnit] = await Promise.all([
      tx.measurementUnit.findFirst({
        where: { id: input.fromUnitId, organizationId: ctx.organizationId },
      }),
      tx.measurementUnit.findFirst({
        where: { id: input.toUnitId, organizationId: ctx.organizationId },
      }),
    ]);
    if (!fromUnit) throw new MeasurementUnitError('Unidade de origem não encontrada', 404);
    if (!toUnit) throw new MeasurementUnitError('Unidade de destino não encontrada', 404);

    // Check duplicate
    const existing = await tx.unitConversion.findFirst({
      where: {
        organizationId: ctx.organizationId,
        fromUnitId: input.fromUnitId,
        toUnitId: input.toUnitId,
      },
    });
    if (existing) {
      throw new MeasurementUnitError(
        `Já existe conversão de ${fromUnit.abbreviation} para ${toUnit.abbreviation}`,
        409,
      );
    }

    // Create forward conversion
    const row = await tx.unitConversion.create({
      data: {
        organizationId: ctx.organizationId,
        fromUnitId: input.fromUnitId,
        toUnitId: input.toUnitId,
        factor: input.factor,
        isSystem: false,
      },
      include: {
        fromUnit: { select: { name: true, abbreviation: true } },
        toUnit: { select: { name: true, abbreviation: true } },
      },
    });

    // Create reverse conversion (CA5 — bidirecional) if it doesn't exist
    const reverseExists = await tx.unitConversion.findFirst({
      where: {
        organizationId: ctx.organizationId,
        fromUnitId: input.toUnitId,
        toUnitId: input.fromUnitId,
      },
    });
    if (!reverseExists) {
      await tx.unitConversion.create({
        data: {
          organizationId: ctx.organizationId,
          fromUnitId: input.toUnitId,
          toUnitId: input.fromUnitId,
          factor: 1 / input.factor,
          isSystem: false,
        },
      });
    }

    return toConversionItem(row as unknown as Record<string, unknown>);
  });
}

export async function listConversions(
  ctx: RlsContext,
  query: ListConversionsQuery,
): Promise<{
  data: ConversionItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  await ensureSystemUnits(ctx);

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      isActive: true,
    };

    if (query.unitId) {
      where.OR = [{ fromUnitId: query.unitId }, { toUnitId: query.unitId }];
    }

    const typedWhere = where as Parameters<typeof tx.unitConversion.findMany>[0] extends {
      where?: infer W;
    }
      ? W
      : never;

    const [rows, total] = await Promise.all([
      tx.unitConversion.findMany({
        where: typedWhere,
        include: {
          fromUnit: { select: { name: true, abbreviation: true } },
          toUnit: { select: { name: true, abbreviation: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      tx.unitConversion.count({ where: typedWhere }),
    ]);

    return {
      data: rows.map((r) => toConversionItem(r as unknown as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export async function updateConversion(
  ctx: RlsContext,
  conversionId: string,
  input: UpdateConversionInput,
): Promise<ConversionItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.unitConversion.findFirst({
      where: { id: conversionId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new MeasurementUnitError('Conversão não encontrada', 404);
    }
    if (existing.isSystem && input.factor != null) {
      throw new MeasurementUnitError('Conversões do sistema não podem ter o fator alterado', 403);
    }
    if (input.factor != null && input.factor <= 0) {
      throw new MeasurementUnitError('Fator de conversão deve ser um número positivo', 400);
    }

    const data: Record<string, unknown> = {};
    if (input.factor !== undefined) data.factor = input.factor;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const row = await tx.unitConversion.update({
      where: { id: conversionId },
      data: data as Parameters<typeof tx.unitConversion.update>[0]['data'],
      include: {
        fromUnit: { select: { name: true, abbreviation: true } },
        toUnit: { select: { name: true, abbreviation: true } },
      },
    });

    // Update reverse conversion factor if factor changed (CA5)
    if (input.factor != null) {
      await tx.unitConversion.updateMany({
        where: {
          organizationId: ctx.organizationId,
          fromUnitId: existing.toUnitId,
          toUnitId: existing.fromUnitId,
        },
        data: { factor: 1 / input.factor },
      });
    }

    return toConversionItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteConversion(ctx: RlsContext, conversionId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.unitConversion.findFirst({
      where: { id: conversionId, organizationId: ctx.organizationId },
    });
    if (!row) {
      throw new MeasurementUnitError('Conversão não encontrada', 404);
    }
    if (row.isSystem) {
      throw new MeasurementUnitError('Conversões do sistema não podem ser excluídas', 403);
    }

    // Delete reverse conversion too
    await tx.unitConversion.deleteMany({
      where: {
        organizationId: ctx.organizationId,
        fromUnitId: row.toUnitId,
        toUnitId: row.fromUnitId,
        isSystem: false,
      },
    });

    await tx.unitConversion.delete({ where: { id: conversionId } });
  });
}

// ─── Convert (CA5 — bidirectional with path) ─────────────────────────

export async function convert(
  ctx: RlsContext,
  fromUnitId: string,
  toUnitId: string,
  value: number,
): Promise<ConvertResult> {
  if (fromUnitId === toUnitId) {
    return withRlsContext(ctx, async (tx) => {
      const unit = await tx.measurementUnit.findFirst({
        where: { id: fromUnitId, organizationId: ctx.organizationId },
      });
      if (!unit) throw new MeasurementUnitError('Unidade não encontrada', 404);
      return {
        fromValue: value,
        fromUnit: unit.abbreviation,
        toValue: value,
        toUnit: unit.abbreviation,
        factor: 1,
        path: [unit.abbreviation],
      };
    });
  }

  return withRlsContext(ctx, async (tx) => {
    // Try direct conversion first
    const direct = await tx.unitConversion.findFirst({
      where: {
        organizationId: ctx.organizationId,
        fromUnitId,
        toUnitId,
        isActive: true,
      },
      include: {
        fromUnit: { select: { abbreviation: true } },
        toUnit: { select: { abbreviation: true } },
      },
    });

    if (direct) {
      const factor = Number(direct.factor);
      return {
        fromValue: value,
        fromUnit: direct.fromUnit.abbreviation,
        toValue: Math.round(value * factor * 1e6) / 1e6,
        toUnit: direct.toUnit.abbreviation,
        factor,
        path: [direct.fromUnit.abbreviation, direct.toUnit.abbreviation],
      };
    }

    // Try 2-hop conversion (from → intermediate → to)
    const result = await findTwoHopConversion(tx, ctx.organizationId, fromUnitId, toUnitId, value);
    if (result) return result;

    throw new MeasurementUnitError(
      'Conversão não configurada entre estas unidades. Configure o fator de conversão primeiro.',
      400,
    );
  });
}

async function findTwoHopConversion(
  tx: TxClient,
  organizationId: string,
  fromUnitId: string,
  toUnitId: string,
  value: number,
): Promise<ConvertResult | null> {
  // Get all conversions from fromUnit
  const fromConversions = await tx.unitConversion.findMany({
    where: { organizationId, fromUnitId, isActive: true },
    include: {
      fromUnit: { select: { abbreviation: true } },
      toUnit: { select: { id: true, abbreviation: true } },
    },
  });

  for (const first of fromConversions) {
    const second = await tx.unitConversion.findFirst({
      where: {
        organizationId,
        fromUnitId: first.toUnitId,
        toUnitId,
        isActive: true,
      },
      include: {
        toUnit: { select: { abbreviation: true } },
      },
    });

    if (second) {
      const factor1 = Number(first.factor);
      const factor2 = Number(second.factor);
      const totalFactor = factor1 * factor2;
      return {
        fromValue: value,
        fromUnit: first.fromUnit.abbreviation,
        toValue: Math.round(value * totalFactor * 1e6) / 1e6,
        toUnit: second.toUnit.abbreviation,
        factor: totalFactor,
        path: [first.fromUnit.abbreviation, first.toUnit.abbreviation, second.toUnit.abbreviation],
      };
    }
  }

  return null;
}

// ─── Import conversions from CSV (CA9) ───────────────────────────────

export interface ImportConversionRow {
  fromAbbreviation: string;
  toAbbreviation: string;
  factor: number;
}

export async function importConversions(
  ctx: RlsContext,
  rows: ImportConversionRow[],
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  return withRlsContext(ctx, async (tx) => {
    // Build abbreviation→id map
    const units = await tx.measurementUnit.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      select: { id: true, abbreviation: true },
    });
    const unitMap = new Map(units.map((u) => [u.abbreviation, u.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.fromAbbreviation?.trim() || !row.toAbbreviation?.trim()) {
          errors.push(`Linha ${i + 1}: abreviações de origem e destino são obrigatórias`);
          skipped++;
          continue;
        }
        if (row.factor == null || row.factor <= 0) {
          errors.push(`Linha ${i + 1}: fator deve ser um número positivo`);
          skipped++;
          continue;
        }

        const fromId = unitMap.get(row.fromAbbreviation.trim());
        const toId = unitMap.get(row.toAbbreviation.trim());
        if (!fromId) {
          errors.push(`Linha ${i + 1}: unidade "${row.fromAbbreviation}" não encontrada`);
          skipped++;
          continue;
        }
        if (!toId) {
          errors.push(`Linha ${i + 1}: unidade "${row.toAbbreviation}" não encontrada`);
          skipped++;
          continue;
        }

        // Check if already exists
        const existing = await tx.unitConversion.findFirst({
          where: { organizationId: ctx.organizationId, fromUnitId: fromId, toUnitId: toId },
        });
        if (existing) {
          skipped++;
          continue;
        }

        // Create forward
        await tx.unitConversion.create({
          data: {
            organizationId: ctx.organizationId,
            fromUnitId: fromId,
            toUnitId: toId,
            factor: row.factor,
            isSystem: false,
          },
        });

        // Create reverse
        const reverseExists = await tx.unitConversion.findFirst({
          where: { organizationId: ctx.organizationId, fromUnitId: toId, toUnitId: fromId },
        });
        if (!reverseExists) {
          await tx.unitConversion.create({
            data: {
              organizationId: ctx.organizationId,
              fromUnitId: toId,
              toUnitId: fromId,
              factor: 1 / row.factor,
              isSystem: false,
            },
          });
        }

        imported++;
      } catch {
        errors.push(`Linha ${i + 1}: erro ao importar conversão`);
        skipped++;
      }
    }

    return { imported, skipped, errors };
  });
}
