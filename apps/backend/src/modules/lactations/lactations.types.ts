// ─── Error ──────────────────────────────────────────────────────────

export class LactationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'LactationError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const LACTATION_ORIGINS = ['BIRTH', 'INDUCTION'] as const;
export type LactationOriginValue = (typeof LACTATION_ORIGINS)[number];

export const LACTATION_ORIGIN_LABELS: Record<LactationOriginValue, string> = {
  BIRTH: 'Parto',
  INDUCTION: 'Indução',
};

export function isValidOrigin(value: string): value is LactationOriginValue {
  return LACTATION_ORIGINS.includes(value as LactationOriginValue);
}

export const LACTATION_STATUSES = ['IN_PROGRESS', 'DRIED'] as const;
export type LactationStatusValue = (typeof LACTATION_STATUSES)[number];

export const LACTATION_STATUS_LABELS: Record<LactationStatusValue, string> = {
  IN_PROGRESS: 'Em lactação',
  DRIED: 'Seca',
};

export function isValidStatus(value: string): value is LactationStatusValue {
  return LACTATION_STATUSES.includes(value as LactationStatusValue);
}

export const DRYING_REASONS = [
  'SCHEDULED',
  'LOW_PRODUCTION',
  'TREATMENT',
  'ADVANCED_GESTATION',
] as const;
export type DryingReasonValue = (typeof DRYING_REASONS)[number];

export const DRYING_REASON_LABELS: Record<DryingReasonValue, string> = {
  SCHEDULED: 'Programada',
  LOW_PRODUCTION: 'Baixa produção',
  TREATMENT: 'Tratamento',
  ADVANCED_GESTATION: 'Gestação avançada',
};

export function isValidDryingReason(value: string): value is DryingReasonValue {
  return DRYING_REASONS.includes(value as DryingReasonValue);
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateLactationInput {
  animalId: string;
  startDate: string; // ISO date
  origin: string;
  calvingEventId?: string | null;
  notes?: string | null;
}

export interface InduceLactationInput {
  animalId: string;
  startDate: string; // ISO date
  inductionProtocol: string;
  inductionReason: string;
  inductionVet?: string | null;
  firstMilkingDate?: string | null;
  notes?: string | null;
}

export interface DryOffInput {
  endDate: string; // ISO date
  dryingReason: string;
  dryingProtocol?: string | null;
  dryingVet?: string | null;
  notes?: string | null;
}

export interface UpdateLactationInput {
  startDate?: string;
  inductionProtocol?: string | null;
  inductionReason?: string | null;
  inductionVet?: string | null;
  firstMilkingDate?: string | null;
  notes?: string | null;
}

export interface ListLactationsQuery {
  animalId?: string;
  status?: LactationStatusValue;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface LactationItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  lactationNumber: number;
  startDate: string;
  endDate: string | null;
  origin: LactationOriginValue;
  originLabel: string;
  status: LactationStatusValue;
  statusLabel: string;
  del: number; // days in lactation (CA4)
  inductionProtocol: string | null;
  inductionReason: string | null;
  inductionVet: string | null;
  firstMilkingDate: string | null;
  dryingReason: DryingReasonValue | null;
  dryingReasonLabel: string | null;
  dryingProtocol: string | null;
  dryingVet: string | null;
  peakLiters: number | null;
  peakDel: number | null;
  accumulated305: number | null;
  totalAccumulated: number | null;
  durationDays: number | null;
  calvingEventId: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface LactationCurvePoint {
  del: number;
  liters: number;
  date: string;
}

export interface LactationIndicators {
  lactationId: string;
  peakLiters: number | null;
  peakDel: number | null;
  persistency: number | null; // % decline from peak per month
  accumulated305: number | null;
  totalAccumulated: number | null;
  durationDays: number;
  avgDailyLiters: number | null;
  projectedTotal: number | null; // (CA7) production projection
}

export interface DryingAlertItem {
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  lactationId: string;
  del: number;
  lastDailyLiters: number | null;
  gestationDays: number | null;
  reasons: string[];
}

export interface LactationHistoryItem {
  id: string;
  lactationNumber: number;
  origin: LactationOriginValue;
  originLabel: string;
  status: LactationStatusValue;
  statusLabel: string;
  startDate: string;
  endDate: string | null;
  durationDays: number | null;
  accumulated305: number | null;
  totalAccumulated: number | null;
  peakLiters: number | null;
  peakDel: number | null;
}
