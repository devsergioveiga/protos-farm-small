// ─── State Machine ────────────────────────────────────────────────────────────

export const GR_RETURN_STATUSES = [
  'PENDENTE',
  'EM_ANALISE',
  'APROVADA',
  'CONCLUIDA',
  'CANCELADA',
] as const;
export type GrReturnStatus = (typeof GR_RETURN_STATUSES)[number];

export const GR_RETURN_VALID_TRANSITIONS: Record<string, string[]> = {
  PENDENTE: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['APROVADA', 'CANCELADA'],
  APROVADA: ['CONCLUIDA'],
  CONCLUIDA: [],
  CANCELADA: [],
};

export function canGrReturnTransition(from: string, to: string): boolean {
  return GR_RETURN_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Enum Constants ───────────────────────────────────────────────────────────

export const GR_RETURN_REASONS = [
  'DEFEITO',
  'VALIDADE',
  'PRODUTO_ERRADO',
  'EXCEDENTE',
  'ESPECIFICACAO_DIVERGENTE',
] as const;
export type GrReturnReasonValue = (typeof GR_RETURN_REASONS)[number];

export const GR_RETURN_ACTIONS = ['TROCA', 'CREDITO', 'ESTORNO'] as const;
export type GrReturnActionValue = (typeof GR_RETURN_ACTIONS)[number];

export const GR_RETURN_RESOLUTION_STATUSES = ['PENDING', 'RESOLVED', 'EXPIRED'] as const;
export type GrReturnResolutionStatusValue = (typeof GR_RETURN_RESOLUTION_STATUSES)[number];

// ─── Label Maps (pt-BR) ──────────────────────────────────────────────────────

export const GR_RETURN_STATUS_LABELS: Record<GrReturnStatus, string> = {
  PENDENTE: 'Pendente',
  EM_ANALISE: 'Em Analise',
  APROVADA: 'Aprovada',
  CONCLUIDA: 'Concluida',
  CANCELADA: 'Cancelada',
};

export const GR_RETURN_REASON_LABELS: Record<GrReturnReasonValue, string> = {
  DEFEITO: 'Defeito',
  VALIDADE: 'Validade vencida',
  PRODUTO_ERRADO: 'Produto errado',
  EXCEDENTE: 'Excedente',
  ESPECIFICACAO_DIVERGENTE: 'Especificacao divergente',
};

export const GR_RETURN_ACTION_LABELS: Record<GrReturnActionValue, string> = {
  TROCA: 'Troca',
  CREDITO: 'Credito',
  ESTORNO: 'Estorno',
};

export const GR_RETURN_RESOLUTION_STATUS_LABELS: Record<GrReturnResolutionStatusValue, string> = {
  PENDING: 'Pendente',
  RESOLVED: 'Resolvido',
  EXPIRED: 'Expirado',
};

// ─── Error Class ─────────────────────────────────────────────────────────────

export class GoodsReturnError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'GoodsReturnError';
  }
}

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface GoodsReturnItemInput {
  productId?: string;
  productName: string;
  unitName: string;
  returnQty: number;
  unitPrice: number;
  batchNumber?: string;
}

export interface CreateGoodsReturnInput {
  goodsReceiptId: string;
  reason: GrReturnReasonValue;
  expectedAction: GrReturnActionValue;
  resolutionDeadline?: string;
  returnInvoiceNumber?: string;
  returnInvoiceDate?: string;
  notes?: string;
  items: GoodsReturnItemInput[];
}

export interface TransitionGrReturnInput {
  status: GrReturnStatus;
  notes?: string;
}

export interface ListGoodsReturnsQuery {
  page?: number;
  limit?: number;
  status?: string;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface GoodsReturnItemOutput {
  id: string;
  goodsReturnId: string;
  productId: string | null;
  productName: string;
  unitName: string;
  returnQty: string;
  unitPrice: string;
  totalPrice: string;
  batchNumber: string | null;
  photoUrl: string | null;
  photoFileName: string | null;
  createdAt: string;
}

export interface GoodsReturnOutput {
  id: string;
  organizationId: string;
  sequentialNumber: string;
  goodsReceiptId: string;
  supplierId: string;
  supplierName: string;
  status: GrReturnStatus;
  statusLabel: string;
  reason: GrReturnReasonValue;
  reasonLabel: string;
  expectedAction: GrReturnActionValue;
  actionLabel: string;
  resolutionStatus: GrReturnResolutionStatusValue;
  resolutionStatusLabel: string;
  resolutionDeadline: string | null;
  returnInvoiceNumber: string | null;
  returnInvoiceDate: string | null;
  notes: string | null;
  stockOutputId: string | null;
  creditPayableId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: GoodsReturnItemOutput[];
  goodsReceipt: {
    sequentialNumber: string;
    purchaseOrderId: string | null;
  };
}

export interface GoodsReturnListItem {
  id: string;
  sequentialNumber: string;
  supplierName: string;
  status: GrReturnStatus;
  statusLabel: string;
  reason: GrReturnReasonValue;
  reasonLabel: string;
  expectedAction: GrReturnActionValue;
  actionLabel: string;
  totalValue: string;
  itemCount: number;
  createdAt: string;
}

export interface ListGoodsReturnsResult {
  data: GoodsReturnListItem[];
  total: number;
  page: number;
  limit: number;
}
