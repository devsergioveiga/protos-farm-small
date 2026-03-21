// ─── Maintenance Plan ──────────────────────────────────────────────────

export type MaintenanceTriggerType = 'HOURMETER' | 'ODOMETER' | 'CALENDAR';

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
  description?: string | null;
  triggerType: MaintenanceTriggerType;
  intervalValue: number;
  alertBeforeValue: number;
}

export interface UpdateMaintenancePlanInput {
  name?: string;
  description?: string | null;
  triggerType?: MaintenanceTriggerType;
  intervalValue?: number;
  alertBeforeValue?: number;
  isActive?: boolean;
}

// ─── Work Order ────────────────────────────────────────────────────────

export type WorkOrderType = 'PREVENTIVA' | 'CORRETIVA' | 'SOLICITACAO';
export type WorkOrderStatus =
  | 'ABERTA'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_PECA'
  | 'ENCERRADA'
  | 'CANCELADA';
export type AccountingTreatment = 'DESPESA' | 'CAPITALIZACAO' | 'DIFERIMENTO';

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
  closedAt: string | null;
  totalPartsCost: number | null;
  totalLaborCost: number | null;
  externalCost: number | null;
  totalCost: number | null;
  accountingTreatment: AccountingTreatment | null;
  photoUrls: string[];
  geoLat: number | null;
  geoLon: number | null;
  costCenterId: string | null;
  costCenterMode: string;
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
  description?: string | null;
  maintenancePlanId?: string | null;
  assignedTo?: string | null;
  totalLaborCost?: number | null;
  externalCost?: number | null;
  costCenterId?: string | null;
}

export interface AddWorkOrderPartInput {
  productId: string;
  quantity: number;
  unitCost: number;
  notes?: string | null;
}

export interface CloseWorkOrderInput {
  accountingTreatment: AccountingTreatment;
  deferralMonths?: number | null;
  closedBy?: string | null;
}

// ─── Dashboard ─────────────────────────────────────────────────────────

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
  overduePlans?: Array<{ id: string; name: string; daysOverdue: number; assetName: string }>;
}

// ─── Maintenance Provision ─────────────────────────────────────────────

export interface MaintenanceProvision {
  id: string;
  organizationId: string;
  assetId: string | null;
  monthlyAmount: number;
  costCenterId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  asset?: { id: string; name: string; assetTag: string } | null;
}

export interface CreateMaintenanceProvisionInput {
  assetId?: string | null;
  monthlyAmount: number;
  costCenterId?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export interface ProvisionReconciliation {
  year: number;
  month: number;
  totalProvisioned: number;
  totalActual: number;
  difference: number;
  items: Array<{
    assetId: string | null;
    assetName: string | null;
    provisioned: number;
    actual: number;
    difference: number;
  }>;
}
