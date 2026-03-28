import { addDays } from 'date-fns';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import { withRlsBypass } from '../../database/rls';
import { createNotification } from '../notifications/notifications.service';
import { logger } from '../../shared/utils/logger';
import {
  MaintenancePlanError,
  type CreateMaintenancePlanInput,
  type UpdateMaintenancePlanInput,
  type ListMaintenancePlansQuery,
} from './maintenance-plans.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ──────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

const PLAN_INCLUDE = {
  asset: { select: { id: true, name: true, assetTag: true } },
};

const PLAN_INCLUDE_FULL = {
  ...PLAN_INCLUDE,
  workOrders: {
    orderBy: { openedAt: 'desc' as const },
    take: 10,
    select: {
      id: true,
      sequentialNumber: true,
      type: true,
      status: true,
      title: true,
      openedAt: true,
      closedAt: true,
    },
  },
};

// ─── computeNextDue ──────────────────────────────────────────────────

export function computeNextDue(
  triggerType: 'HOURMETER' | 'ODOMETER' | 'CALENDAR',
  intervalValue: number,
  lastExecutedAt?: Date | null,
  lastMeterValue?: number | null,
): { nextDueAt: Date | null; nextDueMeter: number | null } {
  if (triggerType === 'CALENDAR') {
    const base = lastExecutedAt ?? new Date();
    return {
      nextDueAt: addDays(base, intervalValue),
      nextDueMeter: null,
    };
  }
  // HOURMETER or ODOMETER
  return {
    nextDueAt: null,
    nextDueMeter: (lastMeterValue ?? 0) + intervalValue,
  };
}

// ─── getLatestMeterValue ──────────────────────────────────────────────

async function getLatestMeterValue(
  tx: TxClient,
  assetId: string,
  triggerType: 'HOURMETER' | 'ODOMETER',
): Promise<number | null> {
  const readingType = triggerType === 'HOURMETER' ? 'HOURMETER' : 'ODOMETER';
  const reading = await tx.meterReading.findFirst({
    where: { assetId, readingType },
    orderBy: { readingDate: 'desc' },
    select: { value: true },
  });
  return reading ? toNumber(reading.value) : null;
}

// ─── createMaintenancePlan ────────────────────────────────────────────

export async function createMaintenancePlan(ctx: RlsContext, input: CreateMaintenancePlanInput) {
  return prisma.$transaction(async (tx) => {
    // Verify asset belongs to org
    const asset = await tx.asset.findFirst({
      where: { id: input.assetId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, currentHourmeter: true, currentOdometer: true },
    });
    if (!asset) {
      throw new MaintenancePlanError('Ativo não encontrado', 404);
    }

    // Get last meter value for HOURMETER/ODOMETER
    let lastMeterValue: number | null = null;
    if (input.triggerType === 'HOURMETER' || input.triggerType === 'ODOMETER') {
      lastMeterValue = await getLatestMeterValue(tx, input.assetId, input.triggerType);
      // Fallback to asset's current meter field
      if (lastMeterValue === null) {
        lastMeterValue =
          input.triggerType === 'HOURMETER'
            ? toNumber(asset.currentHourmeter)
            : toNumber(asset.currentOdometer);
      }
    }

    const { nextDueAt, nextDueMeter } = computeNextDue(
      input.triggerType,
      input.intervalValue,
      null, // lastExecutedAt — new plan, use current date as base
      lastMeterValue,
    );

    return tx.maintenancePlan.create({
      data: {
        organizationId: ctx.organizationId,
        assetId: input.assetId,
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        intervalValue: String(input.intervalValue),
        alertBeforeValue: String(input.alertBeforeValue),
        nextDueAt,
        nextDueMeter: nextDueMeter != null ? String(nextDueMeter) : null,
        lastMeterValue: lastMeterValue != null ? String(lastMeterValue) : null,
        createdBy: 'system',
      },
      include: PLAN_INCLUDE,
    });
  });
}

// ─── listMaintenancePlans ─────────────────────────────────────────────

