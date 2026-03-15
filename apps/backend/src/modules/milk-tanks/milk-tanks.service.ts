import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  MilkTankError,
  DIVERGENCE_THRESHOLD,
  type CreateTankInput,
  type UpdateTankInput,
  type CreateMeasurementInput,
  type CreateCollectionInput,
  type UpdateCollectionInput,
  type ListCollectionsQuery,
  type ListMeasurementsQuery,
  type TankItem,
  type MeasurementItem,
  type CollectionItem,
  type ReconciliationItem,
  type MonthlyReportItem,
} from './milk-tanks.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Includes ────────────────────────────────────────────────────────

const COLLECTION_INCLUDE = {
  tank: { select: { name: true } },
  recorder: { select: { name: true } },
};

const MEASUREMENT_INCLUDE = {
  tank: { select: { name: true } },
  recorder: { select: { name: true } },
};

// ─── Helpers ─────────────────────────────────────────────────────────

function toTankItem(row: any): TankItem {
  return {
    id: row.id,
    farmId: row.farmId,
    name: row.name,
    capacityLiters: row.capacityLiters,
    location: row.location ?? null,
    serialNumber: row.serialNumber ?? null,
    isActive: row.isActive,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toMeasurementItem(row: any): MeasurementItem {
  return {
    id: row.id,
    tankId: row.tankId,
    tankName: row.tank?.name ?? '',
    measureDate: (row.measureDate as Date).toISOString().slice(0, 10),
    volumeLiters: row.volumeLiters,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toCollectionItem(row: any): CollectionItem {
  return {
    id: row.id,
    farmId: row.farmId,
    tankId: row.tankId ?? null,
    tankName: row.tank?.name ?? null,
    collectionDate: (row.collectionDate as Date).toISOString().slice(0, 10),
    collectionTime: row.collectionTime ?? null,
    dairyCompany: row.dairyCompany,
    driverName: row.driverName ?? null,
    volumeLiters: row.volumeLiters,
    sampleCollected: row.sampleCollected,
    milkTemperature: row.milkTemperature ?? null,
    ticketNumber: row.ticketNumber ?? null,
    ticketPhotoPath: row.ticketPhotoPath ?? null,
    ticketPhotoName: row.ticketPhotoName ?? null,
    productionLiters: row.productionLiters ?? null,
    divergencePercent: row.divergencePercent ?? null,
    divergenceAlert: row.divergenceAlert ?? false,
    pricePerLiter: row.pricePerLiter ?? null,
    grossValue: row.grossValue ?? null,
    qualityDiscount: row.qualityDiscount ?? null,
    freightDiscount: row.freightDiscount ?? null,
    otherDiscounts: row.otherDiscounts ?? null,
    netValue: row.netValue ?? null,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── TANK CRUD (CA1) ────────────────────────────────────────────────

export async function createTank(
  ctx: RlsContext,
  farmId: string,
  input: CreateTankInput,
): Promise<TankItem> {
  if (!input.name?.trim()) {
    throw new MilkTankError('Nome do tanque é obrigatório', 400);
  }
  if (input.capacityLiters == null || input.capacityLiters <= 0) {
    throw new MilkTankError('Capacidade em litros deve ser maior que zero', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).coolingTank.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        name: input.name.trim(),
        capacityLiters: input.capacityLiters,
        location: input.location ?? null,
        serialNumber: input.serialNumber ?? null,
      },
    });
    return toTankItem(row);
  });
}

export async function listTanks(ctx: RlsContext, farmId: string): Promise<TankItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const rows = await (tx as any).coolingTank.findMany({
      where: { farmId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toTankItem);
  });
}

export async function getTank(ctx: RlsContext, farmId: string, tankId: string): Promise<TankItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).coolingTank.findFirst({
      where: { id: tankId, farmId },
    });
    if (!row) {
      throw new MilkTankError('Tanque não encontrado', 404);
    }
    return toTankItem(row);
  });
}

