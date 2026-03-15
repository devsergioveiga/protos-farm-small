export interface TankItem {
  id: string;
  name: string;
  capacityLiters: number;
  location: string | null;
  serialNumber: string | null;
  isActive: boolean;
}

export interface TanksResponse {
  data: TankItem[];
}

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
  ticketPhotoUrl: string | null;
  productionLiters: number | null;
  divergencePercent: number | null;
  divergenceAlert: boolean;
  pricePerLiter: number | null;
  grossValue: number | null;
  qualityDiscount: number | null;
  freightDiscount: number | null;
  netValue: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CollectionsResponse {
  data: CollectionItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateCollectionInput {
  tankId?: string | null;
  collectionDate: string;
  collectionTime?: string | null;
  dairyCompany: string;
  driverName?: string | null;
  volumeLiters: number;
  sampleCollected?: boolean;
  milkTemperature?: number | null;
  ticketNumber?: string | null;
  pricePerLiter?: number | null;
  qualityDiscount?: number | null;
  freightDiscount?: number | null;
  notes?: string | null;
}

export interface UpdateCollectionInput {
  tankId?: string | null;
  collectionDate?: string;
  collectionTime?: string | null;
  dairyCompany?: string;
  driverName?: string | null;
  volumeLiters?: number;
  sampleCollected?: boolean;
  milkTemperature?: number | null;
  ticketNumber?: string | null;
  pricePerLiter?: number | null;
  qualityDiscount?: number | null;
  freightDiscount?: number | null;
  notes?: string | null;
}

export interface MonthlyReportItem {
  month: string;
  totalVolume: number;
  totalCollections: number;
  avgPricePerLiter: number | null;
  grossTotal: number;
  discountsTotal: number;
  netTotal: number;
  collections: CollectionItem[];
}

export interface ReconciliationItem {
  date: string;
  productionLiters: number;
  collectedLiters: number;
  tankVolume: number | null;
  divergencePercent: number;
  alert: boolean;
}

export interface ReconciliationResponse {
  data: ReconciliationItem[];
}

export interface MeasurementItem {
  id: string;
  tankId: string;
  volumeLiters: number;
  temperature: number | null;
  measuredAt: string;
  recordedBy: string;
}

export interface CreateMeasurementInput {
  volumeLiters: number;
  temperature?: number | null;
  measuredAt?: string;
}
