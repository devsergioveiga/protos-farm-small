export const KANBAN_COLUMNS = [
  'RC_PENDENTE',
  'APROVADA',
  'EM_COTACAO',
  'OC_EMITIDA',
  'AGUARDANDO_ENTREGA',
  'RECEBIDO',
  'PAGO',
] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

export interface KanbanCard {
  id: string; // purchaseRequestId (or purchaseOrderId for emergency POs)
  column: KanbanColumn;
  number: string; // RC sequential number or PO number for emergencies
  type: string; // RC requestType
  requester: string; // user display name
  totalValue: number; // sum of item estimated prices OR PO total
  urgency: 'NORMAL' | 'URGENTE' | 'EMERGENCIAL';
  daysInStage: number; // days since entering current column
  isOverdue: boolean; // SLA exceeded OR delivery date passed
  purchaseRequestId: string | null;
  quotationId: string | null;
  purchaseOrderId: string | null;
  goodsReceiptId: string | null;
  payableId: string | null;
  isEmergency: boolean;
}

export interface KanbanFilters {
  farmId?: string;
  urgency?: string;
  category?: string;
  supplierId?: string;
  startDate?: Date;
  endDate?: Date;
}

export const ALLOWED_TRANSITIONS: Record<KanbanColumn, KanbanColumn[]> = {
  RC_PENDENTE: ['APROVADA'],
  APROVADA: ['EM_COTACAO'],
  EM_COTACAO: ['OC_EMITIDA'],
  OC_EMITIDA: ['AGUARDANDO_ENTREGA'],
  AGUARDANDO_ENTREGA: ['RECEBIDO'],
  RECEBIDO: ['PAGO'],
  PAGO: [],
};

export class PurchaseKanbanError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PurchaseKanbanError';
  }
}
