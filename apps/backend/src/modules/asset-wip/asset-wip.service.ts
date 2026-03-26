import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import Decimal from 'decimal.js';
import {
  WipError,
  type AddContributionInput,
  type ActivateWipInput,
  type CreateStageInput,
  type CompleteStageInput,
} from './asset-wip.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxAny = any;

export async function addContribution(
  ctx: RlsContext,
  assetId: string,
  input: AddContributionInput,
) {
  return prisma.$transaction(async (tx) => {
    const txAny = tx as TxAny;

    const asset = await txAny.asset.findFirst({
      where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, status: true, wipBudget: true, wipBudgetAlertPct: true },
    });

    if (!asset || asset.status !== 'EM_ANDAMENTO') {
      throw new WipError('Apenas ativos em andamento aceitam aportes', 400);
    }

    const contribution = await txAny.assetWipContribution.create({
      data: {
        organizationId: ctx.organizationId,
        assetId,
        contributionDate: new Date(input.contributionDate),
        amount: new Decimal(String(input.amount)),
        description: input.description,
        stageId: input.stageId ?? null,
        supplierId: input.supplierId ?? null,
        invoiceRef: input.invoiceRef ?? null,
        notes: input.notes ?? null,
      },
    });

    const agg = await txAny.assetWipContribution.aggregate({
      where: { assetId, organizationId: ctx.organizationId },
      _sum: { amount: true },
    });

    const totalContributed = Number(agg._sum.amount ?? 0);
    const budget = asset.wipBudget ? Number(asset.wipBudget) : null;
    const alertPct = asset.wipBudgetAlertPct ? Number(asset.wipBudgetAlertPct) : 90;
    const budgetAlert = budget !== null && totalContributed / budget >= alertPct / 100;
    const budgetExceeded = budget !== null && totalContributed > budget;

    return { contribution, totalContributed, budgetAlert, budgetExceeded };
  });
}

export async function getWipSummary(ctx: RlsContext, assetId: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      assetTag: true,
      status: true,
      wipBudget: true,
      wipBudgetAlertPct: true,
    },
  });

  if (!asset || asset.status !== 'EM_ANDAMENTO') {
    throw new WipError('Ativo em andamento nao encontrado', 400);
  }

  const [agg, contributions, stages] = await Promise.all([
    prisma.assetWipContribution.aggregate({
      where: { assetId, organizationId: ctx.organizationId },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.assetWipContribution.findMany({
      where: { assetId, organizationId: ctx.organizationId },
      orderBy: { contributionDate: 'desc' },
    }),
    prisma.assetWipStage.findMany({
      where: { assetId, organizationId: ctx.organizationId },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  const totalContributed = Number(agg._sum.amount ?? 0);
  const contributionCount = agg._count;
  const budget = asset.wipBudget ? Number(asset.wipBudget) : null;
  const alertPct = asset.wipBudgetAlertPct ? Number(asset.wipBudgetAlertPct) : 90;
  const budgetAlert = budget !== null && totalContributed / budget >= alertPct / 100;
  const budgetExceeded = budget !== null && totalContributed > budget;

  return {
    assetId: asset.id,
    assetName: asset.name,
    assetTag: asset.assetTag,
    status: asset.status,
    budget,
    budgetAlertPct: alertPct,
    totalContributed,
    contributionCount,
    budgetAlert,
    budgetExceeded,
    stages,
    contributions,
  };
}

export async function activateWipAsset(
  ctx: RlsContext,
  assetId: string,
  input: ActivateWipInput,
) {
  return prisma.$transaction(async (tx) => {
    const txAny = tx as TxAny;

    const asset = await txAny.asset.findFirst({
      where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!asset || asset.status !== 'EM_ANDAMENTO') {
      throw new WipError('Ativo em andamento nao encontrado', 404);
    }

    const agg = await txAny.assetWipContribution.aggregate({
      where: { assetId, organizationId: ctx.organizationId },
      _sum: { amount: true },
    });

    const totalContributed = Number(agg._sum.amount ?? 0);

    await txAny.asset.update({
      where: { id: assetId },
      data: {
        status: 'ATIVO',
        acquisitionDate: input.activationDate ? new Date(input.activationDate) : new Date(),
        acquisitionValue: totalContributed,
      },
    });

    const depConfig = await txAny.depreciationConfig.findFirst({
      where: { assetId, organizationId: ctx.organizationId },
    });

    return {
      assetId,
      finalValue: totalContributed,
      depreciationConfigMissing: !depConfig,
    };
  });
}

export async function createStage(ctx: RlsContext, assetId: string, input: CreateStageInput) {
  return prisma.assetWipStage.create({
    data: {
      organizationId: ctx.organizationId,
      assetId,
      name: input.name,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function completeStage(ctx: RlsContext, stageId: string, input: CompleteStageInput) {
  const stage = await prisma.assetWipStage.findFirst({
    where: { id: stageId, organizationId: ctx.organizationId },
  });

  if (!stage) {
    throw new WipError('Etapa nao encontrada', 404);
  }

  return prisma.assetWipStage.update({
    where: { id: stageId },
    data: {
      completedAt: input.completedAt ? new Date(input.completedAt) : new Date(),
    },
  });
}

export async function listStages(ctx: RlsContext, assetId: string) {
  return prisma.assetWipStage.findMany({
    where: { assetId, organizationId: ctx.organizationId },
    orderBy: { sortOrder: 'asc' },
  });
}
