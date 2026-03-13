/**
 * Shared helper for automatic stock deduction from field operations.
 *
 * Used by:
 * - Pesticide applications (US-038 CA8)
 * - Fertilizer applications (US-039)
 * - Soil prep operations (US-034 CA4)
 *
 * Creates a CONSUMPTION-type StockOutput within an existing RLS transaction.
 */

import type { TxClient } from '../../database/rls';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ─────────────────────────────────────────────────────────

export interface StockDeductionItem {
  productId: string;
  quantity: number; // absolute quantity in base unit (L, kg, etc.)
}

export interface StockDeductionInput {
  organizationId: string;
  items: StockDeductionItem[];
  fieldOperationRef: string; // e.g. "pesticide-application:uuid"
  fieldPlotId?: string;
  outputDate?: Date;
  responsibleName?: string;
  notes?: string;
}

export interface StockDeductionResult {
  stockOutputId: string;
  insufficientStockAlerts: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
}

// ─── Helpers ───────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

// ─── Dose → base unit conversion ──────────────────────────────────

/**
 * Convert a per-hectare (or per-plant) dose to absolute quantity in base units.
 *
 * Base units: L for liquids (L_HA, ML_HA), kg for solids (KG_HA, G_HA, T_HA).
 *
 * @param dose - dose value (e.g. 2.5)
 * @param doseUnit - unit string (e.g. 'L_HA', 'KG_HA', 'ML_HA', 'G_HA', 'G_PLANTA', 'T_HA')
 * @param areaHa - area in hectares
 * @param plantsPerHa - plants per hectare (for G_PLANTA only)
 */
export function doseToAbsoluteQuantity(
  dose: number,
  doseUnit: string,
  areaHa: number,
  plantsPerHa?: number,
): number {
  switch (doseUnit) {
    case 'L_HA':
      return dose * areaHa;
    case 'KG_HA':
      return dose * areaHa;
    case 'ML_HA':
      return (dose * areaHa) / 1000; // mL → L
    case 'G_HA':
      return (dose * areaHa) / 1000; // g → kg
    case 'T_HA':
      return dose * areaHa * 1000; // t → kg
    case 'G_PLANTA':
      if (plantsPerHa) {
        return (dose * plantsPerHa * areaHa) / 1000; // g → kg
      }
      return dose / 1000; // fallback: single plant, g → kg
    default:
      return dose * areaHa; // fallback
  }
}

// ─── Main function ─────────────────────────────────────────────────

/**
 * Create a CONSUMPTION stock output within an existing transaction.
 * Returns the stock output ID and any insufficient stock alerts.
 *
 * If all items have zero or no quantity, returns null (no stock output created).
 */
