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

export interface MonitoringRecordsResponse {
  data: MonitoringRecordItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

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

export interface HeatmapPoint {
  monitoringPointId: string;
  code: string;
  latitude: number;
  longitude: number;
  intensity: number;
  maxLevel: string;
  recordCount: number;
  topPests: Array<{ pestId: string; pestName: string; count: number }>;
}

export interface HeatmapResponse {
  data: HeatmapPoint[];
}

export const INFESTATION_LEVELS = [
  { value: 'AUSENTE', label: 'Ausente' },
  { value: 'BAIXO', label: 'Baixo' },
  { value: 'MODERADO', label: 'Moderado' },
  { value: 'ALTO', label: 'Alto' },
  { value: 'CRITICO', label: 'Crítico' },
] as const;

/* ─── Timeline (CA6) ────────────────────────────────────────────────── */

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

export interface TimelineResponse {
  data: TimelineDataPoint[];
  summary: TimelineSummary;
}

/* ─── Recommendations (CA7) ────────────────────────────────────────── */

export interface RecommendationAffectedPoint {
  monitoringPointId: string;
  code: string;
  latitude: number;
  longitude: number;
  currentLevel: string;
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
  urgency: 'ALERTA' | 'CRITICO';
  urgencyLabel: string;
  affectedPoints: RecommendationAffectedPoint[];
  affectedPointCount: number;
  maxLevel: string;
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

export interface RecommendationsResponse {
  data: RecommendationItem[];
  summary: RecommendationSummary;
}

export const GROWTH_STAGES = [
  'VE',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
  'V7',
  'V8',
  'V9',
  'V10',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R5.1',
  'R5.2',
  'R5.3',
  'R5.4',
  'R5.5',
  'R6',
  'R7',
  'R8',
  'R9',
] as const;
