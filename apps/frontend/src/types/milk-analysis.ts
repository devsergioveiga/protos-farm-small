export interface MilkAnalysisItem {
  id: string;
  farmId: string;
  analysisType: string;
  analysisTypeLabel: string;
  animalId: string | null;
  animalEarTag: string | null;
  animalName: string | null;
  analysisDate: string;
  laboratory: string | null;
  dairyCompany: string | null;
  cmtFrontLeft: string | null;
  cmtFrontRight: string | null;
  cmtRearLeft: string | null;
  cmtRearRight: string | null;
  cmtAlert: boolean;
  scc: number | null;
  tbc: number | null;
  fatPercent: number | null;
  proteinPercent: number | null;
  lactosePercent: number | null;
  totalSolidsPercent: number | null;
  snfPercent: number | null;
  munMgDl: number | null;
  fatProteinRatio: number | null;
  antibioticResidue: boolean | null;
  sccAlert: string | null;
  tbcAlert: string | null;
  productionAmLiters: number | null;
  productionPmLiters: number | null;
  projected305Liters: number | null;
  notes: string | null;
  createdAt: string;
}

export interface MilkAnalysesResponse {
  data: MilkAnalysisItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateMilkAnalysisInput {
  analysisType: string;
  animalId?: string | null;
  analysisDate: string;
  laboratory?: string | null;
  dairyCompany?: string | null;
  cmtFrontLeft?: string | null;
  cmtFrontRight?: string | null;
  cmtRearLeft?: string | null;
  cmtRearRight?: string | null;
  scc?: number | null;
  tbc?: number | null;
  fatPercent?: number | null;
  proteinPercent?: number | null;
  lactosePercent?: number | null;
  totalSolidsPercent?: number | null;
  snfPercent?: number | null;
  munMgDl?: number | null;
  antibioticResidue?: boolean | null;
  productionAmLiters?: number | null;
  productionPmLiters?: number | null;
  notes?: string | null;
}

export interface UpdateMilkAnalysisInput {
  analysisDate?: string;
  laboratory?: string | null;
  dairyCompany?: string | null;
  cmtFrontLeft?: string | null;
  cmtFrontRight?: string | null;
  cmtRearLeft?: string | null;
  cmtRearRight?: string | null;
  scc?: number | null;
  tbc?: number | null;
  fatPercent?: number | null;
  proteinPercent?: number | null;
  lactosePercent?: number | null;
  totalSolidsPercent?: number | null;
  snfPercent?: number | null;
  munMgDl?: number | null;
  antibioticResidue?: boolean | null;
  productionAmLiters?: number | null;
  productionPmLiters?: number | null;
  notes?: string | null;
}

export interface HighSccItem {
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  lastScc: number;
  lastAnalysisDate: string;
  alertLevel: string;
  history: number[];
}

export interface QualityTrendItem {
  month: string;
  avgScc: number | null;
  avgTbc: number | null;
  avgFat: number | null;
  avgProtein: number | null;
  sccAlert: string | null;
  tbcAlert: string | null;
}

export interface MilkQualityConfig {
  sccLimitTank: number;
  sccWarningTank: number;
  tbcLimitTank: number;
  tbcWarningTank: number;
  sccLimitIndividual: number;
  bonusPenaltyTable: BonusPenaltyEntry[];
}

export interface BonusPenaltyEntry {
  metric: string;
  min: number | null;
  max: number | null;
  valueCentsPerLiter: number;
  label: string;
}

export interface BonusResult {
  totalBonusCentsPerLiter: number;
  details: Array<{
    metric: string;
    label: string;
    value: number;
    bonusCentsPerLiter: number;
  }>;
  calculatedAt: string;
}

export const ANALYSIS_TYPES = [
  { value: 'INDIVIDUAL_CMT', label: 'CMT individual' },
  { value: 'INDIVIDUAL_LAB', label: 'Laboratorial individual' },
  { value: 'TANK', label: 'Tanque/Coleta' },
  { value: 'OFFICIAL_RECORDING', label: 'Controle leiteiro oficial' },
] as const;

export const CMT_RESULTS = [
  { value: 'NEGATIVE', label: 'Negativo' },
  { value: 'TRACE', label: 'Traço/Suspeito' },
  { value: 'PLUS_1', label: '+' },
  { value: 'PLUS_2', label: '++' },
  { value: 'PLUS_3', label: '+++' },
] as const;

export type CmtValue = (typeof CMT_RESULTS)[number]['value'];
export type AnalysisType = (typeof ANALYSIS_TYPES)[number]['value'];
