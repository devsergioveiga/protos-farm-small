import { randomUUID } from 'node:crypto';
import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import {
  DewormingError,
  ADMINISTRATION_ROUTE_LABELS,
  isValidAdministrationRoute,
  type CreateDewormingInput,
  type BulkDewormInput,
  type UpdateDewormingInput,
  type ListDewormingsQuery,
  type DewormingItem,
  type BulkDewormResult,
  type DewormingReport,
  type DewormingReportItem,
  type AdministrationRouteValue,
  type RotationStatusValue,
} from './dewormings.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function toDewormingItem(
  row: any,
  rotationStatus: RotationStatusValue | null = null,
): DewormingItem {
  const route = row.administrationRoute as AdministrationRouteValue;
  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    productId: row.productId ?? null,
    productName: row.productName,
    activeIngredient: row.activeIngredient ?? null,
    chemicalGroup: row.chemicalGroup ?? null,
    dosageMl: toNumber(row.dosageMl),
    administrationRoute: route,
    administrationRouteLabel: ADMINISTRATION_ROUTE_LABELS[route] ?? route,
    productBatchNumber: row.productBatchNumber ?? null,
    productExpiryDate: row.productExpiryDate
      ? (row.productExpiryDate as Date).toISOString().slice(0, 10)
      : null,
    dewormingDate: (row.dewormingDate as Date).toISOString().slice(0, 10),
    responsibleName: row.responsibleName,
    veterinaryName: row.veterinaryName ?? null,
    protocolItemId: row.protocolItemId ?? null,
    campaignId: row.campaignId ?? null,
    opgPre: row.opgPre ?? null,
    opgPost: row.opgPost ?? null,
    opgPostDate: row.opgPostDate ? (row.opgPostDate as Date).toISOString().slice(0, 10) : null,
    efficacyPercentage: row.efficacyPercentage ?? null,
    withdrawalMeatDays: row.withdrawalMeatDays ?? null,
    withdrawalMilkDays: row.withdrawalMilkDays ?? null,
    withdrawalEndDate: row.withdrawalEndDate
      ? (row.withdrawalEndDate as Date).toISOString().slice(0, 10)
      : null,
    nextDewormingDate: row.nextDewormingDate
      ? (row.nextDewormingDate as Date).toISOString().slice(0, 10)
      : null,
    rotationStatus,
    stockOutputId: row.stockOutputId ?? null,
    animalLotId: row.animalLotId ?? null,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function validateCreateInput(input: CreateDewormingInput): void {
  if (!input.productName?.trim()) {
    throw new DewormingError('Nome do vermífugo é obrigatório', 400);
  }
  if (!input.dosageMl || input.dosageMl <= 0) {
    throw new DewormingError('Dosagem deve ser maior que zero', 400);
  }
  if (!input.administrationRoute || !isValidAdministrationRoute(input.administrationRoute)) {
    throw new DewormingError('Via de administração inválida', 400);
  }
  if (!input.dewormingDate) {
    throw new DewormingError('Data da vermifugação é obrigatória', 400);
  }
  const date = new Date(input.dewormingDate);
  if (isNaN(date.getTime())) {
    throw new DewormingError('Data da vermifugação inválida', 400);
  }
  if (date > new Date()) {
    throw new DewormingError('Data da vermifugação não pode ser no futuro', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new DewormingError('Nome do responsável é obrigatório', 400);
  }
  if (input.opgPre !== undefined && input.opgPre !== null && input.opgPre < 0) {
    throw new DewormingError('OPG pré deve ser maior ou igual a zero', 400);
  }
}

// ─── Rotation check (CA2) ───────────────────────────────────────────

async function checkRotation(
  tx: TxClient,
  animalId: string,
  chemicalGroup: string | null | undefined,
): Promise<{ status: RotationStatusValue | null; consecutiveCount: number }> {
  if (!chemicalGroup) return { status: null, consecutiveCount: 0 };

  const previousDewormings = await (tx as any).deworming.findMany({
    where: { animalId, chemicalGroup: { not: null } },
    orderBy: { dewormingDate: 'desc' },
    take: 3,
    select: { chemicalGroup: true },
  });

  if (previousDewormings.length === 0) return { status: 'ROTATED', consecutiveCount: 0 };

  let consecutiveCount = 0;
  for (const d of previousDewormings) {
    if (d.chemicalGroup?.toLowerCase() === chemicalGroup.toLowerCase()) {
      consecutiveCount++;
    } else {
      break;
    }
  }

  if (consecutiveCount >= 2) return { status: 'CRITICAL', consecutiveCount: consecutiveCount + 1 };
  if (consecutiveCount >= 1) return { status: 'REPEATED', consecutiveCount: consecutiveCount + 1 };
  return { status: 'ROTATED', consecutiveCount: 1 };
}

// ─── Withdrawal + next deworming calculation (CA5, CA6) ─────────────

async function calcWithdrawalAndNext(
  tx: TxClient,
  protocolItemId: string | null | undefined,
  dewormingDate: Date,
): Promise<{
  nextDewormingDate: Date | null;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  withdrawalEndDate: Date | null;
}> {
  if (!protocolItemId) {
    return {
      nextDewormingDate: null,
      withdrawalMeatDays: null,
      withdrawalMilkDays: null,
      withdrawalEndDate: null,
    };
  }

  const item = await (tx as any).sanitaryProtocolItem.findUnique({
    where: { id: protocolItemId },
    select: {
      isReinforcement: true,
      reinforcementIntervalDays: true,
      withdrawalMeatDays: true,
      withdrawalMilkDays: true,
    },
  });

  if (!item) {
    return {
      nextDewormingDate: null,
      withdrawalMeatDays: null,
      withdrawalMilkDays: null,
      withdrawalEndDate: null,
    };
  }

  let nextDewormingDate: Date | null = null;
  if (item.isReinforcement && item.reinforcementIntervalDays) {
    nextDewormingDate = new Date(dewormingDate);
    nextDewormingDate.setDate(nextDewormingDate.getDate() + item.reinforcementIntervalDays);
  }

  const wMeat = item.withdrawalMeatDays ?? null;
  const wMilk = item.withdrawalMilkDays ?? null;
  const maxWithdrawal = Math.max(wMeat ?? 0, wMilk ?? 0);
  let withdrawalEndDate: Date | null = null;
  if (maxWithdrawal > 0) {
    withdrawalEndDate = new Date(dewormingDate);
    withdrawalEndDate.setDate(withdrawalEndDate.getDate() + maxWithdrawal);
  }

  return {
    nextDewormingDate,
    withdrawalMeatDays: wMeat,
    withdrawalMilkDays: wMilk,
    withdrawalEndDate,
  };
}

// ─── Stock deduction ────────────────────────────────────────────────

async function deductStock(
  tx: TxClient,
  organizationId: string,
  productId: string,
  totalQuantityMl: number,
  ref: string,
  responsibleName: string,
  notes: string,
): Promise<{
  stockOutputId: string;
  insufficientAlerts: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
}> {
  const balance = await (tx as any).stockBalance.findUnique({
    where: { organizationId_productId: { organizationId, productId } },
  });

  const available = balance ? toNumber(balance.currentQuantity) : 0;
  const insufficientAlerts: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }> = [];

  if (available < totalQuantityMl) {
    const product = await (tx as any).product.findUnique({
      where: { id: productId },
      select: { name: true },
    });
    insufficientAlerts.push({
      productId,
      productName: product?.name || productId,
      requested: totalQuantityMl,
      available,
    });
  }

  const output = await (tx as any).stockOutput.create({
    data: {
      organizationId,
      outputDate: new Date(),
      type: 'CONSUMPTION',
      status: 'CONFIRMED',
      fieldOperationRef: ref,
      responsibleName,
      notes,
      totalCost: 0,
      items: {
        create: [{ productId, quantity: totalQuantityMl, unitCost: 0, totalCost: 0 }],
      },
    },
  });

  if (balance) {
    const prevQty = toNumber(balance.currentQuantity);
    const prevTotal = toNumber(balance.totalValue);
    const avgCost = toNumber(balance.averageCost);
    const deductedCost = totalQuantityMl * avgCost;
    const newQty = Math.max(0, prevQty - totalQuantityMl);
    const newTotal = Math.max(0, prevTotal - deductedCost);
    const newAvgCost = newQty > 0 ? newTotal / newQty : avgCost;

    await (tx as any).stockBalance.update({
      where: { id: balance.id },
      data: { currentQuantity: newQty, averageCost: newAvgCost, totalValue: newTotal },
    });

    await (tx as any).stockOutput.update({
      where: { id: output.id },
      data: { totalCost: deductedCost },
    });
    await (tx as any).stockOutputItem.updateMany({
      where: { stockOutputId: output.id },
      data: { unitCost: avgCost, totalCost: deductedCost },
    });
  }

  return { stockOutputId: output.id, insufficientAlerts };
}

// ─── Efficacy calculation (CA4) ─────────────────────────────────────

function calcEfficacy(
  opgPre: number | null | undefined,
  opgPost: number | null | undefined,
): number | null {
  if (opgPre == null || opgPost == null || opgPre <= 0) return null;
  return Math.round(((opgPre - opgPost) / opgPre) * 10000) / 100; // 2 decimals
}

// ─── CREATE (CA1) ───────────────────────────────────────────────────

const DEWORMING_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
};

