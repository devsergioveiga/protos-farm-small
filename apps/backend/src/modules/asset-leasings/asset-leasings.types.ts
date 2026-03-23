// ─── Error ──────────────────────────────────────────────────────────

export class AssetLeasingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AssetLeasingError';
  }
}

// ─── Status Types ────────────────────────────────────────────────────

export type LeasingStatus = 'ACTIVE' | 'PURCHASE_OPTION_EXERCISED' | 'RETURNED' | 'CANCELLED';

export const LEASING_STATUS_LABELS: Record<LeasingStatus, string> = {
  ACTIVE: 'Ativo',
  PURCHASE_OPTION_EXERCISED: 'Opcao Exercida',
  RETURNED: 'Devolvido',
  CANCELLED: 'Cancelado',
};

// ─── Input Types ─────────────────────────────────────────────────────

export interface CreateLeasingInput {
  farmId: string;
  assetType: string;           // user chooses: MAQUINA, VEICULO, BENFEITORIA, IMPLEMENTO
  assetName: string;           // name for the ROU asset
  lessorName: string;
  lessorDocument?: string;
  contractNumber?: string;
  contractDate: string;        // ISO 8601
  startDate: string;           // ISO 8601
  endDate: string;             // ISO 8601
  totalContractValue: number;
  installmentCount: number;
  firstDueDate: string;        // ISO 8601
  purchaseOptionValue?: number;
  purchaseOptionDate?: string;
  hasPurchaseOption?: boolean;
  notes?: string;
}

// ─── Output Types ────────────────────────────────────────────────────

export interface LeasingOutput {
  id: string;
  organizationId: string;
  farmId: string;
  farmName: string;
  rouAssetId: string;
  rouAssetTag: string;
  rouAssetName: string;
  lessorName: string;
  lessorDocument: string | null;
  contractNumber: string | null;
  contractDate: string;
  startDate: string;
  endDate: string;
  totalContractValue: number;
  monthlyInstallment: number;
  installmentCount: number;
  purchaseOptionValue: number | null;
  purchaseOptionDate: string | null;
  hasPurchaseOption: boolean;
  status: LeasingStatus;
  statusLabel: string;
  payableId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}
