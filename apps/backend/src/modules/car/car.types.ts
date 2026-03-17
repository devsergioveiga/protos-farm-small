// ─── Error ──────────────────────────────────────────────────────────

export class CarError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'CarError';
  }
}

// ─── Constants ──────────────────────────────────────────────────────

export const CAR_STATUSES = ['ATIVO', 'PENDENTE', 'CANCELADO', 'SUSPENSO'] as const;

export type CarStatusType = (typeof CAR_STATUSES)[number];

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

export const ALLOWED_GEO_EXTENSIONS = ['.geojson', '.json', '.kml', '.kmz', '.zip'] as const;

export const MAX_GEO_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Input types ────────────────────────────────────────────────────

export interface CreateCarInput {
  carCode: string;
  ruralPropertyId?: string | null;
  status?: string;
  inscriptionDate?: string;
  lastRectificationDate?: string;
  areaHa?: number;
  modulosFiscais?: number;
  city?: string;
  state?: string;
  nativeVegetationHa?: number;
  consolidatedAreaHa?: number;
  administrativeEasementHa?: number;
  legalReserveRecordedHa?: number;
  legalReserveApprovedHa?: number;
  legalReserveProposedHa?: number;
  appTotalHa?: number;
  appConsolidatedHa?: number;
  appNativeVegetationHa?: number;
  restrictedUseHa?: number;
  legalReserveSurplusDeficit?: number;
  legalReserveToRestoreHa?: number;
  appToRestoreHa?: number;
  restrictedUseToRestoreHa?: number;
  registrationIds?: string[];
}

export interface UpdateCarInput {
  carCode?: string;
  ruralPropertyId?: string | null;
  status?: string;
  inscriptionDate?: string;
  lastRectificationDate?: string;
  areaHa?: number;
  modulosFiscais?: number;
  city?: string;
  state?: string;
  nativeVegetationHa?: number;
  consolidatedAreaHa?: number;
  administrativeEasementHa?: number;
  legalReserveRecordedHa?: number;
  legalReserveApprovedHa?: number;
  legalReserveProposedHa?: number;
  appTotalHa?: number;
  appConsolidatedHa?: number;
  appNativeVegetationHa?: number;
  restrictedUseHa?: number;
  legalReserveSurplusDeficit?: number;
  legalReserveToRestoreHa?: number;
  appToRestoreHa?: number;
  restrictedUseToRestoreHa?: number;
  registrationIds?: string[];
}

// ─── Output types ───────────────────────────────────────────────────

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
