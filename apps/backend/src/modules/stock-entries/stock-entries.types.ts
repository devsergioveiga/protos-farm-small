// ─── Error ──────────────────────────────────────────────────────────

export class StockEntryError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'StockEntryError';
  }
}

// ─── Enums / Constants ──────────────────────────────────────────────

export const STOCK_ENTRY_STATUSES = ['DRAFT', 'CONFIRMED', 'CANCELLED'] as const;
export type StockEntryStatusType = (typeof STOCK_ENTRY_STATUSES)[number];

export const EXPENSE_TYPES = [
  'FREIGHT',
  'INSURANCE',
  'UNLOADING',
  'TOLL',
  'TEMPORARY_STORAGE',
  'PACKAGING',
  'PORT_FEE',
  'ICMS_ST',
  'IPI',
  'OTHER',
] as const;
export type ExpenseTypeValue = (typeof EXPENSE_TYPES)[number];

export const APPORTIONMENT_METHODS = ['BY_VALUE', 'BY_QUANTITY', 'BY_WEIGHT', 'FIXED'] as const;
export type ApportionmentMethodValue = (typeof APPORTIONMENT_METHODS)[number];

export const EXPENSE_TYPE_LABELS: Record<ExpenseTypeValue, string> = {
  FREIGHT: 'Frete',
  INSURANCE: 'Seguro de carga',
  UNLOADING: 'Descarga/manuseio',
  TOLL: 'Pedágio',
  TEMPORARY_STORAGE: 'Armazenagem temporária',
  PACKAGING: 'Embalagem',
  PORT_FEE: 'Taxa portuária',
  ICMS_ST: 'ICMS-ST',
  IPI: 'IPI não recuperável',
  OTHER: 'Outro',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface StockEntryItemInput {
  productId: string;
  quantity: number;
  unitCost: number;
  /** Unidade de compra (abbreviation do MeasurementUnit, ex: 't', 'sc'). Opcional — se omitido, usa unidade padrão do produto */
  purchaseUnitAbbreviation?: string;
  batchNumber?: string;
  manufacturingDate?: string;
  expirationDate?: string;
  weightKg?: number;
}

export interface StockEntryExpenseInput {
  expenseType: ExpenseTypeValue;
  description?: string;
  supplierName?: string;
  invoiceNumber?: string;
  amount: number;
  apportionmentMethod?: ApportionmentMethodValue;
}

export interface CreateStockEntryInput {
  entryDate?: string;
  supplierName?: string;
  invoiceNumber?: string;
  storageFarmId?: string;
  storageLocation?: string;
  storageSublocation?: string;
  notes?: string;
  items: StockEntryItemInput[];
  expenses?: StockEntryExpenseInput[];
}

export interface AddExpenseInput {
  expenseType: ExpenseTypeValue;
  description?: string;
  supplierName?: string;
  invoiceNumber?: string;
  amount: number;
  apportionmentMethod?: ApportionmentMethodValue;
}

export interface ListStockEntriesQuery {
  page?: number;
  limit?: number;
  status?: StockEntryStatusType;
  supplierName?: string;
  dateFrom?: string;
  dateTo?: string;
  productId?: string;
}

// ─── Output Types ───────────────────────────────────────────────────

export interface StockEntryItemOutput {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  batchNumber: string | null;
  manufacturingDate: string | null;
  expirationDate: string | null;
  apportionedExpenses: number;
  finalUnitCost: number;
  finalTotalCost: number;
  weightKg: number | null;
  // US-097: conversão compra → estoque
  purchaseUnitAbbreviation: string | null;
  stockQuantity: number | null;
  stockUnitAbbreviation: string | null;
  conversionFactor: number | null;
}

export interface StockEntryExpenseOutput {
  id: string;
  expenseType: ExpenseTypeValue;
  expenseTypeLabel: string;
  description: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  amount: number;
  apportionmentMethod: ApportionmentMethodValue;
  isRetroactive: boolean;
}

export interface StockEntryOutput {
  id: string;
  entryDate: string;
  status: StockEntryStatusType;
  supplierName: string | null;
  invoiceNumber: string | null;
  storageFarmId: string | null;
  storageFarmName: string | null;
  storageLocation: string | null;
  storageSublocation: string | null;
  notes: string | null;
  totalMerchandiseCost: number;
  totalExpensesCost: number;
  totalCost: number;
  items: StockEntryItemOutput[];
  expenses: StockEntryExpenseOutput[];
  createdAt: string;
  updatedAt: string;
}

export interface StockBalanceOutput {
  id: string;
  productId: string;
  productName: string;
  productType: string;
  measurementUnit: string | null;
  currentQuantity: number;
  averageCost: number;
  totalValue: number;
  lastEntryDate: string | null;
}

export interface ListStockEntriesResult {
  data: StockEntryOutput[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