export async function createDeworming(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateDewormingInput,
): Promise<DewormingItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const animal = await (tx as any).animal.findFirst({
      where: { id: input.animalId, farmId, deletedAt: null },
      select: { id: true, earTag: true },
    });
    if (!animal) {
      throw new DewormingError('Animal não encontrado', 404);
    }

    if (input.productId) {
      const product = await (tx as any).product.findFirst({
        where: { id: input.productId, organizationId: ctx.organizationId },
        select: { id: true, chemicalGroup: true, activeIngredient: true },
      });
      if (!product) {
        throw new DewormingError('Produto não encontrado', 404);
      }
      // Auto-fill chemical group and active ingredient from product if not provided
      if (!input.chemicalGroup && product.chemicalGroup) {
        input.chemicalGroup = product.chemicalGroup;
      }
      if (!input.activeIngredient && product.activeIngredient) {
        input.activeIngredient = product.activeIngredient;
      }
    }

    if (input.protocolItemId) {
      const protocolItem = await (tx as any).sanitaryProtocolItem.findFirst({
        where: {
          id: input.protocolItemId,
          protocol: { organizationId: ctx.organizationId },
        },
        select: { id: true },
      });
      if (!protocolItem) {
        throw new DewormingError('Item de protocolo sanitário não encontrado', 404);
      }
    }

    // Rotation check (CA2)
    const rotation = await checkRotation(tx, input.animalId, input.chemicalGroup);

    const dewormingDate = new Date(input.dewormingDate);
    const { nextDewormingDate, withdrawalMeatDays, withdrawalMilkDays, withdrawalEndDate } =
      await calcWithdrawalAndNext(tx, input.protocolItemId, dewormingDate);

    // Stock deduction
    let stockOutputId: string | null = null;
    if (input.productId) {
      const result = await deductStock(
        tx,
        ctx.organizationId,
        input.productId,
        input.dosageMl,
        `deworming-individual`,
        input.responsibleName,
        `Vermifugação individual — ${input.productName}`,
      );
      stockOutputId = result.stockOutputId;
    }

    const row = await (tx as any).deworming.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        productId: input.productId ?? null,
        productName: input.productName,
        activeIngredient: input.activeIngredient ?? null,
        chemicalGroup: input.chemicalGroup ?? null,
        dosageMl: input.dosageMl,
        administrationRoute: input.administrationRoute,
        productBatchNumber: input.productBatchNumber ?? null,
        productExpiryDate: input.productExpiryDate ? new Date(input.productExpiryDate) : null,
        dewormingDate,
        responsibleName: input.responsibleName,
        veterinaryName: input.veterinaryName ?? null,
        protocolItemId: input.protocolItemId ?? null,
        opgPre: input.opgPre ?? null,
        nextDewormingDate,
        withdrawalMeatDays,
        withdrawalMilkDays,
        withdrawalEndDate,
        stockOutputId,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: DEWORMING_INCLUDE,
    });

    // Health record
    await (tx as any).animalHealthRecord.create({
      data: {
        animalId: input.animalId,
        farmId,
        type: 'DEWORMING',
        eventDate: dewormingDate,
        productName: input.productName,
        dosage: `${input.dosageMl} mL`,
        applicationMethod: input.administrationRoute === 'ORAL' ? 'ORAL' : 'INJECTABLE',
        batchNumber: input.productBatchNumber ?? null,
        withdrawalDays: Math.max(withdrawalMeatDays ?? 0, withdrawalMilkDays ?? 0) || null,
        veterinaryName: input.veterinaryName ?? null,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
    });

    return toDewormingItem(row, rotation.status);
  });
}

