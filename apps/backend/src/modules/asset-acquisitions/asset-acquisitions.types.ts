// ─── Error ──────────────────────────────────────────────────────────

export class AssetAcquisitionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AssetAcquisitionError';
  }
}

// ─── Payment Types ────────────────────────────────────────────────────

export type PaymentType = 'AVISTA' | 'FINANCIADO';

// ─── Input Types ──────────────────────────────────────────────────────

export interface CreateAssetAcquisitionInput {
  // Asset base fields (forwarded to asset creation)
  name: string;
  assetType: string;
  classification: string;
  farmId: string;
  description?: string;
  supplierId?: string;
  supplierName?: string;
  acquisitionValue?: number;
  acquisitionDate?: string; // ISO 8601
  invoiceNumber?: string;
  costCenterId?: string;
  costCenterMode?: string;
  costCenterPercent?: number;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  yearOfManufacture?: number;
  engineHp?: number;
  fuelType?: string;
  renavamCode?: string;
  licensePlate?: string;
  parentAssetId?: string;
  constructionMaterial?: string;
  areaM2?: number;
  capacity?: string;
  geoLat?: number;
  geoLon?: number;
  registrationNumber?: string;
  areaHa?: number;
  carCode?: string;
  currentHourmeter?: number;
  currentOdometer?: number;
  notes?: string;

  // Financial fields (Phase 19 specific)
  paymentType: PaymentType;
  dueDate?: string; // ISO 8601 — required for AVISTA
  installmentCount?: number; // required for FINANCIADO (2-360)
  firstDueDate?: string; // ISO 8601 — required for FINANCIADO
  interestRate?: number; // monthly rate % (optional)
}

export interface NfeItemAssignment {
  nfeItemIndex: number;
  assetName: string;
  assetType: string;
  existingAssetId?: string; // if linking to existing asset
}

export interface CreateFromNfeInput {
  farmId: string;
  costCenterId?: string;
  costCenterMode?: string;
  classification: string;
  paymentType: PaymentType;
  dueDate?: string;
  installmentCount?: number;
  firstDueDate?: string;
  interestRate?: number;
  items: NfeItemAssignment[];
  nfeParsed: NfeParsedData;
}

// ─── NF-e Types ───────────────────────────────────────────────────────

export interface NfeItem {
  description: string;
  value: number;
  ncm: string | null;
  quantity: number;
  unit: string | null;
}

export interface NfeParsedData {
  supplierName: string | null;
  supplierCnpj: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  totalNf: string | null;
  totalProducts: string | null;
  freight: string | null;
  insurance: string | null;
  otherCosts: string | null;
  items: NfeItem[];
}

// ─── Output Types ─────────────────────────────────────────────────────

export interface AssetAcquisitionOutput {
  asset: { id: string; assetTag: string; name: string };
  payableId: string | null;
  installmentCount: number;
}

export interface NfeAcquisitionOutput {
  assets: Array<{ id: string; assetTag: string; name: string; acquisitionValue: number }>;
  payableId: string | null;
  totalNf: number;
}