export async function updateTank(
  ctx: RlsContext,
  farmId: string,
  tankId: string,
  input: UpdateTankInput,
): Promise<TankItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).coolingTank.findFirst({
      where: { id: tankId, farmId },
    });
    if (!existing) {
      throw new MilkTankError('Tanque não encontrado', 404);
    }

    const data: any = {};
    if (input.name !== undefined) {
      if (!input.name.trim()) {
        throw new MilkTankError('Nome do tanque é obrigatório', 400);
      }
      data.name = input.name.trim();
    }
    if (input.capacityLiters !== undefined) {
      if (input.capacityLiters <= 0) {
        throw new MilkTankError('Capacidade em litros deve ser maior que zero', 400);
      }
      data.capacityLiters = input.capacityLiters;
    }
    if (input.location !== undefined) data.location = input.location;
    if (input.serialNumber !== undefined) data.serialNumber = input.serialNumber;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const row = await (tx as any).coolingTank.update({
      where: { id: tankId },
      data,
    });
    return toTankItem(row);
  });
}

export async function deleteTank(ctx: RlsContext, farmId: string, tankId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).coolingTank.findFirst({
      where: { id: tankId, farmId },
    });
    if (!existing) {
      throw new MilkTankError('Tanque não encontrado', 404);
    }

    // Soft-delete: deactivate instead of hard delete
    await (tx as any).coolingTank.update({
      where: { id: tankId },
      data: { isActive: false },
    });
  });
}

// ─── TANK MEASUREMENT (CA2) ─────────────────────────────────────────

export async function recordMeasurement(
  ctx: RlsContext,
  farmId: string,
  tankId: string,
  userId: string,
  input: CreateMeasurementInput,
): Promise<MeasurementItem> {
  if (!input.measureDate) {
    throw new MilkTankError('Data da medição é obrigatória', 400);
  }
  const measureDate = new Date(input.measureDate);
  if (isNaN(measureDate.getTime())) {
    throw new MilkTankError('Data da medição inválida', 400);
  }
  if (measureDate > new Date()) {
    throw new MilkTankError('Data da medição não pode ser no futuro', 400);
  }
  if (input.volumeLiters == null || input.volumeLiters < 0) {
    throw new MilkTankError('Volume em litros deve ser maior ou igual a zero', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const tank = await (tx as any).coolingTank.findFirst({
      where: { id: tankId, farmId },
    });
    if (!tank) {
      throw new MilkTankError('Tanque não encontrado', 404);
    }

    if (input.volumeLiters > tank.capacityLiters) {
      throw new MilkTankError(
        `Volume (${input.volumeLiters}L) excede a capacidade do tanque (${tank.capacityLiters}L)`,
        400,
      );
    }

    // Upsert: one measurement per tank per date
    const row = await (tx as any).tankMeasurement.upsert({
      where: {
        tankId_measureDate: {
          tankId,
          measureDate: new Date(input.measureDate),
        },
      },
      update: {
        volumeLiters: input.volumeLiters,
        recordedBy: userId,
      },
      create: {
        tankId,
        measureDate: new Date(input.measureDate),
        volumeLiters: input.volumeLiters,
        recordedBy: userId,
      },
      include: MEASUREMENT_INCLUDE,
    });

    return toMeasurementItem(row);
  });
}

export async function listMeasurements(
  ctx: RlsContext,
  farmId: string,
  tankId: string,
  query: ListMeasurementsQuery,
): Promise<{ data: MeasurementItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    // Verify tank belongs to farm
    const tank = await (tx as any).coolingTank.findFirst({
      where: { id: tankId, farmId },
    });
    if (!tank) {
      throw new MilkTankError('Tanque não encontrado', 404);
    }

    const where: any = { tankId };
    if (query.dateFrom || query.dateTo) {
      where.measureDate = {};
      if (query.dateFrom) where.measureDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.measureDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).tankMeasurement.findMany({
        where,
        include: MEASUREMENT_INCLUDE,
        orderBy: { measureDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).tankMeasurement.count({ where }),
    ]);

    return {
      data: rows.map(toMeasurementItem),
      total,
    };
  });
}

