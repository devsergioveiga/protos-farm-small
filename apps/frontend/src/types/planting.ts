export interface SeedTreatmentItem {
  productName: string;
  dose: number;
  doseUnit: string;
  responsibleTechnician?: string | null;
}

export interface BaseFertilizationItem {
  formulation: string;
  doseKgHa: number;
  applicationMode: string;
  totalQuantity?: number | null;
}

export interface PlantingItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  fieldPlotAreaHa: number;
  cultivarId: string | null;
  cultivarName: string | null;
  operationTypeId: string | null;
  seasonYear: string;
  seasonType: string;
  seasonTypeLabel: string;
  crop: string;
  plantingDate: string;
  plantedAreaPercent: number;
  plantedAreaHa: number;
  populationPerM: number | null;
  rowSpacingCm: number | null;
  depthCm: number | null;
  seedRateKgHa: number | null;
  seedTreatments: SeedTreatmentItem[];
  baseFertilizations: BaseFertilizationItem[];
  machineName: string | null;
  operatorName: string | null;
  averageSpeedKmH: number | null;
  seedCost: number | null;
  fertilizerCost: number | null;
  treatmentCost: number | null;
  operationCost: number | null;
  totalCost: number | null;
  notes: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlantingResponse {
  data: PlantingItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const SEASON_TYPES = [
  { value: 'SAFRA', label: 'Safra' },
  { value: 'SAFRINHA', label: 'Safrinha' },
  { value: 'INVERNO', label: 'Inverno' },
] as const;

export const FERTILIZER_MODES = [
  { value: 'SULCO', label: 'Sulco' },
  { value: 'LANCO', label: 'A lanço' },
  { value: 'INCORPORADO', label: 'Incorporado' },
] as const;

export const DOSE_UNITS = [
  { value: 'KG_HA', label: 'kg/ha' },
  { value: 'L_HA', label: 'L/ha' },
  { value: 'ML_100KG', label: 'mL/100kg' },
] as const;
