import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  GrainDiscountError,
  DISCOUNT_TYPES,
  GRADE_TYPES,
  DISCOUNT_TYPE_LABELS,
  GRADE_TYPE_LABELS,
  DEFAULT_DISCOUNT_TABLES,
  DEFAULT_CLASSIFICATIONS,
  type UpsertDiscountTableInput,
  type UpsertClassificationInput,
  type DiscountTableItem,
  type ClassificationItem,
  type DiscountBreakdown,
  type CalculateDiscountInput,
} from './grain-discounts.types';

// ─── Helpers ────────────────────────────────────────────────────────

function normalizeCrop(crop: string): string {
  return crop
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toDiscountItem(row: Record<string, unknown>): DiscountTableItem {
  const discountType = row.discountType as string;
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    crop: row.crop as string,
    discountType,
    discountTypeLabel: DISCOUNT_TYPE_LABELS[discountType] ?? discountType,
    thresholdPct: Number(row.thresholdPct),
    discountPctPerPoint: Number(row.discountPctPerPoint),
    maxPct: row.maxPct != null ? Number(row.maxPct) : null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toClassificationItem(row: Record<string, unknown>): ClassificationItem {
  const gradeType = row.gradeType as string;
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    crop: row.crop as string,
    gradeType,
    gradeTypeLabel: GRADE_TYPE_LABELS[gradeType] ?? gradeType,
    maxMoisturePct: Number(row.maxMoisturePct),
    maxImpurityPct: Number(row.maxImpurityPct),
    maxDamagedPct: Number(row.maxDamagedPct),
    maxBrokenPct: Number(row.maxBrokenPct),
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// CA1: DISCOUNT TABLES CRUD
// ═══════════════════════════════════════════════════════════════════

export async function listDiscountTables(
  ctx: RlsContext,
  crop?: string,
): Promise<{
  data: DiscountTableItem[];
  defaults: Record<
    string,
    Record<string, { thresholdPct: number; discountPctPerPoint: number; maxPct: number | null }>
  >;
}> {
  const where: Record<string, unknown> = { organizationId: ctx.organizationId };
  if (crop) {
    where.crop = normalizeCrop(crop);
  }

  return withRlsContext(ctx, async (tx) => {
    const rows = await tx.grainDiscountTable.findMany({
      where,
      orderBy: [{ crop: 'asc' }, { discountType: 'asc' }],
    });

    return {
      data: rows.map((r) => toDiscountItem(r as unknown as Record<string, unknown>)),
      defaults: DEFAULT_DISCOUNT_TABLES,
    };
  });
}

export async function upsertDiscountTable(
  ctx: RlsContext,
  input: UpsertDiscountTableInput,
): Promise<DiscountTableItem> {
  const crop = normalizeCrop(input.crop);
  if (!crop) {
    throw new GrainDiscountError('Cultura é obrigatória', 400);
  }
  if (!input.discountType || !(DISCOUNT_TYPES as readonly string[]).includes(input.discountType)) {
    throw new GrainDiscountError(
      `Tipo de desconto inválido. Use: ${DISCOUNT_TYPES.join(', ')}`,
      400,
    );
  }
  if (input.thresholdPct == null || input.thresholdPct < 0 || input.thresholdPct > 100) {
    throw new GrainDiscountError('Limite de tolerância deve estar entre 0 e 100%', 400);
  }
  if (
    input.discountPctPerPoint == null ||
    input.discountPctPerPoint < 0 ||
    input.discountPctPerPoint > 10
  ) {
    throw new GrainDiscountError('Desconto por ponto deve estar entre 0 e 10%', 400);
  }
  if (input.maxPct != null && (input.maxPct < 0 || input.maxPct > 100)) {
    throw new GrainDiscountError('Limite máximo deve estar entre 0 e 100%', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const row = await tx.grainDiscountTable.upsert({
      where: {
        organizationId_crop_discountType: {
          organizationId: ctx.organizationId,
          crop,
          discountType: input.discountType,
        },
      },
      create: {
        organizationId: ctx.organizationId,
        crop,
        discountType: input.discountType,
        thresholdPct: input.thresholdPct,
        discountPctPerPoint: input.discountPctPerPoint,
        maxPct: input.maxPct ?? null,
      },
      update: {
        thresholdPct: input.thresholdPct,
        discountPctPerPoint: input.discountPctPerPoint,
        maxPct: input.maxPct ?? null,
      },
    });

    return toDiscountItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteDiscountTable(ctx: RlsContext, tableId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.grainDiscountTable.findFirst({
      where: { id: tableId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!row) {
      throw new GrainDiscountError('Tabela de desconto não encontrada', 404);
    }
    await tx.grainDiscountTable.delete({ where: { id: tableId } });
  });
}

// ═══════════════════════════════════════════════════════════════════
// CA2+CA3: CLASSIFICATION CRUD
// ═══════════════════════════════════════════════════════════════════

export async function listClassifications(
  ctx: RlsContext,
  crop?: string,
): Promise<{
  data: ClassificationItem[];
  defaults: Record<
    string,
    Record<
      string,
      {
        maxMoisturePct: number;
        maxImpurityPct: number;
        maxDamagedPct: number;
        maxBrokenPct: number;
      }
    >
  >;
}> {
  const where: Record<string, unknown> = { organizationId: ctx.organizationId };
  if (crop) {
    where.crop = normalizeCrop(crop);
  }

  return withRlsContext(ctx, async (tx) => {
    const rows = await tx.grainClassification.findMany({
      where,
      orderBy: [{ crop: 'asc' }, { gradeType: 'asc' }],
    });

    return {
      data: rows.map((r) => toClassificationItem(r as unknown as Record<string, unknown>)),
      defaults: DEFAULT_CLASSIFICATIONS,
    };
  });
}

export async function upsertClassification(
  ctx: RlsContext,
  input: UpsertClassificationInput,
): Promise<ClassificationItem> {
  const crop = normalizeCrop(input.crop);
  if (!crop) {
    throw new GrainDiscountError('Cultura é obrigatória', 400);
  }
  if (!input.gradeType || !(GRADE_TYPES as readonly string[]).includes(input.gradeType)) {
    throw new GrainDiscountError(
      `Tipo de classificação inválido. Use: ${GRADE_TYPES.join(', ')}`,
      400,
    );
  }
  const pctFields = [
    { name: 'Umidade máxima', val: input.maxMoisturePct },
    { name: 'Impureza máxima', val: input.maxImpurityPct },
    { name: 'Avariados máximo', val: input.maxDamagedPct },
    { name: 'Quebrados máximo', val: input.maxBrokenPct },
  ];
  for (const f of pctFields) {
    if (f.val == null || f.val < 0 || f.val > 100) {
      throw new GrainDiscountError(`${f.name} deve estar entre 0 e 100%`, 400);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    const row = await tx.grainClassification.upsert({
      where: {
        organizationId_crop_gradeType: {
          organizationId: ctx.organizationId,
          crop,
          gradeType: input.gradeType,
        },
      },
      create: {
        organizationId: ctx.organizationId,
        crop,
        gradeType: input.gradeType,
        maxMoisturePct: input.maxMoisturePct,
        maxImpurityPct: input.maxImpurityPct,
        maxDamagedPct: input.maxDamagedPct,
        maxBrokenPct: input.maxBrokenPct,
      },
      update: {
        maxMoisturePct: input.maxMoisturePct,
        maxImpurityPct: input.maxImpurityPct,
        maxDamagedPct: input.maxDamagedPct,
        maxBrokenPct: input.maxBrokenPct,
      },
    });

    return toClassificationItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteClassification(
  ctx: RlsContext,
  classificationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.grainClassification.findFirst({
      where: { id: classificationId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!row) {
      throw new GrainDiscountError('Classificação não encontrada', 404);
    }
    await tx.grainClassification.delete({ where: { id: classificationId } });
  });
}

// ═══════════════════════════════════════════════════════════════════
// CA4: CALCULATE DISCOUNT BREAKDOWN
// ═══════════════════════════════════════════════════════════════════

/** Resolve discount table for a crop+type — org custom or ANEC default */
async function resolveDiscountParams(
  ctx: RlsContext,
  crop: string,
  discountType: string,
): Promise<{ thresholdPct: number; discountPctPerPoint: number; maxPct: number | null }> {
  const normalized = normalizeCrop(crop);

  return withRlsContext(ctx, async (tx) => {
    const custom = await tx.grainDiscountTable.findUnique({
      where: {
        organizationId_crop_discountType: {
          organizationId: ctx.organizationId,
          crop: normalized,
          discountType,
        },
      },
    });

    if (custom) {
      return {
        thresholdPct: Number(custom.thresholdPct),
        discountPctPerPoint: Number(custom.discountPctPerPoint),
        maxPct: custom.maxPct != null ? Number(custom.maxPct) : null,
      };
    }

    // Fallback to ANEC defaults
    const defaults = DEFAULT_DISCOUNT_TABLES[normalized];
    if (defaults && defaults[discountType as keyof typeof defaults]) {
      return defaults[discountType as keyof typeof defaults];
    }

    // Generic default
    return { thresholdPct: 14, discountPctPerPoint: 1.5, maxPct: null };
  });
}

/** Resolve classification for a crop — org custom or MAPA default */
async function resolveClassifications(
  ctx: RlsContext,
  crop: string,
): Promise<
  Array<{
    gradeType: string;
    maxMoisturePct: number;
    maxImpurityPct: number;
    maxDamagedPct: number;
    maxBrokenPct: number;
  }>
> {
  const normalized = normalizeCrop(crop);

  return withRlsContext(ctx, async (tx) => {
    const customs = await tx.grainClassification.findMany({
      where: { organizationId: ctx.organizationId, crop: normalized },
      orderBy: { gradeType: 'asc' },
    });

    if (customs.length > 0) {
      return customs.map((c) => ({
        gradeType: c.gradeType,
        maxMoisturePct: Number(c.maxMoisturePct),
        maxImpurityPct: Number(c.maxImpurityPct),
        maxDamagedPct: Number(c.maxDamagedPct),
        maxBrokenPct: Number(c.maxBrokenPct),
      }));
    }

    // Fallback to MAPA defaults
    const defaults = DEFAULT_CLASSIFICATIONS[normalized];
    if (defaults) {
      return GRADE_TYPES.filter((gt) => defaults[gt]).map((gt) => ({
        gradeType: gt,
        ...defaults[gt],
      }));
    }

    return [];
  });
}

function classifyGrain(
  moisturePct: number,
  impurityPct: number,
  damagedPct: number,
  brokenPct: number,
  classifications: Array<{
    gradeType: string;
    maxMoisturePct: number;
    maxImpurityPct: number;
    maxDamagedPct: number;
    maxBrokenPct: number;
  }>,
): string {
  // Order: TIPO_1 → TIPO_2 → TIPO_3 → FORA_DE_TIPO
  const ordered = [...classifications].sort((a, b) => a.gradeType.localeCompare(b.gradeType));

  for (const c of ordered) {
    if (
      moisturePct <= c.maxMoisturePct &&
      impurityPct <= c.maxImpurityPct &&
      damagedPct <= c.maxDamagedPct &&
      brokenPct <= c.maxBrokenPct
    ) {
      return c.gradeType;
    }
  }

  return 'FORA_DE_TIPO';
}

function computeDiscount(
  valuePct: number,
  thresholdPct: number,
  discountPctPerPoint: number,
  grossKg: number,
): { excessPoints: number; discountPct: number; discountKg: number } {
  const excessPoints = Math.max(0, Math.round((valuePct - thresholdPct) * 100) / 100);
  const discountPct = Math.round(excessPoints * discountPctPerPoint * 10000) / 10000;
  const discountKg = Math.round(grossKg * (discountPct / 100) * 100) / 100;
  return { excessPoints, discountPct, discountKg };
}

export async function calculateDiscount(
  ctx: RlsContext,
  input: CalculateDiscountInput,
): Promise<DiscountBreakdown> {
  const crop = normalizeCrop(input.crop);
  if (!crop) {
    throw new GrainDiscountError('Cultura é obrigatória', 400);
  }
  if (input.grossProductionKg == null || input.grossProductionKg <= 0) {
    throw new GrainDiscountError('Produção bruta deve ser maior que zero', 400);
  }
  if (input.moisturePct == null || input.moisturePct < 0 || input.moisturePct > 100) {
    throw new GrainDiscountError('Umidade deve estar entre 0 e 100%', 400);
  }
  if (input.impurityPct == null || input.impurityPct < 0 || input.impurityPct > 100) {
    throw new GrainDiscountError('Impureza deve estar entre 0 e 100%', 400);
  }

  const damagedPct = input.damagedPct ?? 0;
  const brokenPct = input.brokenPct ?? 0;
  const grossKg = input.grossProductionKg;

  // Resolve org-specific or default tables
  const [moistureParams, impurityParams, damagedParams, classifications] = await Promise.all([
    resolveDiscountParams(ctx, crop, 'MOISTURE'),
    resolveDiscountParams(ctx, crop, 'IMPURITY'),
    resolveDiscountParams(ctx, crop, 'DAMAGED'),
    resolveClassifications(ctx, crop),
  ]);

  // Calculate individual discounts
  const moistureDiscount = computeDiscount(
    input.moisturePct,
    moistureParams.thresholdPct,
    moistureParams.discountPctPerPoint,
    grossKg,
  );
  const impurityDiscount = computeDiscount(
    input.impurityPct,
    impurityParams.thresholdPct,
    impurityParams.discountPctPerPoint,
    grossKg,
  );
  const damagedDiscount = computeDiscount(
    damagedPct,
    damagedParams.thresholdPct,
    damagedParams.discountPctPerPoint,
    grossKg,
  );

  const totalDiscountKg =
    Math.round(
      (moistureDiscount.discountKg + impurityDiscount.discountKg + damagedDiscount.discountKg) *
        100,
    ) / 100;
  const totalDiscountPct = grossKg > 0 ? Math.round((totalDiscountKg / grossKg) * 10000) / 100 : 0;
  const netProductionKg = Math.round((grossKg - totalDiscountKg) * 100) / 100;

  // Classify
  const classification = classifyGrain(
    input.moisturePct,
    input.impurityPct,
    damagedPct,
    brokenPct,
    classifications,
  );

  // Warnings
  const warnings: string[] = [];
  if (moistureParams.maxPct != null && input.moisturePct > moistureParams.maxPct) {
    warnings.push(
      `Umidade ${input.moisturePct}% excede limite máximo de ${moistureParams.maxPct}%`,
    );
  }
  if (impurityParams.maxPct != null && input.impurityPct > impurityParams.maxPct) {
    warnings.push(
      `Impureza ${input.impurityPct}% excede limite máximo de ${impurityParams.maxPct}%`,
    );
  }
  if (damagedParams.maxPct != null && damagedPct > damagedParams.maxPct) {
    warnings.push(`Avariados ${damagedPct}% excede limite máximo de ${damagedParams.maxPct}%`);
  }
  if (classification === 'FORA_DE_TIPO') {
    warnings.push('Lote classificado como Fora de Tipo — verificar padrões de qualidade');
  }

  return {
    crop,
    grossProductionKg: grossKg,
    moisturePct: input.moisturePct,
    impurityPct: input.impurityPct,
    damagedPct,
    brokenPct,
    moistureDiscount: {
      thresholdPct: moistureParams.thresholdPct,
      ...moistureDiscount,
      discountPctPerPoint: moistureParams.discountPctPerPoint,
    },
    impurityDiscount: {
      thresholdPct: impurityParams.thresholdPct,
      ...impurityDiscount,
      discountPctPerPoint: impurityParams.discountPctPerPoint,
    },
    damagedDiscount: {
      thresholdPct: damagedParams.thresholdPct,
      ...damagedDiscount,
      discountPctPerPoint: damagedParams.discountPctPerPoint,
    },
    totalDiscountPct,
    totalDiscountKg,
    netProductionKg,
    classification,
    classificationLabel: GRADE_TYPE_LABELS[classification] ?? classification,
    warnings,
  };
}
