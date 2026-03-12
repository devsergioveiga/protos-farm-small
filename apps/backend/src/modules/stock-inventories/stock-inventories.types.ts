// ─── Error ──────────────────────────────────────────────────────────

export class StockInventoryError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'StockInventoryError';
  }
}

// ─── Enums / Constants ──────────────────────────────────────────────

export const INVENTORY_STATUSES = ['OPEN', 'IN_PROGRESS', 'RECONCILED', 'CANCELLED'] as const;
export type InventoryStatusValue = (typeof INVENTORY_STATUSES)[number];

export const INVENTORY_STATUS_LABELS: Record<InventoryStatusValue, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  RECONCILED: 'Conciliado',
  CANCELLED: 'Cancelado',
};

export const ADJUSTMENT_TYPES = ['INVENTORY_SURPLUS', 'INVENTORY_SHORTAGE'] as const;
export type AdjustmentTypeValue = (typeof ADJUSTMENT_TYPES)[number];

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentTypeValue, string> = {
  INVENTORY_SURPLUS: 'Sobra (entrada de ajuste)',
  INVENTORY_SHORTAGE: 'Falta (saída de ajuste)',
};

export const ADJUSTMENT_REASONS = [
  'LOSS',
  'REGISTRATION_ERROR',
  'THEFT',
  'EVAPORATION',
  'BREAKAGE',
  'MEASUREMENT_ERROR',
  'NATURAL_SHRINKAGE',
  'OTHER',
] as const;
export type AdjustmentReasonValue = (typeof ADJUSTMENT_REASONS)[number];

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReasonValue, string> = {
  LOSS: 'Perda',
  REGISTRATION_ERROR: 'Erro de registro',
  THEFT: 'Roubo/furto',
  EVAPORATION: 'Evaporação',
  BREAKAGE: 'Quebra/avaria',
  MEASUREMENT_ERROR: 'Erro de medição',
  NATURAL_SHRINKAGE: 'Quebra natural',
  OTHER: 'Outro',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateInventoryInput {
  inventoryDate?: string; // ISO date
  storageFarmId?: string;
  storageLocation?: string;
  notes?: string;
  productIds?: string[]; // se vazio, carrega todos com saldo
}

export interface RecordCountInput {
  items: {
    productId: string;
    batchNumber?: string;
    countedQuantity: number;
    reason?: string;
  }[];
}

export interface ReconcileInventoryInput {
  items: {
    productId: string;
    reason: string;
  }[];
}

export interface ListInventoriesQuery {
  page?: number;
  limit?: number;
  status?: InventoryStatusValue;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Output Types ───────────────────────────────────────────────────

export interface InventoryItemOutput {
  id: string;
  productId: string;
  productName: string;
  productType: string;
  measurementUnit: string | null;
  batchNumber: string | null;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  reason: string | null;
}

export interface InventoryOutput {
  id: string;
  inventoryDate: string;
  status: InventoryStatusValue;
  statusLabel: string;
  storageFarmId: string | null;
  storageFarmName: string | null;
  storageLocation: string | null;
  notes: string | null;
  reconciledAt: string | null;
  reconciledBy: string | null;
  createdBy: string | null;
  items: InventoryItemOutput[];
  itemCount: number;
  countedCount: number;
  divergenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListInventoriesResult {
  data: InventoryOutput[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdjustmentOutput {
  id: string;
  stockInventoryId: string;
  productId: string;
  productName: string;
  adjustmentType: AdjustmentTypeValue;
  adjustmentTypeLabel: string;
  previousQuantity: number;
  newQuantity: number;
  adjustmentQty: number;
  reason: string;
  createdBy: string | null;
  createdAt: string;
}

export interface InventoryReportOutput {
  inventory: InventoryOutput;
  adjustments: AdjustmentOutput[];
  summary: {
    totalItems: number;
    countedItems: number;
    matchCount: number;
    surplusCount: number;
    shortageCount: number;
    totalSurplusValue: number;
    totalShortageValue: number;
  };
}
