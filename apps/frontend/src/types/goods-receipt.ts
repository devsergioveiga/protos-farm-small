// ─── Status types ────────────────────────────────────────────────
export type GrStatus = 'PENDENTE' | 'EM_CONFERENCIA' | 'CONFERIDO' | 'CONFIRMADO' | 'REJEITADO';
export type ReceivingType =
  | 'STANDARD'
  | 'NF_ANTECIPADA'
  | 'MERCADORIA_ANTECIPADA'
  | 'PARCIAL'
  | 'NF_FRACIONADA'
  | 'EMERGENCIAL';
export type DivergenceType = 'A_MAIS' | 'A_MENOS' | 'SUBSTITUIDO' | 'DANIFICADO' | 'ERRADO';
export type DivergenceAction = 'DEVOLVER' | 'ACEITAR_COM_DESCONTO' | 'REGISTRAR_PENDENCIA';

// ─── Label maps ──────────────────────────────────────────────────
export const GR_STATUS_LABELS: Record<GrStatus, string> = {
  PENDENTE: 'Pendente',
  EM_CONFERENCIA: 'Em Conferencia',
  CONFERIDO: 'Conferido',
  CONFIRMADO: 'Confirmado',
  REJEITADO: 'Rejeitado',
};

export const GR_STATUS_COLORS: Record<GrStatus, string> = {
  PENDENTE: 'badge--neutral',
  EM_CONFERENCIA: 'badge--warning',
  CONFERIDO: 'badge--info',
  CONFIRMADO: 'badge--success',
  REJEITADO: 'badge--error',
};

export const RECEIVING_TYPE_LABELS: Record<ReceivingType, string> = {
  STANDARD: 'NF + Mercadoria',
  NF_ANTECIPADA: 'NF Antecipada',
  MERCADORIA_ANTECIPADA: 'Mercadoria Antecipada',
  PARCIAL: 'Recebimento Parcial',
  NF_FRACIONADA: 'NF Fracionada',
  EMERGENCIAL: 'Emergencial',
};

export const DIVERGENCE_TYPE_LABELS: Record<DivergenceType, string> = {
  A_MAIS: 'A mais',
  A_MENOS: 'A menos',
  SUBSTITUIDO: 'Substituido',
  DANIFICADO: 'Danificado',
  ERRADO: 'Errado',
};

export const DIVERGENCE_ACTION_LABELS: Record<DivergenceAction, string> = {
  DEVOLVER: 'Devolver',
  ACEITAR_COM_DESCONTO: 'Aceitar com desconto',
  REGISTRAR_PENDENCIA: 'Registrar pendencia',
};

// ─── Output types ────────────────────────────────────────────────
export interface GoodsReceiptDivergenceOutput {
  id: string;
  itemId: string;
  divergenceType: DivergenceType;
  divergenceTypeLabel: string;
  action: DivergenceAction;
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

export interface GoodsReceipt {
  id: string;
  sequentialNumber: string;
  status: GrStatus;
  statusLabel: string;
  receivingType: ReceivingType;
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
  receivingType: ReceivingType;
  receivingTypeLabel: string;
  invoiceNumber: string | null;
  invoiceTotal: number | null;
  isProvisional: boolean;
  createdAt: string;
  supplier: { id: string; name: string; tradeName: string | null };
  purchaseOrder: { sequentialNumber: string } | null;
  _count: { items: number; divergences: number };
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

// ─── Input types (for create modal — Plan 05) ───────────────────
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
  expirationDate?: string;
  qualityNotes?: string;
}

export interface GoodsReceiptDivergenceInput {
  itemId: string;
  divergenceType: DivergenceType;
  action: DivergenceAction;
  observation?: string;
}

export interface CreateGoodsReceiptInput {
  purchaseOrderId?: string;
  supplierId: string;
  receivingType: ReceivingType;
  invoiceNumber?: string;
  invoiceSerie?: string;
  invoiceCfop?: string;
  invoiceDate?: string;
  invoiceTotal?: number;
  invoiceKey?: string;
  storageFarmId?: string;
  notes?: string;
  emergencyJustification?: string;
  items: GoodsReceiptItemInput[];
  divergences?: GoodsReceiptDivergenceInput[];
}
