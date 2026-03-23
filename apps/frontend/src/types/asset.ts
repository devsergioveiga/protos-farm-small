// ─── Enums ─────────────────────────────────────────────────────────

export type AssetType = 'MAQUINA' | 'VEICULO' | 'IMPLEMENTO' | 'BENFEITORIA' | 'TERRA';

export type PaymentType = 'AVISTA' | 'FINANCIADO';

export type AssetClassification =
  | 'DEPRECIABLE_CPC27'
  | 'NON_DEPRECIABLE_CPC27'
  | 'FAIR_VALUE_CPC29'
  | 'BEARER_PLANT_CPC27';

export type AssetStatus = 'ATIVO' | 'INATIVO' | 'EM_MANUTENCAO' | 'ALIENADO' | 'EM_ANDAMENTO';

export type AssetDocumentType =
  | 'CRLV'
  | 'SEGURO'
  | 'REVISAO'
  | 'CCIR'
  | 'ITR'
  | 'LAUDO'
  | 'GARANTIA'
  | 'OUTRO';

// ─── Interfaces ──────────────────────────────────────────────────────

export interface Asset {
  id: string;
  organizationId: string;
  farmId: string;
  assetType: AssetType;
  classification: AssetClassification;
  status: AssetStatus;
  name: string;
  description: string | null;
  assetTag: string;
  acquisitionDate: string | null;
  acquisitionValue: string | null; // Decimal as string from API
  supplierId: string | null;
  invoiceNumber: string | null;
  costCenterId: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  yearOfManufacture: number | null;
  engineHp: string | null;
  fuelType: string | null;
  renavamCode: string | null;
  licensePlate: string | null;
  parentAssetId: string | null;
  constructionMaterial: string | null;
  areaM2: string | null;
  capacity: string | null;
  registrationNumber: string | null;
  areaHa: string | null;
  carCode: string | null;
  currentHourmeter: string | null;
  currentOdometer: string | null;
  photoUrls: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  farm?: { name: string };
  supplier?: { name: string };
  costCenter?: { name: string };
  parentAsset?: { id: string; name: string; assetTag: string } | null;
  childAssets?: Asset[];
  _count?: { fuelRecords: number; meterReadings: number; documents: number };
}

export interface CreateAssetInput {
  name: string;
  assetType: AssetType;
  classification: AssetClassification;
  farmId: string;
  description?: string;
  acquisitionDate?: string;
  acquisitionValue?: string;
  supplierId?: string;
  invoiceNumber?: string;
  costCenterId?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  yearOfManufacture?: number;
  engineHp?: string;
  fuelType?: string;
  renavamCode?: string;
  licensePlate?: string;
  parentAssetId?: string;
  constructionMaterial?: string;
  areaM2?: string;
  capacity?: string;
  geoLat?: number;
  geoLon?: number;
  registrationNumber?: string;
  areaHa?: string;
  carCode?: string;
  currentHourmeter?: string;
  currentOdometer?: string;
  notes?: string;
}

export type UpdateAssetInput = Partial<CreateAssetInput> & { status?: AssetStatus };

export interface AssetAcquisitionInput extends CreateAssetInput {
  paymentType: PaymentType;
  dueDate?: string;
  installmentCount?: number;
  firstDueDate?: string;
  interestRate?: number;
}

export interface AssetAcquisitionOutput {
  asset: { id: string; assetTag: string; name: string };
  payableId: string | null;
  installmentCount: number;
}

export interface InstallmentPreview {
  number: number;
  dueDate: Date;
  amount: number;
}

// ─── NF-e types ───────────────────────────────────────────────────────

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

export interface NfeItemAssignment {
  nfeItemIndex: number;
  assetName: string;
  assetType: string;
  existingAssetId?: string;
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
}

export interface NfeAcquisitionOutput {
  assets: Array<{ id: string; assetTag: string; name: string; acquisitionValue: number }>;
  payableId: string | null;
  totalNf: number;
}

export interface AssetSummary {
  totalAssets: number;
  totalValue: string;
  inMaintenance: number;
  recentAcquisitions: Asset[];
}

export interface ListAssetsQuery {
  page?: number;
  limit?: number;
  farmId?: string;
  assetType?: AssetType;
  status?: AssetStatus;
  search?: string;
  minValue?: string;
  maxValue?: string;
  acquisitionFrom?: string;
  acquisitionTo?: string;
}