// ─── BULK DEWORM (CA1+CA2) ──────────────────────────────────────────

export async function bulkDeworm(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: BulkDewormInput,
): Promise<BulkDewormResult> {
  if (!input.productName?.trim()) {
    throw new DewormingError('Nome do vermífugo é obrigatório', 400);
  }
  if (!input.dosageMl || input.dosageMl <= 0) {
    throw new DewormingError('Dosagem deve ser maior que zero', 400);
  }
  if (!input.administrationRoute || !isValidAdministrationRoute(input.administrationRoute)) {
    throw new DewormingError('Via de administração inválida', 400);
  }
  if (!input.dewormingDate) {
    throw new DewormingError('Data da vermifugação é obrigatória', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new DewormingError('Nome do responsável é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const lot = await (tx as any).animalLot.findFirst({
      where: { id: input.animalLotId, farmId, deletedAt: null },
      include: {
        animals: {
          where: { deletedAt: null },
          select: { id: true, earTag: true, name: true },
        },
      },
    });
    if (!lot) {
      throw new DewormingError('Lote não encontrado', 404);
    }
    if (lot.animals.length === 0) {
      throw new DewormingError('Lote não possui animais', 400);
    }

    if (input.productId) {
      const product = await (tx as any).product.findFirst({
        where: { id: input.productId, organizationId: ctx.organizationId },
        select: { id: true, chemicalGroup: true, activeIngredient: true },
      });
      if (!product) {
        throw new DewormingError('Produto não encontrado', 404);
      }
      if (!input.chemicalGroup && product.chemicalGroup) {
        input.chemicalGroup = product.chemicalGroup;
      }
      if (!input.activeIngredient && product.activeIngredient) {
        input.activeIngredient = product.activeIngredient;
      }
    }

    const dewormingDate = new Date(input.dewormingDate);
    const campaignId = randomUUID();
    const animalCount = lot.animals.length;

    const { nextDewormingDate, withdrawalMeatDays, withdrawalMilkDays, withdrawalEndDate } =
      await calcWithdrawalAndNext(tx, input.protocolItemId, dewormingDate);

    // Rotation alerts for all animals in the lot (CA2)
    const rotationAlerts: BulkDewormResult['rotationAlerts'] = [];
    if (input.chemicalGroup) {
      for (const animal of lot.animals) {
        const rotation = await checkRotation(tx, animal.id, input.chemicalGroup);
        if (rotation.status === 'REPEATED' || rotation.status === 'CRITICAL') {
          rotationAlerts.push({
            animalId: animal.id,
            animalEarTag: animal.earTag,
            status: rotation.status,
            chemicalGroup: input.chemicalGroup,
            consecutiveCount: rotation.consecutiveCount,
          });
        }
      }
    }

    // Stock deduction
    let stockOutputId: string | null = null;
    let insufficientStockAlerts: BulkDewormResult['insufficientStockAlerts'] = [];

    if (input.productId && input.deductStock !== false) {
      const totalQuantity = animalCount * input.dosageMl;
      const result = await deductStock(
        tx,
        ctx.organizationId,
        input.productId,
        totalQuantity,
        `deworming-campaign-${campaignId}`,
        input.responsibleName,
        `Vermifugação em lote — ${input.productName} — ${animalCount} animais`,
      );
      stockOutputId = result.stockOutputId;
      insufficientStockAlerts = result.insufficientAlerts;
    }

    const dewormingData = lot.animals.map((animal: { id: string }) => ({
      organizationId: ctx.organizationId,
      farmId,
      animalId: animal.id,
      productId: input.productId ?? null,
      productName: input.productName,
      activeIngredient: input.activeIngredient ?? null,
      chemicalGroup: input.chemicalGroup ?? null,
      dosageMl: input.dosageMl,
      administrationRoute: input.administrationRoute,
      productBatchNumber: input.productBatchNumber ?? null,
      productExpiryDate: input.productExpiryDate ? new Date(input.productExpiryDate) : null,
      dewormingDate,
      responsibleName: input.responsibleName,
      veterinaryName: input.veterinaryName ?? null,
      protocolItemId: input.protocolItemId ?? null,
      campaignId,
      opgPre: input.opgPre ?? null,
      nextDewormingDate,
      withdrawalMeatDays,
      withdrawalMilkDays,
      withdrawalEndDate,
      stockOutputId,
      animalLotId: input.animalLotId,
      notes: input.notes ?? null,
      recordedBy: userId,
    }));

    await (tx as any).deworming.createMany({ data: dewormingData });

    const healthData = lot.animals.map((animal: { id: string }) => ({
      animalId: animal.id,
      farmId,
      type: 'DEWORMING' as const,
      eventDate: dewormingDate,
      productName: input.productName,
      dosage: `${input.dosageMl} mL`,
      applicationMethod: input.administrationRoute === 'ORAL' ? 'ORAL' : ('INJECTABLE' as const),
      batchNumber: input.productBatchNumber ?? null,
      withdrawalDays: Math.max(withdrawalMeatDays ?? 0, withdrawalMilkDays ?? 0) || null,
      veterinaryName: input.veterinaryName ?? null,
      notes: input.notes ?? null,
      recordedBy: userId,
    }));

    await (tx as any).animalHealthRecord.createMany({ data: healthData });

    return {
      campaignId,
      created: animalCount,
      animalCount,
      stockOutputId,
      insufficientStockAlerts,
      rotationAlerts,
    };
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listDewormings(
  ctx: RlsContext,
  farmId: string,
  query: ListDewormingsQuery,
): Promise<{ data: DewormingItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.animalId) where.animalId = query.animalId;
    if (query.campaignId) where.campaignId = query.campaignId;
    if (query.productId) where.productId = query.productId;
    if (query.dateFrom || query.dateTo) {
      where.dewormingDate = {};
      if (query.dateFrom) where.dewormingDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.dewormingDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).deworming.findMany({
        where,
        include: DEWORMING_INCLUDE,
        orderBy: { dewormingDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).deworming.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => toDewormingItem(r)),
      total,
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getDeworming(
  ctx: RlsContext,
  farmId: string,
  dewormingId: string,
): Promise<DewormingItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).deworming.findFirst({
      where: { id: dewormingId, farmId },
      include: DEWORMING_INCLUDE,
    });
    if (!row) {
      throw new DewormingError('Registro de vermifugação não encontrado', 404);
    }

    // Compute rotation status dynamically
    const rotation = await checkRotation(tx, row.animalId, row.chemicalGroup);
    return toDewormingItem(row, rotation.status);
  });
}

