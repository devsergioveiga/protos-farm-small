import { withRlsContext, type RlsContext } from '../../database/rls';
import { GrainHarvestError, STANDARD_MOISTURE } from './grain-harvests.types';

// ─── Types ──────────────────────────────────────────────────────────

export interface MoistureStandardItem {
  id: string;
  organizationId: string;
  crop: string;
  moisturePct: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertMoistureStandardInput {
  crop: string;
  moisturePct: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

function normalizeCrop(crop: string): string {
  return crop
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toItem(row: Record<string, unknown>): MoistureStandardItem {
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    crop: row.crop as string,
    moisturePct: Number(row.moisturePct),
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listMoistureStandards(
  ctx: RlsContext,
): Promise<{ data: MoistureStandardItem[]; defaults: Record<string, number> }> {
  return withRlsContext(ctx, async (tx) => {
    const rows = await tx.moistureStandard.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { crop: 'asc' },
    });

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      defaults: { ...STANDARD_MOISTURE },
    };
  });
}

// ─── UPSERT ─────────────────────────────────────────────────────────

export async function upsertMoistureStandard(
  ctx: RlsContext,
  input: UpsertMoistureStandardInput,
): Promise<MoistureStandardItem> {
  const crop = normalizeCrop(input.crop);
  if (!crop) {
    throw new GrainHarvestError('Cultura é obrigatória', 400);
  }
  if (input.moisturePct == null || input.moisturePct < 0 || input.moisturePct > 50) {
    throw new GrainHarvestError('Umidade padrão deve estar entre 0 e 50%', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const row = await tx.moistureStandard.upsert({
      where: {
        organizationId_crop: {
          organizationId: ctx.organizationId,
          crop,
        },
      },
      create: {
        organizationId: ctx.organizationId,
        crop,
        moisturePct: input.moisturePct,
      },
      update: {
        moisturePct: input.moisturePct,
      },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteMoistureStandard(ctx: RlsContext, standardId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.moistureStandard.findFirst({
      where: { id: standardId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!row) {
      throw new GrainHarvestError('Padrão de umidade não encontrado', 404);
    }
    await tx.moistureStandard.delete({ where: { id: standardId } });
  });
}

// ─── RESOLVE (used by grain harvest service) ────────────────────────

export async function resolveStandardMoisture(ctx: RlsContext, crop: string): Promise<number> {
  const normalized = normalizeCrop(crop);

  return withRlsContext(ctx, async (tx) => {
    const custom = await tx.moistureStandard.findUnique({
      where: {
        organizationId_crop: {
          organizationId: ctx.organizationId,
          crop: normalized,
        },
      },
      select: { moisturePct: true },
    });

    if (custom) {
      return Number(custom.moisturePct);
    }

    return STANDARD_MOISTURE[normalized] ?? 13;
  });
}
