// ─── Error ──────────────────────────────────────────────────────────

export class AssetDisposalError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AssetDisposalError';
  }
}

// ─── Enums ────────────────────────────────────────────────────────────

export type DisposalType = 'VENDA' | 'DESCARTE' | 'SINISTRO' | 'OBSOLESCENCIA';

export const DISPOSAL_TYPE_LABELS: Record<DisposalType, string> = {
  VENDA: 'Venda',
  DESCARTE: 'Descarte',
  SINISTRO: 'Sinistro',
  OBSOLESCENCIA: 'Obsolescencia',
};

// ─── Input Types ──────────────────────────────────────────────────────

export interface CreateDisposalInput {
  disposalType: DisposalType;
  disposalDate: string; // ISO 8601
  saleValue?: number; // required for VENDA
  buyerName?: string; // required for VENDA
  motivation?: string; // required for DESCARTE, SINISTRO, OBSOLESCENCIA
  documentUrl?: string;
  dueDate?: string; // ISO 8601, required for VENDA
  installmentCount?: number; // default 1
  firstDueDate?: string; // ISO 8601, required when installmentCount > 1
}

// ─── Output Types ─────────────────────────────────────────────────────

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
  documentUrl: string | null;
  receivableId: string | null;
  installmentCount: number;
  cancelledDepreciationCount: number;
  createdBy: string;
  createdAt: string;
}