export async function listMaintenancePlans(ctx: RlsContext, query: ListMaintenancePlansQuery) {
  const page = Number(query.page ?? 1);
  const limit = Math.min(Number(query.limit ?? 20), 100);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    organizationId: ctx.organizationId,
  };

  if (query.assetId) where['assetId'] = query.assetId;
  if (query.triggerType) where['triggerType'] = query.triggerType;
  if (query.isActive !== undefined) where['isActive'] = query.isActive;
  if (query.farmId) {
    where['asset'] = { farmId: query.farmId };
  }

  const [data, total] = await Promise.all([
    prisma.maintenancePlan.findMany({
      where,
      include: PLAN_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.maintenancePlan.count({ where }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── getMaintenancePlan ───────────────────────────────────────────────

export async function getMaintenancePlan(ctx: RlsContext, id: string) {
  const plan = await prisma.maintenancePlan.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: PLAN_INCLUDE_FULL,
  });

  if (!plan) {
    throw new MaintenancePlanError('Plano não encontrado', 404);
  }

  return plan;
}

// ─── updateMaintenancePlan ────────────────────────────────────────────

export async function updateMaintenancePlan(
  ctx: RlsContext,
  id: string,
  input: UpdateMaintenancePlanInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.maintenancePlan.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new MaintenancePlanError('Plano não encontrado', 404);
    }

    // Recalculate nextDue if trigger config changed
    let nextDueAt = existing.nextDueAt;
    let nextDueMeter = existing.nextDueMeter;

    const triggerChanged =
      (input.triggerType && input.triggerType !== String(existing.triggerType)) ||
      (input.intervalValue !== undefined &&
        Number(input.intervalValue) !== toNumber(existing.intervalValue));

    if (triggerChanged) {
      const newTrigger = (input.triggerType ?? String(existing.triggerType)) as
        | 'HOURMETER'
        | 'ODOMETER'
        | 'CALENDAR';
      const newInterval = input.intervalValue ?? toNumber(existing.intervalValue);

      let lastMeterValue: number | null = null;
      if (newTrigger === 'HOURMETER' || newTrigger === 'ODOMETER') {
        lastMeterValue = await getLatestMeterValue(tx, String(existing.assetId), newTrigger);
        if (lastMeterValue === null) {
          lastMeterValue = toNumber(existing.lastMeterValue);
        }
      }

      const computed = computeNextDue(
        newTrigger,
        newInterval,
        existing.lastExecutedAt,
        lastMeterValue,
      );
      nextDueAt = computed.nextDueAt;
      nextDueMeter =
        computed.nextDueMeter != null ? (String(computed.nextDueMeter) as never) : null;
    }

    return tx.maintenancePlan.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.triggerType !== undefined && { triggerType: input.triggerType }),
        ...(input.intervalValue !== undefined && { intervalValue: String(input.intervalValue) }),
        ...(input.alertBeforeValue !== undefined && {
          alertBeforeValue: String(input.alertBeforeValue),
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        nextDueAt,
        nextDueMeter,
      },
      include: PLAN_INCLUDE,
    });
  });
}

// ─── deleteMaintenancePlan ────────────────────────────────────────────

export async function deleteMaintenancePlan(ctx: RlsContext, id: string) {
  const existing = await prisma.maintenancePlan.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });

  if (!existing) {
    throw new MaintenancePlanError('Plano não encontrado', 404);
  }

  // Hard delete — linked workOrders have onDelete: SetNull or keep FK as null
  await prisma.maintenancePlan.delete({ where: { id } });
}

// ─── processOverduePlans ──────────────────────────────────────────────

export async function processOverduePlans(organizationId?: string): Promise<number> {
  const now = new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { isActive: true };
  if (organizationId) where['organizationId'] = organizationId;

  // Calendar plans where nextDueAt <= now
  const calendarOverdue = await prisma.maintenancePlan.findMany({
    where: {
      ...where,
      triggerType: 'CALENDAR',
      nextDueAt: { lte: now },
    },
    include: {
      asset: {
        select: { name: true, assetTag: true, currentHourmeter: true, currentOdometer: true },
      },
      organization: { select: { id: true } },
    },
  });

  // HOURMETER/ODOMETER plans — check against current meter readings
  const meterPlans = await prisma.maintenancePlan.findMany({
    where: {
      ...where,
      triggerType: { in: ['HOURMETER', 'ODOMETER'] },
      nextDueMeter: { not: null },
    },
    include: {
      asset: {
        select: { name: true, assetTag: true, currentHourmeter: true, currentOdometer: true },
      },
      organization: { select: { id: true } },
    },
  });

  const meterOverdue = meterPlans.filter((plan) => {
    const nextDueMeter = toNumber(plan.nextDueMeter);
    const currentMeter =
      String(plan.triggerType) === 'HOURMETER'
        ? toNumber(plan.asset.currentHourmeter)
        : toNumber(plan.asset.currentOdometer);
    return currentMeter >= nextDueMeter;
  });

  const overduePlans = [...calendarOverdue, ...meterOverdue];
  let notified = 0;

  for (const plan of overduePlans) {
    try {
      // Notify org admins/managers
      const managers = await prisma.user.findMany({
        where: {
          organizationId: plan.organizationId,
          role: { in: ['ADMIN', 'MANAGER'] },
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      await withRlsBypass(async (tx) => {
        for (const manager of managers) {
          await createNotification(tx, plan.organizationId, {
            recipientId: manager.id,
            type: 'MAINTENANCE_OVERDUE',
            title: `Manutenção vencida: ${plan.name}`,
            body: `O plano de manutenção "${plan.name}" para o ativo ${plan.asset.name} (${plan.asset.assetTag}) está vencido.`,
            referenceId: plan.id,
            referenceType: 'maintenance_plan',
          });
        }
      });

      notified++;
    } catch (err) {
      logger.error({ err, planId: plan.id }, 'Failed to send maintenance overdue notification');
    }
  }

  return notified;
}
