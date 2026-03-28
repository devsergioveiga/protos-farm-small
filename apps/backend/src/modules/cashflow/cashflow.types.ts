// ─── DFC Classification ──────────────────────────────────────────────

export type DfcCategory = 'OPERACIONAL' | 'INVESTIMENTO' | 'FINANCIAMENTO';

// Map PayableCategory enum values (from schema.prisma) to DFC classification
// PayableCategory: INPUTS | MAINTENANCE | PAYROLL | RENT | SERVICES | TAXES | FINANCING | OTHER | CARTAO_CREDITO
export const PAYABLE_DFC_MAP: Record<string, DfcCategory> = {
  INPUTS: 'OPERACIONAL',
  MAINTENANCE: 'OPERACIONAL',
  PAYROLL: 'OPERACIONAL',
  RENT: 'OPERACIONAL',
  SERVICES: 'OPERACIONAL',
  TAXES: 'OPERACIONAL',
  FINANCING: 'FINANCIAMENTO',
  OTHER: 'OPERACIONAL',
  CARTAO_CREDITO: 'OPERACIONAL',
  ASSET_ACQUISITION: 'INVESTIMENTO',
};

// Map ReceivableCategory enum values (from schema.prisma) to DFC classification
// ReceivableCategory: GRAIN_SALE | CATTLE_SALE | MILK_SALE | LEASE | SERVICES | OTHER | ASSET_SALE
export const RECEIVABLE_DFC_MAP: Record<string, DfcCategory> = {
  GRAIN_SALE: 'OPERACIONAL',
  CATTLE_SALE: 'OPERACIONAL',
  MILK_SALE: 'OPERACIONAL',
  LEASE: 'OPERACIONAL',
  SERVICES: 'OPERACIONAL',
  OTHER: 'OPERACIONAL',
  ASSET_SALE: 'INVESTIMENTO',
};

// ─── Projection types ────────────────────────────────────────────────

export interface ProjectionPoint {
  date: string; // ISO date string (YYYY-MM format)
  label: string; // "Jan 26", "Fev 26", etc.
  balanceRealistic: number;
  balanceOptimistic: number;
  balancePessimistic: number;
  inflows: number;
  outflows: number;
  checksPending: number;
}

export interface CashflowProjection {
  currentBalance: number;
  projectionPoints: ProjectionPoint[];
  negativeBalanceDate: string | null; // First date where realistic balance < 0
  negativeBalanceAmount: number | null;
  dfc: DfcSummary;
}

export interface DfcEntry {
  category: string; // PayableCategory or ReceivableCategory
  dfcClass: DfcCategory;
  monthlyAmounts: number[]; // 12 values (one per month)
  total: number;
}

export interface DfcSummary {
  inflows: DfcEntry[];
  outflows: DfcEntry[];
  operacional: { totalInflows: number; totalOutflows: number; net: number };
  investimento: { totalInflows: number; totalOutflows: number; net: number };
  financiamento: { totalInflows: number; totalOutflows: number; net: number };
}

// ─── Query ───────────────────────────────────────────────────────────

export interface CashflowQuery {
  farmId?: string;
}

// ─── Error ───────────────────────────────────────────────────────────

export class CashflowError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'CashflowError';
    this.statusCode = statusCode;
  }
}
