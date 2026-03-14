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
  administrationRoute: string;
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
  rotationStatus: 'ROTATED' | 'REPEATED' | 'CRITICAL' | null;
  stockOutputId: string | null;
  animalLotId: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface DewormingsResponse {
  data: DewormingItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateDewormingInput {
  animalId: string;
  productId?: string | null;
  productName: string;
  activeIngredient?: string | null;
  chemicalGroup?: string | null;
  dosageMl: number;
  administrationRoute: string;
  productBatchNumber?: string | null;
  productExpiryDate?: string | null;
  dewormingDate: string;
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
  administrationRoute: string;
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
  administrationRoute?: string;
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
    status: 'ROTATED' | 'REPEATED' | 'CRITICAL';
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

export interface DewormingAlert {
  dewormingId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  productName: string;
  nextDewormingDate: string;
  daysUntil: number;
}

export const ADMINISTRATION_ROUTES = [
  { value: 'IM', label: 'Intramuscular' },
  { value: 'SC', label: 'Subcutâneo' },
  { value: 'IV', label: 'Intravenoso' },
  { value: 'ORAL', label: 'Oral' },
  { value: 'INTRAMMARY', label: 'Intramamário' },
  { value: 'TOPICAL', label: 'Tópico' },
] as const;

export const ROTATION_STATUS_CONFIG = {
  ROTATED: { label: 'Rotacionado', className: 'rotation--rotated' },
  REPEATED: { label: 'Repetido', className: 'rotation--repeated' },
  CRITICAL: { label: '3x consecutivo', className: 'rotation--critical' },
} as const;
