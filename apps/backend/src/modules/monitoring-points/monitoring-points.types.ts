// ─── Error ──────────────────────────────────────────────────────────

export class MonitoringPointError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MonitoringPointError';
  }
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateMonitoringPointInput {
  fieldPlotId: string;
  code: string;
  latitude: number;
  longitude: number;
  notes?: string | null;
}

export interface UpdateMonitoringPointInput {
  code?: string;
  latitude?: number;
  longitude?: number;
  notes?: string | null;
}

export interface ListMonitoringPointsQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface GenerateGridInput {
  fieldPlotId: string;
  spacingMeters: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface MonitoringPointItem {
  id: string;
  farmId: string;
  fieldPlotId: string;
  code: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
