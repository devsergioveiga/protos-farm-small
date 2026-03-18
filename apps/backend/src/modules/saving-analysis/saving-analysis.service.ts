import { withRlsContext, type RlsContext } from '../../database/rls';
import type {
  SavingQueryParams,
  SavingSummary,
  QuotationSaving,
  QuotationSavingItem,
  PriceHistoryResult,
  PriceHistoryPoint,
  CycleIndicators,
  TopProductBySpend,
  TopSupplierByVolume,
  AnalyticsDashboard,
} from './saving-analysis.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── getSavingByQuotation ─────────────────────────────────────────────

export async function getSavingByQuotation(
  ctx: RlsContext,
  params: SavingQueryParams,
): Promise<SavingSummary> {
  const startDate = new Date(params.startDate);
  const endDate = new Date(params.endDate);

  return withRlsContext(ctx, async (tx: TxClient) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
      status: 'FECHADA',
      deletedAt: null,
      createdAt: { gte: startDate, lte: endDate },
    };

    if (params.supplierId) {
      where.suppliers = { some: { supplierId: params.supplierId } };
    }

    const quotations = await tx.quotation.findMany({
      where,
      include: {
        itemSelections: true,
        suppliers: {
          include: {
            proposal: {
              include: { items: true },
            },
          },
        },
        purchaseRequest: {
          include: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const savings: QuotationSaving[] = [];
    let totalSavingVal = 0;
    let totalMaxVal = 0;

    for (const quotation of quotations) {
      // Need at least 2 proposals to calculate saving
      const proposedSuppliers = quotation.suppliers.filter((qs: TxClient) => qs.proposal !== null);
      if (proposedSuppliers.length < 2) continue;

      // Optionally filter by category via RC items
      if (params.category) {
        const rc = quotation.purchaseRequest;
        if (!rc || !rc.category || rc.category !== params.category) continue;
      }

      // Build a map of purchaseRequestItemId -> { winner price, max price, quantity, productName }
      const itemSavingMap: Record<
        string,
        { maxPrice: number; winnerPrice: number; quantity: number; productName: string }
      > = {};

      // Get RC items for productName
      const rcItemNameMap: Record<string, string> = {};
      for (const rcItem of quotation.purchaseRequest?.items ?? []) {
        rcItemNameMap[rcItem.id] = rcItem.productName;
      }

      // Determine winner supplier per item from QuotationItemSelection
      const winnerMap: Record<string, string> = {}; // purchaseRequestItemId -> quotationSupplierId
      for (const sel of quotation.itemSelections) {
        winnerMap[sel.purchaseRequestItemId] = sel.quotationSupplierId;
      }

      // Collect prices per item across all proposals
      const itemPricesMap: Record<string, { price: number; qsId: string; qty: number }[]> = {};
      for (const qs of proposedSuppliers) {
        for (const pi of qs.proposal.items) {
          const itemId = pi.purchaseRequestItemId;
          if (!itemPricesMap[itemId]) itemPricesMap[itemId] = [];
          itemPricesMap[itemId].push({
            price: Number(pi.unitPrice),
            qsId: qs.id,
            qty: Number(pi.quantity),
          });
        }
      }

      const itemSavings: QuotationSavingItem[] = [];
      let quotationSaving = 0;
      let quotationMaxTotal = 0;

      for (const [itemId, pricesArr] of Object.entries(itemPricesMap)) {
        if (pricesArr.length < 2) continue;

        const maxPriceEntry = pricesArr.reduce((a, b) => (a.price >= b.price ? a : b));
        const maxPrice = maxPriceEntry.price;
        const qty = maxPriceEntry.qty;
        const productName = rcItemNameMap[itemId] ?? 'Produto';

        // Winner price: from the selected supplier for this item
        const winnerId = winnerMap[itemId];
        const winnerEntry = winnerId ? pricesArr.find((p) => p.qsId === winnerId) : undefined;
        const winnerPrice = winnerEntry
          ? winnerEntry.price
          : Math.min(...pricesArr.map((p) => p.price));

        const saving = (maxPrice - winnerPrice) * qty;
        const maxTotal = maxPrice * qty;

        if (saving < 0) continue; // skip negative savings (winner > max, shouldn't happen)

        quotationSaving += saving;
        quotationMaxTotal += maxTotal;

        itemSavingMap[itemId] = { maxPrice, winnerPrice, quantity: qty, productName };

        itemSavings.push({
          productName,
          maxPrice: maxPrice.toFixed(4),
          winnerPrice: winnerPrice.toFixed(4),
          saving: saving.toFixed(2),
        });
      }

      if (itemSavings.length === 0) continue;

      totalSavingVal += quotationSaving;
      totalMaxVal += quotationMaxTotal;

      savings.push({
        quotationId: quotation.id,
        sequentialNumber: quotation.sequentialNumber,
        createdAt: quotation.createdAt.toISOString(),
        supplierCount: proposedSuppliers.length,
        savingTotal: quotationSaving.toFixed(2),
        items: itemSavings,
      });
    }

    const avgSavingPercent =
      totalMaxVal > 0 ? ((totalSavingVal / totalMaxVal) * 100).toFixed(2) : '0.00';

    return {
      totalSaving: totalSavingVal.toFixed(2),
      quotationCount: savings.length,
      avgSavingPercent,
      savings,
    };
  });
}

// ─── getPriceHistory ──────────────────────────────────────────────────

export async function getPriceHistory(
  ctx: RlsContext,
  productId: string,
  params: { startDate: string; endDate: string },
): Promise<PriceHistoryResult> {
  const startDate = new Date(params.startDate);
  const endDate = new Date(params.endDate);

  return withRlsContext(ctx, async (tx: TxClient) => {
    // Find POItems where productName matches or purchaseRequestItemId links to a product
    // We search by matching productId via purchaseRequestItem -> product link
    // Since PurchaseOrderItem doesn't have a direct productId, we query via purchaseRequestItem
    const poItems = await tx.purchaseOrderItem.findMany({
      where: {
        purchaseRequestItem: {
          productId,
        },
        purchaseOrder: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          createdAt: { gte: startDate, lte: endDate },
        },
      },
      include: {
        purchaseOrder: {
          include: {
            supplier: { select: { id: true, name: true, tradeName: true } },
          },
        },
        purchaseRequestItem: {
          select: { productId: true, productName: true },
        },
      },
      orderBy: { purchaseOrder: { createdAt: 'asc' } },
    });

    // Determine product name from first result or fall back
    let productName = 'Produto';
    if (poItems.length > 0) {
      productName = poItems[0].purchaseRequestItem?.productName ?? poItems[0].productName;
    }

    const points: PriceHistoryPoint[] = poItems.map(
      (item: TxClient): PriceHistoryPoint => ({
        date: item.purchaseOrder.createdAt.toISOString(),
        price: Number(item.unitPrice).toFixed(4),
        purchaseOrderNumber: item.purchaseOrder.sequentialNumber,
        supplierName: item.purchaseOrder.supplier.tradeName ?? item.purchaseOrder.supplier.name,
      }),
    );

    return { productId, productName, points };
  });
}

// ─── getCycleIndicators ───────────────────────────────────────────────

export async function getCycleIndicators(
  ctx: RlsContext,
  params: SavingQueryParams,
): Promise<CycleIndicators> {
  const startDate = new Date(params.startDate);
  const endDate = new Date(params.endDate);

  return withRlsContext(ctx, async (tx: TxClient) => {
    const allPOs = await tx.purchaseOrder.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        goodsReceipts: {
          where: { status: 'CONFIRMADO' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        quotation: {
          include: {
            purchaseRequest: { select: { createdAt: true } },
          },
        },
      },
    });

    const totalOrders = allPOs.length;

    if (totalOrders === 0) {
      return {
        percentFormal: '0.00',
        percentEmergency: '0.00',
        avgCycleDays: '0.00',
        totalOrders: 0,
      };
    }

    const formalCount = allPOs.filter((po: TxClient) => po.quotationId !== null).length;
    const emergencyCount = allPOs.filter((po: TxClient) => po.isEmergency === true).length;

    // Avg cycle days: RC.createdAt -> most recent GR.createdAt
    const cycleDaysList: number[] = [];
    for (const po of allPOs) {
      const rcCreatedAt = po.quotation?.purchaseRequest?.createdAt;
      const grCreatedAt = po.goodsReceipts?.[0]?.createdAt;
      if (rcCreatedAt && grCreatedAt) {
        const diff =
          (new Date(grCreatedAt).getTime() - new Date(rcCreatedAt).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diff >= 0) cycleDaysList.push(diff);
      }
    }

    const avgCycleDays =
      cycleDaysList.length > 0
        ? (cycleDaysList.reduce((a, b) => a + b, 0) / cycleDaysList.length).toFixed(2)
        : '0.00';

    return {
      percentFormal: ((formalCount / totalOrders) * 100).toFixed(2),
      percentEmergency: ((emergencyCount / totalOrders) * 100).toFixed(2),
      avgCycleDays,
      totalOrders,
    };
  });
}

