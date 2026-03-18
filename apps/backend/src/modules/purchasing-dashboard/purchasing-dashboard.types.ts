export interface PurchasingDashboardFilters {
  farmId?: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface PurchasingDashboardData {
  // 4 KPIs — current + previous period for YoyBadge
  pendingApprovalCount: number;
  pendingApprovalCountPrev: number;
  overduePoCount: number;
  overduePoCountPrev: number;
  avgCycleDays: number;
  avgCycleDaysPrev: number;
  lateDeliveriesCount: number;
  lateDeliveriesCountPrev: number;

  // 4 charts
  volumeByStage: { stage: string; count: number; totalValue: number }[];
  purchasesByCategory: { category: string; totalValue: number }[];
  monthlyEvolution: { month: string; totalValue: number }[];
  urgentVsPlanned: { month: string; urgent: number; planned: number }[];

  // Alerts
  alerts: {
    overduePoCount: number;
    rcAboveSlaCount: number;
    budgetExceededCount: number;
    lateDeliveriesCount: number;
  };
}
