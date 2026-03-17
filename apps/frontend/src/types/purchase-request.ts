export type PurchaseRequestStatus =
  | 'RASCUNHO'
  | 'PENDENTE'
  | 'APROVADA'
  | 'REJEITADA'
  | 'DEVOLVIDA'
  | 'CANCELADA';

export type PurchaseRequestUrgency = 'NORMAL' | 'URGENTE' | 'EMERGENCIAL';

export const RC_STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  RASCUNHO: 'Rascunho',
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  DEVOLVIDA: 'Devolvida',
  CANCELADA: 'Cancelada',
};

export const RC_URGENCY_LABELS: Record<PurchaseRequestUrgency, string> = {
  NORMAL: 'Normal',
  URGENTE: 'Urgente',
  EMERGENCIAL: 'Emergencial',
};

export { SUPPLIER_CATEGORY_LABELS } from './supplier';

export interface PurchaseRequestItem {
  id?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitId?: string;
  unitName: string;
  estimatedUnitPrice?: number;
  notes?: string;
}

export interface ApprovalAction {
  id: string;
  step: number;
  assignedTo: string;
  originalAssignee?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  comment?: string;
  decidedAt?: string;
  createdAt: string;
  assignee: { id: string; name: string; email?: string };
}

export interface TransitionInput {
  action: 'APPROVE' | 'REJECT' | 'RETURN' | 'CANCEL' | 'SUBMIT';
  comment?: string;
}

export interface PurchaseRequest {
  id: string;
  sequentialNumber: string;
  requestType: string;
  farmId: string;
  urgency: PurchaseRequestUrgency;
  status: PurchaseRequestStatus;
  justification?: string;
  costCenterId?: string;
  neededBy?: string;
  slaDeadline?: string;
  createdBy: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseRequestItem[];
  attachments?: PurchaseRequestAttachment[];
  approvalActions?: ApprovalAction[];
  farm: { id: string; name: string };
  creator: { id: string; name: string; email?: string };
  costCenter?: { id: string; name: string };
}

export interface PurchaseRequestAttachment {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface CreatePurchaseRequestInput {
  requestType: string;
  farmId: string;
  urgency: PurchaseRequestUrgency;
  justification?: string;
  costCenterId?: string;
  neededBy?: string;
  items: Omit<PurchaseRequestItem, 'id'>[];
}

export interface PurchaseRequestListResponse {
  data: PurchaseRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