// ─── UPDATE (+ OPG post + efficacy CA3/CA4) ─────────────────────────

export async function updateDeworming(
  ctx: RlsContext,
  farmId: string,
  dewormingId: string,
  input: UpdateDewormingInput,
): Promise<DewormingItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).deworming.findFirst({
      where: { id: dewormingId, farmId },
    });
    if (!existing) {
      throw new DewormingError('Registro de vermifugação não encontrado', 404);
    }

    if (input.administrationRoute && !isValidAdministrationRoute(input.administrationRoute)) {
      throw new DewormingError('Via de administração inválida', 400);
    }
    if (input.dosageMl !== undefined && input.dosageMl <= 0) {
      throw new DewormingError('Dosagem deve ser maior que zero', 400);
    }
    if (input.dewormingDate) {
      const date = new Date(input.dewormingDate);
      if (isNaN(date.getTime())) {
        throw new DewormingError('Data da vermifugação inválida', 400);
      }
      if (date > new Date()) {
        throw new DewormingError('Data da vermifugação não pode ser no futuro', 400);
      }
    }
    if (input.opgPost !== undefined && input.opgPost !== null && input.opgPost < 0) {
      throw new DewormingError('OPG pós deve ser maior ou igual a zero', 400);
    }

    const data: any = {};
    if (input.dosageMl !== undefined) data.dosageMl = input.dosageMl;
    if (input.administrationRoute !== undefined)
      data.administrationRoute = input.administrationRoute;
    if (input.productBatchNumber !== undefined) data.productBatchNumber = input.productBatchNumber;
    if (input.productExpiryDate !== undefined) {
      data.productExpiryDate = input.productExpiryDate ? new Date(input.productExpiryDate) : null;
    }
    if (input.dewormingDate !== undefined) data.dewormingDate = new Date(input.dewormingDate);
    if (input.responsibleName !== undefined) data.responsibleName = input.responsibleName;
    if (input.veterinaryName !== undefined) data.veterinaryName = input.veterinaryName;
    if (input.opgPre !== undefined) data.opgPre = input.opgPre;
    if (input.notes !== undefined) data.notes = input.notes;

    // OPG post update (CA3) + efficacy recalculation (CA4)
    if (input.opgPost !== undefined) {
      data.opgPost = input.opgPost;
      data.opgPostDate = input.opgPostDate ? new Date(input.opgPostDate) : new Date();
      const finalOgpPre = input.opgPre !== undefined ? input.opgPre : existing.opgPre;
      data.efficacyPercentage = calcEfficacy(finalOgpPre, input.opgPost);
    }

    const row = await (tx as any).deworming.update({
      where: { id: dewormingId },
      data,
      include: DEWORMING_INCLUDE,
    });

    const rotation = await checkRotation(tx, row.animalId, row.chemicalGroup);
    return toDewormingItem(row, rotation.status);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteDeworming(
  ctx: RlsContext,
  farmId: string,
  dewormingId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).deworming.findFirst({
      where: { id: dewormingId, farmId },
    });
    if (!existing) {
      throw new DewormingError('Registro de vermifugação não encontrado', 404);
    }

    await (tx as any).deworming.delete({ where: { id: dewormingId } });
  });
}