// ─── MILK COLLECTION (CA3) ──────────────────────────────────────────

async function calcReconciliation(
  tx: any,
  farmId: string,
  collectionDate: Date,
  volumeCollected: number,
): Promise<{
  productionLiters: number | null;
  divergencePercent: number | null;
  divergenceAlert: boolean;
}> {
  // Sum all milking records for the given date on this farm
  const milkings = await tx.milkingRecord.findMany({
    where: {
      farmId,
      milkingDate: collectionDate,
    },
    select: { liters: true },
  });

  if (milkings.length === 0) {
    return { productionLiters: null, divergencePercent: null, divergenceAlert: false };
  }

  const productionLiters = roundTwo(milkings.reduce((sum: number, m: any) => sum + m.liters, 0));

  if (productionLiters === 0) {
    return { productionLiters, divergencePercent: null, divergenceAlert: false };
  }

  const divergencePercent = roundTwo(
    ((volumeCollected - productionLiters) / productionLiters) * 100,
  );
  const divergenceAlert = Math.abs(divergencePercent) > DIVERGENCE_THRESHOLD;

  return { productionLiters, divergencePercent, divergenceAlert };
}

export async function createCollection(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateCollectionInput,
): Promise<CollectionItem> {
  if (!input.collectionDate) {
    throw new MilkTankError('Data da coleta é obrigatória', 400);
  }
  const collectionDate = new Date(input.collectionDate);
  if (isNaN(collectionDate.getTime())) {
    throw new MilkTankError('Data da coleta inválida', 400);
  }
  if (!input.dairyCompany?.trim()) {
    throw new MilkTankError('Laticínio é obrigatório', 400);
  }
  if (input.volumeLiters == null || input.volumeLiters <= 0) {
    throw new MilkTankError('Volume coletado deve ser maior que zero', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate tank if provided
    if (input.tankId) {
      const tank = await (tx as any).coolingTank.findFirst({
        where: { id: input.tankId, farmId },
      });
      if (!tank) {
        throw new MilkTankError('Tanque não encontrado', 404);
      }
    }

    // CA5: Auto-calc reconciliation
    const reconciliation = await calcReconciliation(tx, farmId, collectionDate, input.volumeLiters);

    const row = await (tx as any).milkCollection.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        tankId: input.tankId ?? null,
        collectionDate,
        collectionTime: input.collectionTime ?? null,
        dairyCompany: input.dairyCompany.trim(),
        driverName: input.driverName ?? null,
        volumeLiters: input.volumeLiters,
        sampleCollected: input.sampleCollected ?? false,
        milkTemperature: input.milkTemperature ?? null,
        ticketNumber: input.ticketNumber ?? null,
        productionLiters: reconciliation.productionLiters,
        divergencePercent: reconciliation.divergencePercent,
        divergenceAlert: reconciliation.divergenceAlert,
        pricePerLiter: input.pricePerLiter ?? null,
        grossValue: input.grossValue ?? null,
        qualityDiscount: input.qualityDiscount ?? null,
        freightDiscount: input.freightDiscount ?? null,
        otherDiscounts: input.otherDiscounts ?? null,
        netValue: input.netValue ?? null,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: COLLECTION_INCLUDE,
    });

    return toCollectionItem(row);
  });
}

export async function listCollections(
  ctx: RlsContext,
  farmId: string,
  query: ListCollectionsQuery,
): Promise<{ data: CollectionItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.dairyCompany) {
      where.dairyCompany = { contains: query.dairyCompany, mode: 'insensitive' };
    }
    if (query.divergenceAlert !== undefined) {
      where.divergenceAlert = query.divergenceAlert;
    }
    if (query.dateFrom || query.dateTo) {
      where.collectionDate = {};
      if (query.dateFrom) where.collectionDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.collectionDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).milkCollection.findMany({
        where,
        include: COLLECTION_INCLUDE,
        orderBy: { collectionDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).milkCollection.count({ where }),
    ]);

    return {
      data: rows.map(toCollectionItem),
      total,
    };
  });
}

