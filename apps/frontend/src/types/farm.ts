export interface FarmLimitInfo {
  current: number;
  max: number;
  percentage: number;
  warning: boolean;
  blocked: boolean;
}

export interface FarmRegistration {
  id: string;
  farmId: string;
  number: string;
  cnsCode: string | null;
  cartorioName: string;
  comarca: string;
  state: string;
  livro: string | null;
  registrationDate: string | null;
  areaHa: number;
  boundaryAreaHa: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FarmListItem {
  id: string;
  name: string;
  nickname: string | null;
  city: string | null;
  state: string;
  totalAreaHa: number;
  boundaryAreaHa: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  landClassification: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  _count: {
    registrations: number;
    fieldPlots: number;
  };
}

export interface FarmDetail {
  id: string;
  name: string;
  nickname: string | null;
  address: string | null;
  city: string | null;
  state: string;
  zipCode: string | null;
  totalAreaHa: number;
  boundaryAreaHa: number | null;
  cib: string | null;
  incraCode: string | null;
  carCode: string | null;
  ccirCode: string | null;
  landClassification: string | null;
  productive: boolean | null;
  appAreaHa: number | null;
  legalReserveHa: number | null;
  taxableAreaHa: number | null;
  usableAreaHa: number | null;
  utilizationDegree: number | null;
  latitude: number | null;
  longitude: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  registrations: FarmRegistration[];
  createdAt: string;
  updatedAt: string;
}

export interface FarmsListResponse {
  data: FarmListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BoundaryInfo {
  hasBoundary: boolean;
  boundaryAreaHa: number | null;
  boundaryGeoJSON: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
}

export interface FieldPlot {
  id: string;
  farmId: string;
  registrationId: string | null;
  name: string;
  code: string | null;
  soilType: string | null;
  currentCrop: string | null;
  previousCrop: string | null;
  notes: string | null;
  boundaryAreaHa: number;
  status: string;
  createdAt: string;
}

export interface FieldPlotsSummary {
  totalPlotAreaHa: number;
  farmTotalAreaHa: number;
  unmappedAreaHa: number;
  plotCount: number;
}

// ─── Plot Boundary Edit ──────────────────────────────────────────────

export interface UpdatePlotBoundaryResult {
  boundaryAreaHa: number;
  previousAreaHa: number;
  warnings: string[];
}

export interface PlotBoundaryVersionItem {
  id: string;
  version: number;
  boundaryAreaHa: number;
  editedAt: string;
  editSource: string;
}

// ─── Boundary Versions ──────────────────────────────────────────

export interface BoundaryVersionItem {
  id: string;
  farmId: string;
  registrationId: string | null;
  boundaryAreaHa: number;
  uploadedBy: string;
  uploadedAt: string;
  filename: string | null;
  version: number;
}

export interface BoundaryVersionDetail extends BoundaryVersionItem {
  boundaryGeoJSON: GeoJSON.Polygon;
}

// ─── Bulk Import ─────────────────────────────────────────────────────

export interface BulkPreviewFeature {
  index: number;
  properties: Record<string, unknown>;
  polygon: GeoJSON.Polygon;
  areaHa: number;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
}

export interface BulkPreviewResult {
  filename: string;
  totalFeatures: number;
  validCount: number;
  invalidCount: number;
  propertyKeys: string[];
  features: BulkPreviewFeature[];
}

export interface ColumnMapping {
  name?: string;
  code?: string;
  soilType?: string;
  currentCrop?: string;
  previousCrop?: string;
  notes?: string;
}

export interface BulkImportResultItem {
  index: number;
  status: 'imported' | 'skipped';
  plotId?: string;
  name?: string;
  areaHa?: number;
  reason?: string;
}

export interface BulkImportResult {
  imported: number;
  skipped: number;
  items: BulkImportResultItem[];
  warnings: string[];
}

// ─── Create Plot ────────────────────────────────────────────────────

export interface CreatePlotPayload {
  name: string;
  code?: string;
  soilType?: string;
  currentCrop?: string;
  previousCrop?: string;
  notes?: string;
  registrationId?: string;
}

export interface CreatePlotResponse {
  plot: FieldPlot;
  warnings: string[];
}

// ─── Registrations ─────────────────────────────────────────────────

export interface CreateRegistrationPayload {
  number: string;
  cartorioName: string;
  comarca: string;
  state: string;
  areaHa: number;
  cnsCode?: string;
  livro?: string;
  registrationDate?: string;
}

export type UpdateRegistrationPayload = Partial<CreateRegistrationPayload>;

export interface AreaDivergence {
  divergent: boolean;
  percentage: number;
}

export interface RegistrationMutationResponse {
  id: string;
  farmId: string;
  number: string;
  cnsCode: string | null;
  cartorioName: string;
  comarca: string;
  state: string;
  livro: string | null;
  registrationDate: string | null;
  areaHa: number;
  areaDivergence: AreaDivergence | null;
}

export interface RegistrationDeleteResponse {
  message: string;
  areaDivergence: AreaDivergence | null;
}

// ─── Create Farm ────────────────────────────────────────────────────

export interface CreateFarmPayload {
  name: string;
  nickname?: string;
  address?: string;
  city?: string;
  state: string;
  zipCode?: string;
  totalAreaHa: number;
  cib?: string;
  incraCode?: string;
  carCode?: string;
  ccirCode?: string;
  landClassification?: string;
  productive?: boolean;
  appAreaHa?: number;
  legalReserveHa?: number;
  taxableAreaHa?: number;
  usableAreaHa?: number;
  utilizationDegree?: number;
}

export type UpdateFarmPayload = Partial<CreateFarmPayload>;

// ─── Plot History ───────────────────────────────────────────────────

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

export interface RotationIndicator {
  level: 0 | 1 | 2 | 3;
  label: string;
  description: string;
  uniqueCrops: string[];
  seasonsAnalyzed: number;
}

// ─── Create Crop Season ────────────────────────────────────────────

export interface CreateCropSeasonPayload {
  seasonType: string;
  seasonYear: string;
  crop: string;
  varietyName?: string;
  startDate?: string;
  endDate?: string;
  plantedAreaHa?: number;
  productivityKgHa?: number;
  totalProductionKg?: number;
  notes?: string;
}

// ─── Update Crop Season ────────────────────────────────────────────

export interface UpdateCropSeasonPayload {
  seasonType?: string;
  seasonYear?: string;
  crop?: string;
  varietyName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  plantedAreaHa?: number | null;
  productivityKgHa?: number | null;
  totalProductionKg?: number | null;
  notes?: string | null;
}

// ─── Create Soil Analysis ──────────────────────────────────────────

export interface CreateSoilAnalysisPayload {
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

// ─── Update Soil Analysis ─────────────────────────────────────────────

export interface UpdateSoilAnalysisPayload {
  analysisDate: string;
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

// ─── Boundary Upload ────────────────────────────────────────────────

export interface BoundaryUploadResult {
  boundaryAreaHa: number;
  areaDivergence: {
    referenceAreaHa: number;
    boundaryAreaHa: number;
    percentage: number;
    warning: boolean;
  } | null;
  warnings: string[];
}

// ─── Subdivide & Merge ──────────────────────────────────────────────

export interface SubdividePreviewResult {
  parts: Array<{ suggestedName: string; areaHa: number; geojson: GeoJSON.Polygon }>;
  originalAreaHa: number;
}

export interface SubdivideExecuteResult {
  plots: Array<{ id: string; name: string; boundaryAreaHa: number }>;
  archivedPlotId: string;
}

export interface MergePreviewResult {
  mergedGeojson: GeoJSON.Polygon;
  mergedAreaHa: number;
  sourcePlots: Array<{ id: string; name: string; areaHa: number }>;
  suggestedName: string;
}

export interface MergeExecuteResult {
  plot: { id: string; name: string; boundaryAreaHa: number };
  archivedPlotIds: string[];
}
