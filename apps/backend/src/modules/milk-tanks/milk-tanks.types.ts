// ─── Error ──────────────────────────────────────────────────────────

export class MilkTankError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MilkTankError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const DIVERGENCE_THRESHOLD = 5; // percent

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateTankInput {
  name: string;
  capacityLiters: number;
  location?: string | null;
  serialNumber?: string | null;
}

export interface UpdateTankInput {
  name?: string;
  capacityLiters?: number;
  location?: string | null;
  serialNumber?: string | null;
  isActive?: boolean;
}

export interface CreateMeasurementInput {
  measureDate: string; // ISO date
  volumeLiters: number;
}

export interface CreateCollectionInput {
  tankId?: string | null;
  collectionDate: string; // ISO date
  collectionTime?: string | null;
  dairyCompany: string;
  driverName?: string | null;
  volumeLiters: number;
  sampleCollected?: boolean;
  milkTemperature?: number | null;
  ticketNumber?: string | null;
  pricePerLiter?: number | null;
  grossValue?: number | null;
  qualityDiscount?: number | null;
  freightDiscount?: number | null;
  otherDiscounts?: number | null;
  netValue?: number | null;
  notes?: string | null;
}

export interface UpdateCollectionInput {
  tankId?: string | null;
  collectionTime?: string | null;
  dairyCompany?: string;
  driverName?: string | null;
  volumeLiters?: number;
  sampleCollected?: boolean;
  milkTemperature?: number | null;
  ticketNumber?: string | null;
  pricePerLiter?: number | null;
  grossValue?: number | null;
  qualityDiscount?: number | null;
  freightDiscount?: number | null;
  otherDiscounts?: number | null;
  netValue?: number | null;
  notes?: string | null;
}

export interface ListCollectionsQuery {
  dateFrom?: string;
  dateTo?: string;
  dairyCompany?: string;
  divergenceAlert?: boolean;
  page?: number;
  limit?: number;
}

export interface ListMeasurementsQuery {
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface TankItem {
  id: string;
  farmId: string;
  name: string;
  capacityLiters: number;
  location: string | null;
  serialNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeasurementItem {
  id: string;
  tankId: string;
  tankName: string;
  measureDate: string;
  volumeLiters: number;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface CollectionItem {
  id: string;
  farmId: string;
  tankId: string | null;
  tankName: string | null;
  collectionDate: string;
  collectionTime: string | null;
  dairyCompany: string;
  driverName: string | null;
  volumeLiters: number;
  sampleCollected: boolean;
  milkTemperature: number | null;
  ticketNumber: string | null;
  ticketPhotoPath: string | null;
  ticketPhotoName: string | null;
  productionLiters: number | null;
  divergencePercent: number | null;
  divergenceAlert: boolean;
  pricePerLiter: number | null;
  grossValue: number | null;
  qualityDiscount: number | null;
  freightDiscount: number | null;
  otherDiscounts: number | null;
  netValue: number | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationItem {
  date: string;
  productionLiters: number;
  collectionLiters: number;
  tankVolumeLiters: number | null;
  divergencePercent: number | null;
  divergenceAlert: boolean;
}

export interface MonthlyReportItem {
  month: string; // YYYY-MM
  totalVolumeDelivered: number;
  collectionCount: number;
  avgPricePerLiter: number | null;
  grossValue: number;
  qualityDiscount: number;
  freightDiscount: number;
  otherDiscounts: number;
  totalDiscounts: number;
  netValue: number;
}
