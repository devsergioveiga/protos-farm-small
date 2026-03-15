// ─── Error ──────────────────────────────────────────────────────────

export class CalvingEventError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'CalvingEventError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const CALVING_EVENT_TYPES = ['BIRTH', 'ABORTION'] as const;
export type CalvingEventTypeValue = (typeof CALVING_EVENT_TYPES)[number];

export const CALVING_EVENT_TYPE_LABELS: Record<CalvingEventTypeValue, string> = {
  BIRTH: 'Parto',
  ABORTION: 'Aborto',
};

export function isValidEventType(value: string): value is CalvingEventTypeValue {
  return CALVING_EVENT_TYPES.includes(value as CalvingEventTypeValue);
}

export const BIRTH_TYPES = ['NORMAL', 'ASSISTED_EASY', 'ASSISTED_DIFFICULT', 'CESAREAN'] as const;
export type BirthTypeValue = (typeof BIRTH_TYPES)[number];

export const BIRTH_TYPE_LABELS: Record<BirthTypeValue, string> = {
  NORMAL: 'Normal',
  ASSISTED_EASY: 'Assistido (fácil)',
  ASSISTED_DIFFICULT: 'Assistido (difícil)',
  CESAREAN: 'Cesariana',
};

export function isValidBirthType(value: string): value is BirthTypeValue {
  return BIRTH_TYPES.includes(value as BirthTypeValue);
}

export const PRESENTATIONS = ['ANTERIOR', 'POSTERIOR'] as const;
export type PresentationValue = (typeof PRESENTATIONS)[number];

export const PRESENTATION_LABELS: Record<PresentationValue, string> = {
  ANTERIOR: 'Anterior',
  POSTERIOR: 'Posterior',
};

export function isValidPresentation(value: string): value is PresentationValue {
  return PRESENTATIONS.includes(value as PresentationValue);
}

export const CALF_CONDITIONS = ['ALIVE', 'STILLBORN'] as const;
export type CalfConditionValue = (typeof CALF_CONDITIONS)[number];

export const CALF_CONDITION_LABELS: Record<CalfConditionValue, string> = {
  ALIVE: 'Vivo',
  STILLBORN: 'Natimorto',
};

export function isValidCalfCondition(value: string): value is CalfConditionValue {
  return CALF_CONDITIONS.includes(value as CalfConditionValue);
}

export const CALF_SEXES = ['MALE', 'FEMALE'] as const;
export type CalfSexValue = (typeof CALF_SEXES)[number];

export const CALF_SEX_LABELS: Record<CalfSexValue, string> = {
  MALE: 'Macho',
  FEMALE: 'Fêmea',
};

export function isValidCalfSex(value: string): value is CalfSexValue {
  return CALF_SEXES.includes(value as CalfSexValue);
}

export const ABORTION_CAUSES = [
  'INFECTIOUS',
  'TRAUMATIC',
  'NUTRITIONAL',
  'UNKNOWN',
  'OTHER',
] as const;
export type AbortionCauseValue = (typeof ABORTION_CAUSES)[number];

export const ABORTION_CAUSE_LABELS: Record<AbortionCauseValue, string> = {
  INFECTIOUS: 'Infecciosa',
  TRAUMATIC: 'Traumática',
  NUTRITIONAL: 'Nutricional',
  UNKNOWN: 'Desconhecida',
  OTHER: 'Outra',
};

export function isValidAbortionCause(value: string): value is AbortionCauseValue {
  return ABORTION_CAUSES.includes(value as AbortionCauseValue);
}

export const STILLBORN_REASONS = ['DYSTOCIA', 'MALFORMATION', 'UNKNOWN', 'OTHER'] as const;
export type StillbornReasonValue = (typeof STILLBORN_REASONS)[number];

export const STILLBORN_REASON_LABELS: Record<StillbornReasonValue, string> = {
  DYSTOCIA: 'Distocia',
  MALFORMATION: 'Malformação',
  UNKNOWN: 'Desconhecida',
  OTHER: 'Outra',
};

export function isValidStillbornReason(value: string): value is StillbornReasonValue {
  return STILLBORN_REASONS.includes(value as StillbornReasonValue);
}

