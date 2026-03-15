/* ─── Mastitis types ─────────────────────────────────────────────── */

export interface QuarterItem {
  id: string;
  quarter: string;
  quarterLabel: string;
  grade: string;
  gradeLabel: string;
  milkAppearance: string | null;
  cmtResult: string | null;
  status: string;
  statusLabel: string;
  withdrawalEndDate: string | null;
}

export interface ApplicationItem {
  id: string;
  applicationDate: string;
  applicationTime: string | null;
  productName: string;
  dose: string;
  administrationRoute: string;
  quarterTreated: string | null;
  responsibleName: string;
  costCents: number;
  notes?: string | null;
}

export interface MastitisCaseItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  occurrenceDate: string;
  occurrenceTime: string | null;
  identifiedBy: string;
  delAtOccurrence: number | null;
  rectalTemperature: number | null;
  temperatureAlert: boolean;
  classification: string;
  classificationLabel: string;
  status: string;
  statusLabel: string;
  cultureSampleCollected: boolean;
  cultureAgent: string | null;
  treatmentProtocolName: string | null;
  withdrawalEndDate: string | null;
  closureOutcome: string | null;
  closureOutcomeLabel: string | null;
  totalCostCents: number;
  quartersAffected: string[];
  quarters: QuarterItem[];
  applications: ApplicationItem[];
  notes: string | null;
  createdAt: string;
}

export interface MastitisListResponse {
  data: MastitisCaseItem[];
  total: number;
}

export interface MastitisIndicators {
  totalCases: number;
  openCases: number;
  clinicalRate: number;
  cureRate: number;
  avgCostCents: number;
  topAgents: Array<{ agent: string; count: number }>;
  recurrentCows: number;
}

export interface AnimalHistoryResponse {
  data: MastitisCaseItem[];
}

/* ─── Constants ──────────────────────────────────────────────────── */

export const MASTITIS_GRADES = [
  { value: 'GRADE_1_MILD', label: 'Grau 1 (Leve)' },
  { value: 'GRADE_2_MODERATE', label: 'Grau 2 (Moderada)' },
  { value: 'GRADE_3_SEVERE', label: 'Grau 3 (Grave)' },
] as const;

export const QUARTERS = [
  { value: 'FL', label: 'AE (Anterior Esquerdo)' },
  { value: 'FR', label: 'AD (Anterior Direito)' },
  { value: 'RL', label: 'PE (Posterior Esquerdo)' },
  { value: 'RR', label: 'PD (Posterior Direito)' },
] as const;

export const QUARTER_SHORT_LABELS: Record<string, string> = {
  FL: 'AE',
  FR: 'AD',
  RL: 'PE',
  RR: 'PD',
};

export const CASE_STATUSES = [
  { value: 'OPEN', label: 'Aberto' },
  { value: 'CLOSED', label: 'Encerrado' },
] as const;

export const MILK_APPEARANCES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'WATERY', label: 'Aquoso' },
  { value: 'FLAKES', label: 'Com grumos' },
  { value: 'CLOTS', label: 'Com coágulos' },
  { value: 'BLOODY', label: 'Sanguinolento' },
  { value: 'PURULENT', label: 'Purulento' },
] as const;

export const CMT_RESULTS = [
  { value: 'NEGATIVE', label: 'Negativo (-)' },
  { value: 'TRACE', label: 'Suspeito (+/-)' },
  { value: 'WEAK_POSITIVE', label: 'Fraco positivo (+)' },
  { value: 'DISTINCT_POSITIVE', label: 'Positivo (++)' },
  { value: 'STRONG_POSITIVE', label: 'Forte positivo (+++)' },
] as const;

export const CLASSIFICATION_CONFIG: Record<string, { label: string; className: string }> = {
  CLINICAL: { label: 'Clínica', className: 'mast-class--clinical' },
  SUBCLINICAL: { label: 'Subclínica', className: 'mast-class--subclinical' },
  RECURRENT: { label: 'Recorrente', className: 'mast-class--recurrent' },
  CHRONIC: { label: 'Crônica', className: 'mast-class--chronic' },
};

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Aberto', className: 'mast-status--open' },
  CLOSED: { label: 'Encerrado', className: 'mast-status--closed' },
};

export const GRADE_CONFIG: Record<string, { label: string; className: string }> = {
  GRADE_1_MILD: { label: 'Grau 1', className: 'mast-grade--mild' },
  GRADE_2_MODERATE: { label: 'Grau 2', className: 'mast-grade--moderate' },
  GRADE_3_SEVERE: { label: 'Grau 3', className: 'mast-grade--severe' },
};

export const QUARTER_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  IN_TREATMENT: { label: 'Em tratamento', className: 'q-status--treatment' },
  IN_WITHDRAWAL: { label: 'Em carência', className: 'q-status--withdrawal' },
  CURED: { label: 'Curado', className: 'q-status--cured' },
  CHRONIC: { label: 'Crônico', className: 'q-status--chronic' },
  QUARTER_LOST: { label: 'Quarto perdido', className: 'q-status--lost' },
};

export const QUARTER_STATUSES = [
  { value: 'IN_TREATMENT', label: 'Em tratamento' },
  { value: 'IN_WITHDRAWAL', label: 'Em carência' },
  { value: 'CURED', label: 'Curado' },
  { value: 'CHRONIC', label: 'Crônico' },
  { value: 'QUARTER_LOST', label: 'Quarto perdido' },
] as const;

export const CLOSURE_OUTCOMES = [
  { value: 'CURED', label: 'Curado' },
  { value: 'CHRONIC', label: 'Crônico' },
  { value: 'CULLED', label: 'Descarte' },
  { value: 'DEATH', label: 'Óbito' },
] as const;

export const ADMINISTRATION_ROUTES = [
  { value: 'INTRAMMARY', label: 'Intramamário' },
  { value: 'IM', label: 'Intramuscular' },
  { value: 'SC', label: 'Subcutâneo' },
  { value: 'IV', label: 'Intravenoso' },
  { value: 'ORAL', label: 'Oral' },
  { value: 'TOPICAL', label: 'Tópico' },
] as const;

/* ─── Input types ────────────────────────────────────────────────── */

export interface QuarterInput {
  quarter: string;
  grade: string;
  milkAppearance: string;
  cmtResult: string;
}

export interface CreateMastitisCaseInput {
  animalId: string;
  occurrenceDate: string;
  occurrenceTime?: string | null;
  identifiedBy: string;
  rectalTemperature?: number | null;
  classification?: string;
  cultureSampleCollected?: boolean;
  cultureLab?: string | null;
  cultureSampleNumber?: string | null;
  notes?: string | null;
  quarters: QuarterInput[];
}

export interface CreateApplicationInput {
  applicationDate: string;
  applicationTime?: string | null;
  productName: string;
  dose: string;
  administrationRoute: string;
  quarterTreated?: string | null;
  responsibleName: string;
  costCents?: number;
  notes?: string | null;
}

export interface CloseCaseInput {
  closureOutcome: string;
  closingNotes?: string | null;
}

export interface UpdateQuarterInput {
  status: string;
  withdrawalEndDate?: string | null;
}
