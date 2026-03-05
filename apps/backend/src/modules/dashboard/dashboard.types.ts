// ─── Org Dashboard Types ─────────────────────────────────────────────

export interface ExpiringAlert {
  type: 'FARM_LINK' | 'STATE_REGISTRATION';
  id: string;
  producerName: string;
  farmName: string | null;
  expiresAt: Date | null;
}

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
    targetType: string | null;
    targetId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  }>;
  alerts: {
    farmLimit: { current: number; max: number; percentage: number; warning: boolean };
    userLimit: { current: number; max: number; percentage: number; warning: boolean };
    expiringContracts: { total: number; alerts: ExpiringAlert[] };
  };
}
