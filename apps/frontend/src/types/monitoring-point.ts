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

export interface MonitoringPointsResponse {
  data: MonitoringPointItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GenerateGridInput {
  fieldPlotId: string;
  spacingMeters: number;
}

export interface GenerateGridResponse {
  data: MonitoringPointItem[];
  total: number;
}
