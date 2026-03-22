import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import {
  AssetInventoryError,
  PHYSICAL_STATUS_LABELS,
  INVENTORY_STATUS_LABELS,
  type CreateInventoryInput,
  type CountItemInput,
  type ListInventoriesQuery,
  type InventoryOutput,
  type InventoryItemOutput,
} from './asset-inventory.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ──────────────────────────────────────────────────────────

function mapItem(item: TxClient): InventoryItemOutput {
  const physStatus = item.physicalStatus ?? null;
  return {
    id: item.id,
    assetId: item.assetId,
    assetTag: item.asset?.assetTag ?? '',
    assetName: item.asset?.name ?? '',
    assetType: item.asset?.assetType ?? '',
    registeredStatus: item.registeredStatus,
    physicalStatus: physStatus,
    physicalStatusLabel: physStatus
      ? (PHYSICAL_STATUS_LABELS[physStatus as keyof typeof PHYSICAL_STATUS_LABELS] ?? physStatus)
      : null,
    notes: item.notes ?? null,
  };
}

function mapInventory(inv: TxClient): InventoryOutput {
  const items: InventoryItemOutput[] = (inv.items ?? []).map(mapItem);
  const countedCount = items.filter((i) => i.physicalStatus !== null).length;
  const divergenceCount = items.filter(
    (i) => i.physicalStatus !== null && i.physicalStatus !== 'ENCONTRADO',
  ).length;

  return {
    id: inv.id,
    farmId: inv.farmId ?? null,
    farmName: inv.farm?.name ?? null,
    status: inv.status,
    statusLabel: INVENTORY_STATUS_LABELS[inv.status as string] ?? inv.status,
    notes: inv.notes ?? null,
    reconciledAt: inv.reconciledAt ? inv.reconciledAt.toISOString() : null,
    reconciledBy: inv.reconciledBy ?? null,
    items,
    itemCount: items.length,
    countedCount,
    divergenceCount,
    createdBy: inv.createdBy,
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
    updatedAt: inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : inv.updatedAt,
  };
}

const INVENTORY_INCLUDE = {
  farm: { select: { name: true } },
  items: {
    include: {
      asset: {
        select: { assetTag: true, name: true, assetType: true },
      },
    },
    orderBy: { asset: { name: 'asc' as const } },
  },
};

// ─── createInventory ──────────────────────────────────────────────────

export async function createInventory(
  ctx: RlsContext,
  input: CreateInventoryInput,
  userId: string,
): Promise<InventoryOutput> {
  return prisma.$transaction(async (tx: TxClient) => {
    // Load all non-alienado assets for this org (optionally filtered by farm)
    const assetWhere: TxClient = {
      organizationId: ctx.organizationId,
      status: { in: ['ATIVO', 'INATIVO', 'EM_MANUTENCAO'] },
      deletedAt: null,
    };
    if (input.farmId) {
      assetWhere.farmId = input.farmId;
    }

    const assets = await tx.asset.findMany({
      where: assetWhere,
      select: { id: true, status: true },
    });

    // Create the inventory record
    const inventory = await tx.assetInventory.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId ?? null,
        status: 'DRAFT',
        notes: input.notes ?? null,
        createdBy: userId,
      },
    });

    // Create one item per asset
    if (assets.length > 0) {
      await tx.assetInventoryItem.createMany({
        data: assets.map((a: TxClient) => ({
          inventoryId: inventory.id,
          assetId: a.id,
          registeredStatus: a.status,
          physicalStatus: null,
          notes: null,
        })),
      });
    }

    // Return with full includes
    const full = await tx.assetInventory.findFirst({
      where: { id: inventory.id },
      include: INVENTORY_INCLUDE,
    });

    return mapInventory(full);
  });
}

// ─── countItems ───────────────────────────────────────────────────────

export async function countItems(
  ctx: RlsContext,
  inventoryId: string,
  items: CountItemInput[],
): Promise<InventoryOutput> {
  return prisma.$transaction(async (tx: TxClient) => {
    const inventory = await tx.assetInventory.findFirst({
      where: { id: inventoryId, organizationId: ctx.organizationId },
    });

    if (!inventory) {
      throw new AssetInventoryError('Inventario nao encontrado', 404);
    }
    if (inventory.status === 'RECONCILED' || inventory.status === 'CANCELLED') {
      throw new AssetInventoryError('Inventario ja foi conciliado ou cancelado', 400);
    }

    // Update each item's physicalStatus
    for (const item of items) {
      await tx.assetInventoryItem.updateMany({
        where: { inventoryId, assetId: item.assetId },
        data: {
          physicalStatus: item.physicalStatus,
          notes: item.notes ?? null,
        },
      });
    }

    // Transition to COUNTING if still DRAFT
    if (inventory.status === 'DRAFT') {
      await tx.assetInventory.update({
        where: { id: inventoryId },
        data: { status: 'COUNTING' },
      });
    }

    const full = await tx.assetInventory.findFirst({
      where: { id: inventoryId },
      include: INVENTORY_INCLUDE,
    });

    return mapInventory(full);
  });
}

// ─── reconcileInventory ───────────────────────────────────────────────

export async function reconcileInventory(
  ctx: RlsContext,
  inventoryId: string,
  userId: string,
): Promise<InventoryOutput> {
  return prisma.$transaction(async (tx: TxClient) => {
    const inventory = await tx.assetInventory.findFirst({
      where: { id: inventoryId, organizationId: ctx.organizationId },
    });

    if (!inventory) {
      throw new AssetInventoryError('Inventario nao encontrado', 404);
    }
    if (inventory.status === 'DRAFT') {
      throw new AssetInventoryError('Realize a contagem antes de conciliar', 400);
    }
    if (inventory.status === 'RECONCILED') {
      throw new AssetInventoryError('Inventario ja foi conciliado', 400);
    }
    if (inventory.status === 'CANCELLED') {
      throw new AssetInventoryError('Inventario cancelado nao pode ser conciliado', 400);
    }

    const updated = await tx.assetInventory.update({
      where: { id: inventoryId },
      data: {
        status: 'RECONCILED',
        reconciledAt: new Date(),
        reconciledBy: userId,
      },
      include: INVENTORY_INCLUDE,
    });

    return mapInventory(updated);
  });
}

// ─── getInventory ─────────────────────────────────────────────────────

export async function getInventory(
  ctx: RlsContext,
  inventoryId: string,
): Promise<InventoryOutput> {
  const inventory = await prisma.assetInventory.findFirst({
    where: { id: inventoryId, organizationId: ctx.organizationId },
    include: INVENTORY_INCLUDE,
  });

  if (!inventory) {
    throw new AssetInventoryError('Inventario nao encontrado', 404);
  }

  return mapInventory(inventory);
}

// ─── listInventories ──────────────────────────────────────────────────

export async function listInventories(
  ctx: RlsContext,
  query: ListInventoriesQuery,
): Promise<{ data: InventoryOutput[]; total: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: TxClient = { organizationId: ctx.organizationId };
  if (query.status) {
    where.status = query.status;
  }
  if (query.farmId) {
    where.farmId = query.farmId;
  }

  const [total, inventories] = await Promise.all([
    prisma.assetInventory.count({ where }),
    prisma.assetInventory.findMany({
      where,
      include: INVENTORY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: inventories.map(mapInventory),
    total,
  };
}
