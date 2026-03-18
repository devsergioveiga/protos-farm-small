export interface CalvingCalfItem {
  id: string;
  sex: string;
  sexLabel: string;
  birthWeightKg: number | null;
  condition: string;
  conditionLabel: string;
  stillbornReason: string | null;
  createdAnimalId: string | null;
  earTag: string | null;
}

export interface CalvingEventItem {
  id: string;
  farmId: string;
  motherId: string;
  motherEarTag: string;
  motherName: string | null;
  fatherId: string | null;
  fatherName: string | null;
  fatherBreedName: string | null;
  eventType: string;
  eventTypeLabel: string;
  eventDate: string;
  eventTime: string | null;
  eventPeriod: string | null;
  birthType: string | null;
  birthTypeLabel: string | null;
  presentation: string | null;
  abortionGestationDays: number | null;
  abortionCause: string | null;
  abortionCauseLabel: string | null;
  motherWeightKg: number | null;
  placentaRetention: boolean;
  retentionHours: number | null;
  attendantName: string;
  calvesCount: number;
  liveCalvesCount: number;
  calves: CalvingCalfItem[];
  notes: string | null;
  createdAt: string;
}

export interface CalvingEventsResponse {
  data: CalvingEventItem[];
  total: number;
}

export interface UpcomingBirthItem {
  animalId: string;
  earTag: string;
  animalName: string | null;
  expectedDate: string;
  daysUntil: number;
  bullName: string | null;
}

export interface CalvingIndicators {
  totalBirths: number;
  totalAbortions: number;
  stillbornRate: number;
  avgBirthWeightKg: number | null;
  twinRate: number;
}

export interface CalfInput {
  sex: string;
  birthWeightKg: number | null;
  condition: string;
  earTag: string;
  stillbornReason: string;
}

export interface CreateCalvingEventInput {
  motherId: string;
  fatherId: string;
  fatherBreedName: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  eventPeriod: string;
  birthType: string;
  presentation: string;
  abortionGestationDays: number | null;
  abortionCause: string;
  motherWeightKg: number | null;
  placentaRetention: boolean;
  retentionHours: number | null;
  attendantName: string;
  notes: string;
  calves: CalfInput[];
}

export const EVENT_TYPES = [
  { value: 'BIRTH', label: 'Parto' },
  { value: 'ABORTION', label: 'Aborto' },
] as const;

export const BIRTH_TYPES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ASSISTED_EASY', label: 'Auxiliado (fácil)' },
  { value: 'ASSISTED_DIFFICULT', label: 'Auxiliado (difícil)' },
  { value: 'CESAREAN', label: 'Cesárea' },
] as const;

export const CALF_CONDITIONS = [
  { value: 'ALIVE', label: 'Vivo' },
  { value: 'STILLBORN', label: 'Natimorto' },
] as const;

export const ABORTION_CAUSES = [
  { value: 'INFECTIOUS', label: 'Infecciosa' },
  { value: 'TRAUMATIC', label: 'Traumática' },
  { value: 'NUTRITIONAL', label: 'Nutricional' },
  { value: 'UNKNOWN', label: 'Desconhecida' },
  { value: 'OTHER', label: 'Outra' },
] as const;

export const CALF_SEX_OPTIONS = [
  { value: 'MALE', label: 'Macho' },
  { value: 'FEMALE', label: 'Fêmea' },
] as const;

export const PRESENTATION_OPTIONS = [
  { value: 'ANTERIOR', label: 'Anterior' },
  { value: 'POSTERIOR', label: 'Posterior' },
] as const;

export const EVENT_PERIOD_OPTIONS = [
  { value: 'MORNING', label: 'Manhã' },
  { value: 'AFTERNOON', label: 'Tarde' },
  { value: 'NIGHT', label: 'Noite' },
  { value: 'DAWN', label: 'Madrugada' },
] as const;

export const EVENT_TYPE_CONFIG = {
  BIRTH: { label: 'Parto', className: 'event-type--birth' },
  ABORTION: { label: 'Aborto', className: 'event-type--abortion' },
} as const;

export const BIRTH_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  NORMAL: { label: 'Normal', className: 'birth-type--normal' },
  ASSISTED_EASY: { label: 'Auxiliado (fácil)', className: 'birth-type--easy' },
  ASSISTED_DIFFICULT: { label: 'Auxiliado (difícil)', className: 'birth-type--difficult' },
  CESAREAN: { label: 'Cesárea', className: 'birth-type--cesarean' },
};

export const CALF_CONDITION_CONFIG: Record<string, { label: string; className: string }> = {
  ALIVE: { label: 'Vivo', className: 'calf--alive' },
  STILLBORN: { label: 'Natimorto', className: 'calf--stillborn' },
};
