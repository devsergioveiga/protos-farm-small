// ─── Error ──────────────────────────────────────────────────────────

export class SoilPrepError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'SoilPrepError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const WEATHER_CONDITIONS = [
  'ENSOLARADO',
  'NUBLADO',
  'PARCIALMENTE_NUBLADO',
  'CHUVOSO',
  'POS_CHUVA',
  'SECO',
] as const;

export const WEATHER_LABELS: Record<string, string> = {
  ENSOLARADO: 'Ensolarado',
  NUBLADO: 'Nublado',
  PARCIALMENTE_NUBLADO: 'Parcialmente nublado',
  CHUVOSO: 'Chuvoso',
  POS_CHUVA: 'Pós-chuva',
  SECO: 'Seco',
};

export const DOSE_UNITS = ['KG_HA', 'L_HA', 'T_HA'] as const;

export const DOSE_UNIT_LABELS: Record<string, string> = {
  KG_HA: 'kg/ha',
  L_HA: 'L/ha',
  T_HA: 't/ha',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface SoilPrepInputItem {
  productName: string;
  dose: number;
  doseUnit: string;
  totalQuantity?: number | null;
  batchCode?: string | null;
  // Stock deduction (CA4)
  productId?: string | null;
}

export interface CreateSoilPrepInput {
  id?: string;
  fieldPlotId: string;
  operationTypeId?: string | null;
  operationTypeName: string;
  startedAt: string;
  endedAt?: string | null;
  machineName?: string | null;
  implementName?: string | null;
  operatorName?: string | null;
  depthCm?: number | null;
  inputs?: SoilPrepInputItem[];
  soilMoisturePercent?: number | null;
  weatherCondition?: string | null;
  durationHours?: number | null;
  machineCostPerHour?: number | null;
  laborCount?: number | null;
  laborHourCost?: number | null;
  inputsCost?: number | null;
  notes?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface SoilPrepItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  fieldPlotAreaHa: number;
  operationTypeId: string | null;
  operationTypeName: string;
  startedAt: string;
  endedAt: string | null;
  machineName: string | null;
  implementName: string | null;
  operatorName: string | null;
  depthCm: number | null;
  inputs: SoilPrepInputItem[];
  soilMoisturePercent: number | null;
  weatherCondition: string | null;
  weatherConditionLabel: string | null;
  durationHours: number | null;
  machineCostPerHour: number | null;
  laborCount: number | null;
  laborHourCost: number | null;
  inputsCost: number | null;
  totalCost: number | null;
  notes: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
  // Stock deduction (CA4)
  stockOutputId: string | null;
}
