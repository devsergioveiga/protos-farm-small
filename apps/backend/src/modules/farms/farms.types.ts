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
