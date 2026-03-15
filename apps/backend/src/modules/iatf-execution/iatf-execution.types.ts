// ─── Error ──────────────────────────────────────────────────────────

export class IatfExecutionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'IatfExecutionError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const LOT_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type LotStatusValue = (typeof LOT_STATUSES)[number];

export const LOT_STATUS_LABELS: Record<LotStatusValue, string> = {
  ACTIVE: 'Ativo',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export const STEP_STATUSES = ['PENDING', 'DONE', 'SKIPPED'] as const;
export type StepStatusValue = (typeof STEP_STATUSES)[number];

export const STEP_STATUS_LABELS: Record<StepStatusValue, string> = {
  PENDING: 'Pendente',
  DONE: 'Realizado',
  SKIPPED: 'Pulado',
};

export const INSEMINATION_TYPES = ['IATF', 'NATURAL_HEAT', 'HEAT_DURING_PROTOCOL'] as const;
export type InseminationTypeValue = (typeof INSEMINATION_TYPES)[number];

export const INSEMINATION_TYPE_LABELS: Record<InseminationTypeValue, string> = {
  IATF: 'IATF',
  NATURAL_HEAT: 'Cio natural',
  HEAT_DURING_PROTOCOL: 'Cio durante protocolo',
};

export const CERVICAL_MUCUS_TYPES = [
  'CRYSTALLINE',
  'CLOUDY',
  'BLOODY',
  'PURULENT',
  'ABSENT',
] as const;
export type CervicalMucusValue = (typeof CERVICAL_MUCUS_TYPES)[number];

export const CERVICAL_MUCUS_LABELS: Record<CervicalMucusValue, string> = {
  CRYSTALLINE: 'Cristalino',
  CLOUDY: 'Turvo',
  BLOODY: 'Sanguinolento',
  PURULENT: 'Purulento',
  ABSENT: 'Ausente',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateLotInput {
  name: string;
  protocolId: string;
  d0Date: string; // ISO date
  animalIds: string[];
  notes?: string | null;
}

export interface ExecuteStepInput {
  responsibleName?: string | null;
  notes?: string | null;
}

export interface RecordInseminationInput {
  animalId: string;
  lotStepId?: string | null;
  inseminationType: InseminationTypeValue;
  bullId?: string | null;
  semenBatchId?: string | null;
  dosesUsed?: number;
  inseminatorName: string;
  inseminationDate: string; // ISO date
  inseminationTime?: string | null; // HH:MM
  cervicalMucus?: CervicalMucusValue | null;
  heatRecordId?: string | null;
  substitutionReason?: string | null;
  observations?: string | null;
}

export interface ListLotsQuery {
  status?: LotStatusValue;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListInseminationsQuery {
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
  inseminationType?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface InseminationItem {
  id: string;
  organizationId: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  lotStepId: string | null;
  inseminationType: string;
  inseminationTypeLabel: string;
  bullId: string | null;
  bullName: string | null;
  semenBatchId: string | null;
  semenBatchNumber: string | null;
  dosesUsed: number;
  inseminatorName: string;
  inseminationDate: string;
  inseminationTime: string | null;
  cervicalMucus: string | null;
  cervicalMucusLabel: string | null;
  heatRecordId: string | null;
  matingPairId: string | null;
  plannedBullId: string | null;
  wasPlannedBull: boolean | null;
  substitutionReason: string | null;
  observations: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface LotStepItem {
  id: string;
  lotId: string;
  protocolStepId: string | null;
  dayNumber: number;
  dayLabel: string;
  scheduledDate: string;
  description: string;
  isAiDay: boolean;
  status: StepStatusValue;
  statusLabel: string;
  executedAt: string | null;
  responsibleName: string | null;
  notes: string | null;
  inseminations: InseminationItem[];
}

export interface LotAnimalItem {
  id: string;
  lotId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  removedAt: string | null;
  removalReason: string | null;
}

export interface ReproductiveLotItem {
  id: string;
  organizationId: string;
  farmId: string;
  name: string;
  protocolId: string;
  protocolName: string;
  d0Date: string;
  status: LotStatusValue;
  statusLabel: string;
  totalCostCents: number;
  notes: string | null;
  animalsCount: number;
  stepsCount: number;
  createdBy: string;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LotDetailItem extends ReproductiveLotItem {
  animals: LotAnimalItem[];
  steps: LotStepItem[];
}

export interface UpcomingStepItem {
  stepId: string;
  lotId: string;
  lotName: string;
  dayNumber: number;
  dayLabel: string;
  scheduledDate: string;
  description: string;
  isAiDay: boolean;
  animalsCount: number;
}
