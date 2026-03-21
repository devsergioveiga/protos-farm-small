import Decimal from 'decimal.js';
import { addDays } from 'date-fns';
import { prisma } from '../../database/prisma';
import { createConsumptionOutput } from '../stock-deduction/stock-deduction';
import {
  WorkOrderError,
  type CreateWorkOrderInput,
  type UpdateWorkOrderInput,
  type AddWorkOrderPartInput,
  type CloseWorkOrderInput,
  type ListWorkOrdersQuery,
  type WorkOrderOutput,
  type MaintenanceDashboardOutput,
  type RlsContext,
} from './work-orders.types';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ─────────────────────────────────────────────────────────

async function getNextSequentialNumber(tx: TxClient, organizationId: string): Promise<number> {
  const last = await tx.workOrder.findFirst({
    where: { organizationId },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });
  return (last?.sequentialNumber ?? 0) + 1;
}

function toNumber(val: unknown): number {
  if (val == null) return 0;
  if (val instanceof Decimal) return val.toNumber();
  return typeof val === 'number' ? val : Number(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWorkOrder(wo: any): WorkOrderOutput {
  return {
    id: wo.id,
    organizationId: wo.organizationId,
    assetId: wo.assetId,
    sequentialNumber: wo.sequentialNumber,
    type: wo.type,
    status: wo.status,
    title: wo.title,
    description: wo.description ?? null,
    maintenancePlanId: wo.maintenancePlanId ?? null,
    assignedTo: wo.assignedTo ?? null,
    openedAt: wo.openedAt?.toISOString() ?? '',
    startedAt: wo.startedAt?.toISOString() ?? null,
    closedAt: wo.closedAt?.toISOString() ?? null,
    hourmeterAtOpen: wo.hourmeterAtOpen != null ? toNumber(wo.hourmeterAtOpen) : null,
    odometerAtOpen: wo.odometerAtOpen != null ? toNumber(wo.odometerAtOpen) : null,
    laborHours: wo.laborHours != null ? toNumber(wo.laborHours) : null,
    laborCostPerHour: wo.laborCostPerHour != null ? toNumber(wo.laborCostPerHour) : null,
    totalPartsCost: wo.totalPartsCost != null ? toNumber(wo.totalPartsCost) : null,
    totalLaborCost: wo.totalLaborCost != null ? toNumber(wo.totalLaborCost) : null,
    externalCost: wo.externalCost != null ? toNumber(wo.externalCost) : null,
    totalCost: wo.totalCost != null ? toNumber(wo.totalCost) : null,
    accountingTreatment: wo.accountingTreatment ?? null,
    photoUrls: Array.isArray(wo.photoUrls) ? wo.photoUrls : [],
    geoLat: wo.geoLat != null ? toNumber(wo.geoLat) : null,
    geoLon: wo.geoLon != null ? toNumber(wo.geoLon) : null,
    stockOutputId: wo.stockOutputId ?? null,
    costCenterId: wo.costCenterId ?? null,
    costCenterMode: wo.costCenterMode ?? 'INHERITED',
    notes: wo.notes ?? null,
    parts: (wo.parts ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => ({
        id: p.id,
        productId: p.productId,
        quantity: toNumber(p.quantity),
        unitCost: toNumber(p.unitCost),
        totalCost: toNumber(p.totalCost),
        notes: p.notes ?? null,
        product: p.product
          ? { id: p.product.id, name: p.product.name, unit: p.product.unit ?? '' }
          : undefined,
      }),
    ),
    ccItems: (wo.ccItems ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => ({
        id: c.id,
        costCenterId: c.costCenterId,
        farmId: c.farmId,
        amount: toNumber(c.amount),
        percentage: toNumber(c.percentage),
      }),
    ),
    asset: wo.asset
      ? { id: wo.asset.id, name: wo.asset.name, assetTag: wo.asset.assetTag }
      : undefined,
    createdAt: wo.createdAt?.toISOString() ?? '',
    updatedAt: wo.updatedAt?.toISOString() ?? '',
  };
}

const WO_INCLUDE = {
  parts: {
    include: {
      product: { select: { id: true, name: true, unit: true } },
    },
  },
  ccItems: true,
  asset: { select: { id: true, name: true, assetTag: true, costCenterId: true, farmId: true } },
  maintenancePlan: {
    select: {
      id: true,
      triggerType: true,
      intervalValue: true,
    },
  },
};

// ─── Inline next-due calculation (mirrors maintenance-plans logic) ────

function computeNextDue(
  triggerType: string,
  intervalValue: Decimal,
  lastExecutedAt: Date,
  lastMeterValue: number | null,
): { nextDueAt: Date | null; nextDueMeter: number | null } {
  if (triggerType === 'CALENDAR') {
    return {
      nextDueAt: addDays(lastExecutedAt, intervalValue.toNumber()),
      nextDueMeter: null,
    };
  }
  if (triggerType === 'HOURMETER' || triggerType === 'ODOMETER') {
    return {
      nextDueAt: null,
      nextDueMeter: (lastMeterValue ?? 0) + intervalValue.toNumber(),
    };
  }
  return { nextDueAt: null, nextDueMeter: null };
}

// ─── Service functions ────────────────────────────────────────────────

export async function createWorkOrder(
  ctx: RlsContext,
  input: CreateWorkOrderInput,
): Promise<WorkOrderOutput> {
  return prisma.$transaction(async (tx) => {
    // Verify asset belongs to org
    const asset = await tx.asset.findFirst({
      where: { id: input.assetId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!asset) {
      throw new WorkOrderError('Ativo não encontrado', 404);
    }

    const sequentialNumber = await getNextSequentialNumber(tx, ctx.organizationId);

    const wo = await tx.workOrder.create({
      data: {
        organizationId: ctx.organizationId,
        assetId: input.assetId,
        sequentialNumber,
        type: input.type,
        status: 'ABERTA',
        title: input.title,
        description: input.description ?? null,
        maintenancePlanId: input.maintenancePlanId ?? null,
        assignedTo: input.assignedTo ?? null,
        hourmeterAtOpen: input.hourmeterAtOpen != null ? input.hourmeterAtOpen : null,
        odometerAtOpen: input.odometerAtOpen != null ? input.odometerAtOpen : null,
        photoUrls: input.photoUrls ?? [],
        geoLat: input.geoLat != null ? input.geoLat : null,
        geoLon: input.geoLon != null ? input.geoLon : null,
        costCenterId: input.costCenterId ?? null,
        costCenterMode: input.costCenterId ? 'FIXED' : 'INHERITED',
        createdBy: ctx.userId,
      },
      include: WO_INCLUDE,
    });

    // Atomically set asset to EM_MANUTENCAO
    await tx.asset.update({
      where: { id: input.assetId },
      data: { status: 'EM_MANUTENCAO' },
    });

    return mapWorkOrder(wo);
  });
}

export async function listWorkOrders(
  ctx: RlsContext,
  query: ListWorkOrdersQuery,
): Promise<{ data: WorkOrderOutput[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { organizationId: ctx.organizationId };
  if (query.status) where.status = query.status;
  if (query.assetId) where.assetId = query.assetId;
  if (query.type) where.type = query.type;
  if (query.farmId) {
    where.asset = { farmId: query.farmId };
  }
  if (query.dateFrom || query.dateTo) {
    where.openedAt = {};
    if (query.dateFrom) where.openedAt.gte = new Date(query.dateFrom);
    if (query.dateTo) where.openedAt.lte = new Date(query.dateTo);
  }

  const [total, records] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { openedAt: 'desc' },
      include: {
        ...WO_INCLUDE,
        _count: { select: { parts: true } },
      },
    }),
  ]);

  return {
    data: records.map(mapWorkOrder),
    total,
    page,
    limit,
  };
}

export async function getWorkOrder(ctx: RlsContext, id: string): Promise<WorkOrderOutput> {
  const wo = await prisma.workOrder.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: WO_INCLUDE,
  });
  if (!wo) {
    throw new WorkOrderError('OS não encontrada', 404);
  }
  return mapWorkOrder(wo);
}

