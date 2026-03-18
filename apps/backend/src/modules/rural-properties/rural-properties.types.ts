// ─── Error ──────────────────────────────────────────────────────────

export class RuralPropertyError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'RuralPropertyError';
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

export const OWNER_TYPES = [
  'PROPRIETARIO',
  'USUFRUTUARIO',
  'POSSUIDOR',
  'CESSIONARIO',
  'HERDEIRO',
  'CONDOMINO',
] as const;

export const DOCUMENT_TYPES = [
  'CAFIR',
  'CCIR',
  'CNIR',
  'DITR',
  'CAR_RECEIPT',
  'MATRICULA',
  'OTHER',
] as const;

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_DOCUMENT_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

// ─── Input types ────────────────────────────────────────────────────

export interface CreateRuralPropertyInput {
  denomination: string;
  cib?: string;
  incraCode?: string;
  ccirCode?: string;
  ccirValidUntil?: string;
  ccirIssuedAt?: string;
  ccirGeneratedAt?: string;
  ccirPaymentStatus?: string;
  carCode?: string;
  totalAreaHa?: number;
  registeredAreaHa?: number;
  possessionByTitleHa?: number;
  possessionByOccupationHa?: number;
  measuredAreaHa?: number;
  certifiedAreaHa?: number;
  landClassification?: string;
  productive?: boolean;
  locationDirections?: string;
  lastProcessingDate?: string;
  fiscalModuleHa?: number;
  fiscalModulesCount?: number;
  ruralModuleHa?: number;
  ruralModulesCount?: number;
  minPartitionFraction?: number;
  vtnPerHa?: number;
  appAreaHa?: number;
  legalReserveHa?: number;
  taxableAreaHa?: number;
  usableAreaHa?: number;
  utilizationDegree?: number;
  municipality?: string;
  state?: string;
}

export interface UpdateRuralPropertyInput {
  denomination?: string;
  cib?: string;
  incraCode?: string;
  ccirCode?: string;
  ccirValidUntil?: string;
  ccirIssuedAt?: string;
  ccirGeneratedAt?: string;
  ccirPaymentStatus?: string;
  carCode?: string;
  totalAreaHa?: number;
  registeredAreaHa?: number;
  possessionByTitleHa?: number;
  possessionByOccupationHa?: number;
  measuredAreaHa?: number;
  certifiedAreaHa?: number;
  landClassification?: string;
  productive?: boolean;
  locationDirections?: string;
  lastProcessingDate?: string;
  fiscalModuleHa?: number;
  fiscalModulesCount?: number;
  ruralModuleHa?: number;
  ruralModulesCount?: number;
  minPartitionFraction?: number;
  vtnPerHa?: number;
  appAreaHa?: number;
  legalReserveHa?: number;
  taxableAreaHa?: number;
  usableAreaHa?: number;
  utilizationDegree?: number;
  municipality?: string;
  state?: string;
}

export interface CreateOwnerInput {
  name: string;
  document?: string;
  documentType?: string;
  fractionPct?: number;
  ownerType?: string;
}

export interface UpdateOwnerInput {
  name?: string;
  document?: string;
  documentType?: string;
  fractionPct?: number;
  ownerType?: string;
}

export interface UploadDocumentInput {
  type: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  fileData: Buffer;
}

// ─── Output types ───────────────────────────────────────────────────

export interface RuralPropertyItem {
  id: string;
  farmId: string;
  denomination: string;
  cib: string | null;
  incraCode: string | null;
  ccirCode: string | null;
  ccirValidUntil: string | null;
  carCode: string | null;
  totalAreaHa: number | null;
  landClassification: string | null;
  productive: boolean | null;
  municipality: string | null;
  state: string | null;
  boundaryAreaHa: number | null;
  titlesCount: number;
  ownersCount: number;
  documentsCount: number;
  createdAt: string;
}

export interface RuralPropertyDetail extends RuralPropertyItem {
  ccirIssuedAt: string | null;
  ccirGeneratedAt: string | null;
  ccirPaymentStatus: string | null;
  registeredAreaHa: number | null;
  possessionByTitleHa: number | null;
  possessionByOccupationHa: number | null;
  measuredAreaHa: number | null;
  certifiedAreaHa: number | null;
  locationDirections: string | null;
  lastProcessingDate: string | null;
  fiscalModuleHa: number | null;
  fiscalModulesCount: number | null;
  ruralModuleHa: number | null;
  ruralModulesCount: number | null;
  minPartitionFraction: number | null;
  vtnPerHa: number | null;
  appAreaHa: number | null;
  legalReserveHa: number | null;
  taxableAreaHa: number | null;
  usableAreaHa: number | null;
  utilizationDegree: number | null;
  owners: OwnerItem[];
  titles: TitleItem[];
}

export interface OwnerItem {
  id: string;
  name: string;
  document: string | null;
  documentType: string | null;
  fractionPct: number | null;
  ownerType: string;
}

export interface TitleItem {
  id: string;
  number: string;
  cartorioName: string;
  comarca: string;
  state: string;
  areaHa: number;
}

export interface PropertyDocumentItem {
  id: string;
  type: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  extractionStatus: string;
  extractedData: unknown;
  uploadedAt: string;
  uploadedBy: string | null;
}
