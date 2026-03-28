import { Decimal } from 'decimal.js';
import { prisma } from '../../database/prisma';

// ─── Error ────────────────────────────────────────────────────────────

export class OperationalCostError extends Error {
  statusCode: number;
  data?: Record<string, unknown>;

  constructor(message: string, statusCode = 400, data?: Record<string, unknown>) {
    super(message);
    this.name = 'OperationalCostError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

// ─── Result Interface ─────────────────────────────────────────────────

export interface OperationalCostResult {
  acquisitionValue: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  maintenanceCost: number;
  fuelCost: number;
  insuranceCost: null;
  totalOperationalCost: number;
  totalLifetimeCost: number;
  costPerHour: number | null;
  currentHourmeter: number | null;
  fuelRecordCount: number;
  notes: string[];
}

// ─── Service function ─────────────────────────────────────────────────

export async function getOperationalCost(
  ctx: { organizationId: string },
  assetId: string,
  periodStart?: string,
  periodEnd?: string,
): Promise<OperationalCostResult> {
  // 1. Verify asset
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: {
      acquisitionValue: true,
      currentHourmeter: true,
      currentOdometer: true,
      assetType: true,
    },
  });
  if (!asset) throw new OperationalCostError('Ativo não encontrado', 404);

  // 2. Build optional date filter for period-scoped queries
  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  if (periodStart || periodEnd) {
    dateFilter = {};
    if (periodStart) dateFilter.gte = new Date(periodStart);
    if (periodEnd) dateFilter.lte = new Date(periodEnd);
  }

  // 3. Accumulated depreciation — cumulative, NOT period filtered
  const depreciationAgg = await prisma.depreciationEntry.aggregate({
    where: {
      assetId,
      organizationId: ctx.organizationId,
      reversedAt: null,
    },
    _sum: { depreciationAmount: true },
  });

  // 4. Maintenance cost (completed work orders, period filtered)
  const maintenanceAgg = await prisma.workOrder.aggregate({
    where: {
      assetId,
      organizationId: ctx.organizationId,
      status: 'CONCLUIDA',
      ...(dateFilter ? { completedAt: dateFilter } : {}),
    } as never,
    _sum: { totalCost: true },
  });

  // 5. Fuel cost (period filtered)
  const fuelAgg = await prisma.fuelRecord.aggregate({
    where: {
      assetId,
      organizationId: ctx.organizationId,
      ...(dateFilter ? { fuelDate: dateFilter } : {}),
    },
    _sum: { totalCost: true },
    _count: { id: true },
  });

  // 6. Decimal-safe arithmetic
  const acquisitionValue = new Decimal(String(asset.acquisitionValue ?? 0));
  const depreciationTotal = new Decimal(String(depreciationAgg._sum.depreciationAmount ?? 0));
  const maintenanceTotal = new Decimal(String(maintenanceAgg._sum.totalCost ?? 0));
  const fuelTotal = new Decimal(String(fuelAgg._sum.totalCost ?? 0));

  const netBookValue = Decimal.max(acquisitionValue.minus(depreciationTotal), new Decimal(0));
  const totalOperationalCost = maintenanceTotal.plus(fuelTotal);
  const totalLifetimeCost = acquisitionValue.plus(maintenanceTotal).plus(fuelTotal);

  // 7. Cost per hour
  let costPerHour: number | null = null;
  if (asset.currentHourmeter != null) {
    const hourmeter = new Decimal(String(asset.currentHourmeter));
    if (hourmeter.gt(0)) {
      costPerHour = totalLifetimeCost.div(hourmeter).toDecimalPlaces(2).toNumber();
    }
  }

  // 8. Notes
  const notes: string[] = ['Custo de seguro não disponível — campo não modelado'];

  return {
    acquisitionValue: acquisitionValue.toNumber(),
    accumulatedDepreciation: depreciationTotal.toNumber(),
    netBookValue: netBookValue.toNumber(),
    maintenanceCost: maintenanceTotal.toNumber(),
    fuelCost: fuelTotal.toNumber(),
    insuranceCost: null,
    totalOperationalCost: totalOperationalCost.toNumber(),
    totalLifetimeCost: totalLifetimeCost.toNumber(),
    costPerHour,
    currentHourmeter:
      asset.currentHourmeter != null
        ? new Decimal(String(asset.currentHourmeter)).toNumber()
        : null,
    fuelRecordCount: fuelAgg._count.id,
    notes,
  };
}