// Valid status transitions for updateWorkOrder
const VALID_TRANSITIONS: Record<string, string[]> = {
  ABERTA: ['EM_ANDAMENTO', 'AGUARDANDO_PECA'],
  EM_ANDAMENTO: ['AGUARDANDO_PECA'],
  AGUARDANDO_PECA: ['EM_ANDAMENTO'],
};

export async function updateWorkOrder(
  ctx: RlsContext,
  id: string,
  input: UpdateWorkOrderInput,
): Promise<WorkOrderOutput> {
  const wo = await prisma.workOrder.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!wo) {
    throw new WorkOrderError('OS não encontrada', 404);
  }

  if (input.status && input.status !== wo.status) {
    const allowed = VALID_TRANSITIONS[wo.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw new WorkOrderError(`Transição de status inválida: ${wo.status} → ${input.status}`, 400);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.assignedTo !== undefined) data.assignedTo = input.assignedTo;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.status) {
    data.status = input.status;
    if (input.status === 'EM_ANDAMENTO' && !wo.startedAt) {
      data.startedAt = new Date();
    }
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data,
    include: WO_INCLUDE,
  });
  return mapWorkOrder(updated);
}

export async function addWorkOrderPart(
  ctx: RlsContext,
  workOrderId: string,
  input: AddWorkOrderPartInput,
): Promise<WorkOrderOutput> {
  const wo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, organizationId: ctx.organizationId },
    include: { parts: true },
  });
  if (!wo) {
    throw new WorkOrderError('OS não encontrada', 404);
  }
  if (wo.status === 'ENCERRADA' || wo.status === 'CANCELADA') {
    throw new WorkOrderError('Não é possível adicionar peças a uma OS encerrada ou cancelada', 400);
  }

  const totalCost = new Decimal(input.quantity).times(input.unitCost).toDecimalPlaces(2);

  await prisma.workOrderPart.create({
    data: {
      workOrderId,
      productId: input.productId,
      quantity: input.quantity,
      unitCost: input.unitCost,
      totalCost: totalCost.toNumber(),
      notes: input.notes ?? null,
    },
  });

  // Recalculate totalPartsCost
  const updatedWo = await prisma.workOrder.findFirst({
    where: { id: workOrderId },
    include: { parts: true },
  });
  const newTotalPartsCost = (updatedWo?.parts ?? []).reduce(
    (acc, p) => acc.plus(new Decimal(toNumber(p.totalCost))),
    new Decimal(0),
  );
  const result = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { totalPartsCost: newTotalPartsCost.toDecimalPlaces(2).toNumber() },
    include: WO_INCLUDE,
  });
  return mapWorkOrder(result);
}

