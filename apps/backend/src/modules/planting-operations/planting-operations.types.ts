// ─── Error ──────────────────────────────────────────────────────────

export class PlantingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PlantingError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const SEASON_TYPES = ['SAFRA', 'SAFRINHA', 'INVERNO'] as const;

export const SEASON_TYPE_LABELS: Record<string, string> = {
  SAFRA: 'Safra',
  SAFRINHA: 'Safrinha',
  INVERNO: 'Inverno',
};

export const FERTILIZER_APPLICATION_MODES = ['SULCO', 'LANCO', 'INCORPORADO'] as const;

export const FERTILIZER_MODE_LABELS: Record<string, string> = {
  SULCO: 'Sulco',
  LANCO: 'A lanço',
  INCORPORADO: 'Incorporado',
};

export const DOSE_UNITS = ['KG_HA', 'L_HA', 'ML_100KG'] as const;

export const DOSE_UNIT_LABELS: Record<string, string> = {
  KG_HA: 'kg/ha',
  L_HA: 'L/ha',
  ML_100KG: 'mL/100kg',
};

// ─── Input Types ────────────────────────────────────────────────────

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

export interface CreatePlantingInput {
  id?: string;
  fieldPlotId: string;
  cultivarId?: string | null;
  operationTypeId?: string | null;
  seasonYear: string;
  seasonType?: string;
  crop: string;
  plantingDate: string;
  plantedAreaPercent?: number;
  populationPerM?: number | null;
  rowSpacingCm?: number | null;
  depthCm?: number | null;
  seedRateKgHa?: number | null;
  seedTreatments?: SeedTreatmentItem[];
  baseFertilizations?: BaseFertilizationItem[];
  machineName?: string | null;
  operatorName?: string | null;
  averageSpeedKmH?: number | null;
  seedCost?: number | null;
  fertilizerCost?: number | null;
  treatmentCost?: number | null;
  operationCost?: number | null;
  notes?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // Stock deduction (US-096 CA3)
  seedProductId?: string | null;
  totalSeedQuantityUsed?: number | null;
}

// ─── Response Types ─────────────────────────────────────────────────

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
  // Stock deduction (US-096 CA3)
  seedProductId: string | null;
  stockOutputId: string | null;
  totalSeedQuantityUsed: number | null;
}