// ─── CAMPAIGN REPORT ────────────────────────────────────────────────

export async function getDewormingReport(
  ctx: RlsContext,
  farmId: string,
  campaignId: string,
): Promise<DewormingReport> {
  return withRlsContext(ctx, async (tx) => {
    const rows = await (tx as any).deworming.findMany({
      where: { campaignId, farmId },
      include: {
        animal: {
          select: {
            earTag: true,
            name: true,
            category: true,
            lot: { select: { name: true } },
          },
        },
        farm: { select: { name: true } },
      },
      orderBy: { animal: { earTag: 'asc' } },
    });

    if (rows.length === 0) {
      throw new DewormingError('Campanha de vermifugação não encontrada', 404);
    }

    const first = rows[0];
    const animals: DewormingReportItem[] = rows.map((r: any) => ({
      animalId: r.animalId,
      animalEarTag: r.animal.earTag,
      animalName: r.animal.name ?? null,
      animalCategory: r.animal.category,
      lotName: r.animal.lot?.name ?? null,
      farmName: r.farm.name,
      dewormingDate: (r.dewormingDate as Date).toISOString().slice(0, 10),
      productName: r.productName,
      activeIngredient: r.activeIngredient ?? null,
      chemicalGroup: r.chemicalGroup ?? null,
      dosageMl: toNumber(r.dosageMl),
      administrationRoute:
        ADMINISTRATION_ROUTE_LABELS[r.administrationRoute as AdministrationRouteValue] ??
        r.administrationRoute,
      productBatchNumber: r.productBatchNumber ?? null,
      opgPre: r.opgPre ?? null,
      responsibleName: r.responsibleName,
    }));

    return {
      campaignId,
      productName: first.productName,
      dewormingDate: (first.dewormingDate as Date).toISOString().slice(0, 10),
      farmName: first.farm.name,
      totalAnimals: animals.length,
      animals,
    };
  });
}