export async function removeWorkOrderPart(
  ctx: RlsContext,
  workOrderId: string,
  partId: string,
): Promise<WorkOrderOutput> {
  const wo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, organizationId: ctx.organizationId },
  });
  if (!wo) {
    throw new WorkOrderError('OS não encontrada', 404);
  }

  await prisma.workOrderPart.delete({ where: { id: partId } });

  // Recalculate totalPartsCost
  const remaining = await prisma.workOrderPart.findMany({ where: { workOrderId } });
  const newTotalPartsCost = remaining.reduce(
    (acc, p) => acc.plus(new Decimal(toNumber(p.totalCost))),
    new Decimal(0),
  );
  const result = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { totalPartsCost: newTotalPartsCost.toDecimalPlaces(2).toNumber() },
    include: WO_INCLUDE,
  });
  return mapWorkOrder(result);
}

export async function closeWorkOrder(
  ctx: RlsContext,
  id: string,
  input: CloseWorkOrderInput,
): Promise<WorkOrderOutput> {
  if (!input.accountingTreatment) {
    throw new WorkOrderError('Classificacao contabil obrigatoria para encerrar OS', 400);
  }
  if (input.accountingTreatment === 'DIFERIMENTO' && !input.deferralMonths) {
    throw new WorkOrderError('Numero de meses obrigatorio para diferimento', 400);
  }

  return prisma.$transaction(async (tx) => {
    // a. Fetch WO with parts and asset (with costCenter)
    const wo = await tx.workOrder.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        parts: true,
        asset: {
          select: {
            id: true,
            farmId: true,
            costCenterId: true,
            acquisitionValue: true,
          },
        },
        maintenancePlan: {
          select: {
            id: true,
            triggerType: true,
            intervalValue: true,
          },
        },
      },
    });
    if (!wo) {
      throw new WorkOrderError('OS não encontrada', 404);
    }
    if (wo.status === 'ENCERRADA') {
      throw new WorkOrderError('OS já encerrada', 400);
    }
    if (wo.status === 'CANCELADA') {
      throw new WorkOrderError('OS cancelada não pode ser encerrada', 400);
    }

    // c. Stock deduction
    let stockOutputId: string | null = null;
    if (wo.parts.length > 0) {
      const deduction = await createConsumptionOutput(tx, {
        organizationId: ctx.organizationId,
        items: wo.parts.map((p) => ({
          productId: p.productId,
          quantity: toNumber(p.quantity),
        })),
        fieldOperationRef: `work-order:${id}`,
        outputDate: new Date(),
        responsibleName: input.closedBy,
        notes: `OS #${wo.sequentialNumber} — ${wo.title}`,
      });
      stockOutputId = deduction?.stockOutputId ?? null;
    }

    // d. Compute costs with Decimal
    const partsCost = wo.parts.reduce(
      (acc, p) => acc.plus(new Decimal(toNumber(p.totalCost))),
      new Decimal(0),
    );
    const laborCost =
      input.laborHours != null && input.laborCostPerHour != null
        ? new Decimal(input.laborHours).times(input.laborCostPerHour).toDecimalPlaces(2)
        : new Decimal(0);
    const externalCostDecimal =
      input.externalCost != null
        ? new Decimal(input.externalCost).toDecimalPlaces(2)
        : new Decimal(0);
    const totalCost = partsCost.plus(laborCost).plus(externalCostDecimal).toDecimalPlaces(2);

    // e. CAPITALIZACAO: add totalCost to asset acquisitionValue
    if (input.accountingTreatment === 'CAPITALIZACAO') {
      await tx.asset.update({
        where: { id: wo.assetId },
        data: {
          acquisitionValue: { increment: totalCost.toNumber() },
        },
      });
    }

    // f. DIFERIMENTO: create DeferredMaintenance
    if (input.accountingTreatment === 'DIFERIMENTO' && input.deferralMonths) {
      const monthly = totalCost.dividedBy(input.deferralMonths).toDecimalPlaces(2);
      const startDate = new Date();
      const startMonth = startDate.getMonth() + 1;
      const startYear = startDate.getFullYear();
      // Compute end month/year
      const totalMonths = startMonth + input.deferralMonths - 1;
      const endYear = startYear + Math.floor((totalMonths - 1) / 12);
      const endMonth = ((totalMonths - 1) % 12) + 1;

      await tx.deferredMaintenance.create({
        data: {
          organizationId: ctx.organizationId,
          workOrderId: id,
          totalAmount: totalCost.toNumber(),
          monthlyAmortization: monthly.toNumber(),
          startMonth,
          startYear,
          endMonth,
          endYear,
        },
      });
    }

    // g. CC appropriation: inherit from asset or use override
    const ccId = input.costCenterId ?? wo.asset?.costCenterId;
    if (ccId && wo.asset?.farmId) {
      await tx.workOrderCCItem.create({
        data: {
          workOrderId: id,
          costCenterId: ccId,
          farmId: wo.asset.farmId,
          amount: totalCost.toNumber(),
          percentage: 100,
        },
      });
    }

    // h. Reset asset status to ATIVO
    await tx.asset.update({
      where: { id: wo.assetId },
      data: { status: 'ATIVO' },
    });

    // i. Update linked maintenance plan if present
    if (wo.maintenancePlanId && wo.maintenancePlan) {
      const lastMeterValue =
        wo.hourmeterAtOpen != null
          ? toNumber(wo.hourmeterAtOpen)
          : wo.odometerAtOpen != null
            ? toNumber(wo.odometerAtOpen)
            : null;
      const now = new Date();
      const { nextDueAt, nextDueMeter } = computeNextDue(
        wo.maintenancePlan.triggerType,
        new Decimal(toNumber(wo.maintenancePlan.intervalValue)),
        now,
        lastMeterValue,
      );
      await tx.maintenancePlan.update({
        where: { id: wo.maintenancePlanId },
        data: {
          lastExecutedAt: now,
          lastMeterValue: lastMeterValue ?? undefined,
          nextDueAt: nextDueAt ?? undefined,
          nextDueMeter: nextDueMeter ?? undefined,
        },
      });
    }

    // j. Update WorkOrder with computed values and status ENCERRADA
    const updated = await tx.workOrder.update({
      where: { id },
      data: {
        status: 'ENCERRADA',
        closedAt: new Date(),
        accountingTreatment: input.accountingTreatment,
        totalPartsCost: partsCost.toNumber(),
        totalLaborCost: laborCost.toNumber(),
        externalCost: externalCostDecimal.toNumber(),
        laborHours: input.laborHours ?? null,
        laborCostPerHour: input.laborCostPerHour ?? null,
        externalSupplier: input.externalSupplier ?? null,
        totalCost: totalCost.toNumber(),
        stockOutputId,
      },
      include: WO_INCLUDE,
    });

    return mapWorkOrder(updated);
  });
}

