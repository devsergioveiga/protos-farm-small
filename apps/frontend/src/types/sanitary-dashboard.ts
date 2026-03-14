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
  pendingType: string;
  pendingTypeLabel: string;
  detail: string;
}

export interface SanitaryCostItem {
  groupKey: string;
  groupLabel: string;
  totalCostCents: number;
}

export interface IncidencePoint {
  month: string;
  diseaseName: string;
  count: number;
}

export interface SanitaryDashboardData {
  kpis: SanitaryKpis;
  pendingAnimals: PendingAnimalItem[];
  costsByCategory: SanitaryCostItem[];
  costsByLot: SanitaryCostItem[];
  diseaseIncidence: IncidencePoint[];
  treatmentIncidence: IncidencePoint[];
}
