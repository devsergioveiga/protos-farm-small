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
  owners: PropertyOwner[];
  titles: PropertyTitle[];
}

export interface PropertyOwner {
  id: string;
  name: string;
  document: string | null;
  documentType: string | null;
  fractionPct: number | null;
  ownerType: string;
}

export interface PropertyTitle {
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

export interface CreateRuralPropertyPayload {
  denomination: string;
  cib?: string;
  incraCode?: string;
  ccirCode?: string;
  ccirValidUntil?: string;
  ccirIssuedAt?: string;
  ccirGeneratedAt?: string;
  carCode?: string;
  totalAreaHa?: number;
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
  ccirPaymentStatus?: string;
  registeredAreaHa?: number;
  possessionByTitleHa?: number;
  possessionByOccupationHa?: number;
  measuredAreaHa?: number;
}

export type UpdateRuralPropertyPayload = Partial<CreateRuralPropertyPayload>;

export interface CreateOwnerPayload {
  name: string;
  document?: string;
  documentType?: string;
  fractionPct?: number;
  ownerType?: string;
}

export type UpdateOwnerPayload = Partial<CreateOwnerPayload>;

export const LAND_CLASSIFICATIONS = ['MINIFUNDIO', 'PEQUENA', 'MEDIA', 'GRANDE'] as const;

export const OWNER_TYPES = [
  { value: 'PROPRIETARIO', label: 'Proprietário' },
  { value: 'USUFRUTUARIO', label: 'Usufrutuário' },
  { value: 'POSSUIDOR', label: 'Possuidor' },
  { value: 'CESSIONARIO', label: 'Cessionário' },
  { value: 'HERDEIRO', label: 'Herdeiro' },
  { value: 'CONDOMINO', label: 'Condômino' },
] as const;

export const DOCUMENT_TYPES = [
  { value: 'CAFIR', label: 'CAFIR' },
  { value: 'CCIR', label: 'CCIR' },
  { value: 'CNIR', label: 'CNIR' },
  { value: 'DITR', label: 'DITR' },
  { value: 'CAR_RECEIPT', label: 'Comprovante CAR' },
  { value: 'OTHER', label: 'Outro' },
] as const;

export const CLASSIFICATION_LABELS: Record<string, string> = {
  MINIFUNDIO: 'Minifúndio',
  PEQUENA: 'Pequena',
  MEDIA: 'Média',
  GRANDE: 'Grande',
};
