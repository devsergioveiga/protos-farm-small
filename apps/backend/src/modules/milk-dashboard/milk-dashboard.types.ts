// ─── Errors ──────────────────────────────────────────────────────────

export class MilkDashboardError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'MilkDashboardError';
    this.statusCode = statusCode;
  }
}

// ─── Query ───────────────────────────────────────────────────────────

export type DashboardPeriod = '30d' | '90d' | '365d';

export interface MilkDashboardQuery {
  farmId: string;
  period: DashboardPeriod;
  lotId?: string;
  breedName?: string;
}

// ─── Response Types ──────────────────────────────────────────────────

export interface MilkDashboardKpis {
  todayLiters: number;
  monthLiters: number;
  accumulatedLiters: number;
  avgLitersPerCow: number;
  cowsInLactation: number;
  dryCows: number;
}

export interface ProductionEvolutionPoint {
  date: string; // "2026-03-15"
  totalLiters: number;
}

export interface CowRankingItem {
  animalId: string;
  earTag: string;
  animalName: string | null;
  totalLiters: number;
  avgLitersPerDay: number;
  lotName: string | null;
}

export interface QualityIndicators {
  avgScc: number | null;
  avgTbc: number | null;
  sccTrend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  tbcTrend: 'IMPROVING' | 'STABLE' | 'WORSENING';
}

export interface FinancialSummary {
  costPerLiter: number;
  revenuePerLiter: number;
  marginPerLiter: number;
  totalMargin: number;
  breakdown: {
    feedCost: number;
    healthCost: number;
    laborCost: number;
  };
}

export interface MilkDashboardResponse {
  kpis: MilkDashboardKpis;
  evolution: ProductionEvolutionPoint[];
  topCows: CowRankingItem[];
  bottomCows: CowRankingItem[];
  quality: QualityIndicators;
  financial: FinancialSummary;
}

// ─── Period helpers ──────────────────────────────────────────────────

export function periodToDays(period: DashboardPeriod): number {
  switch (period) {
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '365d':
      return 365;
  }
}

const VALID_PERIODS = new Set<string>(['30d', '90d', '365d']);

export function isValidPeriod(value: string): value is DashboardPeriod {
  return VALID_PERIODS.has(value);
}
