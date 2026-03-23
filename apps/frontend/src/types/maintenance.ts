// ─── Enums ─────────────────────────────────────────────────────────────

export type MaintenanceTriggerType = 'HOURMETER' | 'ODOMETER' | 'CALENDAR';

export type WorkOrderType = 'PREVENTIVA' | 'CORRETIVA' | 'SOLICITACAO';

export type WorkOrderStatus =
  | 'ABERTA'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_PECA'
  | 'ENCERRADA'
  | 'CANCELADA';

export type AccountingTreatment = 'DESPESA' | 'CAPITALIZACAO' | 'DIFERIMENTO';

// ─── Maintenance Plan ───────────────────────────────────────────────────

export interface MaintenancePlan {
  id: string;
  organizationId: string;
  assetId: string;
  name: string;
  description: string | null;
  triggerType: MaintenanceTriggerType;
  intervalValue: number;
  alertBeforeValue: number;
  lastExecutedAt: string | null;
  lastMeterValue: number | null;
  nextDueAt: string | null;
  nextDueMeter: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  asset?: { id: string; name: string; assetTag: string };
}

export interface CreateMaintenancePlanInput {
  assetId: string;
  name: string;
  description?: string;
  triggerType: MaintenanceTriggerType;
  intervalValue: number;
  alertBeforeValue: number;
}

export interface UpdateMaintenancePlanInput extends Partial<CreateMaintenancePlanInput> {
  isActive?: boolean;
}

export interface ListMaintenancePlansQuery {
  assetId?: string;
  triggerType?: MaintenanceTriggerType;
  isActive?: boolean;
  farmId?: string;
  page?: number;
  limit?: number;
}

export interface MaintenancePlanListResponse {
  data: MaintenancePlan[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Work Order ─────────────────────────────────────────────────────────

export interface WorkOrderPart {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes: string | null;
  product?: { id: string; name: string; unit: string };
}

export interface WorkOrderCCItem {
  id: string;
  costCenterId: string;
  farmId: string;
  amount: number;
  percentage: number;
}

export interface WorkOrder {
  id: string;
  organizationId: string;
  assetId: string;
  sequentialNumber: number;
  type: WorkOrderType;
  status: WorkOrderStatus;
  title: string;
  description: string | null;
  maintenancePlanId: string | null;
  assignedTo: string | null;
  openedAt: string;
  startedAt: string | null;
  closedAt: string | null;
  hourmeterAtOpen: number | null;
  odometerAtOpen: number | null;
  laborHours: number | null;
  laborCostPerHour: number | null;
  totalPartsCost: number | null;
  totalLaborCost: number | null;
  externalCost: number | null;
  totalCost: number | null;
  accountingTreatment: AccountingTreatment | null;
  photoUrls: string[];
  geoLat: number | null;
  geoLon: number | null;
  stockOutputId: string | null;
  costCenterId: string | null;
  costCenterMode: string;
  notes: string | null;
  parts: WorkOrderPart[];
  ccItems: WorkOrderCCItem[];
  asset?: { id: string; name: string; assetTag: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkOrderInput {
  assetId: string;
  type: WorkOrderType;
  title: string;
  description?: string;
  maintenancePlanId?: string;
  assignedTo?: string;
  hourmeterAtOpen?: number;
  odometerAtOpen?: number;
  photoUrls?: string[];
  geoLat?: number;
  geoLon?: number;
  costCenterId?: string;
}

export interface UpdateWorkOrderInput {
  title?: string;
  description?: string;
  status?: 'EM_ANDAMENTO' | 'AGUARDANDO_PECA';
  assignedTo?: string;
  notes?: string;
}

export interface AddWorkOrderPartInput {
  productId: string;
  quantity: number;
  unitCost: number;
  notes?: string;
}

export interface CloseWorkOrderInput {
  accountingTreatment: AccountingTreatment;
  laborHours?: number;
  laborCostPerHour?: number;
  externalCost?: number;
  externalSupplier?: string;
  costCenterId?: string;
  deferralMonths?: number;
  closedBy: string;
}

export interface ListWorkOrdersQuery {
  assetId?: string;
  status?: string;
  type?: string;
  farmId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface WorkOrderListResponse {
  data: WorkOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Dashboard ──────────────────────────────────────────────────────────

export interface MaintenanceDashboard {
  availability: number | null;
  mtbfHours: number | null;
  mttrHours: number | null;
  totalCostYTD: number;
  openOrdersCount: number;
  overdueMaintenancesCount: number;
  byStatus: Record<string, number>;
  costByAsset: Array<{ assetId: string; assetName: string; totalCost: number }>;
  recentOrders: WorkOrder[];
}

// ─── Labels ────────────────────────────────────────────────────────────

export const TRIGGER_TYPE_LABELS: Record<MaintenanceTriggerType, string> = {
  HOURMETER: 'Horimetro',
  ODOMETER: 'Km',
  CALENDAR: 'Calendario',
};

export const WORK_ORDER_TYPE_LABELS: Record<WorkOrderType, string> = {
  PREVENTIVA: 'Preventiva',
  CORRETIVA: 'Corretiva',
  SOLICITACAO: 'Solicitacao',
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  ABERTA: 'ABERTA',
  EM_ANDAMENTO: 'EM ANDAMENTO',
  AGUARDANDO_PECA: 'AGUARDANDO PECA',
  ENCERRADA: 'ENCERRADA',
  CANCELADA: 'CANCELADA',
};
