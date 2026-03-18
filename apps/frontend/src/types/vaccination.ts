export interface VaccinationItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  productId: string | null;
  productName: string;
  dosageMl: number;
  administrationRoute: string;
  administrationRouteLabel: string;
  productBatchNumber: string | null;
  productExpiryDate: string | null;
  vaccinationDate: string;
  responsibleName: string;
  veterinaryName: string | null;
  protocolItemId: string | null;
  campaignId: string | null;
  doseNumber: number;
  nextDoseDate: string | null;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  withdrawalEndDate: string | null;
  stockOutputId: string | null;
  animalLotId: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface VaccinationsResponse {
  data: VaccinationItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateVaccinationInput {
  animalId: string;
  productId?: string | null;
  productName: string;
  dosageMl: number;
  administrationRoute: string;
  productBatchNumber?: string | null;
  productExpiryDate?: string | null;
  vaccinationDate: string;
  responsibleName: string;
  veterinaryName?: string | null;
  protocolItemId?: string | null;
  doseNumber?: number;
  notes?: string | null;
}

export interface BulkVaccinateInput {
  animalLotId: string;
  productId?: string | null;
  productName: string;
  dosageMl: number;
  administrationRoute: string;
  productBatchNumber?: string | null;
  productExpiryDate?: string | null;
  vaccinationDate: string;
  responsibleName: string;
  veterinaryName?: string | null;
  protocolItemId?: string | null;
  doseNumber?: number;
  notes?: string | null;
  deductStock?: boolean;
}

export interface UpdateVaccinationInput {
  dosageMl?: number;
  administrationRoute?: string;
  productBatchNumber?: string | null;
  productExpiryDate?: string | null;
  vaccinationDate?: string;
  responsibleName?: string;
  veterinaryName?: string | null;
  notes?: string | null;
}

export interface BulkVaccinateResult {
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
}

export interface VaccinationReportItem {
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  animalCategory: string;
  lotName: string | null;
  farmName: string;
  vaccinationDate: string;
  productName: string;
  dosageMl: number;
  administrationRoute: string;
  productBatchNumber: string | null;
  doseNumber: number;
  responsibleName: string;
}

export interface VaccinationReport {
  campaignId: string;
  productName: string;
  vaccinationDate: string;
  farmName: string;
  totalAnimals: number;
  animals: VaccinationReportItem[];
}

export const ADMINISTRATION_ROUTES = [
  { value: 'IM', label: 'Intramuscular' },
  { value: 'SC', label: 'Subcutâneo' },
  { value: 'IV', label: 'Intravenoso' },
  { value: 'ORAL', label: 'Oral' },
  { value: 'INTRAMMARY', label: 'Intramamário' },
  { value: 'TOPICAL', label: 'Tópico' },
] as const;
