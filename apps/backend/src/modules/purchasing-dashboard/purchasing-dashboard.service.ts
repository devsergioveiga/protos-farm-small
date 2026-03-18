import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import type {
  PurchasingDashboardData,
  PurchasingDashboardFilters,
} from './purchasing-dashboard.types';

const MS_PER_DAY = 86_400_000;

// ─── KPI Helpers ─────────────────────────────────────────────────────────────

async function countPendingApproval(
  tx: TxClient,
  organizationId: string,
  start: Date,
  end: Date,
  farmId?: string,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId,
    status: { in: ['PENDENTE', 'DEVOLVIDA'] },
    createdAt: { gte: start, lte: end },
    deletedAt: null,
  };
  if (farmId) where.farmId = farmId;
  return tx.purchaseRequest.count({ where });
}

async function countOverduePo(
  tx: TxClient,
  organizationId: string,
  _start: Date,
  _end: Date,
  farmId?: string,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId,
    status: { in: ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO'] },
    expectedDeliveryDate: { lt: new Date() },
    deletedAt: null,
  };
  if (farmId) {
    where.quotation = { purchaseRequest: { farmId } };
  }
  return tx.purchaseOrder.count({ where });
}

async function calcAvgCycleDays(
  tx: TxClient,
  organizationId: string,
  start: Date,
  end: Date,
  farmId?: string,
): Promise<number> {
  // GoodsReceipts confirmed within period — cycle = confirmedAt - purchaseRequest.createdAt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grWhere: Record<string, any> = {
    organizationId,
    status: 'CONFIRMADO',
    confirmedAt: { gte: start, lte: end },
    deletedAt: null,
  };

  if (farmId) {
    grWhere.purchaseOrder = {
      quotation: { purchaseRequest: { farmId } },
    };
  }

  const receipts = await tx.goodsReceipt.findMany({
    where: grWhere,
    select: {
      confirmedAt: true,
      purchaseOrder: {
        select: {
          quotation: {
            select: {
              purchaseRequest: {
                select: { createdAt: true },
              },
            },
          },
        },
      },
    },
  });

  if (receipts.length === 0) return 0;

  let totalDays = 0;
  let count = 0;
  for (const gr of receipts) {
    const rcCreatedAt = gr.purchaseOrder?.quotation?.purchaseRequest?.createdAt;
    if (gr.confirmedAt && rcCreatedAt) {
      const days = (gr.confirmedAt.getTime() - rcCreatedAt.getTime()) / MS_PER_DAY;
      totalDays += days;
      count++;
    }
  }

  return count === 0 ? 0 : Math.round(totalDays / count);
}

async function countLateDeliveries(
  tx: TxClient,
  organizationId: string,
  start: Date,
  end: Date,
  farmId?: string,
): Promise<number> {
  // GoodsReceipts confirmed within period where confirmedAt > PurchaseOrder.expectedDeliveryDate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grWhere: Record<string, any> = {
    organizationId,
    status: 'CONFIRMADO',
    confirmedAt: { gte: start, lte: end },
    deletedAt: null,
    purchaseOrder: {
      expectedDeliveryDate: { not: null },
    },
  };

  if (farmId) {
    grWhere.purchaseOrder = {
      ...grWhere.purchaseOrder,
      quotation: { purchaseRequest: { farmId } },
    };
  }

  const receipts = await tx.goodsReceipt.findMany({
    where: grWhere,
    select: {
      confirmedAt: true,
      purchaseOrder: {
        select: { expectedDeliveryDate: true },
      },
    },
  });

  return receipts.filter(
    (gr: {
      confirmedAt: Date | null;
      purchaseOrder: { expectedDeliveryDate: Date | null } | null;
    }) => {
      const expected = gr.purchaseOrder?.expectedDeliveryDate;
      return gr.confirmedAt && expected && gr.confirmedAt > expected;
    },
  ).length;
}

// ─── Chart Helpers ────────────────────────────────────────────────────────────

