/* ─── MIP Report (CA9) ─────────────────────────────────────────────── */

export interface ReportPlotSummary {
  id: string;
  name: string;
  monitoringPointCount: number;
  recordCount: number;
}

export interface ReportSummary {
  farmName: string;
  reportPeriod: { start: string; end: string };
  generatedAt: string;
  totalMonitoringPoints: number;
  totalPestsMonitored: number;
  totalMonitoringRecords: number;
  plotsIncluded: ReportPlotSummary[];
}

export interface ReportPestSummary {
  pestId: string;
  commonName: string;
  scientificName: string | null;
  category: string;
  categoryLabel: string;
  affectedCrops: string[];
  peakLevel: string;
  peakLevelLabel: string;
  firstDetected: string;
  lastDetected: string;
  recordCount: number;
  affectedPointCount: number;
  hasNaturalEnemies: boolean;
}

export interface ReportTimelineEntry {
  date: string;
  avgIntensity: number;
  recordCount: number;
}

export interface ReportControlDecision {
  date: string;
  urgency: string;
  urgencyLabel: string;
  affectedPointCount: number;
  maxLevel: string;
  maxLevelLabel: string;
  justification: string;
}

export interface ReportPestDetail {
  pestId: string;
  pestName: string;
  scientificName: string | null;
  category: string;
  timeline: ReportTimelineEntry[];
  trend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  trendLabel: string;
  controlDecisions: ReportControlDecision[];
  naturalEnemiesObserved: boolean;
  ndeDescription: string | null;
  ncDescription: string | null;
  recommendedProducts: string | null;
}

export interface MonitoringReportResponse {
  summary: ReportSummary;
  pestSummary: ReportPestSummary[];
  detailedAnalysis: ReportPestDetail[];
}
