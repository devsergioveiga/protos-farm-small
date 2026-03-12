import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PESTICIDE_TYPES,
  type StockLevel,
  type StockLevelAlert,
  type ExpiryAlert,
  type StockDashboardSummary,
  type StockLevelDashboard,
  type ListStockLevelAlertsQuery,
  type ListExpiryAlertsQuery,
  type StockLevelAlertsResult,
  type ExpiryAlertsResult,
} from './stock-alerts.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function classifyStockLevel(
  currentQuantity: number,
  reorderPoint: number | null,
  safetyStock: number | null,
): StockLevel {
  if (reorderPoint != null && currentQuantity <= reorderPoint) return 'CRITICAL';
  if (safetyStock != null && currentQuantity <= safetyStock) return 'WARNING';
  return 'OK';
}

function isPesticideType(type: string): boolean {
  return (PESTICIDE_TYPES as readonly string[]).includes(type);
}

// ─── CA3 + CA5: Stock Level Dashboard ───────────────────────────────

export async function getStockLevelDashboard(ctx: RlsContext): Promise<StockLevelDashboard> {
  return withRlsContext(ctx, async (tx) => {
    // Get all products with stock balances
    const balances = await (tx as any).stockBalance.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            type: true,
            reorderPoint: true,
            safetyStock: true,
            measurementUnit: { select: { abbreviation: true } },
          },
        },
      },
    });

    let criticalCount = 0;
    let warningCount = 0;
    let okCount = 0;
    let noThresholdCount = 0;
    let totalStockValue = 0;
    const alerts: StockLevelAlert[] = [];

    for (const bal of balances) {
      const qty = toNumber(bal.currentQuantity);
      const reorderPoint =
        bal.product.reorderPoint != null ? toNumber(bal.product.reorderPoint) : null;
      const safetyStock =
        bal.product.safetyStock != null ? toNumber(bal.product.safetyStock) : null;
      const avgCost = toNumber(bal.averageCost);
      const totalVal = toNumber(bal.totalValue);
      totalStockValue += totalVal;

      if (reorderPoint == null && safetyStock == null) {
        noThresholdCount++;
        continue;
      }

      const level = classifyStockLevel(qty, reorderPoint, safetyStock);

      if (level === 'CRITICAL') criticalCount++;
      else if (level === 'WARNING') warningCount++;
      else okCount++;

      // Include all products that have thresholds configured
      alerts.push({
        productId: bal.product.id,
        productName: bal.product.name,
        productType: bal.product.type,
        measurementUnit: bal.product.measurementUnit?.abbreviation ?? null,
        currentQuantity: qty,
        reorderPoint,
        safetyStock,
        averageCost: avgCost,
        totalValue: totalVal,
        level,
      });
    }

    // Get expiry counts for summary
    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [expiredCount, expiringCount] = await Promise.all([
      (tx as any).stockEntryItem.count({
        where: {
          stockEntry: { organizationId: ctx.organizationId, status: 'CONFIRMED' },
          expirationDate: { lt: now },
          quantity: { gt: 0 },
        },
      }),
      (tx as any).stockEntryItem.count({
        where: {
          stockEntry: { organizationId: ctx.organizationId, status: 'CONFIRMED' },
          expirationDate: { gte: now, lte: ninetyDaysFromNow },
          quantity: { gt: 0 },
        },
      }),
    ]);

    // Sort alerts: CRITICAL first, then WARNING, then OK
    const levelOrder: Record<StockLevel, number> = { CRITICAL: 0, WARNING: 1, OK: 2 };
    alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

    const summary: StockDashboardSummary = {
      totalProducts: balances.length,
      criticalCount,
      warningCount,
      okCount,
      noThresholdCount,
      expiredCount,
      expiringCount,
      totalStockValue,
    };

    return { summary, alerts };
  });
}

// ─── CA3: Stock Level Alerts (paginated) ────────────────────────────

