// ─── Query Params ─────────────────────────────────────────────────────────────

export interface SavingQueryParams {
  startDate: string;
  endDate: string;
  category?: string;
  supplierId?: string;
}

// ─── Saving Types ─────────────────────────────────────────────────────────────

export interface QuotationSavingItem {
  productName: string;
  maxPrice: string;
  winnerPrice: string;
  saving: string;
}

export interface QuotationSaving {
  quotationId: string;
  sequentialNumber: string;
  createdAt: string;
  supplierCount: number;
  savingTotal: string;
  items: QuotationSavingItem[];
}

export interface SavingSummary {
  totalSaving: string;
  quotationCount: number;
  avgSavingPercent: string;
  savings: QuotationSaving[];
}

// ─── Price History Types ───────────────────────────────────────────────────────

export interface PriceHistoryPoint {
  date: string;
  price: string;
  purchaseOrderNumber: string;
  supplierName: string;
}

export interface PriceHistoryResult {
  productId: string;
  productName: string;
  points: PriceHistoryPoint[];
}

// ─── Cycle Indicator Types ────────────────────────────────────────────────────

export interface CycleIndicators {
  percentFormal: string;
  percentEmergency: string;
  avgCycleDays: string;
  totalOrders: number;
}

// ─── Top Products and Suppliers ───────────────────────────────────────────────

export interface TopProductBySpend {
  productId: string;
  productName: string;
  totalSpent: string;
  orderCount: number;
}

export interface TopSupplierByVolume {
  supplierId: string;
  supplierName: string;
  totalVolume: string;
  orderCount: number;
}

// ─── Analytics Dashboard ──────────────────────────────────────────────────────

export interface AnalyticsDashboard {
  saving: SavingSummary;
  indicators: CycleIndicators;
  topProducts: TopProductBySpend[];
  topSuppliers: TopSupplierByVolume[];
}
