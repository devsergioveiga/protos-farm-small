import { Decimal } from 'decimal.js';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import {
  FuelRecordError,
  type CreateFuelRecordInput,
  type ListFuelRecordsQuery,
  type FuelStatsResult,
} from './fuel-records.types';

// ─── Service functions ────────────────────────────────────────────────

export async function createFuelRecord(
  ctx: RlsContext & { userId: string },
  input: CreateFuelRecordInput,
) {
  if (!input.assetId) throw new FuelRecordError('Ativo é obrigatório', 400);
  if (!input.farmId) throw new FuelRecordError('Fazenda é obrigatória', 400);
  if (!input.fuelDate) throw new FuelRecordError('Data do abastecimento é obrigatória', 400);
  if (input.liters == null) throw new FuelRecordError('Quantidade de litros é obrigatória', 400);
  if (input.pricePerLiter == null) throw new FuelRecordError('Preço por litro é obrigatório', 400);

  // Verify asset belongs to org
  const asset = await prisma.asset.findFirst({
    where: { id: input.assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: { id: true, name: true, assetType: true },
  });
  if (!asset) throw new FuelRecordError('Ativo não encontrado', 404);

  const liters = new Decimal(String(input.liters));
  const pricePerLiter = new Decimal(String(input.pricePerLiter));
  const totalCost = liters.mul(pricePerLiter);

  const record = await prisma.fuelRecord.create({
    data: {
      organizationId: ctx.organizationId,
      assetId: input.assetId,
      farmId: input.farmId,
      fuelDate: new Date(input.fuelDate),
      liters: liters.toDecimalPlaces(3).toString(),
      pricePerLiter: pricePerLiter.toDecimalPlaces(4).toString(),
      totalCost: totalCost.toDecimalPlaces(2).toString(),
      hourmeterAtFuel: input.hourmeterAtFuel != null ? String(input.hourmeterAtFuel) : undefined,
      odometerAtFuel: input.odometerAtFuel != null ? String(input.odometerAtFuel) : undefined,
      notes: input.notes,
      createdBy: ctx.userId,
    },
    include: { asset: { select: { name: true, assetType: true } } },
  });

  return record;
}

export async function listFuelRecords(ctx: RlsContext, query: ListFuelRecordsQuery) {
  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 20), 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { organizationId: ctx.organizationId };

  if (query.assetId) where['assetId'] = query.assetId;
  if (query.farmId) where['farmId'] = query.farmId;

  if (query.dateFrom || query.dateTo) {
    const dateFilter: Record<string, unknown> = {};
    if (query.dateFrom) dateFilter['gte'] = new Date(query.dateFrom);
    if (query.dateTo) dateFilter['lte'] = new Date(query.dateTo);
    where['fuelDate'] = dateFilter;
  }

  const [data, total] = await Promise.all([
    prisma.fuelRecord.findMany({
      where: where as never,
      include: { asset: { select: { name: true, assetType: true } } },
      orderBy: { fuelDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.fuelRecord.count({ where: where as never }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getFuelStats(
  ctx: RlsContext,
  assetId: string,
  periodStart?: string,
  periodEnd?: string,
): Promise<FuelStatsResult> {
  // Verify asset belongs to org
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: { assetType: true },
  });
  if (!asset) throw new FuelRecordError('Ativo não encontrado', 404);

  const dateFilter: Record<string, unknown> = {};
  if (periodStart) dateFilter['gte'] = new Date(periodStart);
  if (periodEnd) dateFilter['lte'] = new Date(periodEnd);
  const hasDates = Object.keys(dateFilter).length > 0;

  // Asset-level aggregates
  const assetWhere: Record<string, unknown> = { assetId };
  if (hasDates) assetWhere['fuelDate'] = dateFilter;

  const assetAgg = await prisma.fuelRecord.aggregate({
    where: assetWhere as never,
    _sum: { liters: true, totalCost: true },
    _count: { id: true },
    _min: { hourmeterAtFuel: true },
    _max: { hourmeterAtFuel: true },
  });

  const totalLiters = Number(assetAgg._sum.liters ?? 0);
  const totalCost = Number(assetAgg._sum.totalCost ?? 0);
  const recordCount = assetAgg._count.id;

  // Asset avg l/h — only if hourmeter readings available
  let assetAvgLitersPerHour: number | null = null;
  let assetCostPerHour: number | null = null;
  const minH = assetAgg._min.hourmeterAtFuel;
  const maxH = assetAgg._max.hourmeterAtFuel;
  if (minH != null && maxH != null) {
    const hoursDiff = new Decimal(String(maxH)).minus(new Decimal(String(minH)));
    if (hoursDiff.gt(0)) {
      assetAvgLitersPerHour = new Decimal(totalLiters).div(hoursDiff).toDecimalPlaces(3).toNumber();
      assetCostPerHour = new Decimal(totalCost).div(hoursDiff).toDecimalPlaces(2).toNumber();
    }
  }

  // Fleet-level aggregates (same asset type in org)
  const fleetWhere: Record<string, unknown> = {
    organizationId: ctx.organizationId,
    asset: { assetType: asset.assetType },
  };
  if (hasDates) fleetWhere['fuelDate'] = dateFilter;

  const fleetAgg = await prisma.fuelRecord.aggregate({
    where: fleetWhere as never,
    _sum: { liters: true, totalCost: true },
    _min: { hourmeterAtFuel: true },
    _max: { hourmeterAtFuel: true },
  });

  let fleetAvgLitersPerHour: number | null = null;
  let fleetCostPerHour: number | null = null;
  const fleetMinH = fleetAgg._min.hourmeterAtFuel;
  const fleetMaxH = fleetAgg._max.hourmeterAtFuel;
  if (fleetMinH != null && fleetMaxH != null) {
    const fleetHoursDiff = new Decimal(String(fleetMaxH)).minus(new Decimal(String(fleetMinH)));
    if (fleetHoursDiff.gt(0)) {
      const fleetTotalLiters = Number(fleetAgg._sum.liters ?? 0);
      const fleetTotalCost = Number(fleetAgg._sum.totalCost ?? 0);
      fleetAvgLitersPerHour = new Decimal(fleetTotalLiters)
        .div(fleetHoursDiff)
        .toDecimalPlaces(3)
        .toNumber();
      fleetCostPerHour = new Decimal(fleetTotalCost)
        .div(fleetHoursDiff)
        .toDecimalPlaces(2)
        .toNumber();
    }
  }

  return {
    assetAvgLitersPerHour,
    fleetAvgLitersPerHour,
    assetCostPerHour,
    fleetCostPerHour,
    totalLiters,
    totalCost,
    recordCount,
  };
}

export async function deleteFuelRecord(ctx: RlsContext, id: string) {
  const record = await prisma.fuelRecord.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!record) throw new FuelRecordError('Registro de abastecimento não encontrado', 404);

  return prisma.fuelRecord.delete({ where: { id } });
}