export const EVENT_PERIODS = ['MORNING', 'AFTERNOON', 'NIGHT'] as const;
export type EventPeriodValue = (typeof EVENT_PERIODS)[number];

export const EVENT_PERIOD_LABELS: Record<EventPeriodValue, string> = {
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

export function isValidEventPeriod(value: string): value is EventPeriodValue {
  return EVENT_PERIODS.includes(value as EventPeriodValue);
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CalfInput {
  sex: string;
  birthWeightKg?: number | null;
  condition: string;
  stillbornReason?: string | null;
  earTag?: string | null;
  notes?: string | null;
}

export interface CreateCalvingInput {
  motherId: string;
  fatherId?: string | null;
  fatherBreedName?: string | null;
  eventType: string;
  eventDate: string; // ISO date
  eventTime?: string | null; // HH:MM
  eventPeriod?: string | null; // MORNING, AFTERNOON, NIGHT
  // Birth-specific
  birthType?: string | null;
  presentation?: string | null;
  // Abortion-specific
  abortionGestationDays?: number | null;
  abortionCause?: string | null;
  abortionCauseDetail?: string | null;
  fetusFound?: boolean | null;
  // Mother
  motherWeightKg?: number | null;
  placentaRetention?: boolean;
  retentionHours?: number | null;
  retentionIntervention?: boolean;
  // Linkage
  pregnancyDiagnosisId?: string | null;
  attendantName: string;
  notes?: string | null;
  // Calves (CA5)
  calves?: CalfInput[];
}

export interface UpdateCalvingInput {
  fatherId?: string | null;
  fatherBreedName?: string | null;
  eventDate?: string;
  eventTime?: string | null;
  eventPeriod?: string | null;
  birthType?: string | null;
  presentation?: string | null;
  abortionGestationDays?: number | null;
  abortionCause?: string | null;
  abortionCauseDetail?: string | null;
  fetusFound?: boolean | null;
  motherWeightKg?: number | null;
  placentaRetention?: boolean;
  retentionHours?: number | null;
  retentionIntervention?: boolean;
  attendantName?: string;
  notes?: string | null;
}

export interface ListCalvingsQuery {
  eventType?: CalvingEventTypeValue;
  motherId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface CalvingCalfItem {
  id: string;
  sex: string;
  sexLabel: string;
  birthWeightKg: number | null;
  condition: CalfConditionValue;
  conditionLabel: string;
  stillbornReason: string | null;
  stillbornReasonLabel: string | null;
  createdAnimalId: string | null;
  earTag: string | null;
  notes: string | null;
}

export interface CalvingEventItem {
  id: string;
  farmId: string;
  motherId: string;
  motherEarTag: string;
  motherName: string | null;
  fatherId: string | null;
  fatherEarTag: string | null;
  fatherBreedName: string | null;
  eventType: CalvingEventTypeValue;
  eventTypeLabel: string;
  eventDate: string;
  eventTime: string | null;
  eventPeriod: string | null;
  eventPeriodLabel: string | null;
  birthType: string | null;
  birthTypeLabel: string | null;
  presentation: string | null;
  presentationLabel: string | null;
  abortionGestationDays: number | null;
  abortionCause: string | null;
  abortionCauseLabel: string | null;
  abortionCauseDetail: string | null;
  fetusFound: boolean | null;
  motherWeightKg: number | null;
  placentaRetention: boolean;
  retentionHours: number | null;
  retentionIntervention: boolean;
  pregnancyDiagnosisId: string | null;
  attendantName: string;
  notes: string | null;
  calvesCount: number;
  calves: CalvingCalfItem[];
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export type CalvingDetail = CalvingEventItem;

export interface UpcomingBirthItem {
  diagnosisId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  expectedCalvingDate: string;
  gestationDays: number | null;
  isConfirmed: boolean;
  bullId: string | null;
  bullName: string | null;
  bullBreedName: string | null;
  daysUntil: number;
}

export interface CalvingIndicators {
  totalEvents: number;
  birthCount: number;
  abortionCount: number;
  totalCalves: number;
  aliveCalves: number;
  stillbornCalves: number;
  stillbornRate: number | null;
  avgBirthWeightKg: number | null;
  twinRate: number | null;
  abortionRate: number | null;
  periodStart: string;
  periodEnd: string;
}
