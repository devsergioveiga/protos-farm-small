// ─── Error ────────────────────────────────────────────────────────────

export class MaintenanceProvisionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MaintenanceProvisionError';
  }
}

// ─── Input Types ──────────────────────────────────────────────────────

export interface CreateMaintenanceProvisionInput {
  assetId?: string; // null = fleet-level
  monthlyAmount: number;
  costCenterId?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateMaintenanceProvisionInput {
  assetId?: string;
  monthlyAmount?: number;
  costCenterId?: string;
  description?: string;
  isActive?: boolean;
}

export interface ListMaintenanceProvisionsQuery {
  assetId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// ─── Output Types ────────────────────────────────────────────────────

export interface MaintenanceProvisionOutput {
  id: string;
  organizationId: string;
  assetId: string | null;
  monthlyAmount: number;
  costCenterId: string | null;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  asset?: { id: string; name: string; assetTag: string } | null;
}

export interface ProvisionReconciliationOutput {
  periodYear: number;
  periodMonth: number;
  totalProvisioned: number;
  totalActualCost: number;
  variance: number;
  byAsset: Array<{
    assetId: string;
    assetName: string;
    provisioned: number;
    actual: number;
    variance: number;
  }>;
}

export interface RlsContext {
  userId: string;
  organizationId: string;
}
