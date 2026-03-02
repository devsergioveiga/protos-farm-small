import { withRlsBypass } from '../../database/rls';

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
  return withRlsBypass(async (tx) => {
    const totalOrgs = await tx.organization.count();
    const activeOrgs = await tx.organization.count({ where: { status: 'ACTIVE' } });
    const suspendedOrgs = await tx.organization.count({ where: { status: 'SUSPENDED' } });
    const cancelledOrgs = await tx.organization.count({ where: { status: 'CANCELLED' } });
    const planGroups = await tx.organization.groupBy({ by: ['plan'], _count: { plan: true } });
    const totalUsers = await tx.user.count();
    const totalFarms = await tx.farm.count();

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
  });
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

  return withRlsBypass(async (tx) => {
    const data = await tx.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    const total = await tx.auditLog.count({ where });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}
