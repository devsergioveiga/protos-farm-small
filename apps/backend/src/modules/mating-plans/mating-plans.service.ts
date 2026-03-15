import { randomUUID } from 'node:crypto';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  MatingPlanError,
  MATING_PLAN_STATUS_LABELS,
  MATING_PAIR_STATUS_LABELS,
  isValidMatingPlanStatus,
  isValidMatingPairStatus,
  type CreatePlanInput,
  type UpdatePlanInput,
  type AddPairInput,
  type UpdatePairInput,
  type ListPlansQuery,
  type MatingPlanItem,
  type MatingPlanDetail,
  type MatingPairItem,
  type AdherenceReport,
  type ImportPairsResult,
  type MatingPlanStatusValue,
  type MatingPairStatusValue,
} from './mating-plans.types';
import { parseMatingPlanFile } from './mating-plan-csv-parser';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toPlanItem(row: any): MatingPlanItem {
  const status = row.status as MatingPlanStatusValue;
  return {
    id: row.id,
    organizationId: row.organizationId,
    farmId: row.farmId,
    name: row.name,
    season: row.season ?? null,
    objective: row.objective ?? null,
    status,
    statusLabel: MATING_PLAN_STATUS_LABELS[status] ?? status,
    startDate: row.startDate ? (row.startDate as Date).toISOString().slice(0, 10) : null,
    endDate: row.endDate ? (row.endDate as Date).toISOString().slice(0, 10) : null,
    notes: row.notes ?? null,
    createdBy: row.createdBy,
    creatorName: row.creator?.name ?? null,
    pairsCount: row._count?.pairs ?? row.pairs?.length ?? 0,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toPairItem(row: any): MatingPairItem {
  const status = row.status as MatingPairStatusValue;
  return {
    id: row.id,
    planId: row.planId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    primaryBullId: row.primaryBullId ?? null,
    primaryBullName: row.primaryBull?.name ?? null,
    secondaryBullId: row.secondaryBullId ?? null,
    secondaryBullName: row.secondaryBull?.name ?? null,
    tertiaryBullId: row.tertiaryBullId ?? null,
    tertiaryBullName: row.tertiaryBull?.name ?? null,
    status,
    statusLabel: MATING_PAIR_STATUS_LABELS[status] ?? status,
    executedBullId: row.executedBullId ?? null,
    executedBullName: row.executedBull?.name ?? null,
    executionDate: row.executionDate
      ? (row.executionDate as Date).toISOString().slice(0, 10)
      : null,
    substitutionReason: row.substitutionReason ?? null,
    notes: row.notes ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

const PAIR_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  primaryBull: { select: { name: true } },
  secondaryBull: { select: { name: true } },
  tertiaryBull: { select: { name: true } },
  executedBull: { select: { name: true } },
};

// ─── CREATE PLAN (CA1) ─────────────────────────────────────────────

export async function createPlan(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreatePlanInput,
): Promise<MatingPlanItem> {
  if (!input.name?.trim()) {
    throw new MatingPlanError('Nome do plano é obrigatório', 400);
  }
  if (input.status && !isValidMatingPlanStatus(input.status)) {
    throw new MatingPlanError('Status inválido', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).matingPlan.create({
      data: {
        id: randomUUID(),
        organizationId: ctx.organizationId,
        farmId,
        name: input.name.trim(),
        season: input.season ?? null,
        objective: input.objective ?? null,
        status: input.status ?? 'DRAFT',
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        notes: input.notes ?? null,
        createdBy: userId,
      },
      include: {
        creator: { select: { name: true } },
        _count: { select: { pairs: true } },
      },
    });

    return toPlanItem(row);
  });
}

// ─── LIST PLANS (CA1) ──────────────────────────────────────────────

export async function listPlans(
  ctx: RlsContext,
  farmId: string,
  query: ListPlansQuery,
): Promise<{ data: MatingPlanItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.status && isValidMatingPlanStatus(query.status)) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { season: { contains: query.search, mode: 'insensitive' } },
        { objective: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).matingPlan.findMany({
        where,
        include: {
          creator: { select: { name: true } },
          _count: { select: { pairs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).matingPlan.count({ where }),
    ]);

    return {
      data: rows.map(toPlanItem),
      total,
    };
  });
}

// ─── GET PLAN (with pairs) ─────────────────────────────────────────

export async function getPlan(
  ctx: RlsContext,
  farmId: string,
  planId: string,
): Promise<MatingPlanDetail> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).matingPlan.findFirst({
      where: { id: planId, farmId },
      include: {
        creator: { select: { name: true } },
        pairs: {
          include: PAIR_INCLUDE,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!row) {
      throw new MatingPlanError('Plano de acasalamento não encontrado', 404);
    }

    const item = toPlanItem(row);
    return {
      ...item,
      pairsCount: row.pairs.length,
      pairs: row.pairs.map(toPairItem),
    };
  });
}

