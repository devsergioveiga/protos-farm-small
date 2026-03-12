import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  StockInventoryError,
  INVENTORY_STATUS_LABELS,
  ADJUSTMENT_TYPE_LABELS,
  type CreateInventoryInput,
  type RecordCountInput,
  type ReconcileInventoryInput,
  type ListInventoriesQuery,
  type InventoryOutput,
  type InventoryItemOutput,
  type ListInventoriesResult,
  type InventoryReportOutput,
  type AdjustmentOutput,
  type InventoryStatusValue,
  type AdjustmentTypeValue,
} from './stock-inventories.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function mapItem(item: any): InventoryItemOutput {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product?.name ?? '',
    productType: item.product?.type ?? '',
    measurementUnit: item.product?.measurementUnit?.abbreviation ?? null,
    batchNumber: item.batchNumber ?? null,
    systemQuantity: toNumber(item.systemQuantity),
    countedQuantity: item.countedQuantity != null ? toNumber(item.countedQuantity) : null,
    variance: item.variance != null ? toNumber(item.variance) : null,
    reason: item.reason ?? null,
  };
}

function mapInventory(inv: any): InventoryOutput {
  const items: InventoryItemOutput[] = (inv.items ?? []).map(mapItem);
  const countedCount = items.filter((i) => i.countedQuantity != null).length;
  const divergenceCount = items.filter((i) => i.variance != null && i.variance !== 0).length;

  return {
    id: inv.id,
    inventoryDate: inv.inventoryDate.toISOString(),
    status: inv.status as InventoryStatusValue,
    statusLabel: INVENTORY_STATUS_LABELS[inv.status as InventoryStatusValue] ?? inv.status,
    storageFarmId: inv.storageFarmId ?? null,
    storageFarmName: inv.storageFarm?.name ?? null,
    storageLocation: inv.storageLocation ?? null,
    notes: inv.notes ?? null,
    reconciledAt: inv.reconciledAt?.toISOString() ?? null,
    reconciledBy: inv.reconciledBy ?? null,
    createdBy: inv.createdBy ?? null,
    items,
    itemCount: items.length,
    countedCount,
    divergenceCount,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

const INVENTORY_INCLUDE = {
  storageFarm: { select: { id: true, name: true } },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          type: true,
          measurementUnit: { select: { abbreviation: true } },
        },
      },
    },
    orderBy: { product: { name: 'asc' as const } },
  },
};

// ─── CA1: Criar inventário ──────────────────────────────────────────

export async function createInventory(
  ctx: RlsContext,
  input: CreateInventoryInput,
  createdBy?: string,
): Promise<InventoryOutput> {
  return withRlsContext(ctx, async (tx) => {
    const inventoryDate = input.inventoryDate ? new Date(input.inventoryDate) : new Date();

    // CA7: Check for active inventories (OPEN or IN_PROGRESS) and warn
    const activeInventory = await (tx as any).stockInventory.findFirst({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });
    if (activeInventory) {
      throw new StockInventoryError(
        'Já existe um inventário em andamento. Finalize ou cancele antes de iniciar outro.',
        409,
      );
    }

    // Load products with balances
    const balanceWhere: any = { organizationId: ctx.organizationId };
    if (input.productIds && input.productIds.length > 0) {
      balanceWhere.productId = { in: input.productIds };
    }

    const balances = await (tx as any).stockBalance.findMany({
      where: balanceWhere,
      include: {
        product: {
          select: { id: true, name: true, type: true, deletedAt: true },
        },
      },
    });

    // Filter out deleted products
    const validBalances = balances.filter((b: any) => b.product.deletedAt == null);

    if (validBalances.length === 0) {
      throw new StockInventoryError(
        'Nenhum produto com saldo de estoque encontrado para inventariar.',
        400,
      );
    }

    const inventory = await (tx as any).stockInventory.create({
      data: {
        organizationId: ctx.organizationId,
        inventoryDate,
        status: 'OPEN',
        storageFarmId: input.storageFarmId || null,
        storageLocation: input.storageLocation || null,
        notes: input.notes || null,
        createdBy: createdBy || null,
        items: {
          create: validBalances.map((bal: any) => ({
            productId: bal.productId,
            systemQuantity: toNumber(bal.currentQuantity),
          })),
        },
      },
      include: INVENTORY_INCLUDE,
    });

    return mapInventory(inventory);
  });
}

// ─── CA2: Registrar contagem ────────────────────────────────────────

