import { withRlsContext, type RlsContext } from '../../database/rls';
import type {
  DashboardFilters,
  DashboardMetrics,
  DashboardCharts,
  DashboardAlert,
  KpiValue,
  CategoryChartPoint,
  SavingChartPoint,
  BudgetVsActualPoint,
} from './purchase-dashboard.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── In-Memory Cache ──────────────────────────────────────────────────

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Category Labels ──────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  INSUMO_AGRICOLA: 'Insumos Agricolas',
  PECUARIO: 'Pecuario',
  PECAS: 'Pecas e Equipamentos',
  COMBUSTIVEL: 'Combustivel',
  EPI: 'EPI',
  SERVICOS: 'Servicos',
  OUTROS: 'Outros',
};

// ─── KPI Helper ───────────────────────────────────────────────────────

function buildKpiValue(current: number, previous: number): KpiValue {
  const changePercent =
    previous === 0 ? 0 : Number((((current - previous) / previous) * 100).toFixed(2));
  return { current, previous, changePercent };
}

// ─── Compute Metrics For Period ───────────────────────────────────────

async function computePeriodMetrics(
  tx: TxClient,
  organizationId: string,
  filters: DashboardFilters,
  startDate: Date,
  endDate: Date,
): Promise<{
  totalVolume: number;
  requestCount: number;
  avgCycleTimeDays: number;
  onTimeDeliveryPct: number;
  accumulatedSaving: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseWhere: Record<string, any> = {
    organizationId,
    deletedAt: null,
  };
  if (filters.farmId) baseWhere.farmId = filters.farmId;

  // 1. Total Volume: sum PO totals (EMITIDA, CONFIRMADA, EM_TRANSITO, ENTREGUE)
  const poStatuses = ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO', 'ENTREGUE'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poWhere: Record<string, any> = {
    ...baseWhere,
    status: { in: poStatuses },
    createdAt: { gte: startDate, lte: endDate },
  };
  if (filters.category) {
    poWhere.quotation = { purchaseRequest: { requestType: filters.category } };
  }

  const pos = await tx.purchaseOrder.findMany({
    where: poWhere,
    include: { items: { select: { totalPrice: true } } },
  });

  const totalVolume = pos.reduce((sum: number, po: TxClient) => {
    const poTotal = po.items.reduce((s: number, item: TxClient) => s + Number(item.totalPrice), 0);
    return sum + poTotal;
  }, 0);

  // 2. Request Count: count RCs (not RASCUNHO, not CANCELADA)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rcWhere: Record<string, any> = {
    organizationId,
    status: { notIn: ['RASCUNHO', 'CANCELADA'] },
    createdAt: { gte: startDate, lte: endDate },
  };
  if (filters.farmId) rcWhere.farmId = filters.farmId;
  if (filters.category) rcWhere.requestType = filters.category;

  const requestCount = await tx.purchaseRequest.count({ where: rcWhere });

  // 3. Avg Cycle Time: RC.createdAt -> Payable.paidAt (PAID)
  const paidPayables = await tx.payable.findMany({
    where: {
      organizationId,
      status: 'PAID',
      isCredit: false,
      paidAt: { gte: startDate, lte: endDate },
      goodsReceipt: {
        purchaseOrder: {
          organizationId,
          deletedAt: null,
          quotation: {
            purchaseRequest: {
              ...(filters.farmId ? { farmId: filters.farmId } : {}),
              ...(filters.category ? { requestType: filters.category } : {}),
            },
          },
        },
      },
    },
    include: {
      goodsReceipt: {
        include: {
          purchaseOrder: {
            include: {
              quotation: {
                include: {
                  purchaseRequest: { select: { createdAt: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const cycleDays: number[] = [];
  for (const payable of paidPayables) {
    const rcCreatedAt = payable.goodsReceipt?.purchaseOrder?.quotation?.purchaseRequest?.createdAt;
    const paidAt = payable.paidAt;
    if (rcCreatedAt && paidAt) {
      const diff =
        (new Date(paidAt).getTime() - new Date(rcCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (diff >= 0) cycleDays.push(diff);
    }
  }

  const avgCycleTimeDays =
    cycleDays.length > 0 ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : 0;

  // 4. On-Time Delivery %: POs with GR.receivedAt <= PO.expectedDeliveryDate
  const posWithGr = await tx.purchaseOrder.findMany({
    where: {
      ...baseWhere,
      status: { in: ['ENTREGUE'] },
      createdAt: { gte: startDate, lte: endDate },
      expectedDeliveryDate: { not: null },
      goodsReceipts: { some: { status: 'CONFIRMADO' } },
    },
    include: {
      goodsReceipts: {
        where: { status: 'CONFIRMADO' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { receivedAt: true, createdAt: true },
      },
    },
  });

  let onTimeCount = 0;
  const totalWithGr = posWithGr.length;
  for (const po of posWithGr) {
    const gr = po.goodsReceipts?.[0];
    if (gr && po.expectedDeliveryDate) {
      const receivedAt = gr.receivedAt ?? gr.createdAt;
      if (new Date(receivedAt) <= new Date(po.expectedDeliveryDate)) {
        onTimeCount += 1;
      }
    }
  }

  const onTimeDeliveryPct = totalWithGr > 0 ? (onTimeCount / totalWithGr) * 100 : 0;

  // 5. Accumulated Saving: from closed quotations in period
  const closedQuotations = await tx.quotation.findMany({
    where: {
      organizationId,
      status: 'FECHADA',
      deletedAt: null,
      createdAt: { gte: startDate, lte: endDate },
      ...(filters.farmId || filters.category
        ? {
            purchaseRequest: {
              ...(filters.farmId ? { farmId: filters.farmId } : {}),
              ...(filters.category ? { requestType: filters.category } : {}),
            },
          }
        : {}),
    },
    include: {
      itemSelections: true,
      suppliers: {
        include: {
          proposal: { include: { items: true } },
        },
      },
    },
  });

  let accumulatedSaving = 0;
  for (const q of closedQuotations) {
    const proposedSuppliers = q.suppliers.filter((s: TxClient) => s.proposal !== null);
    if (proposedSuppliers.length < 2) continue;

    const winnerMap: Record<string, string> = {};
    for (const sel of q.itemSelections) {
      winnerMap[sel.purchaseRequestItemId] = sel.quotationSupplierId;
    }

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

    for (const [itemId, pricesArr] of Object.entries(itemPricesMap)) {
      if (pricesArr.length < 2) continue;
      const maxPriceEntry = (pricesArr as { price: number; qsId: string; qty: number }[]).reduce(
        (a, b) => (a.price >= b.price ? a : b),
      );
      const maxPrice = maxPriceEntry.price;
      const qty = maxPriceEntry.qty;
      const winnerId = winnerMap[itemId];
      const winnerEntry = winnerId
        ? (pricesArr as { price: number; qsId: string; qty: number }[]).find(
            (p) => p.qsId === winnerId,
          )
        : undefined;
      const winnerPrice = winnerEntry
        ? winnerEntry.price
        : Math.min(...(pricesArr as { price: number }[]).map((p) => p.price));
      const saving = (maxPrice - winnerPrice) * qty;
      if (saving > 0) accumulatedSaving += saving;
    }
  }

  return {
    totalVolume,
    requestCount,
    avgCycleTimeDays,
    onTimeDeliveryPct,
    accumulatedSaving,
  };
}

// ─── getDashboardMetrics ──────────────────────────────────────────────

export async function getDashboardMetrics(
  ctx: RlsContext,
  filters: DashboardFilters,
): Promise<{ metrics: DashboardMetrics; charts: DashboardCharts }> {
  const cacheKey = `${ctx.organizationId}:${filters.startDate.toISOString()}:${filters.endDate.toISOString()}:${filters.farmId ?? 'all'}:${filters.category ?? 'all'}`;

  const cached = getCached<{ metrics: DashboardMetrics; charts: DashboardCharts }>(cacheKey);
  if (cached) return cached;

  return withRlsContext(ctx, async (tx: TxClient) => {
    // Build comparison period
    const periodMs = filters.endDate.getTime() - filters.startDate.getTime();
    const prevEnd = new Date(filters.startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodMs);

    const [current, previous] = await Promise.all([
      computePeriodMetrics(tx, ctx.organizationId, filters, filters.startDate, filters.endDate),
      computePeriodMetrics(tx, ctx.organizationId, filters, prevStart, prevEnd),
    ]);

    const metrics: DashboardMetrics = {
      totalVolume: buildKpiValue(current.totalVolume, previous.totalVolume),
      requestCount: buildKpiValue(current.requestCount, previous.requestCount),
      avgCycleTimeDays: buildKpiValue(current.avgCycleTimeDays, previous.avgCycleTimeDays),
      onTimeDeliveryPct: buildKpiValue(current.onTimeDeliveryPct, previous.onTimeDeliveryPct),
      accumulatedSaving: buildKpiValue(current.accumulatedSaving, previous.accumulatedSaving),
    };

    // ─── Charts ──────────────────────────────────────────────────────

    // 1. Purchases by category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cumulativePoWhere: Record<string, any> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      status: { in: ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO', 'ENTREGUE'] },
      createdAt: { gte: filters.startDate, lte: filters.endDate },
    };
    if (filters.farmId) cumulativePoWhere.farmId = filters.farmId;

    const posForChart = await tx.purchaseOrder.findMany({
      where: cumulativePoWhere,
      include: {
        items: { select: { totalPrice: true } },
        quotation: {
          include: { purchaseRequest: { select: { requestType: true } } },
        },
      },
    });

    const categoryTotals: Record<string, number> = {};
    for (const po of posForChart) {
      const category = po.quotation?.purchaseRequest?.requestType ?? 'OUTROS';
      if (filters.category && category !== filters.category) continue;
      const poTotal = po.items.reduce(
        (s: number, item: TxClient) => s + Number(item.totalPrice),
        0,
      );
      categoryTotals[category] = (categoryTotals[category] ?? 0) + poTotal;
    }

    const purchasesByCategory: CategoryChartPoint[] = Object.entries(categoryTotals).map(
      ([category, value]) => ({
        category,
        label: CATEGORY_LABELS[category] ?? category,
        value,
      }),
    );

    // 2. Saving evolution (last 12 months from endDate)
    const twelveMonthsAgo = new Date(filters.endDate);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const savingQuotations = await tx.quotation.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: 'FECHADA',
        deletedAt: null,
        createdAt: { gte: twelveMonthsAgo, lte: filters.endDate },
      },
      include: {
        itemSelections: true,
        suppliers: {
          include: { proposal: { include: { items: true } } },
        },
      },
    });

    const savingByMonth: Record<string, number> = {};
    for (const q of savingQuotations) {
      const month = q.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!savingByMonth[month]) savingByMonth[month] = 0;

      const proposedSuppliers = q.suppliers.filter((s: TxClient) => s.proposal !== null);
      if (proposedSuppliers.length < 2) continue;

      const winnerMap: Record<string, string> = {};
      for (const sel of q.itemSelections) {
        winnerMap[sel.purchaseRequestItemId] = sel.quotationSupplierId;
      }

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

      for (const [itemId, pricesArr] of Object.entries(itemPricesMap)) {
        if (pricesArr.length < 2) continue;
        const maxPrice = Math.max(...(pricesArr as { price: number }[]).map((p) => p.price));
        const qty = (pricesArr[0] as { qty: number }).qty;
        const winnerId = winnerMap[itemId];
        const winnerEntry = winnerId
          ? (pricesArr as { price: number; qsId: string }[]).find((p) => p.qsId === winnerId)
          : undefined;
        const winnerPrice = winnerEntry
          ? winnerEntry.price
          : Math.min(...(pricesArr as { price: number }[]).map((p) => p.price));
        const saving = (maxPrice - winnerPrice) * qty;
        if (saving > 0) savingByMonth[month] = (savingByMonth[month] ?? 0) + saving;
      }
    }

    const savingEvolution: SavingChartPoint[] = Object.entries(savingByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, saving]) => ({ month, saving }));

    // 3. Budget vs Actual
    const budgets = await tx.purchaseBudget.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(filters.farmId ? { farmId: filters.farmId } : {}),
        AND: [{ periodStart: { lte: filters.endDate } }, { periodEnd: { gte: filters.startDate } }],
      },
    });

    const budgetMap: Record<string, number> = {};
    for (const b of budgets) {
      const cat = String(b.category);
      budgetMap[cat] = (budgetMap[cat] ?? 0) + Number(b.budgetedAmount);
    }

    const budgetVsActual: BudgetVsActualPoint[] = Object.entries(budgetMap).map(
      ([category, budget]) => ({
        category,
        label: CATEGORY_LABELS[category] ?? category,
        budget,
        actual: categoryTotals[category] ?? 0,
      }),
    );

    const result = { metrics, charts: { purchasesByCategory, savingEvolution, budgetVsActual } };
    setCache(cacheKey, result);
    return result;
  });
}

// ─── getDashboardAlerts ───────────────────────────────────────────────

export async function getDashboardAlerts(
  ctx: RlsContext,
  filters: { farmId?: string },
): Promise<DashboardAlert[]> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const alerts: DashboardAlert[] = [];

    // 1. Pending RC aging (PENDENTE or EM_ANALISE older than 3 days)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rcWhere: Record<string, any> = {
      organizationId: ctx.organizationId,
      status: { in: ['PENDENTE'] },
      createdAt: { lt: threeDaysAgo },
    };
    if (filters.farmId) rcWhere.farmId = filters.farmId;

    const agingRcs = await tx.purchaseRequest.findMany({
      where: rcWhere,
      select: { id: true },
    });

    if (agingRcs.length > 0) {
      alerts.push({
        type: 'PENDING_RC_AGING',
        message: `${agingRcs.length} requisicao(oes) pendente(s) ha mais de 3 dias`,
        count: agingRcs.length,
        referenceIds: agingRcs.map((rc: TxClient) => rc.id),
      });
    }

    // 2. PO Overdue (expectedDeliveryDate < now, status not ENTREGUE/CANCELADA)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const poWhere: Record<string, any> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      expectedDeliveryDate: { lt: now },
      status: { notIn: ['ENTREGUE', 'CANCELADA'] },
    };
    if (filters.farmId) poWhere.farmId = filters.farmId;

    const overduePOs = await tx.purchaseOrder.findMany({
      where: poWhere,
      select: { id: true },
    });

    if (overduePOs.length > 0) {
      alerts.push({
        type: 'PO_OVERDUE',
        message: `${overduePOs.length} ordem(ns) de compra em atraso`,
        count: overduePOs.length,
        referenceIds: overduePOs.map((po: TxClient) => po.id),
      });
    }

    // 3. Budget Overage: categories where actual spend > budget amount
    const currentBudgets = await tx.purchaseBudget.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(filters.farmId ? { farmId: filters.farmId } : {}),
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
    });

    if (currentBudgets.length > 0) {
      // Get actual spend per category for current period
      const posForAlerts = await tx.purchaseOrder.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          status: { in: ['EMITIDA', 'CONFIRMADA', 'EM_TRANSITO', 'ENTREGUE'] },
        },
        include: {
          items: { select: { totalPrice: true } },
          quotation: {
            include: { purchaseRequest: { select: { requestType: true } } },
          },
        },
      });

      const actualByCategory: Record<string, number> = {};
      for (const po of posForAlerts) {
        const category = po.quotation?.purchaseRequest?.requestType ?? 'OUTROS';
        const poTotal = po.items.reduce(
          (s: number, item: TxClient) => s + Number(item.totalPrice),
          0,
        );
        actualByCategory[category] = (actualByCategory[category] ?? 0) + poTotal;
      }

      const budgetByCategory: Record<string, { budgeted: number; ids: string[] }> = {};
      for (const b of currentBudgets) {
        const cat = String(b.category);
        if (!budgetByCategory[cat]) {
          budgetByCategory[cat] = { budgeted: 0, ids: [] };
        }
        budgetByCategory[cat].budgeted += Number(b.budgetedAmount);
        budgetByCategory[cat].ids.push(b.id);
      }

      for (const [category, { budgeted, ids }] of Object.entries(budgetByCategory)) {
        const actual = actualByCategory[category] ?? 0;
        if (actual > budgeted) {
          alerts.push({
            type: 'BUDGET_OVERAGE',
            message: `Orcamento excedido em ${CATEGORY_LABELS[category] ?? category}: R$ ${actual.toFixed(2)} de R$ ${budgeted.toFixed(2)}`,
            count: 1,
            referenceIds: ids,
          });
        }
      }
    }

    return alerts;
  });
}