async function getVolumeByStage(
  tx: TxClient,
  organizationId: string,
  farmId?: string,
): Promise<{ stage: string; count: number; totalValue: number }[]> {
  // Count pending RCs (RASCUNHO/PENDENTE/DEVOLVIDA)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rcWhere: Record<string, any> = { organizationId, deletedAt: null };
  if (farmId) rcWhere.farmId = farmId;

  const [pendingRcs, approvedRcs] = await Promise.all([
    tx.purchaseRequest.findMany({
      where: { ...rcWhere, status: { in: ['RASCUNHO', 'PENDENTE', 'DEVOLVIDA'] } },
      select: { items: { select: { estimatedUnitPrice: true, quantity: true } } },
    }),
    tx.purchaseRequest.findMany({
      where: {
        ...rcWhere,
        status: 'APROVADA',
        quotations: { none: { deletedAt: null } },
      },
      select: { items: { select: { estimatedUnitPrice: true, quantity: true } } },
    }),
  ]);

  function calcRcValue(rc: {
    items: {
      estimatedUnitPrice: { toNumber: () => number } | null;
      quantity: { toNumber: () => number };
    }[];
  }): number {
    return rc.items.reduce((sum, item) => {
      const price = item.estimatedUnitPrice ? Number(item.estimatedUnitPrice) : 0;
      return sum + price * Number(item.quantity);
    }, 0);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotationWhere: Record<string, any> = {
    organizationId,
    deletedAt: null,
    status: { in: ['AGUARDANDO_PROPOSTA', 'EM_ANALISE'] },
  };
  if (farmId) quotationWhere.purchaseRequest = { farmId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poEmitidaWhere: Record<string, any> = {
    organizationId,
    deletedAt: null,
    status: { in: ['EMITIDA', 'CONFIRMADA'] },
  };
  if (farmId) poEmitidaWhere.quotation = { purchaseRequest: { farmId } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poTransitoWhere: Record<string, any> = {
    organizationId,
    deletedAt: null,
    status: 'EM_TRANSITO',
  };
  if (farmId) poTransitoWhere.quotation = { purchaseRequest: { farmId } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grWhere: Record<string, any> = {
    organizationId,
    deletedAt: null,
    status: 'CONFIRMADO',
    payableId: null,
  };
  if (farmId) grWhere.purchaseOrder = { quotation: { purchaseRequest: { farmId } } };

  const thirtyDaysAgo = new Date(Date.now() - 30 * MS_PER_DAY);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payableWhere: Record<string, any> = {
    organizationId,
    status: 'PAID',
    paidAt: { gte: thirtyDaysAgo },
    goodsReceiptId: { not: null },
  };
  if (farmId) payableWhere.farmId = farmId;

  const [quotations, posEmitida, posTransito, grs, payables] = await Promise.all([
    tx.quotation.findMany({
      where: quotationWhere,
      select: {
        purchaseRequest: {
          select: { items: { select: { estimatedUnitPrice: true, quantity: true } } },
        },
      },
    }),
    tx.purchaseOrder.findMany({
      where: poEmitidaWhere,
      select: { items: { select: { totalPrice: true } } },
    }),
    tx.purchaseOrder.findMany({
      where: poTransitoWhere,
      select: { items: { select: { totalPrice: true } } },
    }),
    tx.goodsReceipt.findMany({
      where: grWhere,
      select: { items: { select: { totalPrice: true } } },
    }),
    tx.payable.findMany({
      where: payableWhere,
      select: { totalAmount: true },
    }),
  ]);

  function sumPoItems(pos: { items: { totalPrice: { toNumber: () => number } }[] }[]): number {
    return pos.reduce((sum, po) => sum + po.items.reduce((s, i) => s + Number(i.totalPrice), 0), 0);
  }

  function sumGrItems(grs: { items: { totalPrice: { toNumber: () => number } }[] }[]): number {
    return grs.reduce((sum, gr) => sum + gr.items.reduce((s, i) => s + Number(i.totalPrice), 0), 0);
  }

  const quotationValue = quotations.reduce((sum, q) => {
    if (!q.purchaseRequest) return sum;
    return sum + calcRcValue(q.purchaseRequest);
  }, 0);

  return [
    {
      stage: 'RC_PENDENTE',
      count: pendingRcs.length,
      totalValue: pendingRcs.reduce((s, rc) => s + calcRcValue(rc), 0),
    },
    {
      stage: 'RC_APROVADA',
      count: approvedRcs.length,
      totalValue: approvedRcs.reduce((s, rc) => s + calcRcValue(rc), 0),
    },
    {
      stage: 'EM_COTACAO',
      count: quotations.length,
      totalValue: quotationValue,
    },
    {
      stage: 'OC_EMITIDA',
      count: posEmitida.length,
      totalValue: sumPoItems(posEmitida),
    },
    {
      stage: 'AGUARDANDO_ENTREGA',
      count: posTransito.length,
      totalValue: sumPoItems(posTransito),
    },
    {
      stage: 'RECEBIDO',
      count: grs.length,
      totalValue: sumGrItems(grs),
    },
    {
      stage: 'PAGO',
      count: payables.length,
      totalValue: payables.reduce((sum, p) => sum + Number(p.totalAmount), 0),
    },
  ];
}

async function getPurchasesByCategory(
  tx: TxClient,
  organizationId: string,
  farmId?: string,
): Promise<{ category: string; totalValue: number }[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { organizationId, deletedAt: null };
  if (farmId) where.farmId = farmId;

  const items = await tx.purchaseRequestItem.findMany({
    where: {
      purchaseRequest: where,
    },
    select: {
      estimatedUnitPrice: true,
      quantity: true,
      product: { select: { category: true } },
    },
  });

  const categoryMap = new Map<string, number>();
  for (const item of items) {
    const category = (item.product?.category as string | null) ?? 'Outros';
    const value = Number(item.estimatedUnitPrice ?? 0) * Number(item.quantity);
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + value);
  }

  const sorted = [...categoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, totalValue]) => ({ category, totalValue }));

  if (sorted.length <= 8) return sorted;

  const top8 = sorted.slice(0, 8);
  const othersValue = sorted.slice(8).reduce((sum, item) => sum + item.totalValue, 0);
  return [...top8, { category: 'Outros', totalValue: othersValue }];
}

async function getMonthlyEvolution(
  tx: TxClient,
  organizationId: string,
  farmId?: string,
): Promise<{ month: string; totalValue: number }[]> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId,
    deletedAt: null,
    createdAt: { gte: twelveMonthsAgo },
  };
  if (farmId) {
    where.quotation = { purchaseRequest: { farmId } };
  }

  const orders = await tx.purchaseOrder.findMany({
    where,
    select: {
      createdAt: true,
      items: { select: { totalPrice: true } },
    },
  });

  const monthMap = new Map<string, number>();
  for (const order of orders) {
    const d = order.createdAt;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const value = order.items.reduce(
      (sum: number, item: { totalPrice: { toNumber: () => number } }) =>
        sum + Number(item.totalPrice),
      0,
    );
    monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + value);
  }

  // Return sorted by month
  return [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, totalValue]) => ({ month, totalValue }));
}

