import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';

export class SparePartError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'SparePartError';
  }
}

// ─── Service functions ────────────────────────────────────────────────

export async function addSparePartCompat(
  ctx: RlsContext,
  input: { productId: string; assetId: string; notes?: string },
) {
  // Verify asset belongs to org
  const asset = await prisma.asset.findFirst({
    where: { id: input.assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!asset) {
    throw new SparePartError('Ativo não encontrado', 404);
  }

  // Upsert to handle duplicates gracefully
  const existing = await prisma.sparePartAssetCompat.findUnique({
    where: {
      productId_assetId: {
        productId: input.productId,
        assetId: input.assetId,
      },
    },
  });

  if (existing) {
    return prisma.sparePartAssetCompat.update({
      where: { id: existing.id },
      data: { notes: input.notes ?? existing.notes },
    });
  }

  return prisma.sparePartAssetCompat.create({
    data: {
      productId: input.productId,
      assetId: input.assetId,
      notes: input.notes ?? null,
    },
  });
}

export async function removeSparePartCompat(ctx: RlsContext, id: string) {
  // Verify compat record exists for org (via asset.organizationId)
  const record = await prisma.sparePartAssetCompat.findFirst({
    where: {
      id,
      asset: { organizationId: ctx.organizationId },
    },
  });
  if (!record) {
    throw new SparePartError('Vínculo não encontrado', 404);
  }

  return prisma.sparePartAssetCompat.delete({ where: { id } });
}

export async function listSparePartsForAsset(ctx: RlsContext, assetId: string) {
  // Verify asset belongs to org
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!asset) {
    throw new SparePartError('Ativo não encontrado', 404);
  }

  const records = await prisma.sparePartAssetCompat.findMany({
    where: { assetId },
    orderBy: { createdAt: 'asc' },
  });

  // Fetch product info and stock balance for each product
  const results = await Promise.all(
    records.map(async (r) => {
      const product = await prisma.product.findUnique({
        where: { id: r.productId },
        select: { id: true, name: true, measurementUnit: { select: { abbreviation: true } } },
      });

      const stockBalance = await prisma.stockBalance.findFirst({
        where: { organizationId: ctx.organizationId, productId: r.productId },
        select: { currentQuantity: true },
      });

      const reorderPoint = await prisma.product.findUnique({
        where: { id: r.productId },
        select: { reorderPoint: true },
      });

      return {
        compatId: r.id,
        productId: r.productId,
        productName: product?.name ?? r.productId,
        unit: product?.measurementUnit?.abbreviation ?? '',
        currentStock: stockBalance ? Number(stockBalance.currentQuantity) : 0,
        reorderPoint: reorderPoint?.reorderPoint != null ? Number(reorderPoint.reorderPoint) : null,
        notes: r.notes ?? null,
      };
    }),
  );

  return results;
}

export async function listAssetsForSparePart(ctx: RlsContext, productId: string) {
  const records = await prisma.sparePartAssetCompat.findMany({
    where: {
      productId,
      asset: { organizationId: ctx.organizationId, deletedAt: null },
    },
    include: {
      asset: { select: { id: true, name: true, assetTag: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return records.map((r) => ({
    compatId: r.id,
    assetId: r.assetId,
    assetName: r.asset.name,
    assetTag: r.asset.assetTag,
    notes: r.notes ?? null,
  }));
}
