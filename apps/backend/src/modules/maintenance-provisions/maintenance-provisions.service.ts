import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import {
  MaintenanceProvisionError,
  type CreateMaintenanceProvisionInput,
  type UpdateMaintenanceProvisionInput,
  type ListMaintenanceProvisionsQuery,
  type MaintenanceProvisionOutput,
  type ProvisionReconciliationOutput,
} from './maintenance-provisions.types';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProvision(p: any): MaintenanceProvisionOutput {
  return {
    id: p.id,
    organizationId: p.organizationId,
    assetId: p.assetId ?? null,
    monthlyAmount: p.monthlyAmount != null ? Number(p.monthlyAmount) : 0,
    costCenterId: p.costCenterId ?? null,
    isActive: p.isActive,
    description: p.description ?? null,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
    asset: p.asset ? { id: p.asset.id, name: p.asset.name, assetTag: p.asset.assetTag } : null,
  };
}

const PROVISION_INCLUDE = {
  asset: { select: { id: true, name: true, assetTag: true } },
};

// ─── Service functions ────────────────────────────────────────────────

export async function createProvision(
  ctx: RlsContext,
  input: CreateMaintenanceProvisionInput,
): Promise<MaintenanceProvisionOutput> {
  if (!input.monthlyAmount || input.monthlyAmount <= 0) {
    throw new MaintenanceProvisionError('Valor mensal deve ser maior que zero', 400);
  }

  if (input.assetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: input.assetId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!asset) {
      throw new MaintenanceProvisionError('Ativo não encontrado', 404);
    }
  }

  const record = await prisma.maintenanceProvision.create({
    data: {
      organizationId: ctx.organizationId,
      assetId: input.assetId ?? null,
      monthlyAmount: input.monthlyAmount,
      costCenterId: input.costCenterId ?? null,
      description: input.description ?? null,
      isActive: input.isActive !== undefined ? input.isActive : true,
      createdBy: ctx.userId ?? 'system',
    },
    include: PROVISION_INCLUDE,
  });

  return mapProvision(record);
}

export async function listProvisions(
  ctx: RlsContext,
  query: ListMaintenanceProvisionsQuery,
): Promise<{ data: MaintenanceProvisionOutput[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { organizationId: ctx.organizationId };
  if (query.assetId !== undefined) where.assetId = query.assetId;
  if (query.isActive !== undefined) where.isActive = query.isActive;

  const [total, records] = await Promise.all([
    prisma.maintenanceProvision.count({ where }),
    prisma.maintenanceProvision.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: PROVISION_INCLUDE,
    }),
  ]);

  return {
    data: records.map(mapProvision),
    total,
    page,
    limit,
  };
}

export async function updateProvision(
  ctx: RlsContext,
  id: string,
  input: UpdateMaintenanceProvisionInput,
): Promise<MaintenanceProvisionOutput> {
  const existing = await prisma.maintenanceProvision.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existing) {
    throw new MaintenanceProvisionError('Provisão não encontrada', 404);
  }

  if (input.monthlyAmount !== undefined && input.monthlyAmount <= 0) {
    throw new MaintenanceProvisionError('Valor mensal deve ser maior que zero', 400);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.monthlyAmount !== undefined) data.monthlyAmount = input.monthlyAmount;
  if (input.costCenterId !== undefined) data.costCenterId = input.costCenterId;
  if (input.description !== undefined) data.description = input.description;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.assetId !== undefined) data.assetId = input.assetId;

  const updated = await prisma.maintenanceProvision.update({
    where: { id },
    data,
    include: PROVISION_INCLUDE,
  });

  return mapProvision(updated);
}

export async function deleteProvision(ctx: RlsContext, id: string): Promise<void> {
  const existing = await prisma.maintenanceProvision.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existing) {
    throw new MaintenanceProvisionError('Provisão não encontrada', 404);
  }

  await prisma.maintenanceProvision.delete({ where: { id } });
}