async function getUrgentVsPlanned(
  tx: TxClient,
  organizationId: string,
  farmId?: string,
): Promise<{ month: string; urgent: number; planned: number }[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId,
    deletedAt: null,
    createdAt: { gte: sixMonthsAgo },
  };
  if (farmId) where.farmId = farmId;

  const rcs = await tx.purchaseRequest.findMany({
    where,
    select: { createdAt: true, urgency: true },
  });

  const monthMap = new Map<string, { urgent: number; planned: number }>();
  for (const rc of rcs) {
    const d = rc.createdAt;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, { urgent: 0, planned: 0 });
    const entry = monthMap.get(monthKey)!;
    if (rc.urgency === 'EMERGENCIAL' || rc.urgency === 'URGENTE') {
      entry.urgent++;
    } else {
      entry.planned++;
    }
  }

  return [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, counts]) => ({ month, ...counts }));
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

async function getAlerts(
  tx: TxClient,
  organizationId: string,
  farmId?: string,
): Promise<PurchasingDashboardData['alerts']> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poWhere: Record<string, any> = {
    organizationId,
    status: { in: ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO'] },
    expectedDeliveryDate: { lt: new Date() },
    deletedAt: null,
  };
  if (farmId) poWhere.quotation = { purchaseRequest: { farmId } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rcSlaWhere: Record<string, any> = {
    organizationId,
    deletedAt: null,
    status: { in: ['PENDENTE', 'DEVOLVIDA'] },
    slaDeadline: { lt: new Date() },
  };
  if (farmId) rcSlaWhere.farmId = farmId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgetWhere: Record<string, any> = {
    organizationId,
    deletedAt: null,
    budgetExceeded: true,
    status: { in: ['PENDENTE', 'APROVADA', 'DEVOLVIDA'] },
  };
  if (farmId) budgetWhere.farmId = farmId;

  // Late deliveries (all time, not period-filtered)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grLateWhere: Record<string, any> = {
    organizationId,
    deletedAt: null,
    status: 'CONFIRMADO',
    purchaseOrder: { expectedDeliveryDate: { not: null } },
  };
  if (farmId)
    grLateWhere.purchaseOrder = {
      ...grLateWhere.purchaseOrder,
      quotation: { purchaseRequest: { farmId } },
    };

  const [overduePoCount, rcAboveSlaCount, budgetExceededCount, lateGrs] = await Promise.all([
    tx.purchaseOrder.count({ where: poWhere }),
    tx.purchaseRequest.count({ where: rcSlaWhere }),
    tx.purchaseRequest.count({ where: budgetWhere }),
    tx.goodsReceipt.findMany({
      where: grLateWhere,
      select: {
        confirmedAt: true,
        purchaseOrder: { select: { expectedDeliveryDate: true } },
      },
    }),
  ]);

  const lateDeliveriesCount = lateGrs.filter(
    (gr: {
      confirmedAt: Date | null;
      purchaseOrder: { expectedDeliveryDate: Date | null } | null;
    }) => {
      const expected = gr.purchaseOrder?.expectedDeliveryDate;
      return gr.confirmedAt && expected && gr.confirmedAt > expected;
    },
  ).length;

  return {
    overduePoCount,
    rcAboveSlaCount,
    budgetExceededCount,
    lateDeliveriesCount,
  };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function getDashboardData(
  ctx: RlsContext,
  filters: PurchasingDashboardFilters,
): Promise<PurchasingDashboardData> {
  return withRlsContext(ctx, async (tx) => {
    const { periodStart, periodEnd, farmId } = filters;

    // Calculate previous period (same duration, shifted back)
    const periodDuration = periodEnd.getTime() - periodStart.getTime();
    const prevEnd = new Date(periodStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodDuration);

    const [
      pendingApprovalCount,
      pendingApprovalCountPrev,
      overduePoCount,
      overduePoCountPrev,
      avgCycleDays,
      avgCycleDaysPrev,
      lateDeliveriesCount,
      lateDeliveriesCountPrev,
      volumeByStage,
      purchasesByCategory,
      monthlyEvolution,
      urgentVsPlanned,
      alerts,
    ] = await Promise.all([
      countPendingApproval(tx, ctx.organizationId, periodStart, periodEnd, farmId),
      countPendingApproval(tx, ctx.organizationId, prevStart, prevEnd, farmId),
      countOverduePo(tx, ctx.organizationId, periodStart, periodEnd, farmId),
      countOverduePo(tx, ctx.organizationId, prevStart, prevEnd, farmId),
      calcAvgCycleDays(tx, ctx.organizationId, periodStart, periodEnd, farmId),
      calcAvgCycleDays(tx, ctx.organizationId, prevStart, prevEnd, farmId),
      countLateDeliveries(tx, ctx.organizationId, periodStart, periodEnd, farmId),
      countLateDeliveries(tx, ctx.organizationId, prevStart, prevEnd, farmId),
      getVolumeByStage(tx, ctx.organizationId, farmId),
      getPurchasesByCategory(tx, ctx.organizationId, farmId),
      getMonthlyEvolution(tx, ctx.organizationId, farmId),
      getUrgentVsPlanned(tx, ctx.organizationId, farmId),
      getAlerts(tx, ctx.organizationId, farmId),
    ]);

    return {
      pendingApprovalCount,
      pendingApprovalCountPrev,
      overduePoCount,
      overduePoCountPrev,
      avgCycleDays,
      avgCycleDaysPrev,
      lateDeliveriesCount,
      lateDeliveriesCountPrev,
      volumeByStage,
      purchasesByCategory,
      monthlyEvolution,
      urgentVsPlanned,
      alerts,
    };
  });
}
