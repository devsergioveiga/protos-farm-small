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
}

export interface FertilizerApplicationsResponse {
  data: FertilizerApplicationItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateFertilizerApplicationInput {
  fieldPlotId: string;
  appliedAt: string;
  applicationType: string;
  productName: string;
  formulation?: string;
  dose: number;
  doseUnit: string;
  nutrientSource?: string;
  phenologicalStage?: string;
  nitrogenN?: number;
  phosphorusP?: number;
  potassiumK?: number;
  machineName?: string;
  operatorName?: string;
  areaAppliedHa?: number;
  plantsPerHa?: number;
  dosePerPlantG?: number;
  notes?: string;
}

export interface NutrientSummaryItem {
  fieldPlotId: string;
  fieldPlotName: string;
  totalN: number;
  totalP: number;
  totalK: number;
  applicationCount: number;
}

export const FERTILIZER_APPLICATION_TYPES = [
  { value: 'COBERTURA_SOLIDA', label: 'Cobertura sólida' },
  { value: 'COBERTURA_SULCO', label: 'Cobertura em sulco' },
  { value: 'COBERTURA_LANCO', label: 'Cobertura a lanço' },
  { value: 'FOLIAR', label: 'Foliar' },
  { value: 'FERTIRRIGACAO', label: 'Fertirrigação' },
] as const;

export const FERTILIZER_DOSE_UNITS = [
  { value: 'KG_HA', label: 'kg/ha' },
  { value: 'L_HA', label: 'L/ha' },
  { value: 'G_HA', label: 'g/ha' },
  { value: 'ML_HA', label: 'mL/ha' },
  { value: 'G_PLANTA', label: 'g/planta' },
] as const;

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
