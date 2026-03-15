export interface DiagnosisItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  diagnosisDate: string;
  result: string;
  resultLabel: string;
  method: string;
  methodLabel: string;
  gestationDays: number | null;
  fetalSex: string | null;
  fetalSexLabel: string | null;
  cyclicityStatus: string | null;
  cyclicityStatusLabel: string | null;
  expectedCalvingDate: string | null;
  uterineCondition: string;
  uterineConditionLabel: string;
  placentaRetentionHours: number | null;
  reproductiveRestriction: boolean;
  restrictionEndDate: string | null;
  bullId: string | null;
  bullName: string | null;
  bullBreedName: string | null;
  isConfirmed: boolean;
  confirmationDate: string | null;
  lossDate: string | null;
  lossReason: string | null;
  referredToIatf: boolean;
  veterinaryName: string;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface DiagnosesResponse {
  data: DiagnosisItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateDiagnosisInput {
  animalId: string;
  diagnosisDate: string;
  result: string;
  method: string;
  gestationDays?: number | null;
  fetalSex?: string | null;
  expectedCalvingDate?: string | null;
  cyclicityStatus?: string | null;
  uterineCondition?: string;
  placentaRetentionHours?: number | null;
  reproductiveRestriction?: boolean;
  restrictionEndDate?: string | null;
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
  expectedCalvingDate?: string | null;
  cyclicityStatus?: string | null;
  uterineCondition?: string;
  placentaRetentionHours?: number | null;
  reproductiveRestriction?: boolean;
  restrictionEndDate?: string | null;
  bullId?: string | null;
  bullBreedName?: string | null;
  veterinaryName?: string;
  notes?: string | null;
}

export interface CalvingCalendarItem {
  month: string;
  count: number;
  animals: Array<{
    animalId: string;
    earTag: string;
    animalName: string | null;
    expectedDate: string;
    bullName: string | null;
    gestationDays: number | null;
  }>;
}

export interface EmptyFemaleItem {
  animalId: string;
  earTag: string;
  animalName: string | null;
  diagnosisDate: string;
  daysSinceDiagnosis: number;
  cyclicityStatus: string | null;
}

export interface DgIndicators {
  totalDiagnoses: number;
  pregnancyRate: number;
  emptyCount: number;
  lossCount: number;
  avgGestationDays: number | null;
}

export const DG_RESULTS = [
  { value: 'PREGNANT', label: 'Prenha' },
  { value: 'EMPTY', label: 'Vazia' },
  { value: 'LOSS', label: 'Perda' },
  { value: 'CYCLING', label: 'Ciclando' },
] as const;

export const DG_METHODS = [
  { value: 'PALPATION', label: 'Palpação' },
  { value: 'ULTRASOUND', label: 'Ultrassom' },
  { value: 'BLOOD_TEST', label: 'Exame de sangue' },
  { value: 'OBSERVATION', label: 'Observação' },
] as const;

export const UTERINE_CONDITIONS = [
  { value: 'NONE', label: 'Nenhuma' },
  { value: 'PLACENTA_RETENTION', label: 'Retenção de placenta' },
  { value: 'METRITIS_GRADE_1', label: 'Metrite grau 1' },
  { value: 'METRITIS_GRADE_2', label: 'Metrite grau 2' },
  { value: 'METRITIS_GRADE_3', label: 'Metrite grau 3 (tóxica)' },
  { value: 'ENDOMETRITIS_CLINICAL', label: 'Endometrite clínica' },
  { value: 'ENDOMETRITIS_SUBCLINICAL', label: 'Endometrite subclínica' },
  { value: 'PYOMETRA', label: 'Piometra' },
] as const;

export const CYCLICITY_STATUSES = [
  { value: 'CYCLING', label: 'Ciclando' },
  { value: 'ANESTROUS', label: 'Anestro' },
  { value: 'OVARIAN_CYST', label: 'Cisto ovariano' },
  { value: 'FREEMARTIN', label: 'Freemartin' },
] as const;

export const FETAL_SEX_OPTIONS = [
  { value: 'MALE', label: 'Macho' },
  { value: 'FEMALE', label: 'Fêmea' },
  { value: 'UNKNOWN', label: 'Indeterminado' },
] as const;

export const RESULT_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  PREGNANT: { label: 'Prenha', className: 'dg-badge--pregnant' },
  EMPTY: { label: 'Vazia', className: 'dg-badge--empty' },
  LOSS: { label: 'Perda', className: 'dg-badge--loss' },
  CYCLING: { label: 'Ciclando', className: 'dg-badge--cycling' },
};

export const UTERINE_SEVERITY: Record<string, string> = {
  NONE: '',
  PLACENTA_RETENTION: 'dg-uterine--warning',
  METRITIS_GRADE_1: 'dg-uterine--grade1',
  METRITIS_GRADE_2: 'dg-uterine--grade2',
  METRITIS_GRADE_3: 'dg-uterine--grade3',
  ENDOMETRITIS_CLINICAL: 'dg-uterine--grade2',
  ENDOMETRITIS_SUBCLINICAL: 'dg-uterine--grade1',
  PYOMETRA: 'dg-uterine--grade3',
};
