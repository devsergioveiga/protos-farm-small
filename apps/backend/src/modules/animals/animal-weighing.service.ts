import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  AnimalWeighingError,
  type CreateWeighingInput,
  type UpdateWeighingInput,
  type WeighingItem,
  type FarmWeighingItem,
  type ListFarmWeighingsQuery,
  type WeighingStats,
} from './animal-weighing.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateWeighingInput(input: CreateWeighingInput | UpdateWeighingInput): void {
  if ('weightKg' in input && input.weightKg !== undefined) {
    if (typeof input.weightKg !== 'number' || input.weightKg <= 0 || input.weightKg > 9999) {
      throw new AnimalWeighingError('Peso deve ser um número entre 0.01 e 9999 kg', 400);
    }
  }
  if ('measuredAt' in input && input.measuredAt !== undefined) {
    const date = new Date(input.measuredAt);
    if (isNaN(date.getTime())) {
      throw new AnimalWeighingError('Data de pesagem inválida', 400);
    }
    if (date > new Date()) {
      throw new AnimalWeighingError('Data de pesagem não pode ser no futuro', 400);
    }
  }
  if ('bodyConditionScore' in input && input.bodyConditionScore != null) {
    const bcs = input.bodyConditionScore;
    if (!Number.isInteger(bcs) || bcs < 1 || bcs > 5) {
      throw new AnimalWeighingError('Escore de condição corporal deve ser entre 1 e 5', 400);
    }
  }
}

function toWeighingItem(row: Record<string, unknown>): WeighingItem {
  return {
    id: row.id as string,
    animalId: row.animalId as string,
    farmId: row.farmId as string,
    weightKg: Number(row.weightKg),
    measuredAt: (row.measuredAt as Date).toISOString().slice(0, 10),
    bodyConditionScore: (row.bodyConditionScore as number) ?? null,
    notes: (row.notes as string) ?? null,
    recordedBy: row.recordedBy as string,
    recorderName: ((row as Record<string, unknown>).recorder as { name: string })?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// ─── CRUD ───────────────────────────────────────────────────────────

export async function listWeighings(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<WeighingItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new AnimalWeighingError('Animal não encontrado', 404);
    }

    const rows = await tx.animalWeighing.findMany({
      where: { animalId, farmId },
      orderBy: { measuredAt: 'desc' },
      include: { recorder: { select: { name: true } } },
    });

    return rows.map((r) => toWeighingItem(r as unknown as Record<string, unknown>));
  });
}

export async function createWeighing(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  userId: string,
  input: CreateWeighingInput,
): Promise<WeighingItem> {
  validateWeighingInput(input);

  if (!input.weightKg || !input.measuredAt) {
    throw new AnimalWeighingError('Peso e data de pesagem são obrigatórios', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new AnimalWeighingError('Animal não encontrado', 404);
    }

    const row = await tx.animalWeighing.create({
      data: {
        animalId,
        farmId,
        weightKg: input.weightKg,
        measuredAt: new Date(input.measuredAt),
        bodyConditionScore: input.bodyConditionScore ?? null,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: { recorder: { select: { name: true } } },
    });

    return toWeighingItem(row as unknown as Record<string, unknown>);
  });
}

export async function updateWeighing(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  weighingId: string,
  input: UpdateWeighingInput,
): Promise<WeighingItem> {
  validateWeighingInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalWeighing.findFirst({
      where: { id: weighingId, animalId, farmId },
    });
    if (!existing) {
      throw new AnimalWeighingError('Pesagem não encontrada', 404);
    }

    const data: Record<string, unknown> = {};
    if (input.weightKg !== undefined) data.weightKg = input.weightKg;
    if (input.measuredAt !== undefined) data.measuredAt = new Date(input.measuredAt);
    if (input.bodyConditionScore !== undefined) data.bodyConditionScore = input.bodyConditionScore;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await tx.animalWeighing.update({
      where: { id: weighingId },
      data: data as never,
      include: { recorder: { select: { name: true } } },
    });

    return toWeighingItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteWeighing(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  weighingId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalWeighing.findFirst({
      where: { id: weighingId, animalId, farmId },
    });
    if (!existing) {
      throw new AnimalWeighingError('Pesagem não encontrada', 404);
    }

    await tx.animalWeighing.delete({ where: { id: weighingId } });
  });
}

// ─── Stats ──────────────────────────────────────────────────────────

