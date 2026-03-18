import { randomUUID } from 'node:crypto';
import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import {
  VaccinationError,
  ADMINISTRATION_ROUTE_LABELS,
  isValidAdministrationRoute,
  type CreateVaccinationInput,
  type BulkVaccinateInput,
  type UpdateVaccinationInput,
  type ListVaccinationsQuery,
  type VaccinationItem,
  type BulkVaccinateResult,
  type VaccinationReport,
  type VaccinationReportItem,
  type AdministrationRouteValue,
} from './vaccinations.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function toVaccinationItem(row: any): VaccinationItem {
  const route = row.administrationRoute as AdministrationRouteValue;
  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    productId: row.productId ?? null,
    productName: row.productName,
    dosageMl: toNumber(row.dosageMl),
    administrationRoute: route,
    administrationRouteLabel: ADMINISTRATION_ROUTE_LABELS[route] ?? route,
    productBatchNumber: row.productBatchNumber ?? null,
    productExpiryDate: row.productExpiryDate
      ? (row.productExpiryDate as Date).toISOString().slice(0, 10)
      : null,
    vaccinationDate: (row.vaccinationDate as Date).toISOString().slice(0, 10),
    responsibleName: row.responsibleName,
    veterinaryName: row.veterinaryName ?? null,
    protocolItemId: row.protocolItemId ?? null,
    campaignId: row.campaignId ?? null,
    doseNumber: row.doseNumber,
    nextDoseDate: row.nextDoseDate ? (row.nextDoseDate as Date).toISOString().slice(0, 10) : null,
    withdrawalMeatDays: row.withdrawalMeatDays ?? null,
    withdrawalMilkDays: row.withdrawalMilkDays ?? null,
    withdrawalEndDate: row.withdrawalEndDate
      ? (row.withdrawalEndDate as Date).toISOString().slice(0, 10)
      : null,
    stockOutputId: row.stockOutputId ?? null,
    animalLotId: row.animalLotId ?? null,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function validateCreateInput(input: CreateVaccinationInput): void {
  if (!input.productName?.trim()) {
    throw new VaccinationError('Nome da vacina é obrigatório', 400);
  }
  if (!input.dosageMl || input.dosageMl <= 0) {
    throw new VaccinationError('Dosagem deve ser maior que zero', 400);
  }
  if (!input.administrationRoute || !isValidAdministrationRoute(input.administrationRoute)) {
    throw new VaccinationError('Via de administração inválida', 400);
  }
  if (!input.vaccinationDate) {
    throw new VaccinationError('Data da vacinação é obrigatória', 400);
  }
  const date = new Date(input.vaccinationDate);
  if (isNaN(date.getTime())) {
    throw new VaccinationError('Data da vacinação inválida', 400);
  }
  if (date > new Date()) {
    throw new VaccinationError('Data da vacinação não pode ser no futuro', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new VaccinationError('Nome do responsável é obrigatório', 400);
  }
}

// ─── Next dose calculation (CA4) ────────────────────────────────────

async function calcNextDoseAndWithdrawal(
  tx: TxClient,
  protocolItemId: string | null | undefined,
  vaccinationDate: Date,
): Promise<{
  nextDoseDate: Date | null;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  withdrawalEndDate: Date | null;
}> {
  if (!protocolItemId) {
    return {
      nextDoseDate: null,
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
      nextDoseDate: null,
      withdrawalMeatDays: null,
      withdrawalMilkDays: null,
      withdrawalEndDate: null,
    };
  }

  let nextDoseDate: Date | null = null;
  if (item.isReinforcement && item.reinforcementIntervalDays) {
    nextDoseDate = new Date(vaccinationDate);
    nextDoseDate.setDate(nextDoseDate.getDate() + item.reinforcementIntervalDays);
  }

  const wMeat = item.withdrawalMeatDays ?? null;
  const wMilk = item.withdrawalMilkDays ?? null;
  const maxWithdrawal = Math.max(wMeat ?? 0, wMilk ?? 0);
  let withdrawalEndDate: Date | null = null;
  if (maxWithdrawal > 0) {
    withdrawalEndDate = new Date(vaccinationDate);
    withdrawalEndDate.setDate(withdrawalEndDate.getDate() + maxWithdrawal);
  }

  return { nextDoseDate, withdrawalMeatDays: wMeat, withdrawalMilkDays: wMilk, withdrawalEndDate };
}

// ─── Stock deduction (CA3) ──────────────────────────────────────────

async function deductVaccineStock(
  tx: TxClient,
  organizationId: string,
  productId: string,
  totalQuantityMl: number,
  vaccinationRef: string,
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

  // Create stock output record
  const output = await (tx as any).stockOutput.create({
    data: {
      organizationId,
      outputDate: new Date(),
      type: 'CONSUMPTION',
      status: 'CONFIRMED',
      fieldOperationRef: vaccinationRef,
      responsibleName,
      notes,
      totalCost: 0,
      items: {
        create: [
          {
            productId,
            quantity: totalQuantityMl,
            unitCost: 0,
            totalCost: 0,
          },
        ],
      },
    },
  });

  // Deduct balance
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
      data: {
        currentQuantity: newQty,
        averageCost: newAvgCost,
        totalValue: newTotal,
      },
    });

    // Update stock output cost
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

