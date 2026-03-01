import { prisma } from '../../database/prisma';

// ─── Types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  organizations: {
    total: number;
    active: number;
    suspended: number;
    cancelled: number;
    byPlan: { plan: string; count: number }[];
  };
  users: { total: number };
  farms: { total: number };
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  action?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  farmId?: string;
  organizationId?: string;
}

// ─── Service functions ──────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [totalOrgs, activeOrgs, suspendedOrgs, cancelledOrgs, planGroups, totalUsers, totalFarms] =
    await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: 'ACTIVE' } }),
      prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      prisma.organization.count({ where: { status: 'CANCELLED' } }),
      prisma.organization.groupBy({ by: ['plan'], _count: { plan: true } }),
      prisma.user.count(),
      prisma.farm.count(),
    ]);

  return {
    organizations: {
      total: totalOrgs,
      active: activeOrgs,
      suspended: suspendedOrgs,
      cancelled: cancelledOrgs,
      byPlan: planGroups.map((g) => ({ plan: g.plan, count: g._count.plan })),
    },
    users: { total: totalUsers },
    farms: { total: totalFarms },
  };
}

export async function listAuditLogs(query: AuditLogQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (query.action) {
    where.action = query.action;
  }

  if (query.actorId) {
    where.actorId = query.actorId;
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
      ...(query.dateTo && { lte: new Date(query.dateTo) }),
    };
  }

  if (query.farmId) {
    where.farmId = query.farmId;
  }

  if (query.organizationId) {
    where.organizationId = query.organizationId;
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
