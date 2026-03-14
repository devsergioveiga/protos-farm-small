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

export interface ProductionsResponse {
  data: ProductionItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const COMPOSITE_TYPES = [
  { value: 'calda', label: 'Calda de defensivo' },
  { value: 'mistura_fertilizante', label: 'Mistura de fertilizante' },
  { value: 'racao_concentrado', label: 'Ração/Concentrado' },
  { value: 'pre_mistura_mineral', label: 'Pré-mistura mineral' },
  { value: 'outro', label: 'Outro' },
] as const;