// ─── UPDATE PLAN ───────────────────────────────────────────────────

export async function updatePlan(
  ctx: RlsContext,
  farmId: string,
  planId: string,
  input: UpdatePlanInput,
): Promise<MatingPlanItem> {
  if (input.status && !isValidMatingPlanStatus(input.status)) {
    throw new MatingPlanError('Status inválido', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).matingPlan.findFirst({
      where: { id: planId, farmId },
    });
    if (!existing) {
      throw new MatingPlanError('Plano de acasalamento não encontrado', 404);
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.season !== undefined) data.season = input.season;
    if (input.objective !== undefined) data.objective = input.objective;
    if (input.status !== undefined) data.status = input.status;
    if (input.startDate !== undefined) {
      data.startDate = input.startDate ? new Date(input.startDate) : null;
    }
    if (input.endDate !== undefined) {
      data.endDate = input.endDate ? new Date(input.endDate) : null;
    }
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).matingPlan.update({
      where: { id: planId },
      data,
      include: {
        creator: { select: { name: true } },
        _count: { select: { pairs: true } },
      },
    });

    return toPlanItem(row);
  });
}

// ─── DELETE PLAN ───────────────────────────────────────────────────

export async function deletePlan(ctx: RlsContext, farmId: string, planId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).matingPlan.findFirst({
      where: { id: planId, farmId },
    });
    if (!existing) {
      throw new MatingPlanError('Plano de acasalamento não encontrado', 404);
    }

    await (tx as any).matingPlan.delete({
      where: { id: planId },
    });
  });
}

// ─── ADD PAIRS (CA2) ──────────────────────────────────────────────

export async function addPairs(
  ctx: RlsContext,
  farmId: string,
  planId: string,
  pairs: AddPairInput[],
): Promise<MatingPairItem[]> {
  if (!pairs || pairs.length === 0) {
    throw new MatingPlanError('Pelo menos um par deve ser informado', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate plan exists
    const plan = await (tx as any).matingPlan.findFirst({
      where: { id: planId, farmId },
      select: { id: true },
    });
    if (!plan) {
      throw new MatingPlanError('Plano de acasalamento não encontrado', 404);
    }

    const created: MatingPairItem[] = [];

    for (const pair of pairs) {
      if (!pair.animalId) {
        throw new MatingPlanError('ID do animal é obrigatório para cada par', 400);
      }

      // Validate animal exists
      const animal = await (tx as any).animal.findFirst({
        where: { id: pair.animalId, farmId, deletedAt: null },
        select: { id: true, earTag: true },
      });
      if (!animal) {
        throw new MatingPlanError(`Animal ${pair.animalId} não encontrado na fazenda`, 404);
      }

      // Validate bulls if provided
      if (pair.primaryBullId) {
        const bull = await (tx as any).bull.findFirst({
          where: { id: pair.primaryBullId, farmId, deletedAt: null },
          select: { id: true },
        });
        if (!bull) {
          throw new MatingPlanError('Touro primário não encontrado', 404);
        }
      }
      if (pair.secondaryBullId) {
        const bull = await (tx as any).bull.findFirst({
          where: { id: pair.secondaryBullId, farmId, deletedAt: null },
          select: { id: true },
        });
        if (!bull) {
          throw new MatingPlanError('Touro secundário não encontrado', 404);
        }
      }
      if (pair.tertiaryBullId) {
        const bull = await (tx as any).bull.findFirst({
          where: { id: pair.tertiaryBullId, farmId, deletedAt: null },
          select: { id: true },
        });
        if (!bull) {
          throw new MatingPlanError('Touro terciário não encontrado', 404);
        }
      }

      const row = await (tx as any).matingPair.create({
        data: {
          id: randomUUID(),
          planId,
          animalId: pair.animalId,
          primaryBullId: pair.primaryBullId ?? null,
          secondaryBullId: pair.secondaryBullId ?? null,
          tertiaryBullId: pair.tertiaryBullId ?? null,
          notes: pair.notes ?? null,
        },
        include: PAIR_INCLUDE,
      });

      created.push(toPairItem(row));
    }

    return created;
  });
}

