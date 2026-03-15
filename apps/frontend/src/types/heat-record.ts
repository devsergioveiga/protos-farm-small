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
  intensity: string;
  intensityLabel: string;
  signs: string[];
  signLabels: string[];
  detectionMethod: string;
  detectionMethodLabel: string;
  status: string;
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

export interface HeatRecordsResponse {
  data: HeatRecordItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface HeatIndicators {
  totalHeats: number;
  avgInterHeatDays: number | null;
  inseminatedPercent: number;
  irregularIntervalPercent: number;
}

export interface DailyHeatGroup {
  status: string;
  statusLabel: string;
  heats: HeatRecordItem[];
}

export interface DailyHeatsResponse {
  data: DailyHeatGroup[];
}

export interface AnimalHeatHistoryResponse {
  data: HeatRecordItem[];
}

export interface CreateHeatRecordInput {
  animalId: string;
  heatDate: string;
  heatTime?: string | null;
  heatPeriod?: string | null;
  intensity: string;
  signs: string[];
  detectionMethod: string;
  notes?: string | null;
}

export interface UpdateHeatRecordInput {
  status?: string;
  notInseminatedReason?: string | null;
}

export const HEAT_INTENSITIES = [
  { value: 'STRONG', label: 'Forte' },
  { value: 'MODERATE', label: 'Moderado' },
  { value: 'WEAK', label: 'Fraco/Duvidoso' },
] as const;

export const HEAT_SIGNS = [
  { value: 'mount_accepted', label: 'Monta aceita' },
  { value: 'mucus', label: 'Muco' },
  { value: 'restlessness', label: 'Inquietação' },
  { value: 'swollen_vulva', label: 'Vulva edemaciada' },
  { value: 'bellowing', label: 'Mugido' },
  { value: 'milk_drop', label: 'Queda de produção' },
] as const;

export const DETECTION_METHODS = [
  { value: 'VISUAL', label: 'Observação visual' },
  { value: 'MARKER_PAINT', label: 'Bastão marcador/Tinta' },
  { value: 'PEDOMETER', label: 'Pedômetro/Sensor' },
  { value: 'TEASER', label: 'Rufiã' },
] as const;

export const HEAT_STATUSES = [
  { value: 'AWAITING_AI', label: 'Aguardando IA' },
  { value: 'AI_DONE', label: 'IA realizada' },
  { value: 'NOT_INSEMINATED', label: 'Não inseminada' },
] as const;

export const HEAT_PERIODS = [
  { value: 'MORNING', label: 'Manhã' },
  { value: 'AFTERNOON', label: 'Tarde' },
  { value: 'NIGHT', label: 'Noite' },
] as const;

export const INTENSITY_CONFIG = {
  STRONG: { label: 'Forte', className: 'heat-records-page__badge--strong' },
  MODERATE: { label: 'Moderado', className: 'heat-records-page__badge--moderate' },
  WEAK: { label: 'Fraco/Duvidoso', className: 'heat-records-page__badge--weak' },
} as const;

export const STATUS_CONFIG = {
  AWAITING_AI: { label: 'Aguardando IA', className: 'heat-records-page__badge--awaiting' },
  AI_DONE: { label: 'IA realizada', className: 'heat-records-page__badge--done' },
  NOT_INSEMINATED: {
    label: 'Não inseminada',
    className: 'heat-records-page__badge--not-inseminated',
  },
} as const;
