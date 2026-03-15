// ─── Constants ─────────────────────────────────────────────────────

export const ANIMAL_CATEGORIES = [
  { value: 'VACA_LACTACAO', label: 'Vaca em lactação' },
  { value: 'VACA_SECA', label: 'Vaca seca' },
  { value: 'NOVILHA', label: 'Novilha' },
  { value: 'BEZERRO', label: 'Bezerro(a)' },
  { value: 'TOURO', label: 'Touro' },
  { value: 'BOI_ENGORDA', label: 'Boi de engorda' },
  { value: 'RECRIA', label: 'Recria' },
  { value: 'CRIA', label: 'Cria' },
] as const;

export const ANIMAL_CATEGORY_MAP: Record<string, string> = {
  VACA_LACTACAO: 'Vaca em lactação',
  VACA_SECA: 'Vaca seca',
  NOVILHA: 'Novilha',
  BEZERRO: 'Bezerro(a)',
  TOURO: 'Touro',
  BOI_ENGORDA: 'Boi de engorda',
  RECRIA: 'Recria',
  CRIA: 'Cria',
};

// ─── Response Types ─────────────────────────────────────────────────

export interface NutrientCalculation {
  totalDmKgDay: number | null;
  totalCpGDay: number | null;
  cpPercentDm: number | null;
  ndfPercentDm: number | null;
  adfPercentDm: number | null;
  eePercentDm: number | null;
  tdnPercentDm: number | null;
  nelMcalDay: number | null;
  nelMcalKgDm: number | null;
  caGDay: number | null;
  pGDay: number | null;
  roughageConcentrateRatio: number | null;
  costPerAnimalDay: number | null;
  costPerKgDm: number | null;
}

export interface DietIngredientItem {
  id: string;
  feedIngredientId: string;
  feedIngredientName: string;
  feedIngredientType: string;
  quantityKgDay: number;
  sortOrder: number;
  dmKgDay: number | null;
  cpGDay: number | null;
  costPerDay: number | null;
  notes: string | null;
}

export interface DietLotAssignmentItem {
  id: string;
  lotId: string;
  lotName: string;
  animalCount: number;
  startDate: string;
  endDate: string | null;
}

export interface DietItem {
  id: string;
  organizationId: string;
  name: string;
  targetCategory: string;
  targetCategoryLabel: string;
  startDate: string | null;
  endDate: string | null;
  nutritionist: string | null;
  objective: string | null;
  version: number;
  parentId: string | null;
  isActive: boolean;
  nutrients: NutrientCalculation;
  ingredientCount: number;
  lotCount: number;
  notes: string | null;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DietDetail extends DietItem {
  ingredients: DietIngredientItem[];
  lotAssignments: DietLotAssignmentItem[];
}

export interface DietsResponse {
  data: DietItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DietVersionItem {
  id: string;
  version: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  creatorName: string;
}

export interface SimulationResult {
  nutrients: NutrientCalculation;
  ingredients: Array<{
    feedIngredientId: string;
    feedIngredientName: string;
    feedIngredientType: string;
    quantityKgDay: number;
    dmKgDay: number | null;
    cpGDay: number | null;
    costPerDay: number | null;
  }>;
}

// ─── Input Types ────────────────────────────────────────────────────

export interface DietIngredientInput {
  feedIngredientId: string;
  quantityKgDay: number;
  sortOrder?: number;
  notes?: string | null;
}

export interface CreateDietInput {
  name: string;
  targetCategory: string;
  startDate?: string | null;
  endDate?: string | null;
  nutritionist?: string | null;
  objective?: string | null;
  notes?: string | null;
  ingredients: DietIngredientInput[];
}

export interface UpdateDietInput {
  name?: string;
  targetCategory?: string;
  startDate?: string | null;
  endDate?: string | null;
  nutritionist?: string | null;
  objective?: string | null;
  notes?: string | null;
  ingredients?: DietIngredientInput[];
}

export interface AssignLotInput {
  lotId: string;
  startDate: string;
  endDate?: string | null;
}

// ─── Feed Ingredient (for selects) ─────────────────────────────────

export interface FeedIngredientOption {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  costPerKg: number | null;
}
