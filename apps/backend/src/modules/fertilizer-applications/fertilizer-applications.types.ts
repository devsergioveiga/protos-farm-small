// ─── Error ──────────────────────────────────────────────────────────

export class FertilizerApplicationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'FertilizerApplicationError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const FERTILIZER_APPLICATION_TYPES = [
  'COBERTURA_SOLIDA',
  'COBERTURA_SULCO',
  'COBERTURA_LANCO',
  'FOLIAR',
  'FERTIRRIGACAO',
] as const;

export const FERTILIZER_DOSE_UNITS = ['KG_HA', 'L_HA', 'G_HA', 'ML_HA', 'G_PLANTA'] as const;

export const APPLICATION_TYPE_LABELS: Record<string, string> = {
  COBERTURA_SOLIDA: 'Cobertura sólida',
  COBERTURA_SULCO: 'Cobertura em sulco',
  COBERTURA_LANCO: 'Cobertura a lanço',
  FOLIAR: 'Foliar',
  FERTIRRIGACAO: 'Fertirrigação',
};

export const DOSE_UNIT_LABELS: Record<string, string> = {
  KG_HA: 'kg/ha',
  L_HA: 'L/ha',
  G_HA: 'g/ha',
  ML_HA: 'mL/ha',
  G_PLANTA: 'g/planta',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateFertilizerApplicationInput {
  id?: string;
  fieldPlotId: string;
  appliedAt: string;
  applicationType: string;
  productName: string;
  formulation?: string | null;
  dose: number;
  doseUnit?: string;
  nutrientSource?: string | null;
  phenologicalStage?: string | null;
  nitrogenN?: number | null;
  phosphorusP?: number | null;
  potassiumK?: number | null;
  machineName?: string | null;
  operatorName?: string | null;
  areaAppliedHa?: number | null;
  plantsPerHa?: number | null;
  dosePerPlantG?: number | null;
  notes?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // Stock deduction
  productId?: string | null;
  totalQuantityUsed?: number | null;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface FertilizerApplicationItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  appliedAt: string;
  applicationType: string;
  productName: string;
  formulation: string | null;
  dose: number;
  doseUnit: string;
  nutrientSource: string | null;
  phenologicalStage: string | null;
  nitrogenN: number | null;
  phosphorusP: number | null;
  potassiumK: number | null;
  machineName: string | null;
  operatorName: string | null;
  areaAppliedHa: number | null;
  plantsPerHa: number | null;
  dosePerPlantG: number | null;
  notes: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
  // Stock deduction
  productId: string | null;
  stockOutputId: string | null;
  totalQuantityUsed: number | null;
}

export interface NutrientSummaryItem {
  fieldPlotId: string;
  fieldPlotName: string;
  totalN: number;
  totalP: number;
  totalK: number;
  applicationCount: number;
}
