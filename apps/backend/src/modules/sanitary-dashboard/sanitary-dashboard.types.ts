// ─── Query ──────────────────────────────────────────────────────────

export interface SanitaryDashboardQuery {
  farmId?: string;
  lotId?: string;
  category?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface SanitaryKpis {
  vaccinationCoveragePercent: number;
  animalsInTreatment: number;
  animalsInWithdrawal: number;
  upcomingCampaigns: number;
  pendingExamResults: number;
  expiredRegulatoryExams: number;
}

export interface PendingAnimalItem {
  animalId: string;
  earTag: string;
  animalName: string | null;
  farmName: string;
  lotName: string | null;
  category: string;
  pendingType:
    | 'OVERDUE_VACCINE'
    | 'PENDING_BOOSTER'
    | 'IN_WITHDRAWAL'
    | 'IN_TREATMENT'
    | 'EXAM_PENDING';
  pendingTypeLabel: string;
  detail: string;
}

export interface SanitaryCostItem {
  groupKey: string;
  groupLabel: string;
  totalCostCents: number;
}

export interface IncidencePoint {
  month: string; // "2026-01"
  diseaseName: string;
  count: number;
}

export interface SanitaryDashboardResponse {
  kpis: SanitaryKpis;
  pendingAnimals: PendingAnimalItem[];
  costsByCategory: SanitaryCostItem[];
  costsByLot: SanitaryCostItem[];
  diseaseIncidence: IncidencePoint[];
  treatmentIncidence: IncidencePoint[];
}

export const PENDING_TYPE_LABELS: Record<string, string> = {
  OVERDUE_VACCINE: 'Vacina atrasada',
  PENDING_BOOSTER: 'Reforço pendente',
  IN_WITHDRAWAL: 'Em carência',
  IN_TREATMENT: 'Em tratamento',
  EXAM_PENDING: 'Exame pendente',
};