export async function getCollection(
  ctx: RlsContext,
  farmId: string,
  collectionId: string,
): Promise<CollectionItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).milkCollection.findFirst({
      where: { id: collectionId, farmId },
      include: COLLECTION_INCLUDE,
    });
    if (!row) {
      throw new MilkTankError('Coleta não encontrada', 404);
    }
    return toCollectionItem(row);
  });
}

export async function updateCollection(
  ctx: RlsContext,
  farmId: string,
  collectionId: string,
  input: UpdateCollectionInput,
): Promise<CollectionItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).milkCollection.findFirst({
      where: { id: collectionId, farmId },
    });
    if (!existing) {
      throw new MilkTankError('Coleta não encontrada', 404);
    }

    const data: any = {};

    if (input.tankId !== undefined) data.tankId = input.tankId;
    if (input.collectionTime !== undefined) data.collectionTime = input.collectionTime;
    if (input.dairyCompany !== undefined) {
      if (!input.dairyCompany.trim()) {
        throw new MilkTankError('Laticínio é obrigatório', 400);
      }
      data.dairyCompany = input.dairyCompany.trim();
    }
    if (input.driverName !== undefined) data.driverName = input.driverName;
    if (input.volumeLiters !== undefined) {
      if (input.volumeLiters <= 0) {
        throw new MilkTankError('Volume coletado deve ser maior que zero', 400);
      }
      data.volumeLiters = input.volumeLiters;

      // Recalculate reconciliation when volume changes
      const reconciliation = await calcReconciliation(
        tx,
        farmId,
        existing.collectionDate,
        input.volumeLiters,
      );
      data.productionLiters = reconciliation.productionLiters;
      data.divergencePercent = reconciliation.divergencePercent;
      data.divergenceAlert = reconciliation.divergenceAlert;
    }
    if (input.sampleCollected !== undefined) data.sampleCollected = input.sampleCollected;
    if (input.milkTemperature !== undefined) data.milkTemperature = input.milkTemperature;
    if (input.ticketNumber !== undefined) data.ticketNumber = input.ticketNumber;
    if (input.pricePerLiter !== undefined) data.pricePerLiter = input.pricePerLiter;
    if (input.grossValue !== undefined) data.grossValue = input.grossValue;
    if (input.qualityDiscount !== undefined) data.qualityDiscount = input.qualityDiscount;
    if (input.freightDiscount !== undefined) data.freightDiscount = input.freightDiscount;
    if (input.otherDiscounts !== undefined) data.otherDiscounts = input.otherDiscounts;
    if (input.netValue !== undefined) data.netValue = input.netValue;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).milkCollection.update({
      where: { id: collectionId },
      data,
      include: COLLECTION_INCLUDE,
    });

    return toCollectionItem(row);
  });
}

export async function deleteCollection(
  ctx: RlsContext,
  farmId: string,
  collectionId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).milkCollection.findFirst({
      where: { id: collectionId, farmId },
    });
    if (!existing) {
      throw new MilkTankError('Coleta não encontrada', 404);
    }

    await (tx as any).milkCollection.delete({ where: { id: collectionId } });
  });
}

// ─── TICKET UPLOAD (CA4) ────────────────────────────────────────────

export async function uploadCollectionTicket(
  ctx: RlsContext,
  farmId: string,
  collectionId: string,
  file: { originalname: string; buffer: Buffer },
): Promise<CollectionItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).milkCollection.findFirst({
      where: { id: collectionId, farmId },
    });
    if (!existing) {
      throw new MilkTankError('Coleta não encontrada', 404);
    }

    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'collection-tickets');
    await fs.mkdir(uploadsDir, { recursive: true });

    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${collectionId}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, file.buffer);

    const row = await (tx as any).milkCollection.update({
      where: { id: collectionId },
      data: {
        ticketPhotoPath: filePath,
        ticketPhotoName: file.originalname,
      },
      include: COLLECTION_INCLUDE,
    });

    return toCollectionItem(row);
  });
}

