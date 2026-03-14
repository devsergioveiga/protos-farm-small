// ─── Error ──────────────────────────────────────────────────────────

export class TherapeuticTreatmentError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'TherapeuticTreatmentError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const TREATMENT_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const;
export type TreatmentStatusValue = (typeof TREATMENT_STATUSES)[number];

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatusValue, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrado',
};

export const TREATMENT_OUTCOMES = [
  'CURED',
  'PARTIAL_IMPROVEMENT',
  'DEATH',
  'CHRONIC',
  'REFERRED_DISPOSAL',
] as const;
export type TreatmentOutcomeValue = (typeof TREATMENT_OUTCOMES)[number];

export const TREATMENT_OUTCOME_LABELS: Record<TreatmentOutcomeValue, string> = {
  CURED: 'Curado',
  PARTIAL_IMPROVEMENT: 'Melhora parcial',
  DEATH: 'Óbito',
  CHRONIC: 'Crônico',
  REFERRED_DISPOSAL: 'Encaminhado para descarte',
};

export const EVOLUTION_TYPES = ['IMPROVEMENT', 'STABLE', 'WORSENING'] as const;
export type EvolutionTypeValue = (typeof EVOLUTION_TYPES)[number];

export const EVOLUTION_TYPE_LABELS: Record<EvolutionTypeValue, string> = {
  IMPROVEMENT: 'Melhora',
  STABLE: 'Estável',
  WORSENING: 'Piora',
};

export const APPLICATION_STATUSES = ['PENDING', 'DONE', 'NOT_DONE'] as const;
export type ApplicationStatusValue = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatusValue, string> = {
  PENDING: 'Pendente',
  DONE: 'Realizado',
  NOT_DONE: 'Não realizado',
};

export const SEVERITY_LEVELS = ['MILD', 'MODERATE', 'SEVERE'] as const;

export const SEVERITY_LABELS: Record<string, string> = {
  MILD: 'Leve',
  MODERATE: 'Moderada',
  SEVERE: 'Grave',
};

export const ADMINISTRATION_ROUTES = ['IM', 'SC', 'IV', 'ORAL', 'INTRAMMARY', 'TOPICAL'] as const;

export const ADMINISTRATION_ROUTE_LABELS: Record<string, string> = {
  IM: 'Intramuscular',
  SC: 'Subcutâneo',
  IV: 'Intravenoso',
  ORAL: 'Oral',
  INTRAMMARY: 'Intramamário',
  TOPICAL: 'Tópico',
};

export const DOSAGE_UNIT_LABELS: Record<string, string> = {
  MG_KG: 'mg/kg',
  ML_ANIMAL: 'mL/animal',
  FIXED_DOSE: 'Dose fixa',
};

export function isValidAdministrationRoute(
  value: string,
): value is (typeof ADMINISTRATION_ROUTES)[number] {
  return ADMINISTRATION_ROUTES.includes(value as (typeof ADMINISTRATION_ROUTES)[number]);
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateTreatmentInput {
  animalId: string;
  diseaseId?: string | null;
  diseaseName: string;
  diagnosisDate: string; // ISO date
  observedSeverity: string;
  clinicalObservations?: string | null;
  veterinaryName: string;
  responsibleName: string;
  treatmentProtocolId?: string | null;
  notes?: string | null;
  // Ad-hoc (CA3): when no protocol
  adhocProducts?: AdhocProductInput[];
}

export interface AdhocProductInput {
  productId?: string | null;
  productName: string;
  dosage: number;
  dosageUnit: string;
  administrationRoute: string;
  durationDays: number;
  frequencyPerDay?: number;
  startDay?: number;
}

export interface UpdateTreatmentInput {
  clinicalObservations?: string | null;
  veterinaryName?: string;
  responsibleName?: string;
  notes?: string | null;
}

export interface CloseTreatmentInput {
  outcome: TreatmentOutcomeValue;
  closingNotes?: string | null;
}

export interface RecordApplicationInput {
  applicationDate: string; // ISO date
  applicationTime?: string | null;
  responsibleName: string;
  notes?: string | null;
  deductStock?: boolean;
}

export interface SkipApplicationInput {
  notDoneReason: string;
}

export interface RecordEvolutionInput {
  evolutionDate: string; // ISO date
  evolutionType: EvolutionTypeValue;
  temperature?: number | null;
  observations?: string | null;
  veterinaryName?: string | null;
}

export interface ListTreatmentsQuery {
  animalId?: string;
  diseaseId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface ApplicationItem {
  id: string;
  treatmentId: string;
  productId: string | null;
  productName: string;
  dosage: number;
  dosageUnit: string;
  dosageUnitLabel: string;
  administrationRoute: string;
  administrationRouteLabel: string;
  scheduledDate: string;
  scheduledTime: string | null;
  applicationDate: string | null;
  applicationTime: string | null;
  status: ApplicationStatusValue;
  statusLabel: string;
  notDoneReason: string | null;
  responsibleName: string | null;
  stockOutputId: string | null;
  costCents: number;
  notes: string | null;
}

export interface EvolutionItem {
  id: string;
  treatmentId: string;
  evolutionDate: string;
  evolutionType: EvolutionTypeValue;
  evolutionTypeLabel: string;
  temperature: number | null;
  observations: string | null;
  veterinaryName: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface TreatmentItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  diseaseId: string | null;
  diseaseName: string;
  diagnosisDate: string;
  observedSeverity: string;
  severityLabel: string;
  clinicalObservations: string | null;
  veterinaryName: string;
  responsibleName: string;
  treatmentProtocolId: string | null;
  treatmentProtocolName: string | null;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  withdrawalEndDate: string | null;
  status: TreatmentStatusValue;
  statusLabel: string;
  outcome: TreatmentOutcomeValue | null;
  outcomeLabel: string | null;
  closedAt: string | null;
  closingNotes: string | null;
  totalCostCents: number;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  applications: ApplicationItem[];
  evolutions: EvolutionItem[];
  pendingApplicationsToday: number;
  createdAt: string;
}

export interface TreatmentListItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  diseaseName: string;
  diagnosisDate: string;
  observedSeverity: string;
  severityLabel: string;
  status: TreatmentStatusValue;
  statusLabel: string;
  outcome: TreatmentOutcomeValue | null;
  outcomeLabel: string | null;
  veterinaryName: string;
  treatmentProtocolName: string | null;
  totalCostCents: number;
  createdAt: string;
}

export interface PendingApplicationsResult {
  date: string;
  totalPending: number;
  treatments: Array<{
    treatmentId: string;
    animalEarTag: string;
    animalName: string | null;
    diseaseName: string;
    applications: ApplicationItem[];
  }>;
}
