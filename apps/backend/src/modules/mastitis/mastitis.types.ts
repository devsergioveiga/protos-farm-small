// ─── Error ──────────────────────────────────────────────────────────

export class MastitisError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MastitisError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const GRADES = ['GRADE_1_MILD', 'GRADE_2_MODERATE', 'GRADE_3_SEVERE'] as const;
export type GradeValue = (typeof GRADES)[number];

export const GRADE_LABELS: Record<GradeValue, string> = {
  GRADE_1_MILD: 'Grau 1 — Leve',
  GRADE_2_MODERATE: 'Grau 2 — Moderada',
  GRADE_3_SEVERE: 'Grau 3 — Grave',
};

export const CLASSIFICATIONS = ['CLINICAL', 'SUBCLINICAL', 'RECURRENT', 'CHRONIC'] as const;
export type ClassificationValue = (typeof CLASSIFICATIONS)[number];

export const CLASSIFICATION_LABELS: Record<ClassificationValue, string> = {
  CLINICAL: 'Clínica',
  SUBCLINICAL: 'Subclínica',
  RECURRENT: 'Recorrente',
  CHRONIC: 'Crônica',
};

export const QUARTER_STATUSES = [
  'IN_TREATMENT',
  'IN_WITHDRAWAL',
  'CURED',
  'CHRONIC',
  'QUARTER_LOST',
] as const;
export type QuarterStatusValue = (typeof QUARTER_STATUSES)[number];

export const QUARTER_STATUS_LABELS: Record<QuarterStatusValue, string> = {
  IN_TREATMENT: 'Em tratamento',
  IN_WITHDRAWAL: 'Período de carência',
  CURED: 'Curado',
  CHRONIC: 'Crônico',
  QUARTER_LOST: 'Quarto perdido',
};

export const CASE_STATUSES = ['OPEN', 'CLOSED'] as const;
export type CaseStatusValue = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatusValue, string> = {
  OPEN: 'Aberto',
  CLOSED: 'Encerrado',
};

export const MILK_APPEARANCES = [
  'NORMAL',
  'CLOTS',
  'WATERY',
  'BLOODY',
  'PURULENT',
  'YELLOWISH',
  'FLAKES',
] as const;
export type MilkAppearanceValue = (typeof MILK_APPEARANCES)[number];

export const MILK_APPEARANCE_LABELS: Record<MilkAppearanceValue, string> = {
  NORMAL: 'Normal',
  CLOTS: 'Grumos',
  WATERY: 'Aquoso',
  BLOODY: 'Sanguinolento',
  PURULENT: 'Purulento',
  YELLOWISH: 'Amarelado',
  FLAKES: 'Flocos',
};

export const CMT_RESULTS = ['NEGATIVE', 'TRACE', 'PLUS_1', 'PLUS_2', 'PLUS_3'] as const;
export type CmtResultValue = (typeof CMT_RESULTS)[number];

export const CMT_RESULT_LABELS: Record<CmtResultValue, string> = {
  NEGATIVE: 'Negativo',
  TRACE: 'Traços',
  PLUS_1: '+',
  PLUS_2: '++',
  PLUS_3: '+++',
};

export const QUARTERS = ['FL', 'FR', 'RL', 'RR'] as const;
export type QuarterValue = (typeof QUARTERS)[number];

export const QUARTER_LABELS: Record<QuarterValue, string> = {
  FL: 'Anterior esquerdo',
  FR: 'Anterior direito',
  RL: 'Posterior esquerdo',
  RR: 'Posterior direito',
};

export const CLOSURE_OUTCOMES = ['CURED', 'PARTIAL', 'QUARTER_LOST', 'ANIMAL_DISPOSAL'] as const;
export type ClosureOutcomeValue = (typeof CLOSURE_OUTCOMES)[number];

export const CLOSURE_OUTCOME_LABELS: Record<ClosureOutcomeValue, string> = {
  CURED: 'Curado',
  PARTIAL: 'Melhora parcial',
  QUARTER_LOST: 'Quarto perdido',
  ANIMAL_DISPOSAL: 'Descarte do animal',
};