// ─── RECONCILIATION (CA5 / CA7) ─────────────────────────────────────

export async function getReconciliation(
  ctx: RlsContext,
  farmId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ReconciliationItem[]> {
  if (!dateFrom || !dateTo) {
    throw new MilkTankError('Período (dateFrom e dateTo) é obrigatório', 400);
  }

  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new MilkTankError('Datas inválidas', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Get all milking records in range grouped by date
    const milkings = await (tx as any).milkingRecord.findMany({
      where: {
        farmId,
        milkingDate: { gte: from, lte: to },
      },
      select: { milkingDate: true, liters: true },
    });

    const productionByDate = new Map<string, number>();
    for (const m of milkings) {
      const dateKey = (m.milkingDate as Date).toISOString().slice(0, 10);
      productionByDate.set(dateKey, (productionByDate.get(dateKey) ?? 0) + m.liters);
    }

    // Get all collections in range grouped by date
    const collections = await (tx as any).milkCollection.findMany({
      where: {
        farmId,
        collectionDate: { gte: from, lte: to },
      },
      select: { collectionDate: true, volumeLiters: true },
    });

    const collectionByDate = new Map<string, number>();
    for (const c of collections) {
      const dateKey = (c.collectionDate as Date).toISOString().slice(0, 10);
      collectionByDate.set(dateKey, (collectionByDate.get(dateKey) ?? 0) + c.volumeLiters);
    }

    // Get all tank measurements in range grouped by date
    const measurements = await (tx as any).tankMeasurement.findMany({
      where: {
        tank: { farmId },
        measureDate: { gte: from, lte: to },
      },
      select: { measureDate: true, volumeLiters: true },
    });

    const tankByDate = new Map<string, number>();
    for (const m of measurements) {
      const dateKey = (m.measureDate as Date).toISOString().slice(0, 10);
      // Sum across tanks if multiple
      tankByDate.set(dateKey, (tankByDate.get(dateKey) ?? 0) + m.volumeLiters);
    }

    // Build unique sorted dates
    const allDates = new Set<string>();
    for (const d of productionByDate.keys()) allDates.add(d);
    for (const d of collectionByDate.keys()) allDates.add(d);
    for (const d of tankByDate.keys()) allDates.add(d);

    const sortedDates = Array.from(allDates).sort();

    return sortedDates.map((date) => {
      const productionLiters = roundTwo(productionByDate.get(date) ?? 0);
      const collectionLiters = roundTwo(collectionByDate.get(date) ?? 0);
      const tankVolumeLiters = tankByDate.has(date) ? roundTwo(tankByDate.get(date)!) : null;

      let divergencePercent: number | null = null;
      let divergenceAlert = false;

      if (productionLiters > 0 && collectionLiters > 0) {
        divergencePercent = roundTwo(
          ((collectionLiters - productionLiters) / productionLiters) * 100,
        );
        divergenceAlert = Math.abs(divergencePercent) > DIVERGENCE_THRESHOLD;
      }

      return {
        date,
        productionLiters,
        collectionLiters,
        tankVolumeLiters,
        divergencePercent,
        divergenceAlert,
      };
    });
  });
}

// ─── MONTHLY REPORT (CA6) ───────────────────────────────────────────

