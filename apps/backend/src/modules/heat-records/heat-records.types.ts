// ─── Error ──────────────────────────────────────────────────────────

export class HeatRecordError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'HeatRecordError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const HEAT_INTENSITIES = ['STRONG', 'MODERATE', 'WEAK'] as const;
export type HeatIntensityValue = (typeof HEAT_INTENSITIES)[number];

export const HEAT_INTENSITY_LABELS: Record<HeatIntensityValue, string> = {
  STRONG: 'Forte',
  MODERATE: 'Moderado',
  WEAK: 'Fraco',
};

export function isValidHeatIntensity(value: string): value is HeatIntensityValue {
  return HEAT_INTENSITIES.includes(value as HeatIntensityValue);
}

export const HEAT_DETECTION_METHODS = ['VISUAL', 'MARKER_PAINT', 'PEDOMETER', 'TEASER'] as const;
export type HeatDetectionMethodValue = (typeof HEAT_DETECTION_METHODS)[number];

export const HEAT_DETECTION_METHOD_LABELS: Record<HeatDetectionMethodValue, string> = {
  VISUAL: 'Visual',
  MARKER_PAINT: 'Tinta marcadora',
  PEDOMETER: 'Pedômetro',
  TEASER: 'Rufião',
};

export function isValidHeatDetectionMethod(value: string): value is HeatDetectionMethodValue {
  return HEAT_DETECTION_METHODS.includes(value as HeatDetectionMethodValue);
}

export const HEAT_STATUSES = ['AWAITING_AI', 'AI_DONE', 'NOT_INSEMINATED'] as const;
export type HeatStatusValue = (typeof HEAT_STATUSES)[number];

export const HEAT_STATUS_LABELS: Record<HeatStatusValue, string> = {
  AWAITING_AI: 'Aguardando IA',
  AI_DONE: 'IA realizada',
  NOT_INSEMINATED: 'Não inseminada',
};

export function isValidHeatStatus(value: string): value is HeatStatusValue {
  return HEAT_STATUSES.includes(value as HeatStatusValue);
}

export const HEAT_SIGNS = [
  'mount_accepted',
  'mucus',
  'restlessness',
  'swollen_vulva',
  'bellowing',
  'milk_drop',
] as const;
export type HeatSignValue = (typeof HEAT_SIGNS)[number];

export const HEAT_SIGN_LABELS: Record<HeatSignValue, string> = {
  mount_accepted: 'Aceita monta',
  mucus: 'Muco',
  restlessness: 'Inquietação',
  swollen_vulva: 'Vulva inchada',
  bellowing: 'Berro',
  milk_drop: 'Queda de leite',
};

export function isValidHeatSign(value: string): value is HeatSignValue {
  return HEAT_SIGNS.includes(value as HeatSignValue);
}

export const HEAT_PERIODS = ['MORNING', 'AFTERNOON', 'NIGHT'] as const;
export type HeatPeriodValue = (typeof HEAT_PERIODS)[number];

export const HEAT_PERIOD_LABELS: Record<HeatPeriodValue, string> = {
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

export function isValidHeatPeriod(value: string): value is HeatPeriodValue {
  return HEAT_PERIODS.includes(value as HeatPeriodValue);
}

export const CYCLICITY_STATUSES = [
  'CYCLING',
  'ANESTRUS',
  'FOLLICULAR_CYST',
  'LUTEAL_CYST',
  'CORPUS_LUTEUM_PRESENT',
] as const;
export type CyclicityStatusValue = (typeof CYCLICITY_STATUSES)[number];

export const CYCLICITY_STATUS_LABELS: Record<CyclicityStatusValue, string> = {
  CYCLING: 'Ciclando',
  ANESTRUS: 'Anestro',
  FOLLICULAR_CYST: 'Cisto folicular',
  LUTEAL_CYST: 'Cisto luteal',
  CORPUS_LUTEUM_PRESENT: 'Corpo lúteo presente',
};

export function isValidCyclicityStatus(value: string): value is CyclicityStatusValue {
  return CYCLICITY_STATUSES.includes(value as CyclicityStatusValue);
}

// ─── Default AI window config ──────────────────────────────────────

/** Default hours after heat onset for recommended insemination */
export const DEFAULT_AI_WINDOW_HOURS = 10;

/** Minimum inter-heat interval (days) considered regular */
export const MIN_REGULAR_INTERVAL_DAYS = 18;

/** Maximum inter-heat interval (days) considered regular */
export const MAX_REGULAR_INTERVAL_DAYS = 24;

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateHeatInput {
  animalId: string;
  heatDate: string; // ISO date
  heatTime?: string | null; // "08:30"
  heatPeriod?: string | null; // MORNING, AFTERNOON, NIGHT
  intensity: HeatIntensityValue;
  signs: string[]; // e.g. ["mount_accepted", "mucus"]
  detectionMethod: HeatDetectionMethodValue;
  cyclicityStatus?: string | null;
  notes?: string | null;
}

export interface UpdateHeatInput {
  status?: HeatStatusValue;
  notInseminatedReason?: string | null;
  cyclicityStatus?: string | null;
  intensity?: HeatIntensityValue;
  signs?: string[];
  detectionMethod?: HeatDetectionMethodValue;
  heatTime?: string | null;
  heatPeriod?: string | null;
  recommendedBullId?: string | null;
  inseminationId?: string | null;
  notes?: string | null;
}

export interface ListHeatsQuery {
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: HeatStatusValue;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface HeatRecordItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  heatDate: string;
  heatTime: string | null;
  heatPeriod: string | null;
  heatPeriodLabel: string | null;
  intensity: HeatIntensityValue;
  intensityLabel: string;
  signs: string[];
  signLabels: string[];
  detectionMethod: HeatDetectionMethodValue;
  detectionMethodLabel: string;
  status: HeatStatusValue;
  statusLabel: string;
  recommendedAiTime: string | null;
  recommendedBullId: string | null;
  cyclicityStatus: string | null;
  cyclicityStatusLabel: string | null;
  previousHeatDate: string | null;
  interHeatDays: number | null;
  isIntervalIrregular: boolean;
  inseminationId: string | null;
  notInseminatedReason: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface DailyHeatItem {
  awaitingAi: HeatRecordItem[];
  aiDone: HeatRecordItem[];
  notInseminated: HeatRecordItem[];
  total: number;
  date: string;
}

export interface HeatIndicators {
  totalHeatsDetected: number;
  avgInterHeatDays: number | null;
  irregularIntervalPercent: number;
  heatsInseminatedPercent: number;
  conceptionRatePlaceholder: number | null;
  detectionRateMonthly: number;
  periodStart: string;
  periodEnd: string;
}
