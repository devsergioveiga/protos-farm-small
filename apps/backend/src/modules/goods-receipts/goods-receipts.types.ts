// ─── State Machine ────────────────────────────────────────────────────────────

export const GR_STATUSES = [
  'PENDENTE',
  'EM_CONFERENCIA',
  'CONFERIDO',
  'CONFIRMADO',
  'REJEITADO',
] as const;
export type GrStatus = (typeof GR_STATUSES)[number];

export const GR_VALID_TRANSITIONS: Record<string, string[]> = {
  PENDENTE: ['EM_CONFERENCIA', 'REJEITADO'],
  EM_CONFERENCIA: ['CONFERIDO', 'REJEITADO'],
  CONFERIDO: ['CONFIRMADO', 'REJEITADO'],
  CONFIRMADO: [],
  REJEITADO: [],
};

export function canGrTransition(from: string, to: string): boolean {
  return GR_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Enum Constants (mirroring Prisma) ───────────────────────────────────────

export const RECEIVING_TYPES = [
  'STANDARD',
  'NF_ANTECIPADA',
  'MERCADORIA_ANTECIPADA',
  'PARCIAL',
  'NF_FRACIONADA',
  'EMERGENCIAL',
] as const;
export type ReceivingTypeValue = (typeof RECEIVING_TYPES)[number];

export const DIVERGENCE_TYPES = [
  'A_MAIS',
  'A_MENOS',
  'SUBSTITUIDO',
  'DANIFICADO',
  'ERRADO',
] as const;
export type DivergenceTypeValue = (typeof DIVERGENCE_TYPES)[number];

export const DIVERGENCE_ACTIONS = [
  'DEVOLVER',
  'ACEITAR_COM_DESCONTO',
  'REGISTRAR_PENDENCIA',
] as const;
export type DivergenceActionValue = (typeof DIVERGENCE_ACTIONS)[number];

// ─── Label Maps (pt-BR) ──────────────────────────────────────────────────────

export const GR_STATUS_LABELS: Record<GrStatus, string> = {
  PENDENTE: 'Pendente',
  EM_CONFERENCIA: 'Em Conferencia',
  CONFERIDO: 'Conferido',
  CONFIRMADO: 'Confirmado',
  REJEITADO: 'Rejeitado',
};

export const RECEIVING_TYPE_LABELS: Record<ReceivingTypeValue, string> = {
  STANDARD: 'NF + Mercadoria',
  NF_ANTECIPADA: 'NF Antecipada',
  MERCADORIA_ANTECIPADA: 'Mercadoria Antecipada',
  PARCIAL: 'Recebimento Parcial',
  NF_FRACIONADA: 'NF Fracionada',
  EMERGENCIAL: 'Emergencial (sem pedido)',
};

export const DIVERGENCE_TYPE_LABELS: Record<DivergenceTypeValue, string> = {
  A_MAIS: 'A mais',
  A_MENOS: 'A menos',
  SUBSTITUIDO: 'Substituido',
  DANIFICADO: 'Danificado',
  ERRADO: 'Errado',
};

export const DIVERGENCE_ACTION_LABELS: Record<DivergenceActionValue, string> = {
  DEVOLVER: 'Devolver',
  ACEITAR_COM_DESCONTO: 'Aceitar com desconto',
  REGISTRAR_PENDENCIA: 'Registrar pendencia',
};

// ─── Error Class ─────────────────────────────────────────────────────────────

export class GoodsReceiptError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'GoodsReceiptError';
  }
}

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface GoodsReceiptItemInput {
  purchaseOrderItemId?: string;
  productId?: string;
  productName: string;
  unitName: string;
  orderedQty: number;
  invoiceQty?: number;
  receivedQty: number;
  unitPrice: number;
  qualityVisualOk?: boolean;
  batchNumber?: string;
  expirationDate?: string; // ISO date
  qualityNotes?: string;
}

export interface GoodsReceiptDivergenceInput {
  itemId: string; // client-generated or PO item id
  divergenceType: DivergenceTypeValue;
  action: DivergenceActionValue;
  observation?: string;
}

export interface CreateGoodsReceiptInput {
  purchaseOrderId?: string; // null for EMERGENCIAL
  supplierId: string;
  receivingType: ReceivingTypeValue;
  invoiceNumber?: string;
  invoiceSerie?: string;
  invoiceCfop?: string;
  invoiceDate?: string; // ISO date
  invoiceTotal?: number;
  invoiceKey?: string;
  storageFarmId?: string;
  notes?: string;
  emergencyJustification?: string;
  items: GoodsReceiptItemInput[];
  divergences?: GoodsReceiptDivergenceInput[];
}

export interface TransitionGrInput {
  status: string;
  rejectionReason?: string;
}

export interface ListGoodsReceiptsQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  receivingType?: string;
  supplierId?: string;
  purchaseOrderId?: string;
}

// ─── Output Types ────────────────────────────────────────────────────────────

export interface GoodsReceiptDivergenceOutput {
  id: string;
  itemId: string;
  divergenceType: DivergenceTypeValue;
  divergenceTypeLabel: string;
  action: DivergenceActionValue;
  actionLabel: string;
  observation: string | null;
  photoUrl: string | null;
  photoFileName: string | null;
  createdAt: string;
}

export interface GoodsReceiptItemOutput {
  id: string;
  purchaseOrderItemId: string | null;
  productId: string | null;
  productName: string;
  unitName: string;
  orderedQty: number;
  invoiceQty: number | null;
  receivedQty: number;
  unitPrice: number;
  totalPrice: number;
  qualityVisualOk: boolean | null;
  batchNumber: string | null;
  expirationDate: string | null;
  qualityNotes: string | null;
  hasDivergence: boolean;
  divergencePct: number | null;
}

export interface GoodsReceiptOutput {
  id: string;
  sequentialNumber: string;
  status: GrStatus;
  statusLabel: string;
  receivingType: ReceivingTypeValue;
  receivingTypeLabel: string;
  purchaseOrderId: string | null;
  purchaseOrder: { sequentialNumber: string; status: string } | null;
  supplierId: string;
  supplier: { id: string; name: string; tradeName: string | null };
  invoiceNumber: string | null;
  invoiceSerie: string | null;
  invoiceCfop: string | null;
  invoiceDate: string | null;
  invoiceTotal: number | null;
  invoiceKey: string | null;
  isProvisional: boolean;
  stockEntryId: string | null;
  payableId: string | null;
  storageFarmId: string | null;
  notes: string | null;
  emergencyJustification: string | null;
  receivedAt: string | null;
  conferredAt: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdBy: string;
  creator: { id: string; name: string };
  items: GoodsReceiptItemOutput[];
  divergences: GoodsReceiptDivergenceOutput[];
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptListItem {
  id: string;
  sequentialNumber: string;
  status: GrStatus;
  statusLabel: string;
  receivingType: ReceivingTypeValue;
  receivingTypeLabel: string;
  invoiceNumber: string | null;
  invoiceTotal: number | null;
  isProvisional: boolean;
  createdAt: string;
  supplier: { id: string; name: string; tradeName: string | null };
  purchaseOrder: { sequentialNumber: string } | null;
  _count: { items: number; divergences: number };
}

export interface ListGoodsReceiptsResult {
  data: GoodsReceiptListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PendingDelivery {
  purchaseOrderId: string;
  sequentialNumber: string;
  supplier: { id: string; name: string };
  expectedDeliveryDate: string | null;
  isOverdue: boolean;
  itemCount: number;
  totalPendingItems: number;
}
