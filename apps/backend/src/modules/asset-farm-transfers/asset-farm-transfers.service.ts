import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import {
  AssetTransferError,
  type CreateTransferInput,
  type TransferOutput,
  type ListTransfersQuery,
} from './asset-farm-transfers.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ──────────────────────────────────────────────────────────

function mapTransfer(t: TxClient): TransferOutput {
  return {
    id: t.id,
    assetId: t.assetId,
    assetTag: t.asset?.assetTag ?? '',
    assetName: t.asset?.name ?? '',
    fromFarmId: t.fromFarmId,
    fromFarmName: t.fromFarm?.name ?? '',
    toFarmId: t.toFarmId,
    toFarmName: t.toFarm?.name ?? '',
    transferDate: t.transferDate instanceof Date ? t.transferDate.toISOString() : t.transferDate,
    fromCostCenterId: t.fromCostCenterId ?? null,
    toCostCenterId: t.toCostCenterId ?? null,
    notes: t.notes ?? null,
    createdBy: t.createdBy,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
  };
}

const TRANSFER_INCLUDE = {
  asset: { select: { assetTag: true, name: true } },
  fromFarm: { select: { name: true } },
  toFarm: { select: { name: true } },
};

// ─── createTransfer ────────────────────────────────────────────────────

export async function createTransfer(
  ctx: RlsContext,
  assetId: string,
  input: CreateTransferInput,
  userId: string,
): Promise<TransferOutput> {
  return prisma.$transaction(async (tx: TxClient) => {
    // Guard: find asset
    const asset = await tx.asset.findFirst({
      where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, farmId: true, costCenterId: true, status: true },
    });
    if (!asset) {
      throw new AssetTransferError('Ativo nao encontrado', 404);
    }

    // Guard: ALIENADO
    if (asset.status === 'ALIENADO') {
      throw new AssetTransferError('Ativo alienado nao pode ser transferido', 400);
    }

    // Guard: destination farm must belong to same org
    const toFarm = await tx.farm.findFirst({
      where: { id: input.toFarmId, organizationId: ctx.organizationId },
      select: { id: true, name: true },
    });
    if (!toFarm) {
      throw new AssetTransferError('Fazenda destino nao encontrada na organizacao', 400);
    }

    // Guard: cannot transfer to same farm
    if (asset.farmId === input.toFarmId) {
      throw new AssetTransferError('Ativo ja esta na fazenda de destino', 400);
    }

    // Resolve from farm name
    const fromFarm = await tx.farm.findFirst({
      where: { id: asset.farmId },
      select: { name: true },
    });

    // Create transfer record
    const transfer = await tx.assetFarmTransfer.create({
      data: {
        organizationId: ctx.organizationId,
        assetId: asset.id,
        fromFarmId: asset.farmId,
        toFarmId: input.toFarmId,
        transferDate: new Date(input.transferDate),
        fromCostCenterId: asset.costCenterId ?? null,
        toCostCenterId: input.toCostCenterId ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
      },
    });

    // Update asset: move to destination farm, optionally update cost center
    await tx.asset.update({
      where: { id: asset.id },
      data: {
        farmId: input.toFarmId,
        costCenterId:
          input.toCostCenterId !== undefined ? input.toCostCenterId : asset.costCenterId,
      },
    });

    return mapTransfer({
      ...transfer,
      asset: { assetTag: '', name: '' }, // will be fetched below
      fromFarm: { name: fromFarm?.name ?? '' },
      toFarm: { name: toFarm.name },
    });
  }).then(async (result) => {
    // Enrich with asset tag and name
    const assetData = await prisma.asset.findFirst({
      where: { id: assetId },
      select: { assetTag: true, name: true },
    });
    return {
      ...result,
      assetTag: assetData?.assetTag ?? '',
      assetName: assetData?.name ?? '',
    };
  });
}

// ─── listTransfers ────────────────────────────────────────────────────

export async function listTransfers(
  ctx: RlsContext,
  assetId: string,
  query: ListTransfersQuery,
): Promise<{ data: TransferOutput[]; total: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = { assetId, organizationId: ctx.organizationId };

  const [total, transfers] = await Promise.all([
    prisma.assetFarmTransfer.count({ where }),
    prisma.assetFarmTransfer.findMany({
      where,
      include: TRANSFER_INCLUDE,
      orderBy: { transferDate: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: transfers.map(mapTransfer),
    total,
  };
}
