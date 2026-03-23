import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import Decimal from 'decimal.js';
import { RenovationError, type CreateRenovationInput } from './asset-renovations.types';

export async function createRenovation(
  ctx: RlsContext,
  assetId: string,
  input: CreateRenovationInput,
) {
  return prisma.$transaction(async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txAny = tx as any;

    const asset = await txAny.asset.findFirst({
      where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!asset) {
      throw new RenovationError('Ativo nao encontrado', 404);
    }

    if (asset.status === 'ALIENADO') {
      throw new RenovationError('Ativo alienado nao pode ser reformado', 400);
    }

    if (asset.status === 'EM_ANDAMENTO') {
      throw new RenovationError('Ativo em andamento nao pode ser reformado', 400);
    }

    const renovation = await txAny.assetRenovation.create({
      data: {
        organizationId: ctx.organizationId,
        assetId,
        description: input.description,
        renovationDate: new Date(input.renovationDate),
        totalCost: new Decimal(String(input.totalCost)),
        accountingDecision: input.accountingDecision,
        newUsefulLifeMonths: input.newUsefulLifeMonths ?? null,
        notes: input.notes ?? null,
      },
    });

    if (input.accountingDecision === 'CAPITALIZAR') {
      await txAny.asset.update({
        where: { id: assetId },
        data: {
          acquisitionValue: {
            increment: new Decimal(String(input.totalCost)).toNumber(),
          },
        },
      });

      if (input.newUsefulLifeMonths) {
        await txAny.depreciationConfig.updateMany({
          where: { assetId, organizationId: ctx.organizationId },
          data: { usefulLifeMonths: input.newUsefulLifeMonths },
        });
      }
    }

    return renovation;
  });
}

export async function listRenovations(ctx: RlsContext, assetId: string) {
  return prisma.assetRenovation.findMany({
    where: { assetId, organizationId: ctx.organizationId },
    orderBy: { renovationDate: 'desc' },
  });
}
