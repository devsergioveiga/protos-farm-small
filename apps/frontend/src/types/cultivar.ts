export interface CultivarItem {
  id: string;
  organizationId: string;
  name: string;
  crop: string;
  breeder: string | null;
  cycleDays: number | null;
  maturationGroup: string | null;
  type: string;
  technology: string | null;
  diseaseTolerances: string | null;
  regionalAptitude: string | null;
  populationRecommendation: string | null;
  plantingWindowStart: string | null;
  plantingWindowEnd: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CultivarsResponse {
  data: CultivarItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateCultivarInput {
  name: string;
  crop: string;
  breeder?: string;
  cycleDays?: number | null;
  maturationGroup?: string;
  type?: string;
  technology?: string;
  diseaseTolerances?: string;
  regionalAptitude?: string;
  populationRecommendation?: string;
  plantingWindowStart?: string;
  plantingWindowEnd?: string;
  notes?: string;
}

export interface CultivarPlotHistoryItem {
  plotId: string;
  plotName: string;
  seasons: {
    seasonYear: string;
    seasonType: string;
    cultivarId: string | null;
    cultivarName: string | null;
    productivityKgHa: number | null;
    totalProductionKg: number | null;
    notes: string | null;
  }[];
}

export interface CultivarProductivityComparison {
  cultivarId: string;
  cultivarName: string;
  crop: string;
  avgProductivityKgHa: number | null;
  totalPlantings: number;
  entries: {
    seasonYear: string;
    seasonType: string;
    plotName: string;
    plotId: string;
    plantedAreaHa: number | null;
    productivityKgHa: number | null;
    totalProductionKg: number | null;
    notes: string | null;
  }[];
}

export const CULTIVAR_TYPES = [
  { value: 'CONVENCIONAL', label: 'Convencional' },
  { value: 'TRANSGENICO', label: 'Transgênico' },
] as const;

export const CROP_OPTIONS = [
  'Soja',
  'Milho',
  'Algodão',
  'Feijão',
  'Trigo',
  'Arroz',
  'Café',
  'Cana-de-açúcar',
  'Laranja',
  'Sorgo',
  'Girassol',
  'Amendoim',
  'Outro',
] as const;