// ─── UPDATE PAIR (CA6) ─────────────────────────────────────────────

export async function updatePair(
  ctx: RlsContext,
  pairId: string,
  input: UpdatePairInput,
): Promise<MatingPairItem> {
  if (input.status && !isValidMatingPairStatus(input.status)) {
    throw new MatingPlanError('Status inválido', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).matingPair.findFirst({
      where: { id: pairId },
      include: { plan: { select: { id: true } } },
    });
    if (!existing) {
      throw new MatingPlanError('Par de acasalamento não encontrado', 404);
    }

    const data: any = {};
    if (input.primaryBullId !== undefined) data.primaryBullId = input.primaryBullId;
    if (input.secondaryBullId !== undefined) data.secondaryBullId = input.secondaryBullId;
    if (input.tertiaryBullId !== undefined) data.tertiaryBullId = input.tertiaryBullId;
    if (input.status !== undefined) data.status = input.status;
    if (input.executedBullId !== undefined) data.executedBullId = input.executedBullId;
    if (input.executionDate !== undefined) {
      data.executionDate = input.executionDate ? new Date(input.executionDate) : null;
    }
    if (input.substitutionReason !== undefined) data.substitutionReason = input.substitutionReason;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).matingPair.update({
      where: { id: pairId },
      data,
      include: PAIR_INCLUDE,
    });

    return toPairItem(row);
  });
}

// ─── REMOVE PAIR ───────────────────────────────────────────────────

export async function removePair(ctx: RlsContext, pairId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).matingPair.findFirst({
      where: { id: pairId },
    });
    if (!existing) {
      throw new MatingPlanError('Par de acasalamento não encontrado', 404);
    }

    await (tx as any).matingPair.delete({
      where: { id: pairId },
    });
  });
}

// ─── ADHERENCE REPORT (CA8) ────────────────────────────────────────

export async function getAdherenceReport(
  ctx: RlsContext,
  farmId: string,
  planId: string,
): Promise<AdherenceReport> {
  return withRlsContext(ctx, async (tx) => {
    const plan = await (tx as any).matingPlan.findFirst({
      where: { id: planId, farmId },
      select: { id: true, name: true },
    });
    if (!plan) {
      throw new MatingPlanError('Plano de acasalamento não encontrado', 404);
    }

    const pairs = await (tx as any).matingPair.findMany({
      where: { planId },
      select: {
        status: true,
        primaryBullId: true,
        executedBullId: true,
      },
    });

    const totalPairs = pairs.length;
    const executedPairs = pairs.filter(
      (p: any) => p.status === 'EXECUTED' || p.status === 'CONFIRMED_PREGNANT',
    ).length;
    const followedPlan = pairs.filter(
      (p: any) =>
        (p.status === 'EXECUTED' || p.status === 'CONFIRMED_PREGNANT') &&
        p.executedBullId &&
        p.executedBullId === p.primaryBullId,
    ).length;
    const substituted = executedPairs - followedPlan;
    const adherenceRate =
      executedPairs > 0 ? Math.round((followedPlan / executedPairs) * 10000) / 100 : 0;
    const pending = pairs.filter((p: any) => p.status === 'PLANNED').length;
    const cancelled = pairs.filter((p: any) => p.status === 'CANCELLED').length;
    const confirmedPregnant = pairs.filter((p: any) => p.status === 'CONFIRMED_PREGNANT').length;
    const empty = pairs.filter((p: any) => p.status === 'EMPTY').length;

    return {
      planId,
      planName: plan.name,
      totalPairs,
      executedPairs,
      followedPlan,
      substituted,
      adherenceRate,
      pending,
      cancelled,
      confirmedPregnant,
      empty,
    };
  });
}

