export interface PurchaseOrder {
  id: string;
  sequentialNumber: string;
  status: 'RASCUNHO' | 'EMITIDA' | 'CONFIRMADA' | 'EM_TRANSITO' | 'ENTREGUE' | 'CANCELADA';
  isEmergency: boolean;
  emergencyJustification: string | null;
  notes: string | null;
  internalReference: string | null;
  expectedDeliveryDate: string | null;
  issuedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue?: boolean;
  supplier: { id: string; name: string; tradeName: string | null; email?: string | null };
  quotation?: {
    id: string;
    sequentialNumber: string;
    purchaseRequest?: { sequentialNumber: string };
  } | null;
  items: PurchaseOrderItem[];
  creator?: { id: string; name: string };
  _count?: { items: number };
}

export interface PurchaseOrderItem {
  id: string;
  productName: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
}

export interface PurchaseOrderListItem {
  id: string;
  sequentialNumber: string;
  status: PurchaseOrder['status'];
  isEmergency: boolean;
  isOverdue?: boolean;
  issuedAt: string | null;
  expectedDeliveryDate: string | null;
  createdAt: string;
  supplier: { id: string; name: string; tradeName: string | null };
  _count: { items: number };
}

export interface CreateEmergencyPOInput {
  supplierId: string;
  justification: string;
  notes?: string;
  internalReference?: string;
  expectedDeliveryDate?: string;
  items: {
    productName: string;
    unitName: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }[];
}

export interface DuplicatePOInput {
  sourcePurchaseOrderId: string;
  notes?: string;
}

export interface UpdatePOInput {
  notes?: string;
  internalReference?: string;
  expectedDeliveryDate?: string;
  items?: {
    productName: string;
    unitName: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }[];
}

export interface TransitionPOInput {
  status: PurchaseOrder['status'];
  reason?: string;
}

export const OC_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  EMITIDA: 'Emitida',
  CONFIRMADA: 'Confirmada',
  EM_TRANSITO: 'Em Transito',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
};

export const OC_STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'badge--neutral',
  EMITIDA: 'badge--info',
  CONFIRMADA: 'badge--success',
  EM_TRANSITO: 'badge--warning',
  ENTREGUE: 'badge--success',
  CANCELADA: 'badge--error',
};
