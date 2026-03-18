export const OC_STATUSES = [
  'RASCUNHO',
  'EMITIDA',
  'CONFIRMADA',
  'EM_TRANSITO',
  'ENTREGUE',
  'CANCELADA',
] as const;
export type OcStatus = (typeof OC_STATUSES)[number];

export const OC_VALID_TRANSITIONS: Record<string, string[]> = {
  RASCUNHO: ['EMITIDA', 'CANCELADA'],
  EMITIDA: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['EM_TRANSITO', 'CANCELADA'],
  EM_TRANSITO: ['ENTREGUE', 'CANCELADA'],
  ENTREGUE: [],
  CANCELADA: [],
};

export function canOcTransition(from: string, to: string): boolean {
  return OC_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class PurchaseOrderError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PurchaseOrderError';
  }
}

export interface CreateEmergencyPOInput {
  supplierId: string;
  items: {
    productName: string;
    unitName: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }[];
  justification: string; // REQUIRED for emergency
  notes?: string;
  internalReference?: string;
  expectedDeliveryDate?: string; // ISO date
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
  status: string;
  reason?: string;
}

export interface ListPurchaseOrdersQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  supplierId?: string;
  isEmergency?: boolean;
  overdue?: boolean;
}