export async function recordCount(
  ctx: RlsContext,
  inventoryId: string,
  input: RecordCountInput,
): Promise<InventoryOutput> {
  if (!input.items || input.items.length === 0) {
    throw new StockInventoryError('Pelo menos um item com contagem é obrigatório.', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const inventory = await (tx as any).stockInventory.findFirst({
      where: { id: inventoryId, organizationId: ctx.organizationId },
      include: { items: true },
    });

    if (!inventory) {
      throw new StockInventoryError('Inventário não encontrado.', 404);
    }
    if (inventory.status === 'RECONCILED') {
      throw new StockInventoryError(
        'Inventário já conciliado. Não é possível alterar contagens.',
        400,
      );
    }
    if (inventory.status === 'CANCELLED') {
      throw new StockInventoryError('Inventário cancelado. Não é possível alterar contagens.', 400);
    }

    // Update status to IN_PROGRESS if still OPEN
    if (inventory.status === 'OPEN') {
      await (tx as any).stockInventory.update({
        where: { id: inventoryId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // Update each item
    for (const countItem of input.items) {
      if (countItem.countedQuantity < 0) {
        throw new StockInventoryError('Quantidade contada não pode ser negativa.', 400);
      }

      const invItem = inventory.items.find(
        (i: any) =>
          i.productId === countItem.productId &&
          (i.batchNumber ?? null) === (countItem.batchNumber ?? null),
      );

      if (!invItem) {
        throw new StockInventoryError(
          `Produto ${countItem.productId} não faz parte deste inventário.`,
          400,
        );
      }

      const systemQty = toNumber(invItem.systemQuantity);
      const variance = countItem.countedQuantity - systemQty;

      await (tx as any).stockInventoryItem.update({
        where: { id: invItem.id },
        data: {
          countedQuantity: countItem.countedQuantity,
          variance,
          reason: countItem.reason || null,
        },
      });
    }

    // Re-fetch with full relations
    const updated = await (tx as any).stockInventory.findUnique({
      where: { id: inventoryId },
      include: INVENTORY_INCLUDE,
    });

    return mapInventory(updated);
  });
}

// ─── CA3 + CA4 + CA5: Conciliar inventário (aprovação + ajuste) ─────

export async function reconcileInventory(
  ctx: RlsContext,
  inventoryId: string,
  input: ReconcileInventoryInput,
  reconciledBy?: string,
): Promise<InventoryReportOutput> {
  return withRlsContext(ctx, async (tx) => {
    const inventory = await (tx as any).stockInventory.findFirst({
      where: { id: inventoryId, organizationId: ctx.organizationId },
      include: {
        ...INVENTORY_INCLUDE,
        adjustments: true,
      },
    });

    if (!inventory) {
      throw new StockInventoryError('Inventário não encontrado.', 404);
    }
    if (inventory.status === 'RECONCILED') {
      throw new StockInventoryError('Inventário já foi conciliado.', 400);
    }
    if (inventory.status === 'CANCELLED') {
      throw new StockInventoryError('Inventário cancelado.', 400);
    }

    // Check all items have been counted
    const uncountedItems = inventory.items.filter((i: any) => i.countedQuantity == null);
    if (uncountedItems.length > 0) {
      const names = uncountedItems.map((i: any) => i.product?.name ?? i.productId).join(', ');
      throw new StockInventoryError(
        `Todos os itens devem ser contados antes da conciliação. Faltam: ${names}`,
        400,
      );
    }

    // Build reason map from input
    const reasonMap = new Map<string, string>();
    for (const item of input.items) {
      reasonMap.set(item.productId, item.reason);
    }

    // Process adjustments for items with variance != 0
    const adjustments: AdjustmentOutput[] = [];
    let totalSurplusValue = 0;
    let totalShortageValue = 0;
    let surplusCount = 0;
    let shortageCount = 0;
    let matchCount = 0;

    for (const item of inventory.items) {
      const variance = toNumber(item.variance);
      if (variance === 0) {
        matchCount++;
        continue;
      }

      // CA5: Motivo obrigatório para divergências
      const reason = item.reason || reasonMap.get(item.productId);
      if (!reason) {
        throw new StockInventoryError(
          `Motivo obrigatório para divergência do produto "${item.product?.name ?? item.productId}".`,
          400,
        );
      }

      const systemQty = toNumber(item.systemQuantity);
      const countedQty = toNumber(item.countedQuantity);
      const adjustmentType: AdjustmentTypeValue =
        variance > 0 ? 'INVENTORY_SURPLUS' : 'INVENTORY_SHORTAGE';

      // Get current balance for cost reference
      const balance = await (tx as any).stockBalance.findFirst({
        where: { organizationId: ctx.organizationId, productId: item.productId },
      });

      const avgCost = balance ? toNumber(balance.averageCost) : 0;

      // Create adjustment record
      const adjustment = await (tx as any).stockAdjustment.create({
        data: {
          organizationId: ctx.organizationId,
          stockInventoryId: inventoryId,
          productId: item.productId,
          adjustmentType,
          previousQuantity: systemQty,
          newQuantity: countedQty,
          adjustmentQty: Math.abs(variance),
          reason,
          createdBy: reconciledBy || null,
        },
      });

      // CA4: Adjust StockBalance
      if (balance) {
        const newQty = countedQty;
        const newTotalValue = newQty * avgCost;

        await (tx as any).stockBalance.update({
          where: { id: balance.id },
          data: {
            currentQuantity: Math.max(0, newQty),
            totalValue: Math.max(0, newTotalValue),
          },
        });
      }

      if (variance > 0) {
        surplusCount++;
        totalSurplusValue += Math.abs(variance) * avgCost;
      } else {
        shortageCount++;
        totalShortageValue += Math.abs(variance) * avgCost;
      }

      adjustments.push({
        id: adjustment.id,
        stockInventoryId: inventoryId,
        productId: item.productId,
        productName: item.product?.name ?? '',
        adjustmentType,
        adjustmentTypeLabel: ADJUSTMENT_TYPE_LABELS[adjustmentType],
        previousQuantity: systemQty,
        newQuantity: countedQty,
        adjustmentQty: Math.abs(variance),
        reason,
        createdBy: reconciledBy || null,
        createdAt: adjustment.createdAt.toISOString(),
      });
    }

    // Mark inventory as reconciled
    const reconciled = await (tx as any).stockInventory.update({
      where: { id: inventoryId },
      data: {
        status: 'RECONCILED',
        reconciledAt: new Date(),
        reconciledBy: reconciledBy || null,
      },
      include: INVENTORY_INCLUDE,
    });

    return {
      inventory: mapInventory(reconciled),
      adjustments,
      summary: {
        totalItems: inventory.items.length,
        countedItems: inventory.items.length,
        matchCount,
        surplusCount,
        shortageCount,
        totalSurplusValue: Math.round(totalSurplusValue * 100) / 100,
        totalShortageValue: Math.round(totalShortageValue * 100) / 100,
      },
    };
  });
}

// ─── LIST ──────────────────────────────────────────────────────────

export async function listInventories(
  ctx: RlsContext,
  query: ListInventoriesQuery,
): Promise<ListInventoriesResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    const where: any = { organizationId: ctx.organizationId };
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.inventoryDate = {};
      if (query.dateFrom) where.inventoryDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.inventoryDate.lte = new Date(query.dateTo);
    }

    const [inventories, total] = await Promise.all([
      (tx as any).stockInventory.findMany({
        where,
        include: INVENTORY_INCLUDE,
        orderBy: { inventoryDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (tx as any).stockInventory.count({ where }),
    ]);

    return {
      data: inventories.map(mapInventory),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

// ─── GET BY ID ─────────────────────────────────────────────────────

export async function getInventory(ctx: RlsContext, inventoryId: string): Promise<InventoryOutput> {
  return withRlsContext(ctx, async (tx) => {
    const inventory = await (tx as any).stockInventory.findFirst({
      where: { id: inventoryId, organizationId: ctx.organizationId },
      include: INVENTORY_INCLUDE,
    });

    if (!inventory) {
      throw new StockInventoryError('Inventário não encontrado.', 404);
    }

    return mapInventory(inventory);
  });
}

// ─── CANCEL ────────────────────────────────────────────────────────

export async function cancelInventory(
  ctx: RlsContext,
  inventoryId: string,
): Promise<InventoryOutput> {
  return withRlsContext(ctx, async (tx) => {
    const inventory = await (tx as any).stockInventory.findFirst({
      where: { id: inventoryId, organizationId: ctx.organizationId },
    });

    if (!inventory) {
      throw new StockInventoryError('Inventário não encontrado.', 404);
    }
    if (inventory.status === 'RECONCILED') {
      throw new StockInventoryError('Inventário já conciliado. Não é possível cancelar.', 400);
    }
    if (inventory.status === 'CANCELLED') {
      throw new StockInventoryError('Inventário já está cancelado.', 400);
    }

    const cancelled = await (tx as any).stockInventory.update({
      where: { id: inventoryId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: INVENTORY_INCLUDE,
    });

    return mapInventory(cancelled);
  });
}

// ─── CA6: Relatório de inventário com divergências ─────────────────

export async function getInventoryReport(
  ctx: RlsContext,
  inventoryId: string,
): Promise<InventoryReportOutput> {
  return withRlsContext(ctx, async (tx) => {
    const inventory = await (tx as any).stockInventory.findFirst({
      where: { id: inventoryId, organizationId: ctx.organizationId },
      include: {
        ...INVENTORY_INCLUDE,
        adjustments: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    });

    if (!inventory) {
      throw new StockInventoryError('Inventário não encontrado.', 404);
    }

    const items: InventoryItemOutput[] = (inventory.items ?? []).map(mapItem);
    const countedItems = items.filter((i) => i.countedQuantity != null);
    const matchCount = items.filter((i) => i.variance != null && i.variance === 0).length;
    const surplusItems = items.filter((i) => i.variance != null && i.variance > 0);
    const shortageItems = items.filter((i) => i.variance != null && i.variance < 0);

    // Calculate value impact using avg cost from balance
    const balances = await (tx as any).stockBalance.findMany({
      where: {
        organizationId: ctx.organizationId,
        productId: { in: items.map((i) => i.productId) },
      },
    });
    const costMap = new Map<string, number>();
    for (const bal of balances) {
      costMap.set(bal.productId, toNumber(bal.averageCost));
    }

    let totalSurplusValue = 0;
    for (const item of surplusItems) {
      totalSurplusValue += (item.variance ?? 0) * (costMap.get(item.productId) ?? 0);
    }
    let totalShortageValue = 0;
    for (const item of shortageItems) {
      totalShortageValue += Math.abs(item.variance ?? 0) * (costMap.get(item.productId) ?? 0);
    }

    const adjustments: AdjustmentOutput[] = (inventory.adjustments ?? []).map((adj: any) => ({
      id: adj.id,
      stockInventoryId: adj.stockInventoryId,
      productId: adj.productId,
      productName: adj.product?.name ?? '',
      adjustmentType: adj.adjustmentType as AdjustmentTypeValue,
      adjustmentTypeLabel: ADJUSTMENT_TYPE_LABELS[adj.adjustmentType as AdjustmentTypeValue],
      previousQuantity: toNumber(adj.previousQuantity),
      newQuantity: toNumber(adj.newQuantity),
      adjustmentQty: toNumber(adj.adjustmentQty),
      reason: adj.reason,
      createdBy: adj.createdBy ?? null,
      createdAt: adj.createdAt.toISOString(),
    }));

    return {
      inventory: mapInventory(inventory),
      adjustments,
      summary: {
        totalItems: items.length,
        countedItems: countedItems.length,
        matchCount,
        surplusCount: surplusItems.length,
        shortageCount: shortageItems.length,
        totalSurplusValue: Math.round(totalSurplusValue * 100) / 100,
        totalShortageValue: Math.round(totalShortageValue * 100) / 100,
      },
    };
  });
}

// ─── CA6: Relatório CSV de divergências ────────────────────────────

export async function getInventoryReportCSV(ctx: RlsContext, inventoryId: string): Promise<string> {
  const report = await getInventoryReport(ctx, inventoryId);

  const header =
    'Produto;Tipo;Unidade;Saldo Sistema;Contagem Física;Diferença;Motivo;Ajuste Aplicado';

  const rows = report.inventory.items
    .filter((i) => i.countedQuantity != null)
    .map((item) => {
      const adjApplied = report.adjustments.some((a) => a.productId === item.productId);
      return [
        `"${item.productName}"`,
        item.productType,
        item.measurementUnit || '',
        item.systemQuantity,
        item.countedQuantity ?? '',
        item.variance ?? '',
        `"${item.reason ?? ''}"`,
        adjApplied ? 'Sim' : 'Não',
      ].join(';');
    });

  return [header, ...rows].join('\n');
}

// ─── CA7: Verificar movimentações durante inventário ───────────────

export async function checkActiveInventoryWarning(
  ctx: RlsContext,
  productId: string,
): Promise<{ hasActiveInventory: boolean; inventoryId?: string }> {
  return withRlsContext(ctx, async (tx) => {
    const active = await (tx as any).stockInventory.findFirst({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        items: { some: { productId } },
      },
      select: { id: true },
    });

    return {
      hasActiveInventory: !!active,
      inventoryId: active?.id,
    };
  });
}
