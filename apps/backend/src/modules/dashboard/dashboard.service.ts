import { withRlsContext, withRlsBypass, type RlsContext } from '../../database/rls';
import { getExpiringContracts } from '../producers/producers.service';
import type { OrgDashboardStats } from './dashboard.types';

export async function getOrgDashboardStats(ctx: RlsContext): Promise<OrgDashboardStats> {
  // Summary + farmsByUf via RLS context (scoped to org)
  const rlsData = await withRlsContext(ctx, async (tx) => {
    const totalFarms = await tx.farm.count({ where: { deletedAt: null } });
    const totalPlots = await tx.fieldPlot.count({ where: { deletedAt: null } });
    const areaResult = await tx.farm.aggregate({
      _sum: { totalAreaHa: true },
      where: { deletedAt: null },
    });
    const totalAreaHa = areaResult._sum.totalAreaHa ? Number(areaResult._sum.totalAreaHa) : 0;

    const farmsByUfRaw = await tx.farm.groupBy({
      by: ['state'],
      _count: { state: true },
      where: { deletedAt: null },
      orderBy: { _count: { state: 'desc' } },
    });

    const farmsByUf = farmsByUfRaw.map((g) => ({
      uf: g.state,
      count: g._count.state,
    }));

    return { totalFarms, totalPlots, totalAreaHa, farmsByUf };
  });

  // Active users + org limits via bypass (users table has org-level RLS)
  const bypassData = await withRlsBypass(async (tx) => {
    const activeUsers = await tx.user.count({
      where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
    });

    const org = await tx.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { maxFarms: true, maxUsers: true },
    });

    const recentActivity = await tx.auditLog.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        actorEmail: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
      },
    });

    const totalUsers = await tx.user.count({
      where: { organizationId: ctx.organizationId },
    });

    return { activeUsers, org, recentActivity, totalUsers };
  });

  // Expiring contracts via producers service (uses RLS)
  let expiringContracts: {
    total: number;
    alerts: OrgDashboardStats['alerts']['expiringContracts']['alerts'];
  };
  try {
    const result = await getExpiringContracts(ctx, 30);
    expiringContracts = {
      total: result.total,
      alerts: result.alerts.slice(0, 5).map((a) => ({
        type: a.type,
        id: a.id,
        producerName: a.producerName,
        farmName: a.farmName ?? null,
        expiresAt: a.expiresAt,
      })),
    };
  } catch {
    expiringContracts = { total: 0, alerts: [] };
  }

  const farmPercentage =
    bypassData.org.maxFarms > 0
      ? Math.round((rlsData.totalFarms / bypassData.org.maxFarms) * 100)
      : 0;
  const userPercentage =
    bypassData.org.maxUsers > 0
      ? Math.round((bypassData.totalUsers / bypassData.org.maxUsers) * 100)
      : 0;

  return {
    summary: {
      totalFarms: rlsData.totalFarms,
      totalPlots: rlsData.totalPlots,
      totalAreaHa: rlsData.totalAreaHa,
      activeUsers: bypassData.activeUsers,
    },
    farmsByUf: rlsData.farmsByUf,
    recentActivity: bypassData.recentActivity as OrgDashboardStats['recentActivity'],
    alerts: {
      farmLimit: {
        current: rlsData.totalFarms,
        max: bypassData.org.maxFarms,
        percentage: farmPercentage,
        warning: farmPercentage >= 80,
      },
      userLimit: {
        current: bypassData.totalUsers,
        max: bypassData.org.maxUsers,
        percentage: userPercentage,
        warning: userPercentage >= 80,
      },
      expiringContracts,
    },
  };
}