// ─── CAMPAIGN REPORT CSV ────────────────────────────────────────────

export async function exportDewormingReportCsv(
  ctx: RlsContext,
  farmId: string,
  campaignId: string,
): Promise<string> {
  const report = await getDewormingReport(ctx, farmId, campaignId);

  const BOM = '\uFEFF';
  const lines: string[] = [];

  lines.push(`COMPROVANTE DE VERMIFUGAÇÃO — ${report.productName}`);
  lines.push(`Fazenda: ${report.farmName}`);
  lines.push(`Data: ${new Date(report.dewormingDate).toLocaleDateString('pt-BR')}`);
  lines.push(`Total de animais: ${report.totalAnimals}`);
  lines.push('');
  lines.push(
    'Brinco;Nome;Categoria;Lote;Vermífugo;Princípio Ativo;Grupo Químico;Dose (mL);Via;Lote Produto;OPG Pré;Responsável',
  );

  for (const a of report.animals) {
    lines.push(
      [
        a.animalEarTag,
        a.animalName ?? '',
        a.animalCategory,
        a.lotName ?? '',
        a.productName,
        a.activeIngredient ?? '',
        a.chemicalGroup ?? '',
        a.dosageMl,
        a.administrationRoute,
        a.productBatchNumber ?? '',
        a.opgPre ?? '',
        a.responsibleName,
      ].join(';'),
    );
  }

  return BOM + lines.join('\n');
}

// ─── NEXT DEWORMING ALERTS (CA6) ───────────────────────────────────

export interface DewormingAlert {
  dewormingId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  productName: string;
  nextDewormingDate: string;
  daysUntil: number;
}

export async function getNextDewormingAlerts(
  ctx: RlsContext,
  farmId: string,
  daysAhead: number = 30,
): Promise<DewormingAlert[]> {
  return withRlsContext(ctx, async (tx) => {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const rows = await (tx as any).deworming.findMany({
      where: {
        farmId,
        nextDewormingDate: { gte: today, lte: futureDate },
      },
      include: {
        animal: { select: { earTag: true, name: true, deletedAt: true } },
      },
      orderBy: { nextDewormingDate: 'asc' },
    });

    return rows
      .filter((r: any) => !r.animal.deletedAt)
      .map((r: any) => {
        const next = r.nextDewormingDate as Date;
        const diffMs = next.getTime() - today.getTime();
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return {
          dewormingId: r.id,
          animalId: r.animalId,
          animalEarTag: r.animal.earTag,
          animalName: r.animal.name ?? null,
          productName: r.productName,
          nextDewormingDate: next.toISOString().slice(0, 10),
          daysUntil,
        };
      });
  });
}
