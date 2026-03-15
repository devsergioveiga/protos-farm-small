// ─── Error ──────────────────────────────────────────────────────────

export class VaccinationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'VaccinationError';
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

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateVaccinationInput {
  animalId: string;
  productId?: string | null;
  productName: string;
  dosageMl: number;
  administrationRoute: AdministrationRouteValue;
  productBatchNumber?: string | null;
  productExpiryDate?: string | null; // ISO date
  vaccinationDate: string; // ISO date
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
  administrationRoute: AdministrationRouteValue;
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
  administrationRoute?: AdministrationRouteValue;
  productBatchNumber?: string | null;
  productExpiryDate?: string | null;
  vaccinationDate?: string;
  responsibleName?: string;
  veterinaryName?: string | null;
  notes?: string | null;
}

export interface ListVaccinationsQuery {
  animalId?: string;
  campaignId?: string;
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface VaccinationItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  productId: string | null;
  productName: string;
  dosageMl: number;
  administrationRoute: AdministrationRouteValue;
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
