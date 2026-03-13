export interface PesticideApplicationItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  appliedAt: string;
  productName: string;
  activeIngredient: string;
  dose: number;
  doseUnit: string;
  sprayVolume: number;
  target: string;
  targetDescription: string | null;
  artNumber: string | null;
  agronomistCrea: string | null;
  technicalJustification: string | null;
  temperature: number | null;
  relativeHumidity: number | null;
  windSpeed: number | null;
  sprayerType: string | null;
  nozzleType: string | null;
  workingPressure: number | null;
  applicationSpeed: number | null;
  adjuvant: string | null;
  adjuvantDose: number | null;
  tankMixOrder: string | null;
  tankMixPh: number | null;
  withdrawalPeriodDays: number | null;
  safeHarvestDate: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
  productId: string | null;
  stockOutputId: string | null;
  totalQuantityUsed: number | null;
}

export interface PesticideApplicationsResponse {
  data: PesticideApplicationItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreatePesticideApplicationInput {
  fieldPlotId: string;
  appliedAt: string;
  productName: string;
  activeIngredient: string;
  dose: number;
  doseUnit: string;
  sprayVolume: number;
  target: string;
  targetDescription?: string;
  artNumber?: string;
  agronomistCrea?: string;
  technicalJustification?: string;
  temperature?: number;
  relativeHumidity?: number;
  windSpeed?: number;
  sprayerType?: string;
  nozzleType?: string;
  workingPressure?: number;
  applicationSpeed?: number;
  adjuvant?: string;
  adjuvantDose?: number;
  tankMixOrder?: string;
  tankMixPh?: number;
  withdrawalPeriodDays?: number;
  notes?: string;
  productId?: string;
  totalQuantityUsed?: number;
}

export interface WithdrawalAlert {
  applicationId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  productName: string;
  activeIngredient: string;
  appliedAt: string;
  withdrawalPeriodDays: number;
  safeHarvestDate: string;
  daysRemaining: number;
}

export const PESTICIDE_TARGETS = [
  { value: 'PRAGA', label: 'Praga' },
  { value: 'DOENCA', label: 'Doença' },
  { value: 'PLANTA_DANINHA', label: 'Planta daninha' },
] as const;

export const DOSE_UNITS = [
  { value: 'L_HA', label: 'L/ha' },
  { value: 'KG_HA', label: 'kg/ha' },
  { value: 'ML_HA', label: 'mL/ha' },
  { value: 'G_HA', label: 'g/ha' },
] as const;

export const DOSE_UNIT_LABELS: Record<string, string> = {
  L_HA: 'L/ha',
  KG_HA: 'kg/ha',
  ML_HA: 'mL/ha',
  G_HA: 'g/ha',
};

export const TARGET_LABELS: Record<string, string> = {
  PRAGA: 'Praga',
  DOENCA: 'Doença',
  PLANTA_DANINHA: 'Planta daninha',
};

export const SPRAYER_TYPES = [
  { value: 'COSTAL_MANUAL', label: 'Costal manual' },
  { value: 'COSTAL_MOTORIZADO', label: 'Costal motorizado' },
  { value: 'BARRA_TRATORIZADO', label: 'Barra tratorizado' },
  { value: 'AUTOPROPELIDO', label: 'Autopropelido' },
  { value: 'PIVÔ', label: 'Pivô central' },
  { value: 'DRONE', label: 'Drone/VANT' },
  { value: 'OUTRO', label: 'Outro' },
] as const;

export const NOZZLE_TYPES = [
  { value: 'LEQUE', label: 'Leque (plano)' },
  { value: 'CONICO_VAZIO', label: 'Cônico vazio' },
  { value: 'CONICO_CHEIO', label: 'Cônico cheio' },
  { value: 'DEFLETOR', label: 'Defletor' },
  { value: 'INDUÇÃO_AR', label: 'Indução de ar' },
  { value: 'OUTRO', label: 'Outro' },
] as const;
