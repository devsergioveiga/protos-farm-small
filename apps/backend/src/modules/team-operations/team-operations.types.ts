// ─── Error ──────────────────────────────────────────────────────────

export class TeamOperationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'TeamOperationError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const TEAM_OPERATION_TYPES = [
  'PULVERIZACAO',
  'ADUBACAO',
  'PLANTIO',
  'COLHEITA',
  'IRRIGACAO',
  'MANEJO_PASTO',
  'VACINACAO',
  'VERMIFUGACAO',
  'INSEMINACAO',
  'MOVIMENTACAO',
  'PESAGEM',
  'OUTRO',
] as const;

export const TEAM_OPERATION_TYPE_LABELS: Record<string, string> = {
  PULVERIZACAO: 'Pulverização',
  ADUBACAO: 'Adubação',
  PLANTIO: 'Plantio',
  COLHEITA: 'Colheita',
  IRRIGACAO: 'Irrigação',
  MANEJO_PASTO: 'Manejo de pasto',
  VACINACAO: 'Vacinação',
  VERMIFUGACAO: 'Vermifugação',
  INSEMINACAO: 'Inseminação',
  MOVIMENTACAO: 'Movimentação',
  PESAGEM: 'Pesagem',
  OUTRO: 'Outro',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface TeamOperationEntryInput {
  userId: string;
  hoursWorked?: number | null;
  productivity?: number | null;
  productivityUnit?: string | null;
  notes?: string | null;
}

export interface CreateTeamOperationInput {
  fieldPlotId: string;
  teamId: string;
  operationType: string;
  performedAt: string;
  timeStart: string;
  timeEnd: string;
  memberIds: string[];
  entries?: TeamOperationEntryInput[];
  notes?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// ─── Report Types ──────────────────────────────────────────────────

export interface PlotLaborCostItem {
  fieldPlotId: string;
  fieldPlotName: string;
  operationCount: number;
  totalHours: number;
  totalLaborCost: number;
  entries: number;
}

export interface TimesheetEntry {
  date: string;
  userId: string;
  userName: string;
  userEmail: string;
  hourlyRate: number | null;
  operationCount: number;
  totalHours: number;
  totalLaborCost: number | null;
  operations: Array<{
    operationId: string;
    operationType: string;
    operationTypeLabel: string;
    fieldPlotName: string;
    timeStart: string;
    timeEnd: string;
    hoursWorked: number;
  }>;
}

// ─── Productivity Types ─────────────────────────────────────────────

export type ProductivityStatus = 'above' | 'on_target' | 'below' | null;

export interface ProductivityRankingEntry {
  userId: string;
  userName: string;
  userEmail: string;
  totalProductivity: number;
  productivityUnit: string;
  totalHoursWorked: number;
  productivityPerHour: number;
  operationCount: number;
  rank: number;
  targetValue: number | null;
  targetPercentage: number | null;
  status: ProductivityStatus;
}

export interface BonificationEntry {
  userId: string;
  userName: string;
  userEmail: string;
  operationType: string;
  operationTypeLabel: string;
  totalProductivity: number;
  productivityUnit: string;
  ratePerUnit: number;
  bonificationValue: number;
  operationCount: number;
}

export interface BonificationSummary {
  entries: BonificationEntry[];
  totalBonification: number;
  period: { dateFrom: string | null; dateTo: string | null };
}

export interface ProductivityHistoryEntry {
  period: string;
  totalProductivity: number;
  productivityUnit: string;
  totalHoursWorked: number;
  productivityPerHour: number;
  operationCount: number;
}

// ─── Edit Types ────────────────────────────────────────────────────

export interface AddMemberInput {
  userId: string;
  justification: string;
  hoursWorked?: number | null;
  productivity?: number | null;
  productivityUnit?: string | null;
  notes?: string | null;
}

export interface RemoveMemberInput {
  justification: string;
}

export interface UpdateEntryInput {
  hoursWorked?: number | null;
  productivity?: number | null;
  productivityUnit?: string | null;
  notes?: string | null;
  justification: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface TeamOperationEntryItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  hoursWorked: number | null;
  productivity: number | null;
  productivityUnit: string | null;
  notes: string | null;
  hourlyRate: number | null;
  laborCost: number | null;
}

export interface TeamOperationItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  fieldPlotName: string;
  teamId: string;
  teamName: string;
  operationType: string;
  operationTypeLabel: string;
  performedAt: string;
  timeStart: string;
  timeEnd: string;
  durationHours: number;
  notes: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  entryCount: number;
  entries: TeamOperationEntryItem[];
  totalLaborCost: number | null;
  totalProductivity: number | null;
  productivityUnit: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}