// ─── getTopProducts ───────────────────────────────────────────────────

export async function getTopProducts(
  ctx: RlsContext,
  params: SavingQueryParams,
  limit = 10,
): Promise<TopProductBySpend[]> {
  const startDate = new Date(params.startDate);
  const endDate = new Date(params.endDate);

  return withRlsContext(ctx, async (tx: TxClient) => {
    // Aggregate PurchaseOrderItem.totalPrice grouped by productName
    // Since there's no direct productId on PurchaseOrderItem, we group by productName
    const items = await tx.purchaseOrderItem.findMany({
      where: {
        purchaseOrder: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          createdAt: { gte: startDate, lte: endDate },
        },
      },
      include: {
        purchaseRequestItem: { select: { productId: true } },
      },
      select: {
        productName: true,
        totalPrice: true,
        purchaseOrderId: true,
        purchaseRequestItem: { select: { productId: true } },
      },
    });

    // Aggregate by productName (or productId when available)
    const aggregated: Record<
      string,
      { productId: string; productName: string; totalSpent: number; orderIds: Set<string> }
    > = {};

    for (const item of items) {
      const productId = item.purchaseRequestItem?.productId ?? `name:${item.productName}`;
      const key = productId;
      if (!aggregated[key]) {
        aggregated[key] = {
          productId,
          productName: item.productName,
          totalSpent: 0,
          orderIds: new Set(),
        };
      }
      aggregated[key].totalSpent += Number(item.totalPrice);
      aggregated[key].orderIds.add(item.purchaseOrderId);
    }

    const sorted = Object.values(aggregated)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);

    return sorted.map((entry) => ({
      productId: entry.productId,
      productName: entry.productName,
      totalSpent: entry.totalSpent.toFixed(2),
      orderCount: entry.orderIds.size,
    }));
  });
}

