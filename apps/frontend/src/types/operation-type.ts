// ─── Field Configuration ────────────────────────────────────────────

export type FieldVisibility = 'required' | 'optional' | 'hidden';

export const OPERATION_FIELD_KEYS = [
  'product',
  'dose',
  'volume',
  'machine',
  'implement',
  'operator',
  'depth',
  'spacing',
  'seedRate',
  'plantPopulation',
  'weather',
  'soilMoisture',
  'notes',
  'photos',
  'litersPerPerson',
  'harvestWeight',
  'area',
] as const;

export type OperationFieldKey = (typeof OPERATION_FIELD_KEYS)[number];

export const OPERATION_FIELD_LABELS: Record<OperationFieldKey, string> = {
  product: 'Produto/Insumo',
  dose: 'Dose (kg/ha ou L/ha)',
  volume: 'Volume de calda (L/ha)',
  machine: 'Máquina',
  implement: 'Implemento',
  operator: 'Operador',
  depth: 'Profundidade (cm)',
  spacing: 'Espaçamento (cm)',
  seedRate: 'Taxa de semeadura (kg/ha)',
  plantPopulation: 'População de plantas',
  weather: 'Condições climáticas',
  soilMoisture: 'Umidade do solo',
  notes: 'Observações',
  photos: 'Fotos',
  litersPerPerson: 'Litros por pessoa',
  harvestWeight: 'Peso da colheita',
  area: 'Área trabalhada',
};

export interface FieldConfig {
  fieldKey: OperationFieldKey;
  visibility: FieldVisibility;
  sortOrder: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface OperationTypeItem {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  childCount: number;
  crops: string[];
  fields: FieldConfig[];
  createdAt: string;
  updatedAt: string;
}

export const CROP_OPTIONS_OPERATION = [
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
  'Pastagem',
  'Todas',
] as const;

export interface OperationTypeTreeNode extends OperationTypeItem {
  children: OperationTypeTreeNode[];
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateOperationTypeInput {
  name: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  crops?: string[];
  fields?: FieldConfig[];
}

export type UpdateOperationTypeInput = Partial<CreateOperationTypeInput>;
