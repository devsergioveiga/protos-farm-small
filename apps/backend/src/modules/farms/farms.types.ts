// ─── Error ──────────────────────────────────────────────────────────

export class FarmError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'FarmError';
  }
}

// ─── Constants ──────────────────────────────────────────────────────

export const VALID_UF = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const;

export const CIB_REGEX = /^\d{1,3}\.\d{3}\.\d{3}-\d$/;

export const LAND_CLASSIFICATIONS = ['MINIFUNDIO', 'PEQUENA', 'MEDIA', 'GRANDE'] as const;

export type LandClassification = (typeof LAND_CLASSIFICATIONS)[number];

// ─── Input types ────────────────────────────────────────────────────

export interface CreateFarmInput {
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
  fiscalModuleHa?: number;
  fiscalModulesCount?: number;
  minPartitionFraction?: number;
  appAreaHa?: number;
  legalReserveHa?: number;
  taxableAreaHa?: number;
  usableAreaHa?: number;
  utilizationDegree?: number;
  latitude?: number;
  longitude?: number;
  registrations?: CreateRegistrationInput[];
}

export interface UpdateFarmInput {
  name?: string;
  nickname?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  totalAreaHa?: number;
  cib?: string;
  incraCode?: string;
  carCode?: string;
  ccirCode?: string;
  landClassification?: string;
  productive?: boolean;
  fiscalModuleHa?: number;
  fiscalModulesCount?: number;
  minPartitionFraction?: number;
  appAreaHa?: number;
  legalReserveHa?: number;
  taxableAreaHa?: number;
  usableAreaHa?: number;
  utilizationDegree?: number;
  latitude?: number;
  longitude?: number;
}

export interface ListFarmsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  state?: string;
  minAreaHa?: number;
  maxAreaHa?: number;
}

export interface FarmListCaller {
  userId: string;
  role: string;
}

export interface CreateRegistrationInput {
  number: string;
  cnsCode?: string;
  cartorioName: string;
  comarca: string;
  state: string;
  livro?: string;
  registrationDate?: string;
  areaHa: number;
}

export interface UpdateRegistrationInput {
  number?: string;
  cnsCode?: string;
  cartorioName?: string;
  comarca?: string;
  state?: string;
  livro?: string;
  registrationDate?: string;
  areaHa?: number;
}

export interface DeleteFarmInput {
  confirmName: string;
}

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

// ─── Boundary Upload ─────────────────────────────────────────────────

export const ALLOWED_GEO_EXTENSIONS = ['.geojson', '.json', '.kml', '.kmz', '.zip'] as const;

export const MAX_GEO_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

export interface BoundaryInfo {
  hasBoundary: boolean;
  boundaryAreaHa: number | null;
  boundaryGeoJSON: GeoJSON.Polygon | null;
}

// ─── Field Plots ────────────────────────────────────────────────────

export const VALID_SOIL_TYPES = [
  'LATOSSOLO_VERMELHO',
  'LATOSSOLO_AMARELO',
  'ARGISSOLO',
  'NEOSSOLO',
  'CAMBISSOLO',
  'GLEISSOLO',
  'PLANOSSOLO',
  'NITOSSOLO',
  'OUTRO',
] as const;

export interface CreateFieldPlotInput {
  name: string;
  code?: string;
  soilType?: string;
  currentCrop?: string;
  previousCrop?: string;
  notes?: string;
  registrationId?: string;
}

export interface UpdateFieldPlotInput {
  name?: string;
  code?: string;
  soilType?: string | null;
  currentCrop?: string | null;
  previousCrop?: string | null;
  notes?: string | null;
  registrationId?: string | null;
}

export interface FieldPlotItem {
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

export interface CreateFieldPlotResult {
  plot: FieldPlotItem;
  warnings: string[];
}

// ─── Bulk Import ─────────────────────────────────────────────────────

export const MAX_BULK_FEATURES = 500;

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

export interface BulkImportInput {
  columnMapping: ColumnMapping;
  selectedIndices: number[];
  registrationId?: string;
  defaultName?: string;
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