// ─── IMPORT PAIRS CSV (CA9) ────────────────────────────────────────

export async function importPairsCsv(
  ctx: RlsContext,
  farmId: string,
  planId: string,
  file: Express.Multer.File,
): Promise<ImportPairsResult> {
  const parsed = await parseMatingPlanFile(file.buffer, file.originalname);

  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    throw new MatingPlanError(`Erro ao processar arquivo: ${parsed.errors.join('; ')}`, 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate plan exists
    const plan = await (tx as any).matingPlan.findFirst({
      where: { id: planId, farmId },
      select: { id: true },
    });
    if (!plan) {
      throw new MatingPlanError('Plano de acasalamento não encontrado', 404);
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [...parsed.errors];

    for (const row of parsed.rows) {
      // Find animal by earTag
      const animal = await (tx as any).animal.findFirst({
        where: { farmId, earTag: row.earTag, deletedAt: null },
        select: { id: true },
      });
      if (!animal) {
        errors.push(`Linha ${row.index + 1}: Animal com brinco "${row.earTag}" não encontrado`);
        skipped++;
        continue;
      }

      // Find bulls by name
      let primaryBullId: string | null = null;
      let secondaryBullId: string | null = null;
      let tertiaryBullId: string | null = null;

      if (row.primaryBullName) {
        const bull = await (tx as any).bull.findFirst({
          where: { farmId, name: row.primaryBullName, deletedAt: null },
          select: { id: true },
        });
        if (bull) {
          primaryBullId = bull.id;
        } else {
          errors.push(
            `Linha ${row.index + 1}: Touro primário "${row.primaryBullName}" não encontrado`,
          );
        }
      }

      if (row.secondaryBullName) {
        const bull = await (tx as any).bull.findFirst({
          where: { farmId, name: row.secondaryBullName, deletedAt: null },
          select: { id: true },
        });
        if (bull) {
          secondaryBullId = bull.id;
        } else {
          errors.push(
            `Linha ${row.index + 1}: Touro secundário "${row.secondaryBullName}" não encontrado`,
          );
        }
      }

      if (row.tertiaryBullName) {
        const bull = await (tx as any).bull.findFirst({
          where: { farmId, name: row.tertiaryBullName, deletedAt: null },
          select: { id: true },
        });
        if (bull) {
          tertiaryBullId = bull.id;
        } else {
          errors.push(
            `Linha ${row.index + 1}: Touro terciário "${row.tertiaryBullName}" não encontrado`,
          );
        }
      }

      await (tx as any).matingPair.create({
        data: {
          id: randomUUID(),
          planId,
          animalId: animal.id,
          primaryBullId,
          secondaryBullId,
          tertiaryBullId,
        },
      });

      imported++;
    }

    return { imported, skipped, errors };
  });
}

// ─── EXPORT PLAN CSV (CA10) ────────────────────────────────────────

export async function exportPlanCsv(
  ctx: RlsContext,
  farmId: string,
  planId: string,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const plan = await (tx as any).matingPlan.findFirst({
      where: { id: planId, farmId },
      include: {
        pairs: {
          include: PAIR_INCLUDE,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!plan) {
      throw new MatingPlanError('Plano de acasalamento não encontrado', 404);
    }

    const BOM = '\uFEFF';
    const lines: string[] = [];

    lines.push(
      'Brinco;Nome Animal;Touro 1ª Opção;Touro 2ª Opção;Touro 3ª Opção;Status;Touro Executado;Data Execução;Motivo Substituição',
    );

    for (const pair of plan.pairs) {
      const status = MATING_PAIR_STATUS_LABELS[pair.status as MatingPairStatusValue] ?? pair.status;
      const executionDate = pair.executionDate
        ? (pair.executionDate as Date).toISOString().slice(0, 10)
        : '';

      lines.push(
        [
          pair.animal?.earTag ?? '',
          pair.animal?.name ?? '',
          pair.primaryBull?.name ?? '',
          pair.secondaryBull?.name ?? '',
          pair.tertiaryBull?.name ?? '',
          status,
          pair.executedBull?.name ?? '',
          executionDate,
          pair.substitutionReason ?? '',
        ].join(';'),
      );
    }

    return BOM + lines.join('\n');
  });
}