export const ADMIN_ROUTES = ['INTRAMMARY', 'IM', 'IV', 'SC'] as const;
export type AdminRouteValue = (typeof ADMIN_ROUTES)[number];

export const ADMIN_ROUTE_LABELS: Record<AdminRouteValue, string> = {
  INTRAMMARY: 'Intramamário',
  IM: 'Intramuscular',
  IV: 'Intravenoso',
  SC: 'Subcutâneo',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface QuarterInput {
  quarter: string;
  grade: string;
  milkAppearance?: string | null;
  cmtResult?: string | null;
  notes?: string | null;
}

export interface CreateMastitisInput {
  animalId: string;
  occurrenceDate: string; // ISO date
  occurrenceTime?: string | null;
  identifiedBy: string;
  rectalTemperature?: number | null;
  quarters: QuarterInput[];
  cultureSampleCollected?: boolean;
  cultureLab?: string | null;
  cultureSampleNumber?: string | null;
  cultureAgent?: string | null;
  cultureAntibiogram?: Array<{ antibiotic: string; result: string }> | null;
  treatmentProtocolName?: string | null;
  notes?: string | null;
}

export interface UpdateMastitisInput {
  cultureSampleCollected?: boolean;
  cultureLab?: string | null;
  cultureSampleNumber?: string | null;
  cultureAgent?: string | null;
  cultureAntibiogram?: Array<{ antibiotic: string; result: string }> | null;
  treatmentProtocolName?: string | null;
  notes?: string | null;
}

export interface RecordApplicationInput {
  applicationDate: string; // ISO date
  applicationTime?: string | null;
  productName: string;
  productId?: string | null;
  dose: string;
  administrationRoute: string;
  quarterTreated?: string | null;
  responsibleName: string;
  costCents?: number;
  notes?: string | null;
}

export interface UpdateQuarterInput {
  milkAppearance?: string | null;
  cmtResult?: string | null;
  status?: string;
  withdrawalEndDate?: string | null;
  notes?: string | null;
}

export interface CloseCaseInput {
  closureOutcome: string;
  notes?: string | null;
}

export interface ListMastitisQuery {
  animalId?: string;
  status?: string;
  classification?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface QuarterItem {
  id: string;
  caseId: string;
  quarter: string;
  quarterLabel: string;
  grade: string;
  gradeLabel: string;
  milkAppearance: string | null;
  milkAppearanceLabel: string | null;
  cmtResult: string | null;
  cmtResultLabel: string | null;
  status: string;
  statusLabel: string;
  withdrawalEndDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ApplicationItem {
  id: string;
  caseId: string;
  applicationDate: string;
  applicationTime: string | null;
  productName: string;
  productId: string | null;
  dose: string;
  administrationRoute: string;
  administrationRouteLabel: string;
  quarterTreated: string | null;
  quarterTreatedLabel: string | null;
  responsibleName: string;
  costCents: number;
  notes: string | null;
  createdAt: string;
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
  cultureLab: string | null;
  cultureSampleNumber: string | null;
  cultureAgent: string | null;
  cultureAntibiogram: Array<{ antibiotic: string; result: string }> | null;
  treatmentProtocolName: string | null;
  withdrawalEndDate: string | null;
  closedAt: string | null;
  closureOutcome: string | null;
  closureOutcomeLabel: string | null;
  totalCostCents: number;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  quarters: QuarterItem[];
  applications: ApplicationItem[];
  createdAt: string;
}

export interface MastitisListItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  occurrenceDate: string;
  classification: string;
  classificationLabel: string;
  status: string;
  statusLabel: string;
  identifiedBy: string;
  quartersAffected: string[];
  treatmentProtocolName: string | null;
  totalCostCents: number;
  createdAt: string;
}

export interface MastitisIndicators {
  totalCases: number;
  openCases: number;
  closedCases: number;
  clinicalRate: number;
  subclinicalRate: number;
  recurrentRate: number;
  chronicRate: number;
  quarterBreakdown: Record<string, number>;
  topAgents: Array<{ agent: string; count: number }>;
  cureRate: number;
  totalCostCents: number;
  recurrentCows: number;
}