// ─── CREATE (CA1) ───────────────────────────────────────────────────

const VACCINATION_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
};

export async function createVaccination(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateVaccinationInput,
): Promise<VaccinationItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Validate animal
    const animal = await (tx as any).animal.findFirst({
      where: { id: input.animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new VaccinationError('Animal não encontrado', 404);
    }

    // Validate product if provided
    if (input.productId) {
      const product = await (tx as any).product.findFirst({
        where: { id: input.productId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!product) {
        throw new VaccinationError('Produto não encontrado', 404);
      }
    }

    // Validate protocol item if provided
    if (input.protocolItemId) {
      const protocolItem = await (tx as any).sanitaryProtocolItem.findFirst({
        where: {
          id: input.protocolItemId,
          protocol: { organizationId: ctx.organizationId },
        },
        select: { id: true },
      });
      if (!protocolItem) {
        throw new VaccinationError('Item de protocolo sanitário não encontrado', 404);
      }
    }

    const vaccinationDate = new Date(input.vaccinationDate);
    const { nextDoseDate, withdrawalMeatDays, withdrawalMilkDays, withdrawalEndDate } =
      await calcNextDoseAndWithdrawal(tx, input.protocolItemId, vaccinationDate);

    // Stock deduction if product linked
    let stockOutputId: string | null = null;
    if (input.productId) {
      const result = await deductVaccineStock(
        tx,
        ctx.organizationId,
        input.productId,
        input.dosageMl,
        `vaccination-individual`,
        input.responsibleName,
        `Vacinação individual — ${input.productName}`,
      );
      stockOutputId = result.stockOutputId;
    }

    const row = await (tx as any).vaccination.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        productId: input.productId ?? null,
        productName: input.productName,
        dosageMl: input.dosageMl,
        administrationRoute: input.administrationRoute,
        productBatchNumber: input.productBatchNumber ?? null,
        productExpiryDate: input.productExpiryDate ? new Date(input.productExpiryDate) : null,
        vaccinationDate,
        responsibleName: input.responsibleName,
        veterinaryName: input.veterinaryName ?? null,
        protocolItemId: input.protocolItemId ?? null,
        doseNumber: input.doseNumber ?? 1,
        nextDoseDate,
        withdrawalMeatDays,
        withdrawalMilkDays,
        withdrawalEndDate,
        stockOutputId,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: VACCINATION_INCLUDE,
    });

    // Also create health record for animal timeline
    await (tx as any).animalHealthRecord.create({
      data: {
        animalId: input.animalId,
        farmId,
        type: 'VACCINATION',
        eventDate: vaccinationDate,
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

    return toVaccinationItem(row);
  });
}

// ─── BULK VACCINATE (CA2) ───────────────────────────────────────────

export async function bulkVaccinate(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: BulkVaccinateInput,
): Promise<BulkVaccinateResult> {
  if (!input.productName?.trim()) {
    throw new VaccinationError('Nome da vacina é obrigatório', 400);
  }
  if (!input.dosageMl || input.dosageMl <= 0) {
    throw new VaccinationError('Dosagem deve ser maior que zero', 400);
  }
  if (!input.administrationRoute || !isValidAdministrationRoute(input.administrationRoute)) {
    throw new VaccinationError('Via de administração inválida', 400);
  }
  if (!input.vaccinationDate) {
    throw new VaccinationError('Data da vacinação é obrigatória', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new VaccinationError('Nome do responsável é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate lot and get animals
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
      throw new VaccinationError('Lote não encontrado', 404);
    }
    if (lot.animals.length === 0) {
      throw new VaccinationError('Lote não possui animais', 400);
    }

    // Validate product if provided
    if (input.productId) {
      const product = await (tx as any).product.findFirst({
        where: { id: input.productId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!product) {
        throw new VaccinationError('Produto não encontrado', 404);
      }
    }

    const vaccinationDate = new Date(input.vaccinationDate);
    const campaignId = randomUUID();
    const animalCount = lot.animals.length;

    const { nextDoseDate, withdrawalMeatDays, withdrawalMilkDays, withdrawalEndDate } =
      await calcNextDoseAndWithdrawal(tx, input.protocolItemId, vaccinationDate);

    // Stock deduction (CA3) — total = nº animals x dose
    let stockOutputId: string | null = null;
    let insufficientStockAlerts: Array<{
      productId: string;
      productName: string;
      requested: number;
      available: number;
    }> = [];

    if (input.productId && input.deductStock !== false) {
      const totalQuantity = animalCount * input.dosageMl;
      const result = await deductVaccineStock(
        tx,
        ctx.organizationId,
        input.productId,
        totalQuantity,
        `vaccination-campaign-${campaignId}`,
        input.responsibleName,
        `Vacinação em lote — ${input.productName} — ${animalCount} animais`,
      );
      stockOutputId = result.stockOutputId;
      insufficientStockAlerts = result.insufficientAlerts;
    }

    // Create vaccination records for each animal
    const vaccinationData = lot.animals.map((animal: { id: string }) => ({
      organizationId: ctx.organizationId,
      farmId,
      animalId: animal.id,
      productId: input.productId ?? null,
      productName: input.productName,
      dosageMl: input.dosageMl,
      administrationRoute: input.administrationRoute,
      productBatchNumber: input.productBatchNumber ?? null,
      productExpiryDate: input.productExpiryDate ? new Date(input.productExpiryDate) : null,
      vaccinationDate,
      responsibleName: input.responsibleName,
      veterinaryName: input.veterinaryName ?? null,
      protocolItemId: input.protocolItemId ?? null,
      campaignId,
      doseNumber: input.doseNumber ?? 1,
      nextDoseDate,
      withdrawalMeatDays,
      withdrawalMilkDays,
      withdrawalEndDate,
      stockOutputId,
      animalLotId: input.animalLotId,
      notes: input.notes ?? null,
      recordedBy: userId,
    }));

    await (tx as any).vaccination.createMany({ data: vaccinationData });

    // Also create health records for all animals
    const healthData = lot.animals.map((animal: { id: string }) => ({
      animalId: animal.id,
      farmId,
      type: 'VACCINATION' as const,
      eventDate: vaccinationDate,
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
    };
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listVaccinations(
  ctx: RlsContext,
  farmId: string,
  query: ListVaccinationsQuery,
): Promise<{ data: VaccinationItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.animalId) where.animalId = query.animalId;
    if (query.campaignId) where.campaignId = query.campaignId;
    if (query.productId) where.productId = query.productId;
    if (query.dateFrom || query.dateTo) {
      where.vaccinationDate = {};
      if (query.dateFrom) where.vaccinationDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.vaccinationDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).vaccination.findMany({
        where,
        include: VACCINATION_INCLUDE,
        orderBy: { vaccinationDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).vaccination.count({ where }),
    ]);

    return {
      data: rows.map(toVaccinationItem),
      total,
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getVaccination(
  ctx: RlsContext,
  farmId: string,
  vaccinationId: string,
): Promise<VaccinationItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).vaccination.findFirst({
      where: { id: vaccinationId, farmId },
      include: VACCINATION_INCLUDE,
    });
    if (!row) {
      throw new VaccinationError('Registro de vacinação não encontrado', 404);
    }
    return toVaccinationItem(row);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateVaccination(
  ctx: RlsContext,
  farmId: string,
  vaccinationId: string,
  input: UpdateVaccinationInput,
): Promise<VaccinationItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).vaccination.findFirst({
      where: { id: vaccinationId, farmId },
    });
    if (!existing) {
      throw new VaccinationError('Registro de vacinação não encontrado', 404);
    }

    if (input.administrationRoute && !isValidAdministrationRoute(input.administrationRoute)) {
      throw new VaccinationError('Via de administração inválida', 400);
    }
    if (input.dosageMl !== undefined && input.dosageMl <= 0) {
      throw new VaccinationError('Dosagem deve ser maior que zero', 400);
    }
    if (input.vaccinationDate) {
      const date = new Date(input.vaccinationDate);
      if (isNaN(date.getTime())) {
        throw new VaccinationError('Data da vacinação inválida', 400);
      }
      if (date > new Date()) {
        throw new VaccinationError('Data da vacinação não pode ser no futuro', 400);
      }
    }

    const data: any = {};
    if (input.dosageMl !== undefined) data.dosageMl = input.dosageMl;
    if (input.administrationRoute !== undefined)
      data.administrationRoute = input.administrationRoute;
    if (input.productBatchNumber !== undefined) data.productBatchNumber = input.productBatchNumber;
    if (input.productExpiryDate !== undefined) {
      data.productExpiryDate = input.productExpiryDate ? new Date(input.productExpiryDate) : null;
    }
    if (input.vaccinationDate !== undefined) data.vaccinationDate = new Date(input.vaccinationDate);
    if (input.responsibleName !== undefined) data.responsibleName = input.responsibleName;
    if (input.veterinaryName !== undefined) data.veterinaryName = input.veterinaryName;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).vaccination.update({
      where: { id: vaccinationId },
      data,
      include: VACCINATION_INCLUDE,
    });

    return toVaccinationItem(row);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteVaccination(
  ctx: RlsContext,
  farmId: string,
  vaccinationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).vaccination.findFirst({
      where: { id: vaccinationId, farmId },
    });
    if (!existing) {
      throw new VaccinationError('Registro de vacinação não encontrado', 404);
    }

    await (tx as any).vaccination.delete({ where: { id: vaccinationId } });
  });
}

// ─── CAMPAIGN REPORT (CA6) ──────────────────────────────────────────

export async function getVaccinationReport(
  ctx: RlsContext,
  farmId: string,
  campaignId: string,
): Promise<VaccinationReport> {
  return withRlsContext(ctx, async (tx) => {
    const rows = await (tx as any).vaccination.findMany({
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
      throw new VaccinationError('Campanha de vacinação não encontrada', 404);
    }

    const first = rows[0];
    const animals: VaccinationReportItem[] = rows.map((r: any) => ({
      animalId: r.animalId,
      animalEarTag: r.animal.earTag,
      animalName: r.animal.name ?? null,
      animalCategory: r.animal.category,
      lotName: r.animal.lot?.name ?? null,
      farmName: r.farm.name,
      vaccinationDate: (r.vaccinationDate as Date).toISOString().slice(0, 10),
      productName: r.productName,
      dosageMl: toNumber(r.dosageMl),
      administrationRoute:
        ADMINISTRATION_ROUTE_LABELS[r.administrationRoute as AdministrationRouteValue] ??
        r.administrationRoute,
      productBatchNumber: r.productBatchNumber ?? null,
      doseNumber: r.doseNumber,
      responsibleName: r.responsibleName,
    }));

    return {
      campaignId,
      productName: first.productName,
      vaccinationDate: (first.vaccinationDate as Date).toISOString().slice(0, 10),
      farmName: first.farm.name,
      totalAnimals: animals.length,
      animals,
    };
  });
}

// ─── CAMPAIGN REPORT CSV (CA6) ──────────────────────────────────────

export async function exportVaccinationReportCsv(
  ctx: RlsContext,
  farmId: string,
  campaignId: string,
): Promise<string> {
  const report = await getVaccinationReport(ctx, farmId, campaignId);

  const BOM = '\uFEFF';
  const lines: string[] = [];

  lines.push(`COMPROVANTE DE VACINAÇÃO — ${report.productName}`);
  lines.push(`Fazenda: ${report.farmName}`);
  lines.push(`Data: ${new Date(report.vaccinationDate).toLocaleDateString('pt-BR')}`);
  lines.push(`Total de animais: ${report.totalAnimals}`);
  lines.push('');
  lines.push('Brinco;Nome;Categoria;Lote;Vacina;Dose (mL);Via;Lote Produto;Nº Dose;Responsável');

  for (const a of report.animals) {
    lines.push(
      [
        a.animalEarTag,
        a.animalName ?? '',
        a.animalCategory,
        a.lotName ?? '',
        a.productName,
        a.dosageMl,
        a.administrationRoute,
        a.productBatchNumber ?? '',
        a.doseNumber,
        a.responsibleName,
      ].join(';'),
    );
  }

  return BOM + lines.join('\n');
}