// ─── getTopSuppliers ──────────────────────────────────────────────────

export async function getTopSuppliers(
  ctx: RlsContext,
  params: SavingQueryParams,
  limit = 5,
): Promise<TopSupplierByVolume[]> {
  const startDate = new Date(params.startDate);
  const endDate = new Date(params.endDate);

  return withRlsContext(ctx, async (tx: TxClient) => {
    const purchaseOrders = await tx.purchaseOrder.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        supplier: { select: { id: true, name: true, tradeName: true } },
        items: { select: { totalPrice: true } },
      },
    });

    // Aggregate by supplierId
    const aggregated: Record<
      string,
      { supplierId: string; supplierName: string; totalVolume: number; orderCount: number }
    > = {};

    for (const po of purchaseOrders) {
      const supplierId = po.supplierId;
      if (!aggregated[supplierId]) {
        aggregated[supplierId] = {
          supplierId,
          supplierName: po.supplier.tradeName ?? po.supplier.name,
          totalVolume: 0,
          orderCount: 0,
        };
      }
      const poTotal = po.items.reduce(
        (sum: number, item: TxClient) => sum + Number(item.totalPrice),
        0,
      );
      aggregated[supplierId].totalVolume += poTotal;
      aggregated[supplierId].orderCount += 1;
    }

    const sorted = Object.values(aggregated)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, limit);

    return sorted.map((entry) => ({
      supplierId: entry.supplierId,
      supplierName: entry.supplierName,
      totalVolume: entry.totalVolume.toFixed(2),
      orderCount: entry.orderCount,
    }));
  });
}

// ─── getAnalyticsDashboard ────────────────────────────────────────────

export async function getAnalyticsDashboard(
  ctx: RlsContext,
  params: SavingQueryParams,
): Promise<AnalyticsDashboard> {
  const [saving, indicators, topProducts, topSuppliers] = await Promise.all([
    getSavingByQuotation(ctx, params),
    getCycleIndicators(ctx, params),
    getTopProducts(ctx, params),
    getTopSuppliers(ctx, params),
  ]);

  return { saving, indicators, topProducts, topSuppliers };
}
