// ─── Error ──────────────────────────────────────────────────────────

export class CompositeProductError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'CompositeProductError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const COMPOSITE_TYPES = [
  'calda',
  'mistura_fertilizante',
  'racao_concentrado',
  'pre_mistura_mineral',
  'outro',
] as const;
export type CompositeTypeValue = (typeof COMPOSITE_TYPES)[number];

export const COMPOSITE_TYPE_LABELS: Record<CompositeTypeValue, string> = {
  calda: 'Calda de defensivo',
  mistura_fertilizante: 'Mistura de fertilizante',
  racao_concentrado: 'Ração/Concentrado',
  pre_mistura_mineral: 'Pré-mistura mineral',
  outro: 'Outro',
};

// ─── Input Types ────────────────────────────────────────────────────

export interface IngredientInput {
  ingredientProductId: string;
  quantityPerBatch: number;
  sortOrder?: number;
  notes?: string | null;
}

export interface SetCompositeInput {
  isComposite: boolean;
  compositeType: string;
  batchSize: number;
  batchUnit: string;
  ingredients: IngredientInput[];
}

export interface AddIngredientInput {
  ingredientProductId: string;
  quantityPerBatch: number;
  sortOrder?: number;
  notes?: string | null;
}

export interface ProductionIngredientInput {
  productId: string;
  quantityUsed: number;
  sourceBatchNumber?: string | null;
}

export interface RecordProductionInput {
  compositeProductId: string;
  productionDate: string; // ISO date
  batchNumber?: string | null;
  quantityProduced: number;
  responsibleName: string;
  ingredients: ProductionIngredientInput[];
  notes?: string | null;
}

export interface ListProductionsQuery {
  compositeProductId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface CompositeIngredientItem {
  id: string;
  ingredientProductId: string;
  ingredientProductName: string;
  ingredientMeasurementUnit: string | null;
  quantityPerBatch: number;
  unitCostCents: number;
  sortOrder: number;
  notes: string | null;
}

export interface CompositeProductDetail {
  productId: string;
  productName: string;
  compositeType: string;
  compositeTypeLabel: string;
  batchSize: number;
  batchUnit: string;
  ingredients: CompositeIngredientItem[];
  estimatedCostCents: number;
}

export interface ProductionItemDetail {
  ingredientProductId: string;
  ingredientProductName: string;
  quantityUsed: number;
  unitCostCents: number;
  totalCostCents: number;
  sourceBatchNumber: string | null;
}

export interface ProductionItem {
  id: string;
  compositeProductId: string;
  productName: string;
  productionDate: string;
  batchNumber: string | null;
  quantityProduced: number;
  totalCostCents: number;
  responsibleName: string;
  stockEntryId: string | null;
  stockOutputId: string | null;
  items: ProductionItemDetail[];
  createdAt: string;
}
