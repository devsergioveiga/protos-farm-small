export interface LactationItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  lactationNumber: number;
  startDate: string;
  endDate: string | null;
  origin: string;
  originLabel: string;
  status: string;
  statusLabel: string;
  del: number;
  inductionProtocol: string | null;
  inductionReason: string | null;
  dryingReason: string | null;
  dryingReasonLabel: string | null;
  peakLiters: number | null;
  peakDel: number | null;
  accumulated305: number | null;
  totalAccumulated: number | null;
  durationDays: number | null;
  notes: string | null;
  createdAt: string;
}

export interface LactationsResponse {
  data: LactationItem[];
  total: number;
}

export interface LactationCurvePoint {
  del: number;
  liters: number;
  date: string;
}

export interface DryingAlertItem {
  animalId: string;
  earTag: string;
  animalName: string | null;
  lactationId: string;
  del: number;
  currentProduction: number | null;
  reason: string;
}

export interface CreateLactationInput {
  animalId: string;
  startDate: string;
  origin?: string;
  notes?: string | null;
}

export interface InduceLactationInput {
  animalId: string;
  startDate: string;
  inductionProtocol?: string | null;
  inductionReason?: string | null;
  inductionVet?: string | null;
  firstMilkingDate?: string | null;
  notes?: string | null;
}

export interface DryOffInput {
  dryingDate: string;
  dryingReason: string;
  dryingProtocol?: string | null;
  dryingVet?: string | null;
  notes?: string | null;
}

export interface UpdateLactationInput {
  startDate?: string;
  notes?: string | null;
}

export const LACTATION_ORIGINS = [
  { value: 'BIRTH', label: 'Parto' },
  { value: 'INDUCTION', label: 'Indução' },
] as const;

export const LACTATION_STATUSES = [
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'DRIED', label: 'Seca' },
] as const;

export const DRYING_REASONS = [
  { value: 'SCHEDULED', label: 'Programada' },
  { value: 'LOW_PRODUCTION', label: 'Baixa produção' },
  { value: 'TREATMENT', label: 'Tratamento' },
  { value: 'ADVANCED_GESTATION', label: 'Gestação avançada' },
] as const;

export const ORIGIN_CONFIG = {
  BIRTH: { label: 'Parto', className: 'origin--birth' },
  INDUCTION: { label: 'Indução', className: 'origin--induction' },
} as const;

export const STATUS_CONFIG = {
  IN_PROGRESS: { label: 'Em andamento', className: 'status--active' },
  DRIED: { label: 'Seca', className: 'status--dried' },
} as const;

export const DRYING_REASON_CONFIG: Record<string, { label: string; className: string }> = {
  DEL_HIGH: { label: 'DEL elevado', className: 'alert--del-high' },
  LOW_PRODUCTION: { label: 'Baixa produção', className: 'alert--low-production' },
  ADVANCED_GESTATION: { label: 'Gestação avançada', className: 'alert--advanced-gestation' },
};
