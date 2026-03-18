// ─── Error ──────────────────────────────────────────────────────────

export class DewormingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'DewormingError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const ADMINISTRATION_ROUTES = ['IM', 'SC', 'IV', 'ORAL', 'INTRAMMARY', 'TOPICAL'] as const;
export type AdministrationRouteValue = (typeof ADMINISTRATION_ROUTES)[number];

export const ADMINISTRATION_ROUTE_LABELS: Record<AdministrationRouteValue, string> = {
  IM: 'Intramuscular',
  SC: 'Subcutâneo',
  IV: 'Intravenoso',
  ORAL: 'Oral',
  INTRAMMARY: 'Intramamário',
  TOPICAL: 'Tópico',
};

export function isValidAdministrationRoute(value: string): value is AdministrationRouteValue {
  return ADMINISTRATION_ROUTES.includes(value as AdministrationRouteValue);
}

export const ROTATION_STATUS = ['ROTATED', 'REPEATED', 'CRITICAL'] as const;
export type RotationStatusValue = (typeof ROTATION_STATUS)[number];

export const ROTATION_STATUS_LABELS: Record<RotationStatusValue, string> = {
  ROTATED: 'Rotacionado',
  REPEATED: 'Repetido',
  CRITICAL: '3x consecutivo',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateDewormingInput {
  animalId: string;
  productId?: string | null;
  productName: string;
  activeIngredient?: string | null;
  chemicalGroup?: string | null;
  dosageMl: number;
  administrationRoute: AdministrationRouteValue;
  productBatchNumber?: string | null;
  productExpiryDate?: string | null; // ISO date
  dewormingDate: string; // ISO date
  responsibleName: string;
  veterinaryName?: string | null;
  protocolItemId?: string | null;
  opgPre?: number | null;
  notes?: string | null;
}

export interface BulkDewormInput {
  animalLotId: string;
  productId?: string | null;
  productName: string;
  activeIngredient?: string | null;
  chemicalGroup?: string | null;
  dosageMl: number;
  administrationRoute: AdministrationRouteValue;
  productBatchNumber?: string | null;
  productExpiryDate?: string | null;
  dewormingDate: string;
  responsibleName: string;
  veterinaryName?: string | null;
  protocolItemId?: string | null;
  opgPre?: number | null;
  notes?: string | null;
  deductStock?: boolean;
}

export interface UpdateDewormingInput {
  dosageMl?: number;
  administrationRoute?: AdministrationRouteValue;
  productBatchNumber?: string | null;
  productExpiryDate?: string | null;
  dewormingDate?: string;
  responsibleName?: string;
  veterinaryName?: string | null;
  opgPre?: number | null;
  opgPost?: number | null;
  opgPostDate?: string | null;
  notes?: string | null;
}

export interface ListDewormingsQuery {
  animalId?: string;
  campaignId?: string;
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface DewormingItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  productId: string | null;
  productName: string;
  activeIngredient: string | null;
  chemicalGroup: string | null;
  dosageMl: number;
  administrationRoute: AdministrationRouteValue;
  administrationRouteLabel: string;
  productBatchNumber: string | null;
  productExpiryDate: string | null;
  dewormingDate: string;
  responsibleName: string;
  veterinaryName: string | null;
  protocolItemId: string | null;
  campaignId: string | null;
  opgPre: number | null;
  opgPost: number | null;
  opgPostDate: string | null;
  efficacyPercentage: number | null;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  withdrawalEndDate: string | null;
  nextDewormingDate: string | null;
  rotationStatus: RotationStatusValue | null;
  stockOutputId: string | null;
  animalLotId: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface BulkDewormResult {
  campaignId: string;
  created: number;
  animalCount: number;
  stockOutputId: string | null;
  insufficientStockAlerts: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }>;
  rotationAlerts: Array<{
    animalId: string;
    animalEarTag: string;
    status: RotationStatusValue;
    chemicalGroup: string;
    consecutiveCount: number;
  }>;
}

export interface DewormingReportItem {
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  animalCategory: string;
  lotName: string | null;
  farmName: string;
  dewormingDate: string;
  productName: string;
  activeIngredient: string | null;
  chemicalGroup: string | null;
  dosageMl: number;
  administrationRoute: string;
  productBatchNumber: string | null;
  opgPre: number | null;
  responsibleName: string;
}

export interface DewormingReport {
  campaignId: string;
  productName: string;
  dewormingDate: string;
  farmName: string;
  totalAnimals: number;
  animals: DewormingReportItem[];
}
