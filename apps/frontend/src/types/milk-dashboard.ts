export interface MilkDashboardKpis {
  todayLiters: number;
  monthLiters: number;
  accumulatedLiters: number;
  avgLitersPerCow: number;
  cowsInLactation: number;
  dryCows: number;
}

export interface EvolutionPoint {
  date: string;
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

export interface MilkQuality {
  avgScc: number | null;
  avgTbc: number | null;
  sccTrend: string | null;
  tbcTrend: string | null;
}

export interface MilkFinancial {
  costPerLiter: number | null;
  revenuePerLiter: number | null;
  marginPerLiter: number | null;
  totalMargin: number | null;
  breakdown: {
    feedCost: number;
    healthCost: number;
    laborCost: number;
  };
}

export interface MilkDashboardData {
  kpis: MilkDashboardKpis;
  evolution: EvolutionPoint[];
  topCows: CowRankingItem[];
  bottomCows: CowRankingItem[];
  quality: MilkQuality;
  financial: MilkFinancial;
}
