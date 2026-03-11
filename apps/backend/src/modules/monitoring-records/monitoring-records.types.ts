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

// ─── Heatmap Types ──────────────────────────────────────────────────

export interface HeatmapQuery {
  pestId?: string;
  startDate?: string;
  endDate?: string;
}

export interface HeatmapPoint {
  monitoringPointId: string;
  code: string;
  latitude: number;
  longitude: number;
  intensity: number;
  maxLevel: InfestationLevel;
  recordCount: number;
  topPests: Array<{ pestId: string; pestName: string; count: number }>;
}

// ─── Timeline Types ────────────────────────────────────────────────

export interface TimelineQuery {
  pestIds?: string;
  startDate?: string;
  endDate?: string;
  aggregation?: 'daily' | 'weekly' | 'monthly';
}

export interface TimelinePestEntry {
  pestId: string;
  pestName: string;
  avgIntensity: number;
  maxLevel: string;
  recordCount: number;
}

export interface TimelineDataPoint {
  date: string;
  pests: TimelinePestEntry[];
}

export interface TimelineSummary {
  totalRecords: number;
  dateRange: { start: string; end: string };
  pestsFound: string[];
}

// ─── Recommendation Types ──────────────────────────────────────────

export interface RecommendationQuery {
  pestId?: string;
  urgency?: 'ALERTA' | 'CRITICO';
}

export type RecommendationUrgency = 'ALERTA' | 'CRITICO';

export const URGENCY_LABELS: Record<RecommendationUrgency, string> = {
  ALERTA: 'Alerta',
  CRITICO: 'Crítico',
};

export interface RecommendationAffectedPoint {
  monitoringPointId: string;
  code: string;
  latitude: number;
  longitude: number;
  currentLevel: InfestationLevel;
  currentLevelLabel: string;
  lastObservedAt: string;
  damagePercentage: number | null;
}

export interface RecommendationItem {
  pestId: string;
  pestName: string;
  pestCategory: string;
  pestCategoryLabel: string;
  severity: string | null;
  severityLabel: string | null;
  controlThreshold: string;
  controlThresholdLabel: string;
  ndeDescription: string | null;
  ncDescription: string | null;
  recommendedProducts: string | null;
  urgency: RecommendationUrgency;
  urgencyLabel: string;
  affectedPoints: RecommendationAffectedPoint[];
  affectedPointCount: number;
  maxLevel: InfestationLevel;
  maxLevelLabel: string;
  avgDamagePercentage: number | null;
  hasNaturalEnemies: boolean;
  trend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  trendLabel: string;
}

export interface RecommendationSummary {
  totalRecommendations: number;
  criticalCount: number;
  alertCount: number;
  totalAffectedPoints: number;
}

export const TREND_LABELS: Record<string, string> = {
  increasing: 'Em alta',
  stable: 'Estável',
  decreasing: 'Em queda',
  unknown: 'Sem dados suficientes',
};

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
