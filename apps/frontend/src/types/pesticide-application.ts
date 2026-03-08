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
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
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
  notes?: string;
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