export async function createConsumptionOutput(
  tx: TxClient,
  input: StockDeductionInput,
): Promise<StockDeductionResult | null> {
  const validItems = input.items.filter((i) => i.productId && i.quantity > 0);
  if (validItems.length === 0) return null;

  // Check stock availability
  const alerts: StockDeductionResult['insufficientStockAlerts'] = [];
  for (const item of validItems) {
    const balance = await (tx as any).stockBalance.findUnique({
      where: {
        organizationId_productId: {
          organizationId: input.organizationId,
          productId: item.productId,
        },
      },
    });
    const available = balance ? toNumber(balance.currentQuantity) : 0;
    if (available < item.quantity) {
      const product = await (tx as any).product.findUnique({
        where: { id: item.productId },
        select: { name: true },
      });
      alerts.push({
        productId: item.productId,
        productName: product?.name || item.productId,
        requested: item.quantity,
        available,
      });
    }
  }

  // FEFO batch assignment
  const batchedItems: Array<{
    productId: string;
    quantity: number;
    batchNumber: string | null;
  }> = [];
  for (const item of validItems) {
    const batches = await (tx as any).stockEntryItem.findMany({
      where: {
        productId: item.productId,
        stockEntry: {
          organizationId: input.organizationId,
          status: 'CONFIRMED',
        },
        expirationDate: { not: null },
      },
      orderBy: { expirationDate: 'asc' },
      select: { batchNumber: true },
      take: 1,
    });
    batchedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      batchNumber: batches[0]?.batchNumber || null,
    });
  }

  // Get costs
  const itemsWithCost: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    batchNumber: string | null;
  }> = [];

  for (const item of batchedItems) {
    const balance = await (tx as any).stockBalance.findUnique({
      where: {
        organizationId_productId: {
          organizationId: input.organizationId,
          productId: item.productId,
        },
      },
    });
    const avgCost = balance ? toNumber(balance.averageCost) : 0;
    itemsWithCost.push({
      productId: item.productId,
      quantity: item.quantity,
      unitCost: avgCost,
      totalCost: Math.round(avgCost * item.quantity * 100) / 100,
      batchNumber: item.batchNumber,
    });
  }

  const totalCost = itemsWithCost.reduce((sum, i) => sum + i.totalCost, 0);

  // Create stock output
  const created = await (tx as any).stockOutput.create({
    data: {
      organizationId: input.organizationId,
      outputDate: input.outputDate || new Date(),
      type: 'CONSUMPTION',
      status: 'CONFIRMED',
      fieldOperationRef: input.fieldOperationRef,
      fieldPlotId: input.fieldPlotId || null,
      responsibleName: input.responsibleName || null,
      notes: input.notes || null,
      totalCost,
      createdBy: null,
      items: {
        create: itemsWithCost.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          batchNumber: item.batchNumber,
        })),
      },
    },
    select: { id: true },
  });

  // Deduct balances
  for (const item of itemsWithCost) {
    const existing = await (tx as any).stockBalance.findUnique({
      where: {
        organizationId_productId: {
          organizationId: input.organizationId,
          productId: item.productId,
        },
      },
    });
    if (existing) {
      const prevQty = toNumber(existing.currentQuantity);
      const prevTotal = toNumber(existing.totalValue);
      const newQty = Math.max(0, prevQty - item.quantity);
      const newTotal = Math.max(0, prevTotal - item.totalCost);
      const newAvgCost = newQty > 0 ? newTotal / newQty : toNumber(existing.averageCost);
      await (tx as any).stockBalance.update({
        where: { id: existing.id },
        data: { currentQuantity: newQty, averageCost: newAvgCost, totalValue: newTotal },
      });
    }
  }

  return {
    stockOutputId: created.id,
    insufficientStockAlerts: alerts,
  };
}

/**
 * Cancel a previously created consumption stock output (reverse balances).
 * Used when a field operation is soft-deleted.
 */
export async function cancelConsumptionOutput(
  tx: TxClient,
  organizationId: string,
  stockOutputId: string,
): Promise<void> {
  const output = await (tx as any).stockOutput.findFirst({
    where: { id: stockOutputId, organizationId },
    include: { items: true },
  });

  if (!output || output.status === 'CANCELLED') return;

  // Revert balances
  for (const item of output.items) {
    const qty = toNumber(item.quantity);
    const cost = toNumber(item.totalCost);

    const existing = await (tx as any).stockBalance.findUnique({
      where: {
        organizationId_productId: {
          organizationId,
          productId: item.productId,
        },
      },
    });

    if (existing) {
      const prevQty = toNumber(existing.currentQuantity);
      const prevTotal = toNumber(existing.totalValue);
      const newQty = prevQty + qty;
      const newTotal = prevTotal + cost;
      const newAvgCost = newQty > 0 ? newTotal / newQty : 0;
      await (tx as any).stockBalance.update({
        where: { id: existing.id },
        data: { currentQuantity: newQty, averageCost: newAvgCost, totalValue: newTotal },
      });
    } else {
      const avgCost = qty > 0 ? cost / qty : 0;
      await (tx as any).stockBalance.create({
        data: {
          organizationId,
          productId: item.productId,
          currentQuantity: qty,
          averageCost: avgCost,
          totalValue: cost,
        },
      });
    }
  }

  // Mark as cancelled
  await (tx as any).stockOutput.update({
    where: { id: stockOutputId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
}
