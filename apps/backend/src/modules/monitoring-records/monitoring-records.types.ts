// ─── Error ──────────────────────────────────────────────────────────

export class MonitoringRecordError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MonitoringRecordError';
  }
}

// ─── Enums ──────────────────────────────────────────────────────────

export const INFESTATION_LEVELS = ['AUSENTE', 'BAIXO', 'MODERADO', 'ALTO', 'CRITICO'] as const;

export type InfestationLevel = (typeof INFESTATION_LEVELS)[number];

export const INFESTATION_LEVEL_LABELS: Record<InfestationLevel, string> = {
  AUSENTE: 'Ausente',
  BAIXO: 'Baixo',
  MODERADO: 'Moderado',
  ALTO: 'Alto',
  CRITICO: 'Crítico',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateMonitoringRecordInput {
  monitoringPointId: string;
  pestId: string;
  observedAt: string;
  infestationLevel: string;
  sampleCount?: number | null;
  pestCount?: number | null;
  growthStage?: string | null;
  hasNaturalEnemies?: boolean;
  naturalEnemiesDesc?: string | null;
  damagePercentage?: number | null;
  photoUrl?: string | null;
  notes?: string | null;
}

export interface UpdateMonitoringRecordInput {
  pestId?: string;
  observedAt?: string;
  infestationLevel?: string;
  sampleCount?: number | null;
  pestCount?: number | null;
  growthStage?: string | null;
  hasNaturalEnemies?: boolean;
  naturalEnemiesDesc?: string | null;
  damagePercentage?: number | null;
  photoUrl?: string | null;
  notes?: string | null;
}

export interface ListMonitoringRecordsQuery {
  page?: number;
  limit?: number;
  monitoringPointId?: string;
  pestId?: string;
  infestationLevel?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface MonitoringRecordItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  monitoringPointId: string;
  monitoringPointCode: string;
  pestId: string;
  pestName: string;
  pestCategory: string;
  observedAt: string;
  infestationLevel: string;
  infestationLevelLabel: string;
  sampleCount: number | null;
  pestCount: number | null;
  growthStage: string | null;
  hasNaturalEnemies: boolean;
  naturalEnemiesDesc: string | null;
  damagePercentage: number | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
