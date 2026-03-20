// ─── Enums ──────────────────────────────────────────────────────────────────

export type DepreciationMethod =
  | 'STRAIGHT_LINE'
  | 'HOURS_OF_USE'
  | 'UNITS_OF_PRODUCTION'
  | 'ACCELERATED';

export type DepreciationTrack = 'FISCAL' | 'MANAGERIAL';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface DepreciationConfig {
  id: string;
  assetId: string;
  method: DepreciationMethod;
  fiscalAnnualRate: number | null;
  managerialAnnualRate: number | null;
  usefulLifeMonths: number | null;
  residualValue: number;
  totalHours: number | null;
  totalUnits: number | null;
  accelerationFactor: number | null;
  activeTrack: DepreciationTrack;
  createdAt: string;
  updatedAt: string;
}

export interface DepreciationEntry {
  id: string;
  assetId: string;
  periodYear: number;
  periodMonth: number;
  track: DepreciationTrack;
  openingBookValue: number;
  depreciationAmount: number;
  closingBookValue: number;
  proRataDays: number | null;
  daysInMonth: number;
  reversedAt: string | null;
  notes: string | null;
  asset: { id: string; name: string; assetType: string; assetTag: string };
  farm?: { name: string };
  ccItems: { costCenter: { name: string }; amount: number; percentage: number }[];
}

export interface DepreciationRun {
  id: string;
  periodYear: number;
  periodMonth: number;
  track: DepreciationTrack;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  totalAssets: number;
  processedCount: number;
  skippedCount: number;
  totalAmount: number;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface DepreciationReportResponse {
  entries: DepreciationEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateDepreciationConfigInput {
  assetId: string;
  method: DepreciationMethod;
  fiscalAnnualRate?: number | null;
  managerialAnnualRate?: number | null;
  usefulLifeMonths?: number | null;
  residualValue?: number;
  totalHours?: number | null;
  totalUnits?: number | null;
  accelerationFactor?: number | null;
  activeTrack?: DepreciationTrack;
}

export type UpdateDepreciationConfigInput = Partial<Omit<CreateDepreciationConfigInput, 'assetId'>>;

export interface TriggerRunInput {
  periodYear: number;
  periodMonth: number;
  track?: DepreciationTrack;
  force?: boolean;
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export const METHOD_LABELS: Record<DepreciationMethod, string> = {
  STRAIGHT_LINE: 'Linear',
  HOURS_OF_USE: 'Horas-uso',
  UNITS_OF_PRODUCTION: 'Producao',
  ACCELERATED: 'Acelerada',
};

export const TRACK_LABELS: Record<DepreciationTrack, string> = {
  FISCAL: 'Fiscal (RFB)',
  MANAGERIAL: 'Gerencial',
};

export const MONTH_LABELS: Record<number, string> = {
  1: 'Janeiro',
  2: 'Fevereiro',
  3: 'Marco',
  4: 'Abril',
  5: 'Maio',
  6: 'Junho',
  7: 'Julho',
  8: 'Agosto',
  9: 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro',
};

export const DEFAULT_RFB_RATES: Record<string, { annualRate: number; usefulLifeMonths: number }> = {
  MAQUINA: { annualRate: 10, usefulLifeMonths: 120 },
  VEICULO: { annualRate: 20, usefulLifeMonths: 60 },
  IMPLEMENTO: { annualRate: 10, usefulLifeMonths: 120 },
  BENFEITORIA: { annualRate: 4, usefulLifeMonths: 300 },
  TERRA: { annualRate: 0, usefulLifeMonths: 0 },
};