export async function getReconciliation(
  ctx: RlsContext,
  query: { year: number; month: number },
): Promise<ProvisionReconciliationOutput> {
  const { year, month } = query;

  // Provisioned: sum monthlyAmount for active provisions in org
  const activeProvisions = await prisma.maintenanceProvision.findMany({
    where: { organizationId: ctx.organizationId, isActive: true },
    include: { asset: { select: { id: true, name: true } } },
  });

  const totalProvisioned = activeProvisions.reduce(
    (acc, p) => acc.plus(new Decimal(Number(p.monthlyAmount))),
    new Decimal(0),
  );

  // Actual: sum totalCost from WorkOrders closed in that year/month
  // Use closedAt for period matching (Pitfall 7)
  const periodStart = new Date(year, month - 1, 1); // month is 1-indexed
  const periodEnd = new Date(year, month, 1); // first day of next month

  const closedWorkOrders = await prisma.workOrder.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: 'ENCERRADA',
      closedAt: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
    select: {
      id: true,
      assetId: true,
      totalCost: true,
      closedAt: true,
      asset: { select: { id: true, name: true } },
    },
  });

  const totalActualCost = closedWorkOrders.reduce(
    (acc, wo) => acc.plus(new Decimal(Number(wo.totalCost ?? 0))),
    new Decimal(0),
  );

  const variance = totalProvisioned.minus(totalActualCost);

  // Per-asset breakdown
  // Build a map: assetId → { provisioned, actual }
  const assetMap = new Map<string, { assetName: string; provisioned: Decimal; actual: Decimal }>();

  // Add provisioned amounts per asset
  for (const p of activeProvisions) {
    if (p.assetId && p.asset) {
      const key = p.assetId;
      const existing = assetMap.get(key);
      if (existing) {
        existing.provisioned = existing.provisioned.plus(Number(p.monthlyAmount));
      } else {
        assetMap.set(key, {
          assetName: p.asset.name,
          provisioned: new Decimal(Number(p.monthlyAmount)),
          actual: new Decimal(0),
        });
      }
    }
  }

  // Add actual costs per asset
  for (const wo of closedWorkOrders) {
    const key = wo.assetId;
    const existing = assetMap.get(key);
    const cost = new Decimal(Number(wo.totalCost ?? 0));
    if (existing) {
      existing.actual = existing.actual.plus(cost);
    } else {
      assetMap.set(key, {
        assetName: wo.asset?.name ?? wo.assetId,
        provisioned: new Decimal(0),
        actual: cost,
      });
    }
  }

  const byAsset = Array.from(assetMap.entries()).map(([assetId, v]) => ({
    assetId,
    assetName: v.assetName,
    provisioned: v.provisioned.toNumber(),
    actual: v.actual.toNumber(),
    variance: v.provisioned.minus(v.actual).toNumber(),
  }));

  return {
    periodYear: year,
    periodMonth: month,
    totalProvisioned: totalProvisioned.toNumber(),
    totalActualCost: totalActualCost.toNumber(),
    variance: variance.toNumber(),
    byAsset,
  };
}

export async function processMonthlyProvisions(): Promise<void> {
  // Query all active provisions across all orgs
  const activeProvisions = await prisma.maintenanceProvision.findMany({
    where: { isActive: true },
    select: { id: true, organizationId: true, assetId: true, monthlyAmount: true },
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // For Phase 18: simply log the provision processing for each active provision.
  // Full financial integration (CP entries) deferred to Phase 23.
  for (const provision of activeProvisions) {
    // In a real implementation, this would create a financial entry.
    // For now, log that this provision was processed for the period.
    void {
      provisionId: provision.id,
      organizationId: provision.organizationId,
      assetId: provision.assetId,
      monthlyAmount: Number(provision.monthlyAmount),
      period: `${year}-${String(month).padStart(2, '0')}`,
      processedAt: now.toISOString(),
    };
  }
}
