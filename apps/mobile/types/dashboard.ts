export interface OrgDashboardStats {
  summary: {
    totalFarms: number;
    totalPlots: number;
    totalAreaHa: number;
    activeUsers: number;
  };
  farmsByUf: Array<{ uf: string; count: number }>;
  recentActivity: Array<{
    id: string;
    actorEmail: string;
    action: string;
    targetType: string;
    createdAt: string;
  }>;
  alerts: {
    farmLimit: { current: number; max: number; percentage: number; warning: boolean };
    userLimit: { current: number; max: number; percentage: number; warning: boolean };
    expiringContracts: {
      total: number;
      alerts: Array<{ producerName: string; expiresAt: string }>;
    };
  };
}