export async function getWeighingStats(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<WeighingStats> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true, entryWeightKg: true },
    });
    if (!animal) {
      throw new AnimalWeighingError('Animal não encontrado', 404);
    }

    const weighings = await tx.animalWeighing.findMany({
      where: { animalId, farmId },
      orderBy: { measuredAt: 'asc' },
      select: { weightKg: true, measuredAt: true },
    });

    const totalWeighings = weighings.length;

    if (totalWeighings === 0) {
      return {
        currentWeightKg: null,
        entryWeightKg: animal.entryWeightKg ? Number(animal.entryWeightKg) : null,
        totalGainKg: null,
        gmdKgDay: null,
        minWeightKg: null,
        maxWeightKg: null,
        totalWeighings: 0,
      };
    }

    const weights = weighings.map((w) => Number(w.weightKg));
    const currentWeightKg = weights[weights.length - 1];
    const entryWeightKg = animal.entryWeightKg ? Number(animal.entryWeightKg) : null;

    const minWeightKg = Math.min(...weights);
    const maxWeightKg = Math.max(...weights);

    // GMD: ganho médio diário = (último peso - primeiro peso) / dias
    const firstWeighing = weighings[0];
    const lastWeighing = weighings[weighings.length - 1];
    const firstWeight = Number(firstWeighing.weightKg);
    const lastWeight = Number(lastWeighing.weightKg);
    const daysDiff =
      (new Date(lastWeighing.measuredAt).getTime() - new Date(firstWeighing.measuredAt).getTime()) /
      (1000 * 60 * 60 * 24);

    const gmdKgDay =
      daysDiff > 0 ? Math.round(((lastWeight - firstWeight) / daysDiff) * 1000) / 1000 : null;

    const totalGainKg =
      entryWeightKg != null
        ? Math.round((currentWeightKg - entryWeightKg) * 100) / 100
        : Math.round((lastWeight - firstWeight) * 100) / 100;

    return {
      currentWeightKg: Math.round(currentWeightKg * 100) / 100,
      entryWeightKg,
      totalGainKg,
      gmdKgDay,
      minWeightKg: Math.round(minWeightKg * 100) / 100,
      maxWeightKg: Math.round(maxWeightKg * 100) / 100,
      totalWeighings,
    };
  });
}

// ─── Farm-level listing ─────────────────────────────────────────────

export async function listFarmWeighings(
  ctx: RlsContext,
  farmId: string,
  query: ListFarmWeighingsQuery,
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 30));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: Record<string, unknown> = { farmId };

    // Date range filter
    const measuredAtFilter: Record<string, unknown> = {};
    if (query.dateFrom) {
      measuredAtFilter.gte = new Date(query.dateFrom);
    }
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setDate(end.getDate() + 1);
      measuredAtFilter.lt = end;
    }
    if (Object.keys(measuredAtFilter).length > 0) {
      where.measuredAt = measuredAtFilter;
    }

    // Animal-level filters (search by earTag/name, filter by lotId)
    const animalFilter: Record<string, unknown> = { deletedAt: null };
    if (query.search) {
      animalFilter.OR = [
        { earTag: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.lotId) {
      animalFilter.lotId = query.lotId;
    }
    if (Object.keys(animalFilter).length > 1) {
      where.animal = animalFilter;
    }

    // Build orderBy
    const ALLOWED_SORT_FIELDS = new Set([
      'measuredAt', 'earTag', 'animalName', 'weightKg', 'bodyConditionScore', 'recorderName',
    ]);
    const sortField =
      query.sortBy && ALLOWED_SORT_FIELDS.has(query.sortBy)
        ? query.sortBy
        : 'measuredAt';
    const sortDir = query.sortOrder === 'asc' ? 'asc' as const : 'desc' as const;

    function buildOrderBy() {
      switch (sortField) {
        case 'earTag':
          return { animal: { earTag: sortDir } };
        case 'animalName':
          return { animal: { name: sortDir } };
        case 'recorderName':
          return { recorder: { name: sortDir } };
        case 'weightKg':
          return { weightKg: sortDir };
        case 'bodyConditionScore':
          return { bodyConditionScore: sortDir };
        case 'measuredAt':
        default:
          return { measuredAt: sortDir };
      }
    }

    const [rows, total] = await Promise.all([
      tx.animalWeighing.findMany({
        where: where as never,
        skip,
        take: limit,
        orderBy: buildOrderBy(),
        include: {
          animal: { select: { earTag: true, name: true, lotId: true } },
          recorder: { select: { name: true } },
        },
      }),
      tx.animalWeighing.count({ where: where as never }),
    ]);

    const data: FarmWeighingItem[] = rows.map((r) => ({
      id: r.id,
      animalId: r.animalId,
      earTag: r.animal.earTag,
      animalName: r.animal.name,
      weightKg: Number(r.weightKg),
      measuredAt: r.measuredAt.toISOString().slice(0, 10),
      bodyConditionScore: r.bodyConditionScore,
      notes: r.notes,
      recorderName: r.recorder.name,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

// ─── CSV Export ──────────────────────────────────────────────────────

export async function exportWeighingsCsv(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true, earTag: true, name: true },
    });
    if (!animal) {
      throw new AnimalWeighingError('Animal não encontrado', 404);
    }

    const weighings = await tx.animalWeighing.findMany({
      where: { animalId, farmId },
      orderBy: { measuredAt: 'asc' },
      include: { recorder: { select: { name: true } } },
    });

    const BOM = '\uFEFF';
    const lines: string[] = [];

    lines.push(`PESAGENS — ${animal.earTag}${animal.name ? ` (${animal.name})` : ''}`);
    lines.push('Data;Peso (kg);ECC;Registrado por;Observações');

    for (const w of weighings) {
      const date = new Date(w.measuredAt).toLocaleDateString('pt-BR');
      const weight = Number(w.weightKg).toFixed(2).replace('.', ',');
      lines.push(
        [date, weight, w.bodyConditionScore ?? '', w.recorder.name, w.notes ?? ''].join(';'),
      );
    }

    return BOM + lines.join('\n');
  });
}
