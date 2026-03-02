// ─── Constants ──────────────────────────────────────────────────────

export const VALID_SEASON_TYPES = ['SAFRA', 'SAFRINHA', 'INVERNO'] as const;

export type SeasonType = (typeof VALID_SEASON_TYPES)[number];

// ─── Crop Season ────────────────────────────────────────────────────

export interface CreateCropSeasonInput {
  seasonType: string;
  seasonYear: string;
  crop: string;
  varietyName?: string;
  startDate?: string;
  endDate?: string;
  plantedAreaHa?: number;
  productivityKgHa?: number;
  totalProductionKg?: number;
  operations?: unknown[];
  notes?: string;
}

export interface UpdateCropSeasonInput {
  seasonType?: string;
  seasonYear?: string;
  crop?: string;
  varietyName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  plantedAreaHa?: number | null;
  productivityKgHa?: number | null;
  totalProductionKg?: number | null;
  operations?: unknown[];
  notes?: string | null;
}

export interface CropSeasonItem {
  id: string;
  plotId: string;
  farmId: string;
  seasonType: string;
  seasonYear: string;
  crop: string;
  varietyName: string | null;
  startDate: string | null;
  endDate: string | null;
  plantedAreaHa: number | null;
  productivityKgHa: number | null;
  totalProductionKg: number | null;
  operations: unknown[];
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

// ─── Soil Analysis ──────────────────────────────────────────────────

export interface CreateSoilAnalysisInput {
  analysisDate: string;
  labName?: string;
  sampleDepthCm?: string;
  phH2o?: number;
  organicMatterPct?: number;
  phosphorusMgDm3?: number;
  potassiumMgDm3?: number;
  calciumCmolcDm3?: number;
  magnesiumCmolcDm3?: number;
  aluminumCmolcDm3?: number;
  ctcCmolcDm3?: number;
  baseSaturationPct?: number;
  sulfurMgDm3?: number;
  clayContentPct?: number;
  notes?: string;
}

export interface UpdateSoilAnalysisInput {
  analysisDate?: string;
  labName?: string | null;
  sampleDepthCm?: string | null;
  phH2o?: number | null;
  organicMatterPct?: number | null;
  phosphorusMgDm3?: number | null;
  potassiumMgDm3?: number | null;
  calciumCmolcDm3?: number | null;
  magnesiumCmolcDm3?: number | null;
  aluminumCmolcDm3?: number | null;
  ctcCmolcDm3?: number | null;
  baseSaturationPct?: number | null;
  sulfurMgDm3?: number | null;
  clayContentPct?: number | null;
  notes?: string | null;
}

export interface SoilAnalysisItem {
  id: string;
  plotId: string;
  farmId: string;
  analysisDate: string;
  labName: string | null;
  sampleDepthCm: string | null;
  phH2o: number | null;
  organicMatterPct: number | null;
  phosphorusMgDm3: number | null;
  potassiumMgDm3: number | null;
  calciumCmolcDm3: number | null;
  magnesiumCmolcDm3: number | null;
  aluminumCmolcDm3: number | null;
  ctcCmolcDm3: number | null;
  baseSaturationPct: number | null;
  sulfurMgDm3: number | null;
  clayContentPct: number | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

// ─── Rotation Indicator ─────────────────────────────────────────────

export interface RotationIndicator {
  level: 0 | 1 | 2 | 3;
  label: string;
  description: string;
  uniqueCrops: string[];
  seasonsAnalyzed: number;
}
