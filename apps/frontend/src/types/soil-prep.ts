export interface SoilPrepInputItem {
  productName: string;
  dose: number;
  doseUnit: string;
  totalQuantity?: number | null;
  batchCode?: string | null;
  productId?: string | null;
}

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
  stockOutputId: string | null;
}

export interface SoilPrepResponse {
  data: SoilPrepItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const WEATHER_CONDITIONS = [
  { value: 'ENSOLARADO', label: 'Ensolarado' },
  { value: 'NUBLADO', label: 'Nublado' },
  { value: 'PARCIALMENTE_NUBLADO', label: 'Parcialmente nublado' },
  { value: 'CHUVOSO', label: 'Chuvoso' },
  { value: 'POS_CHUVA', label: 'Pós-chuva' },
  { value: 'SECO', label: 'Seco' },
] as const;

export const DOSE_UNITS = [
  { value: 'KG_HA', label: 'kg/ha' },
  { value: 'L_HA', label: 'L/ha' },
  { value: 'T_HA', label: 't/ha' },
] as const;
