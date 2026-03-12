// ─── Error ──────────────────────────────────────────────────────────

export class PesticideApplicationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PesticideApplicationError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const PESTICIDE_TARGETS = ['PRAGA', 'DOENCA', 'PLANTA_DANINHA'] as const;

export const DOSE_UNITS = ['L_HA', 'KG_HA', 'ML_HA', 'G_HA'] as const;

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

// ─── Input Types ────────────────────────────────────────────────────

export interface CreatePesticideApplicationInput {
  id?: string;
  fieldPlotId: string;
  appliedAt: string;
  productName: string;
  activeIngredient: string;
  dose: number;
  doseUnit?: string;
  sprayVolume: number;
  target: string;
  targetDescription?: string | null;
  artNumber?: string | null;
  agronomistCrea?: string | null;
  technicalJustification?: string | null;
  temperature?: number | null;
  relativeHumidity?: number | null;
  windSpeed?: number | null;
  sprayerType?: string | null;
  nozzleType?: string | null;
  workingPressure?: number | null;
  applicationSpeed?: number | null;
  adjuvant?: string | null;
  adjuvantDose?: number | null;
  tankMixOrder?: string | null;
  tankMixPh?: number | null;
  withdrawalPeriodDays?: number | null;
  notes?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // Stock deduction (CA8)
  productId?: string | null;
  totalQuantityUsed?: number | null;
}

// ─── Response Types ─────────────────────────────────────────────────

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
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
  // Stock deduction (CA8)
  productId: string | null;
  stockOutputId: string | null;
  totalQuantityUsed: number | null;
}