export interface AssetListResponse {
  data: Asset[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Labels ──────────────────────────────────────────────────────────

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  MAQUINA: 'Maquina',
  VEICULO: 'Veiculo',
  IMPLEMENTO: 'Implemento',
  BENFEITORIA: 'Benfeitoria',
  TERRA: 'Terra',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  EM_MANUTENCAO: 'Em manutencao',
  ALIENADO: 'Alienado',
  EM_ANDAMENTO: 'Em andamento',
};

// ─── Map types ────────────────────────────────────────────────────────

export interface AssetMapItem {
  id: string;
  name: string;
  assetTag: string;
  assetType: AssetType;
  status: AssetStatus;
  farmId: string;
  lat: number;
  lon: number;
}

export const ASSET_CLASSIFICATION_LABELS: Record<AssetClassification, string> = {
  DEPRECIABLE_CPC27: 'CPC 27 — Depreciavel',
  NON_DEPRECIABLE_CPC27: 'CPC 27 — Nao depreciavel',
  FAIR_VALUE_CPC29: 'CPC 29 — Valor justo',
  BEARER_PLANT_CPC27: 'CPC 27 — Planta portadora',
};

// ─── Disposal Types ──────────────────────────────────────────────────

export type DisposalType = 'VENDA' | 'DESCARTE' | 'SINISTRO' | 'OBSOLESCENCIA';

export const DISPOSAL_TYPE_LABELS: Record<DisposalType, string> = {
  VENDA: 'Venda',
  DESCARTE: 'Descarte',
  SINISTRO: 'Sinistro',
  OBSOLESCENCIA: 'Obsolescencia',
};

export interface CreateDisposalInput {
  disposalType: DisposalType;
  disposalDate: string;
  saleValue?: number;
  buyerName?: string;
  motivation?: string;
  documentUrl?: string;
  dueDate?: string;
  installmentCount?: number;
  firstDueDate?: string;
}

export interface DisposalOutput {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  disposalType: DisposalType;
  disposalTypeLabel: string;
  disposalDate: string;
  saleValue: number | null;
  netBookValue: number;
  gainLoss: number;
  buyerName: string | null;
  motivation: string | null;
  receivableId: string | null;
  installmentCount: number;
  cancelledDepreciationCount: number;
  createdAt: string;
}

// ─── Transfer Types ──────────────────────────────────────────────────

export interface CreateTransferInput {
  toFarmId: string;
  transferDate: string;
  toCostCenterId?: string;
  notes?: string;
}

export interface TransferOutput {
  id: string;
  assetId: string;
  fromFarmId: string;
  fromFarmName: string;
  toFarmId: string;
  toFarmName: string;
  transferDate: string;
  notes: string | null;
  createdAt: string;
}

// ─── Inventory Types ─────────────────────────────────────────────────

export type PhysicalStatus = 'ENCONTRADO' | 'NAO_ENCONTRADO' | 'AVARIADO' | 'DESCARTADO';

export const PHYSICAL_STATUS_LABELS: Record<PhysicalStatus, string> = {
  ENCONTRADO: 'Encontrado',
  NAO_ENCONTRADO: 'Nao encontrado',
  AVARIADO: 'Avariado',
  DESCARTADO: 'Descartado',
};

export interface InventoryItemOutput {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  assetType: string;
  registeredStatus: string;
  physicalStatus: string | null;
  physicalStatusLabel: string | null;
  notes: string | null;
}

export interface InventoryOutput {
  id: string;
  farmId: string | null;
  farmName: string | null;
  status: string;
  statusLabel: string;
  notes: string | null;
  items: InventoryItemOutput[];
  itemCount: number;
  countedCount: number;
  divergenceCount: number;
  createdAt: string;
}

// ─── Asset Trade-in Types ────────────────────────────────────────────

export interface TradeInOutput {
  id: string;
  organizationId: string;
  farmId: string;
  farmName: string;
  tradedAssetId: string;
  tradedAssetTag: string;
  tradedAssetName: string;
  newAssetId: string;
  newAssetTag: string;
  newAssetName: string;
  tradeInDate: string;
  tradedAssetValue: number;
  newAssetValue: number;
  netPayable: number;
  gainLossOnTrade: number;
  payableId: string | null;
  supplierName: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateTradeInInput {
  farmId: string;
  tradedAssetId: string;
  tradeInDate: string;
  tradedAssetValue: number;
  newAssetType: string;
  newAssetClassification: string;
  newAssetName: string;
  newAssetValue: number;
  newAssetAcquisitionDate?: string;
  supplierName?: string;
  dueDate?: string;
  notes?: string;
}

// ─── Patrimony Dashboard Types ───────────────────────────────────────

export interface PatrimonyDashboardOutput {
  totalActiveValue: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  acquisitionsInPeriod: { count: number; totalValue: number };
  disposalsInPeriod: { count: number; totalSaleValue: number; totalGainLoss: number };
  assetCountByType: Array<{ assetType: string; count: number }>;
  assetCountByStatus: Array<{ status: string; count: number }>;
}

// ─── Asset Leasing Types (CPC 06) ───────────────────────────────────

export type LeasingStatus = 'ACTIVE' | 'PURCHASE_OPTION_EXERCISED' | 'RETURNED' | 'CANCELLED';

export const LEASING_STATUS_LABELS: Record<LeasingStatus, string> = {
  ACTIVE: 'Ativo',
  PURCHASE_OPTION_EXERCISED: 'Opcao Exercida',
  RETURNED: 'Devolvido',
  CANCELLED: 'Cancelado',
};

export const LEASING_STATUS_VARIANTS: Record<LeasingStatus, 'success' | 'info' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  PURCHASE_OPTION_EXERCISED: 'info',
  RETURNED: 'warning',
  CANCELLED: 'error',
};

export interface LeasingOutput {
  id: string;
  organizationId: string;
  farmId: string;
  farmName: string;
  rouAssetId: string;
  rouAssetTag: string;
  rouAssetName: string;
  lessorName: string;
  lessorDocument: string | null;
  contractNumber: string | null;
  contractDate: string;
  startDate: string;
  endDate: string;
  totalContractValue: number;
  monthlyInstallment: number;
  installmentCount: number;
  purchaseOptionValue: number | null;
  purchaseOptionDate: string | null;
  hasPurchaseOption: boolean;
  status: LeasingStatus;
  statusLabel: string;
  payableId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateLeasingInput {
  farmId: string;
  assetType: string;
  assetName: string;
  lessorName: string;
  lessorDocument?: string;
  contractNumber?: string;
  contractDate: string;
  startDate: string;
  endDate: string;
  totalContractValue: number;
  installmentCount: number;
  firstDueDate: string;
  purchaseOptionValue?: number;
  purchaseOptionDate?: string;
  hasPurchaseOption?: boolean;
  notes?: string;
}

// ─── Biological Asset Valuation Types (CPC 29) ──────────────────────
export type BiologicalGroupType = 'ANIMAL' | 'PERENNIAL_CROP';

export const GROUP_TYPE_LABELS: Record<BiologicalGroupType, string> = {
  ANIMAL: 'Rebanho',
  PERENNIAL_CROP: 'Cultura Perene',
};

export const ANIMAL_GROUPS = [
  { value: 'BEZERRO', label: 'Bezerro' },
  { value: 'BEZERRA', label: 'Bezerra' },
  { value: 'NOVILHA', label: 'Novilha' },
  { value: 'NOVILHO', label: 'Novilho' },
  { value: 'VACA_LACTACAO', label: 'Vaca em Lactacao' },
  { value: 'VACA_SECA', label: 'Vaca Seca' },
  { value: 'TOURO_REPRODUTOR', label: 'Touro Reprodutor' },
  { value: 'DESCARTE', label: 'Descarte' },
] as const;

export const PERENNIAL_CROP_GROUPS = [
  { value: 'CAFE_FORMACAO', label: 'Cafe em Formacao' },
  { value: 'LARANJA_FORMACAO', label: 'Laranja em Formacao' },
  { value: 'EUCALIPTO_FORMACAO', label: 'Eucalipto em Formacao' },
  { value: 'SERINGUEIRA_FORMACAO', label: 'Seringueira em Formacao' },
  { value: 'OUTRO_PERENE', label: 'Outro Perene' },
] as const;

export interface BiologicalValuationOutput {
  id: string;
  organizationId: string;
  farmId: string;
  farmName: string;
  valuationDate: string;
  assetGroup: string;
  groupType: BiologicalGroupType;
  groupTypeLabel: string;
  headCount: number | null;
  areaHa: number | null;
  pricePerUnit: number;
  totalFairValue: number;
  previousValue: number | null;
  fairValueChange: number | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface BiologicalValuationSummaryItem {
  assetGroup: string;
  groupType: BiologicalGroupType;
  latestTotalFairValue: number;
  latestFairValueChange: number | null;
  valuationCount: number;
}

export interface CreateBiologicalValuationInput {
  farmId: string;
  valuationDate: string;
  assetGroup: string;
  groupType: BiologicalGroupType;
  headCount?: number;
  areaHa?: number;
  pricePerUnit: number;
  totalFairValue: number;
  notes?: string;
}

// ─── Asset Trade-in Types ───────────────────────────────────────────
export interface CreateTradeInInput {
  farmId: string;
  tradedAssetId: string;
  tradeInDate: string;
  tradedAssetValue: number;
  newAssetType: string;
  newAssetClassification: string;
  newAssetName: string;
  newAssetValue: number;
  newAssetAcquisitionDate?: string;
  supplierName?: string;
  dueDate?: string;
  notes?: string;
}
