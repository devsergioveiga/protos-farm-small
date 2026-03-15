// ─── Error ──────────────────────────────────────────────────────────

export class PregnancyDiagnosisError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PregnancyDiagnosisError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const DG_RESULTS = ['PREGNANT', 'EMPTY', 'LOSS', 'CYCLING'] as const;
export type DgResultValue = (typeof DG_RESULTS)[number];

export const DG_RESULT_LABELS: Record<DgResultValue, string> = {
  PREGNANT: 'Gestante',
  EMPTY: 'Vazia',
  LOSS: 'Perda gestacional',
  CYCLING: 'Ciclando',
};

export function isValidDgResult(value: string): value is DgResultValue {
  return DG_RESULTS.includes(value as DgResultValue);
}

export const DG_METHODS = ['PALPATION', 'ULTRASOUND', 'BLOOD_TEST', 'OBSERVATION'] as const;
export type DgMethodValue = (typeof DG_METHODS)[number];

export const DG_METHOD_LABELS: Record<DgMethodValue, string> = {
  PALPATION: 'Palpação retal',
  ULTRASOUND: 'Ultrassonografia',
  BLOOD_TEST: 'Exame de sangue',
  OBSERVATION: 'Observação',
};

export function isValidDgMethod(value: string): value is DgMethodValue {
  return DG_METHODS.includes(value as DgMethodValue);
}

export const UTERINE_CONDITIONS = [
  'NONE',
  'PLACENTA_RETENTION',
  'METRITIS_GRADE_1',
  'METRITIS_GRADE_2',
  'METRITIS_GRADE_3',
  'ENDOMETRITIS_CLINICAL',
  'ENDOMETRITIS_SUBCLINICAL',
  'PYOMETRA',
] as const;
export type UterineConditionValue = (typeof UTERINE_CONDITIONS)[number];

export const UTERINE_CONDITION_LABELS: Record<UterineConditionValue, string> = {
  NONE: 'Nenhuma',
  PLACENTA_RETENTION: 'Retenção de placenta',
  METRITIS_GRADE_1: 'Metrite grau 1',
  METRITIS_GRADE_2: 'Metrite grau 2',
  METRITIS_GRADE_3: 'Metrite grau 3 (tóxica)',
  ENDOMETRITIS_CLINICAL: 'Endometrite clínica',
  ENDOMETRITIS_SUBCLINICAL: 'Endometrite subclínica',
  PYOMETRA: 'Piometra',
};

export function isValidUterineCondition(value: string): value is UterineConditionValue {
  return UTERINE_CONDITIONS.includes(value as UterineConditionValue);
}

/** Conditions that trigger reproductive restriction (CA4) */
export const RESTRICTIVE_CONDITIONS: UterineConditionValue[] = [
  'PLACENTA_RETENTION',
  'METRITIS_GRADE_1',
  'METRITIS_GRADE_2',
  'METRITIS_GRADE_3',
  'ENDOMETRITIS_CLINICAL',
  'ENDOMETRITIS_SUBCLINICAL',
  'PYOMETRA',
];

/** Default wait period (days) per uterine condition grade (CA4) */
export const RESTRICTION_WAIT_DAYS: Partial<Record<UterineConditionValue, number>> = {
  PLACENTA_RETENTION: 30,
  METRITIS_GRADE_1: 21,
  METRITIS_GRADE_2: 30,
  METRITIS_GRADE_3: 45,
  ENDOMETRITIS_CLINICAL: 30,
  ENDOMETRITIS_SUBCLINICAL: 21,
  PYOMETRA: 60,
};

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

export const FETAL_SEXES = ['MALE', 'FEMALE', 'UNKNOWN'] as const;
export type FetalSexValue = (typeof FETAL_SEXES)[number];

export const FETAL_SEX_LABELS: Record<FetalSexValue, string> = {
  MALE: 'Macho',
  FEMALE: 'Fêmea',
  UNKNOWN: 'Indeterminado',
};

export function isValidFetalSex(value: string): value is FetalSexValue {
  return FETAL_SEXES.includes(value as FetalSexValue);
}

/** Average bovine gestation (days) */
export const AVG_GESTATION_DAYS = 283;

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateDiagnosisInput {
  animalId: string;
  diagnosisDate: string; // ISO date
  result: string;
  method: string;
  gestationDays?: number | null;
  fetalSex?: string | null;
  cyclicityStatus?: string | null;
  uterineCondition?: string | null;
  placentaRetentionHours?: number | null;
  inseminationId?: string | null;
  naturalMatingId?: string | null;
  bullId?: string | null;
  bullBreedName?: string | null;
  veterinaryName: string;
  notes?: string | null;
}

export interface UpdateDiagnosisInput {
  diagnosisDate?: string;
  result?: string;
  method?: string;
  gestationDays?: number | null;
  fetalSex?: string | null;
  cyclicityStatus?: string | null;
  uterineCondition?: string | null;
  placentaRetentionHours?: number | null;
  inseminationId?: string | null;
  naturalMatingId?: string | null;
  bullId?: string | null;
  bullBreedName?: string | null;
  veterinaryName?: string;
  notes?: string | null;
}

export interface ConfirmPregnancyInput {
  confirmationDate: string; // ISO date
  notes?: string | null;
}

export interface RecordLossInput {
  lossDate: string; // ISO date
  lossReason: string;
  notes?: string | null;
}

export interface ReferToIatfInput {
  referredProtocolId?: string | null;
}

export interface ListDiagnosesQuery {
  result?: DgResultValue;
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface DiagnosisItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  diagnosisDate: string;
  result: DgResultValue;
  resultLabel: string;
  method: DgMethodValue;
  methodLabel: string;
  gestationDays: number | null;
  fetalSex: string | null;
  fetalSexLabel: string | null;
  cyclicityStatus: string | null;
  cyclicityStatusLabel: string | null;
  expectedCalvingDate: string | null;
  uterineCondition: UterineConditionValue;
  uterineConditionLabel: string;
  placentaRetentionHours: number | null;
  reproductiveRestriction: boolean;
  restrictionEndDate: string | null;
  inseminationId: string | null;
  naturalMatingId: string | null;
  linkedTreatmentId: string | null;
  bullId: string | null;
  bullName: string | null;
  bullBreedName: string | null;
  isConfirmed: boolean;
  confirmationDate: string | null;
  lossDate: string | null;
  lossReason: string | null;
  referredToIatf: boolean;
  referredProtocolId: string | null;
  veterinaryName: string;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface CalvingCalendarItem {
  month: string; // YYYY-MM
  monthLabel: string;
  expectedCalvings: {
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
  }[];
  count: number;
}

export interface DgIndicators {
  totalDiagnoses: number;
  pregnantCount: number;
  emptyCount: number;
  lossCount: number;
  cyclingCount: number;
  pregnancyRate: number | null; // %
  lossRate: number | null; // %
  conceptionRatePerBull: {
    bullId: string | null;
    bullName: string | null;
    bullBreedName: string | null;
    pregnantCount: number;
    totalCount: number;
    rate: number;
  }[];
  periodStart: string;
  periodEnd: string;
}

export interface EmptyFemaleItem {
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  diagnosisId: string;
  diagnosisDate: string;
  cyclicityStatus: string | null;
  cyclicityStatusLabel: string | null;
  referredToIatf: boolean;
  referredProtocolId: string | null;
  daysSinceDiagnosis: number;
}
