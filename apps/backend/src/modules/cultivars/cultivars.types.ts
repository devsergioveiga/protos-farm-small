// ─── Error ──────────────────────────────────────────────────────────

export class CultivarError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'CultivarError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const CULTIVAR_TYPES = ['CONVENCIONAL', 'TRANSGENICO'] as const;

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateCultivarInput {
  name: string;
  crop: string;
  breeder?: string | null;
  cycleDays?: number | null;
  maturationGroup?: string | null;
  type?: string;
  technology?: string | null;
  diseaseTolerances?: string | null;
  regionalAptitude?: string | null;
  populationRecommendation?: string | null;
  plantingWindowStart?: string | null;
  plantingWindowEnd?: string | null;
  notes?: string | null;
}

export type UpdateCultivarInput = Partial<CreateCultivarInput>;

export interface ListCultivarsQuery {
  page?: number;
  limit?: number;
  crop?: string;
  search?: string;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface CultivarItem {
  id: string;
  organizationId: string;
  name: string;
  crop: string;
  breeder: string | null;
  cycleDays: number | null;
  maturationGroup: string | null;
  type: string;
  technology: string | null;
  diseaseTolerances: string | null;
  regionalAptitude: string | null;
  populationRecommendation: string | null;
  plantingWindowStart: string | null;
  plantingWindowEnd: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Productivity Comparison Types ──────────────────────────────────

export interface CultivarProductivityEntry {
  seasonYear: string;
  seasonType: string;
  plotName: string;
  plotId: string;
  plantedAreaHa: number | null;
  productivityKgHa: number | null;
  totalProductionKg: number | null;
  notes: string | null;
}

export interface CultivarProductivityComparison {
  cultivarId: string;
  cultivarName: string;
  crop: string;
  avgProductivityKgHa: number | null;
  totalPlantings: number;
  entries: CultivarProductivityEntry[];
}

export interface CultivarPlotHistory {
  plotId: string;
  plotName: string;
  seasons: {
    seasonYear: string;
    seasonType: string;
    cultivarId: string | null;
    cultivarName: string | null;
    productivityKgHa: number | null;
    totalProductionKg: number | null;
    notes: string | null;
  }[];
}
