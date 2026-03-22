// ─── Error ──────────────────────────────────────────────────────────

export class AssetInventoryError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AssetInventoryError';
  }
}

// ─── Status Constants ─────────────────────────────────────────────────

export const PHYSICAL_STATUSES = [
  'ENCONTRADO',
  'NAO_ENCONTRADO',
  'AVARIADO',
  'DESCARTADO',
] as const;
export type PhysicalStatus = (typeof PHYSICAL_STATUSES)[number];

export const PHYSICAL_STATUS_LABELS: Record<PhysicalStatus, string> = {
  ENCONTRADO: 'Encontrado',
  NAO_ENCONTRADO: 'Nao encontrado',
  AVARIADO: 'Avariado',
  DESCARTADO: 'Descartado',
};

export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  COUNTING: 'Em contagem',
  RECONCILED: 'Conciliado',
  CANCELLED: 'Cancelado',
};

// ─── Input Types ──────────────────────────────────────────────────────

export interface CreateInventoryInput {
  farmId?: string; // null = all farms
  notes?: string;
}

export interface CountItemInput {
  assetId: string;
  physicalStatus: PhysicalStatus;
  notes?: string;
}

export interface ReconcileInventoryInput {
  items: { assetId: string; action?: string }[];
}

// ─── Output Types ─────────────────────────────────────────────────────

export interface InventoryItemOutput {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  assetType: string;
  registeredStatus: string;
  physicalStatus: string | null;
  physicalStatusLabel: string | null;
  notes: string | null;
}

export interface InventoryOutput {
  id: string;
  farmId: string | null;
  farmName: string | null;
  status: string;
  statusLabel: string;
  notes: string | null;
  reconciledAt: string | null;
  reconciledBy: string | null;
  items: InventoryItemOutput[];
  itemCount: number;
  countedCount: number;
  divergenceCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListInventoriesQuery {
  page?: number;
  limit?: number;
  status?: string;
  farmId?: string;
}
