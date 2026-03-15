// ─── Error ──────────────────────────────────────────────────────────

export class MilkAnalysisError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MilkAnalysisError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const ANALYSIS_TYPES = [
  'INDIVIDUAL_CMT',
  'INDIVIDUAL_LAB',
  'TANK',
  'OFFICIAL_RECORDING',
] as const;
export type AnalysisTypeValue = (typeof ANALYSIS_TYPES)[number];

export const ANALYSIS_TYPE_LABELS: Record<AnalysisTypeValue, string> = {
  INDIVIDUAL_CMT: 'CMT Individual',
  INDIVIDUAL_LAB: 'Laboratório Individual',
  TANK: 'Análise de Tanque',
  OFFICIAL_RECORDING: 'Controle Leiteiro Oficial',
};

export function isValidAnalysisType(value: string): value is AnalysisTypeValue {
  return ANALYSIS_TYPES.includes(value as AnalysisTypeValue);
}

export const CMT_RESULTS = ['NEGATIVE', 'TRACE', 'PLUS_1', 'PLUS_2', 'PLUS_3'] as const;
export type CmtResultValue = (typeof CMT_RESULTS)[number];

export const CMT_RESULT_LABELS: Record<CmtResultValue, string> = {
  NEGATIVE: 'Negativo',
  TRACE: 'Traço',
  PLUS_1: '+',
  PLUS_2: '++',
  PLUS_3: '+++',
};

export function isValidCmtResult(value: string): value is CmtResultValue {
  return CMT_RESULTS.includes(value as CmtResultValue);
}

// Quarters that trigger mastitis alert (++ or +++)
export const CMT_ALERT_VALUES: CmtResultValue[] = ['PLUS_2', 'PLUS_3'];

export const ALERT_LEVELS = ['GREEN', 'YELLOW', 'RED'] as const;
export type AlertLevelValue = (typeof ALERT_LEVELS)[number];

export const ALERT_LEVEL_LABELS: Record<AlertLevelValue, string> = {
  GREEN: 'Dentro do limite',
  YELLOW: 'Próximo do limite',
  RED: 'Acima do limite',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateAnalysisInput {
  analysisType: AnalysisTypeValue;
  animalId?: string | null;
  analysisDate: string; // ISO date
  laboratory?: string | null;
  dairyCompany?: string | null;
  // CMT
  cmtFrontLeft?: CmtResultValue | null;
  cmtFrontRight?: CmtResultValue | null;
  cmtRearLeft?: CmtResultValue | null;
  cmtRearRight?: CmtResultValue | null;
  // Lab/Tank results
  scc?: number | null;
  tbc?: number | null;
  fatPercent?: number | null;
  proteinPercent?: number | null;
  lactosePercent?: number | null;
  caseinPercent?: number | null;
  totalSolidsPercent?: number | null;
  snfPercent?: number | null;
  munMgDl?: number | null;
  antibioticResidue?: boolean | null;
  temperature?: number | null;
  acidityDornic?: number | null;
  cryoscopy?: number | null;
  // Official recording
  productionAmLiters?: number | null;
  productionPmLiters?: number | null;
  projected305Liters?: number | null;
  // File
  reportFileName?: string | null;
  reportPath?: string | null;
  notes?: string | null;
}

export interface UpdateAnalysisInput {
  laboratory?: string | null;
  dairyCompany?: string | null;
  cmtFrontLeft?: CmtResultValue | null;
  cmtFrontRight?: CmtResultValue | null;
  cmtRearLeft?: CmtResultValue | null;
  cmtRearRight?: CmtResultValue | null;
  scc?: number | null;
  tbc?: number | null;
  fatPercent?: number | null;
  proteinPercent?: number | null;
  lactosePercent?: number | null;
  caseinPercent?: number | null;
  totalSolidsPercent?: number | null;
  snfPercent?: number | null;
  munMgDl?: number | null;
  antibioticResidue?: boolean | null;
  temperature?: number | null;
  acidityDornic?: number | null;
  cryoscopy?: number | null;
  productionAmLiters?: number | null;
  productionPmLiters?: number | null;
  projected305Liters?: number | null;
  reportFileName?: string | null;
  reportPath?: string | null;
  notes?: string | null;
}

export interface SetQualityConfigInput {
  sccLimit?: number | null;
  sccWarning?: number | null;
  tbcLimit?: number | null;
  tbcWarning?: number | null;
  individualSccLimit?: number | null;
  bonusTable?: BonusTableEntry[] | null;
}

export interface BonusTableEntry {
  parameter: string; // 'SCC' | 'TBC' | 'FAT' | 'PROTEIN'
  ranges: Array<{
    min: number;
    max: number;
    bonusPerLiter: number; // positive = bonus, negative = penalty
  }>;
}

export interface ListAnalysesQuery {
  analysisType?: AnalysisTypeValue;
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
  sccAlert?: AlertLevelValue;
  tbcAlert?: AlertLevelValue;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface MilkAnalysisItem {
  id: string;
  farmId: string;
  analysisType: AnalysisTypeValue;
  analysisTypeLabel: string;
  animalId: string | null;
  animalEarTag: string | null;
  animalName: string | null;
  analysisDate: string;
  laboratory: string | null;
  dairyCompany: string | null;
  // CMT
  cmtFrontLeft: CmtResultValue | null;
  cmtFrontRight: CmtResultValue | null;
  cmtRearLeft: CmtResultValue | null;
  cmtRearRight: CmtResultValue | null;
  cmtAlert: boolean;
  // Lab/Tank
  scc: number | null;
  tbc: number | null;
  fatPercent: number | null;
  proteinPercent: number | null;
  lactosePercent: number | null;
  caseinPercent: number | null;
  totalSolidsPercent: number | null;
  snfPercent: number | null;
  munMgDl: number | null;
  fatProteinRatio: number | null;
  antibioticResidue: boolean | null;
  temperature: number | null;
  acidityDornic: number | null;
  cryoscopy: number | null;
  // Official recording
  productionAmLiters: number | null;
  productionPmLiters: number | null;
  projected305Liters: number | null;
  // Alerts
  sccAlert: AlertLevelValue | null;
  tbcAlert: AlertLevelValue | null;
  // File
  reportFileName: string | null;
  reportPath: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface QualityConfigItem {
  id: string;
  organizationId: string;
  sccLimit: number | null;
  sccWarning: number | null;
  tbcLimit: number | null;
  tbcWarning: number | null;
  individualSccLimit: number | null;
  bonusTable: BonusTableEntry[] | null;
}

export interface HighSccCowItem {
  animalId: string;
  earTag: string;
  name: string | null;
  latestScc: number;
  latestDate: string;
  sccHistory: Array<{ date: string; scc: number }>;
  mastitisAlert: boolean;
}

export interface QualityTrendItem {
  month: string; // YYYY-MM
  avgScc: number | null;
  avgTbc: number | null;
  avgFat: number | null;
  avgProtein: number | null;
  sampleCount: number;
}

export interface BonusCalcResult {
  month: string;
  tankAnalysisId: string | null;
  scc: number | null;
  tbc: number | null;
  fatPercent: number | null;
  proteinPercent: number | null;
  bonusDetails: Array<{
    parameter: string;
    value: number | null;
    bonusPerLiter: number;
    rangeLabel: string;
  }>;
  totalBonusPerLiter: number;
}