export async function listStockLevelAlerts(
  ctx: RlsContext,
  query: ListStockLevelAlertsQuery,
): Promise<StockLevelAlertsResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  return withRlsContext(ctx, async (tx) => {
    // Build product filter
    const productWhere: any = {
      deletedAt: null,
      organizationId: ctx.organizationId,
    };
    if (query.productType) productWhere.type = query.productType;
    if (query.search) {
      productWhere.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { commercialName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Only products with thresholds configured
    if (!query.level) {
      productWhere.OR = [...(productWhere.OR ?? [])];
      productWhere.AND = [
        { OR: [{ reorderPoint: { not: null } }, { safetyStock: { not: null } }] },
      ];
    } else {
      productWhere.AND = [
        { OR: [{ reorderPoint: { not: null } }, { safetyStock: { not: null } }] },
      ];
    }

    const balances = await (tx as any).stockBalance.findMany({
      where: {
        organizationId: ctx.organizationId,
        product: productWhere,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            type: true,
            reorderPoint: true,
            safetyStock: true,
            measurementUnit: { select: { abbreviation: true } },
          },
        },
      },
    });

    // Classify and filter
    let allAlerts: StockLevelAlert[] = balances.map((bal: any) => {
      const qty = toNumber(bal.currentQuantity);
      const reorderPt =
        bal.product.reorderPoint != null ? toNumber(bal.product.reorderPoint) : null;
      const safetySt = bal.product.safetyStock != null ? toNumber(bal.product.safetyStock) : null;
      return {
        productId: bal.product.id,
        productName: bal.product.name,
        productType: bal.product.type,
        measurementUnit: bal.product.measurementUnit?.abbreviation ?? null,
        currentQuantity: qty,
        reorderPoint: reorderPt,
        safetyStock: safetySt,
        averageCost: toNumber(bal.averageCost),
        totalValue: toNumber(bal.totalValue),
        level: classifyStockLevel(qty, reorderPt, safetySt),
      };
    });

    // Filter by level
    if (query.level) {
      allAlerts = allAlerts.filter((a) => a.level === query.level);
    }

    // Sort: CRITICAL > WARNING > OK
    const levelOrder: Record<StockLevel, number> = { CRITICAL: 0, WARNING: 1, OK: 2 };
    allAlerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

    const total = allAlerts.length;
    const skip = (page - 1) * limit;
    const data = allAlerts.slice(skip, skip + limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

// ─── CA4 + CA6: Expiry Alerts ───────────────────────────────────────

export async function listExpiryAlerts(
  ctx: RlsContext,
  query: ListExpiryAlertsQuery,
): Promise<ExpiryAlertsResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const daysAhead = query.daysAhead ?? 90;
  const includeExpired = query.includeExpired !== false;

  return withRlsContext(ctx, async (tx) => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // Build where clause
    const where: any = {
      stockEntry: { organizationId: ctx.organizationId, status: 'CONFIRMED' },
      expirationDate: { not: null },
      quantity: { gt: 0 },
    };

    if (includeExpired) {
      where.expirationDate = { not: null, lte: futureDate };
    } else {
      where.expirationDate = { not: null, gte: now, lte: futureDate };
    }

    // Product filter
    const productWhere: any = { deletedAt: null };
    if (query.productType) productWhere.type = query.productType;
    if (query.isPesticide) {
      productWhere.type = { in: [...PESTICIDE_TYPES] };
    }
    if (query.search) {
      productWhere.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { commercialName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(productWhere).length > 1) {
      where.product = productWhere;
    }

    const [items, total] = await Promise.all([
      (tx as any).stockEntryItem.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              type: true,
              expiryAlertDays: true,
              measurementUnit: { select: { abbreviation: true } },
            },
          },
        },
        orderBy: { expirationDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (tx as any).stockEntryItem.count({ where }),
    ]);

    const data: ExpiryAlert[] = items.map((item: any) => {
      const expDate = new Date(item.expirationDate);
      const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntil < 0;
      const productType = item.product.type as string;
      const isPesticide = isPesticideType(productType);

      return {
        productId: item.product.id,
        productName: item.product.name,
        productType,
        measurementUnit: item.product.measurementUnit?.abbreviation ?? null,
        batchNumber: item.batchNumber ?? null,
        expirationDate: expDate.toISOString(),
        daysUntilExpiry: daysUntil,
        quantity: toNumber(item.quantity),
        unitCost: toNumber(item.unitCost),
        totalCost: toNumber(item.totalCost),
        isExpired,
        isPesticide,
        inpevRequired: isPesticide && isExpired,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

// ─── CA7: Expiry Report (CSV) ───────────────────────────────────────

export async function getExpiryReportCSV(
  ctx: RlsContext,
  daysAhead: number = 90,
  includeExpired: boolean = true,
  productType?: string,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const where: any = {
      stockEntry: { organizationId: ctx.organizationId, status: 'CONFIRMED' },
      expirationDate: { not: null },
      quantity: { gt: 0 },
    };

    if (includeExpired) {
      where.expirationDate = { not: null, lte: futureDate };
    } else {
      where.expirationDate = { not: null, gte: now, lte: futureDate };
    }

    if (productType) {
      where.product = { type: productType, deletedAt: null };
    }

    const items = await (tx as any).stockEntryItem.findMany({
      where,
      include: {
        product: {
          select: {
            name: true,
            type: true,
            measurementUnit: { select: { abbreviation: true } },
          },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });

    const header =
      'Produto;Tipo;Lote;Validade;Dias até Vencimento;Quantidade;Unidade;Custo Unit.;Custo Total;Vencido;Defensivo;InpEV Obrigatório';

    const rows = items.map((item: any) => {
      const expDate = new Date(item.expirationDate);
      const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntil < 0;
      const productType = item.product.type as string;
      const isPest = isPesticideType(productType);

      return [
        `"${item.product.name}"`,
        productType,
        item.batchNumber || '',
        expDate.toISOString().split('T')[0],
        daysUntil,
        toNumber(item.quantity),
        item.product.measurementUnit?.abbreviation || '',
        toNumber(item.unitCost).toFixed(4),
        toNumber(item.totalCost).toFixed(2),
        isExpired ? 'Sim' : 'Não',
        isPest ? 'Sim' : 'Não',
        isPest && isExpired ? 'Sim' : 'Não',
      ].join(';');
    });

    return [header, ...rows].join('\n');
  });
}
