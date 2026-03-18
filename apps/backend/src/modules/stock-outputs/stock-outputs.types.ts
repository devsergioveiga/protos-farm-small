// ─── Error ──────────────────────────────────────────────────────────

export class StockOutputError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'StockOutputError';
  }
}

// ─── Enums / Constants ──────────────────────────────────────────────

export const STOCK_OUTPUT_TYPES = [
  'CONSUMPTION',
  'MANUAL_CONSUMPTION',
  'TRANSFER',
  'DISPOSAL',
  'RETURN',
] as const;
export type StockOutputTypeValue = (typeof STOCK_OUTPUT_TYPES)[number];

export const STOCK_OUTPUT_TYPE_LABELS: Record<StockOutputTypeValue, string> = {
  CONSUMPTION: 'Consumo (operação)',
  MANUAL_CONSUMPTION: 'Consumo manual',
  TRANSFER: 'Transferência',
  DISPOSAL: 'Descarte',
  RETURN: 'Devolucao',
};

export const STOCK_OUTPUT_STATUSES = ['DRAFT', 'CONFIRMED', 'CANCELLED'] as const;
export type StockOutputStatusValue = (typeof STOCK_OUTPUT_STATUSES)[number];

export const DISPOSAL_REASONS = ['EXPIRED', 'DAMAGED', 'CONTAMINATED', 'OTHER'] as const;
export type DisposalReasonValue = (typeof DISPOSAL_REASONS)[number];

export const DISPOSAL_REASON_LABELS: Record<DisposalReasonValue, string> = {
  EXPIRED: 'Vencido',
  DAMAGED: 'Avariado',
  CONTAMINATED: 'Contaminado',
  OTHER: 'Outro',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateStockOutputItemInput {
  productId: string;
  quantity: number;
  batchNumber?: string;
}

export interface CreateStockOutputInput {
  type: StockOutputTypeValue;
  outputDate?: string; // ISO date string
  items: CreateStockOutputItemInput[];

  // CONSUMPTION / MANUAL_CONSUMPTION
  fieldOperationRef?: string;
  fieldPlotId?: string;

  // TRANSFER
  sourceFarmId?: string;
  sourceLocation?: string;
  destinationFarmId?: string;
  destinationLocation?: string;

  // DISPOSAL
  disposalReason?: DisposalReasonValue;
  disposalJustification?: string;
  authorizedBy?: string;

  // Common
  responsibleName?: string;
  notes?: string;

  // Allow output even if stock is insufficient (with justification)
  forceInsufficientStock?: boolean;
  insufficientStockJustification?: string;
}

export interface ListStockOutputsQuery {
  page?: number;
  limit?: number;
  type?: StockOutputTypeValue;
  status?: StockOutputStatusValue;
  productId?: string;
  responsibleName?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Output Types ───────────────────────────────────────────────────

export interface StockOutputItemOutput {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchNumber: string | null;
}

export interface StockOutputOutput {
  id: string;
  outputDate: string;
  type: StockOutputTypeValue;
  typeLabel: string;
  status: StockOutputStatusValue;

  fieldOperationRef: string | null;
  fieldPlotId: string | null;

  sourceFarmId: string | null;
  sourceFarmName: string | null;
  sourceLocation: string | null;
  destinationFarmId: string | null;
  destinationFarmName: string | null;
  destinationLocation: string | null;

  disposalReason: DisposalReasonValue | null;
  disposalReasonLabel: string | null;
  disposalJustification: string | null;
  authorizedBy: string | null;

  responsibleName: string | null;
  notes: string | null;
  totalCost: number;
  items: StockOutputItemOutput[];
  createdAt: string;
  updatedAt: string;
}

export interface ListStockOutputsResult {
  data: StockOutputOutput[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InsufficientStockAlert {
  productId: string;
  productName: string;
  requested: number;
  available: number;
}

export interface MovementHistoryEntry {
  id: string;
  date: string;
  movementType: 'ENTRY' | 'EXIT';
  type: string;
  typeLabel: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchNumber: string | null;
  referenceId: string;
  responsibleName: string | null;
  notes: string | null;
}

export interface ListMovementsQuery {
  productId: string;
  page?: number;
  limit?: number;
  movementType?: 'ENTRY' | 'EXIT';
  dateFrom?: string;
  dateTo?: string;
  responsibleName?: string;
}

export interface ListMovementsResult {
  data: MovementHistoryEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
