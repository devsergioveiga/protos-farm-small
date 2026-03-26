// ─── Error ───────────────────────────────────────────────────────────

export class WorkOrderError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'WorkOrderError';
  }
}

// ─── Input Types ─────────────────────────────────────────────────────

export interface CreateWorkOrderInput {
  assetId: string;
  type: 'PREVENTIVA' | 'CORRETIVA' | 'SOLICITACAO';
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
  accountingTreatment: 'DESPESA' | 'CAPITALIZACAO' | 'DIFERIMENTO';
  laborHours?: number;
  laborCostPerHour?: number;
  externalCost?: number;
  externalSupplier?: string;
  costCenterId?: string; // override asset CC
  deferralMonths?: number; // required when DIFERIMENTO
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

// ─── Output Types ────────────────────────────────────────────────────

export interface WorkOrderPartOutput {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes: string | null;
  product?: { id: string; name: string; unit: string };
}

export interface WorkOrderCCItemOutput {
  id: string;
  costCenterId: string;
  farmId: string;
  amount: number;
  percentage: number;
}

export interface WorkOrderOutput {
  id: string;
  organizationId: string;
  assetId: string;
  sequentialNumber: number;
  type: string;
  status: string;
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
  accountingTreatment: string | null;
  photoUrls: string[];
  geoLat: number | null;
  geoLon: number | null;
  stockOutputId: string | null;
  costCenterId: string | null;
  costCenterMode: string;
  notes: string | null;
  parts: WorkOrderPartOutput[];
  ccItems: WorkOrderCCItemOutput[];
  asset?: { id: string; name: string; assetTag: string };
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceDashboardOutput {
  availability: number | null;
  mtbfHours: number | null;
  mttrHours: number | null;
  totalCostYTD: number;
  openOrdersCount: number;
  overdueMaintenancesCount: number;
  byStatus: Record<string, number>;
  costByAsset: Array<{ assetId: string; assetName: string; totalCost: number }>;
  recentOrders: WorkOrderOutput[];
}

export interface RlsContext {
  userId: string;
  organizationId: string;
}