export async function getMonthlyReport(
  ctx: RlsContext,
  farmId: string,
  month: string, // YYYY-MM
): Promise<MonthlyReportItem> {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new MilkTankError('Mês inválido. Use o formato YYYY-MM', 400);
  }

  const [year, mon] = month.split('-').map(Number);
  const dateFrom = new Date(year, mon - 1, 1);
  const dateTo = new Date(year, mon, 0); // last day of month

  return withRlsContext(ctx, async (tx) => {
    const collections = await (tx as any).milkCollection.findMany({
      where: {
        farmId,
        collectionDate: { gte: dateFrom, lte: dateTo },
      },
    });

    let totalVolumeDelivered = 0;
    let grossValue = 0;
    let qualityDiscount = 0;
    let freightDiscount = 0;
    let otherDiscounts = 0;
    let netValue = 0;
    let priceSum = 0;
    let priceCount = 0;

    for (const c of collections) {
      totalVolumeDelivered += c.volumeLiters;
      grossValue += c.grossValue ?? 0;
      qualityDiscount += c.qualityDiscount ?? 0;
      freightDiscount += c.freightDiscount ?? 0;
      otherDiscounts += c.otherDiscounts ?? 0;
      netValue += c.netValue ?? 0;

      if (c.pricePerLiter != null) {
        priceSum += c.pricePerLiter;
        priceCount++;
      }
    }

    const totalDiscounts = roundTwo(qualityDiscount + freightDiscount + otherDiscounts);
    const avgPricePerLiter = priceCount > 0 ? roundTwo(priceSum / priceCount) : null;

    return {
      month,
      totalVolumeDelivered: roundTwo(totalVolumeDelivered),
      collectionCount: collections.length,
      avgPricePerLiter,
      grossValue: roundTwo(grossValue),
      qualityDiscount: roundTwo(qualityDiscount),
      freightDiscount: roundTwo(freightDiscount),
      otherDiscounts: roundTwo(otherDiscounts),
      totalDiscounts,
      netValue: roundTwo(netValue),
    };
  });
}

// ─── EXPORT COLLECTIONS CSV ─────────────────────────────────────────

export async function exportCollectionsCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListCollectionsQuery,
): Promise<string> {
  const where: any = { farmId };

  if (query.dairyCompany) {
    where.dairyCompany = { contains: query.dairyCompany, mode: 'insensitive' };
  }
  if (query.dateFrom || query.dateTo) {
    where.collectionDate = {};
    if (query.dateFrom) where.collectionDate.gte = new Date(query.dateFrom);
    if (query.dateTo) where.collectionDate.lte = new Date(query.dateTo);
  }

  const rows = await withRlsContext(ctx, async (tx) => {
    return (tx as any).milkCollection.findMany({
      where,
      include: {
        tank: { select: { name: true } },
        recorder: { select: { name: true } },
      },
      orderBy: { collectionDate: 'desc' },
    });
  });

  const BOM = '\uFEFF';
  const lines: string[] = [];

  lines.push('RELATÓRIO DE COLETAS DE LEITE');
  lines.push(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`);
  lines.push('');
  lines.push(
    'Data;Horário;Laticínio;Motorista;Volume (L);Temperatura (°C);Amostra;Ticket;' +
      'Produção (L);Divergência %;Alerta;Preço/L;Valor Bruto;Desc. Qualidade;Desc. Frete;Outras Desc.;Valor Líquido;Tanque;Registrado por',
  );

  for (const r of rows) {
    lines.push(
      [
        (r.collectionDate as Date).toLocaleDateString('pt-BR'),
        r.collectionTime ?? '',
        r.dairyCompany,
        r.driverName ?? '',
        r.volumeLiters.toString().replace('.', ','),
        r.milkTemperature != null ? r.milkTemperature.toString().replace('.', ',') : '',
        r.sampleCollected ? 'SIM' : 'NÃO',
        r.ticketNumber ?? '',
        r.productionLiters != null ? r.productionLiters.toString().replace('.', ',') : '',
        r.divergencePercent != null ? r.divergencePercent.toString().replace('.', ',') : '',
        r.divergenceAlert ? 'SIM' : '',
        r.pricePerLiter != null ? r.pricePerLiter.toString().replace('.', ',') : '',
        r.grossValue != null ? r.grossValue.toString().replace('.', ',') : '',
        r.qualityDiscount != null ? r.qualityDiscount.toString().replace('.', ',') : '',
        r.freightDiscount != null ? r.freightDiscount.toString().replace('.', ',') : '',
        r.otherDiscounts != null ? r.otherDiscounts.toString().replace('.', ',') : '',
        r.netValue != null ? r.netValue.toString().replace('.', ',') : '',
        r.tank?.name ?? '',
        r.recorder?.name ?? '',
      ].join(';'),
    );
  }

  return BOM + lines.join('\n');
}