export async function cancelWorkOrder(ctx: RlsContext, id: string): Promise<WorkOrderOutput> {
  return prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!wo) {
      throw new WorkOrderError('OS não encontrada', 404);
    }
    if (wo.status === 'ENCERRADA') {
      throw new WorkOrderError('OS encerrada não pode ser cancelada', 400);
    }
    if (wo.status === 'CANCELADA') {
      throw new WorkOrderError('OS já cancelada', 400);
    }

    // Reset asset status to ATIVO
    await tx.asset.update({
      where: { id: wo.assetId },
      data: { status: 'ATIVO' },
    });

    const updated = await tx.workOrder.update({
      where: { id },
      data: { status: 'CANCELADA' },
      include: WO_INCLUDE,
    });
    return mapWorkOrder(updated);
  });
}

export async function getMaintenanceDashboard(
  ctx: RlsContext,
  query: { year?: number },
): Promise<MaintenanceDashboardOutput> {
  const year = query.year ?? new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  // Fetch all closed OS for the year
  const closedOrders = await prisma.workOrder.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: 'ENCERRADA',
      closedAt: { gte: yearStart, lt: yearEnd },
    },
    include: {
      asset: { select: { id: true, name: true } },
    },
  });

  // Total cost YTD
  const totalCostYTD = closedOrders.reduce((acc, o) => acc + toNumber(o.totalCost), 0);

  // Corrective OS only (MTBF/MTTR)
  const correctiveOrders = closedOrders.filter((o) => o.type === 'CORRETIVA');

  // MTBF: total uptime hours / count of corrective OS
  let mtbfHours: number | null = null;
  let mttrHours: number | null = null;

  if (correctiveOrders.length > 0) {
    const totalDowntimeMs = correctiveOrders.reduce((acc, o) => {
      if (o.closedAt && o.openedAt) {
        return acc + (o.closedAt.getTime() - o.openedAt.getTime());
      }
      return acc;
    }, 0);
    const totalDowntimeHours = totalDowntimeMs / (1000 * 60 * 60);
    const totalHoursInPeriod = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60);
    const uptimeHours = Math.max(0, totalHoursInPeriod - totalDowntimeHours);

    mtbfHours = correctiveOrders.length > 0 ? uptimeHours / correctiveOrders.length : null;
    mttrHours = correctiveOrders.length > 0 ? totalDowntimeHours / correctiveOrders.length : null;
  }

  // Availability: uptime / (uptime + downtime) * 100
  let availability: number | null = null;
  const allDowntimeMs = closedOrders.reduce((acc, o) => {
    if (o.closedAt && o.openedAt) {
      return acc + (o.closedAt.getTime() - o.openedAt.getTime());
    }
    return acc;
  }, 0);
  const totalHoursInPeriod = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60);
  const allDowntimeHours = allDowntimeMs / (1000 * 60 * 60);
  const uptimeHours = Math.max(0, totalHoursInPeriod - allDowntimeHours);
  if (totalHoursInPeriod > 0) {
    availability = (uptimeHours / totalHoursInPeriod) * 100;
  }

  // Open orders count
  const openOrdersCount = await prisma.workOrder.count({
    where: {
      organizationId: ctx.organizationId,
      status: { in: ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_PECA'] },
    },
  });

  // Overdue maintenances
  const overdueMaintenancesCount = await prisma.maintenancePlan.count({
    where: {
      organizationId: ctx.organizationId,
      isActive: true,
      nextDueAt: { lt: new Date() },
    },
  });

  // byStatus: count all WO by status (all time for current org)
  const allOrders = await prisma.workOrder.findMany({
    where: { organizationId: ctx.organizationId },
    select: { status: true },
  });
  const byStatus: Record<string, number> = {};
  for (const o of allOrders) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  }

  // costByAsset: top 10 assets by OS cost for the year
  const costByAssetMap = new Map<string, { assetName: string; totalCost: number }>();
  for (const o of closedOrders) {
    const key = o.assetId;
    const existing = costByAssetMap.get(key);
    if (existing) {
      existing.totalCost += toNumber(o.totalCost);
    } else {
      costByAssetMap.set(key, {
        assetName: o.asset?.name ?? o.assetId,
        totalCost: toNumber(o.totalCost),
      });
    }
  }
  const costByAsset = Array.from(costByAssetMap.entries())
    .map(([assetId, v]) => ({ assetId, assetName: v.assetName, totalCost: v.totalCost }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10);

  // Recent orders: last 10
  const recentOrdersRaw = await prisma.workOrder.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { openedAt: 'desc' },
    take: 10,
    include: WO_INCLUDE,
  });
  const recentOrders = recentOrdersRaw.map(mapWorkOrder);

  return {
    availability,
    mtbfHours,
    mttrHours,
    totalCostYTD,
    openOrdersCount,
    overdueMaintenancesCount,
    byStatus,
    costByAsset,
    recentOrders,
  };
}
