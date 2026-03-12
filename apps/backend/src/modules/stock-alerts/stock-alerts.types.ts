// ─── Error ──────────────────────────────────────────────────────────

export class StockAlertError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'StockAlertError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const STOCK_LEVELS = ['CRITICAL', 'WARNING', 'OK'] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number];

export const DEFAULT_EXPIRY_ALERT_DAYS = [90, 60, 30] as const;

// Tipos de defensivo para alerta InpEV (CA6)
export const PESTICIDE_TYPES = [
  'defensivo_herbicida',
  'defensivo_inseticida',
  'defensivo_fungicida',
  'defensivo_acaricida',
  'adjuvante',
] as const;

// ─── Output Types ──────────────────────────────────────────────────

export interface StockLevelAlert {
  productId: string;
  productName: string;
  productType: string;
  measurementUnit: string | null;
  currentQuantity: number;
  reorderPoint: number | null;
  safetyStock: number | null;
  averageCost: number;
  totalValue: number;
  level: StockLevel;
}

export interface ExpiryAlert {
  productId: string;
  productName: string;
  productType: string;
  measurementUnit: string | null;
  batchNumber: string | null;
  expirationDate: string;
  daysUntilExpiry: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  isExpired: boolean;
  isPesticide: boolean;
  inpevRequired: boolean; // CA6: obrigação logística reversa
}

export interface StockDashboardSummary {
  totalProducts: number;
  criticalCount: number; // abaixo do mínimo (vermelho)
  warningCount: number; // em nível de segurança (amarelo)
  okCount: number; // OK (verde)
  noThresholdCount: number; // sem limites configurados
  expiredCount: number;
  expiringCount: number; // a vencer nos próximos 90 dias
  totalStockValue: number;
}

export interface StockLevelDashboard {
  summary: StockDashboardSummary;
  alerts: StockLevelAlert[];
}

export interface ListStockLevelAlertsQuery {
  level?: StockLevel;
  productType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListExpiryAlertsQuery {
  daysAhead?: number; // padrão 90
  includeExpired?: boolean; // incluir já vencidos (padrão true)
  productType?: string;
  isPesticide?: boolean; // CA6: filtrar defensivos
  search?: string;
  page?: number;
  limit?: number;
}

export interface ExpiryReportQuery {
  daysAhead?: number;
  includeExpired?: boolean;
  productType?: string;
  format?: 'json' | 'csv';
}

export interface StockLevelAlertsResult {
  data: StockLevelAlert[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ExpiryAlertsResult {
  data: ExpiryAlert[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
