// ─── Error ──────────────────────────────────────────────────────────

export class OperationTypeError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'OperationTypeError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const MAX_LEVELS = 3;

export const LEVEL_1_CATEGORIES = [
  'Preparo de Solo',
  'Plantio',
  'Tratos Culturais',
  'Colheita',
  'Pós-Colheita',
  'Manejo de Pastagem',
] as const;

export const ALL_CROPS = [
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

export interface ListOperationTypesQuery {
  parentId?: string | null;
  level?: number;
  search?: string;
  includeInactive?: boolean;
  crop?: string;
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

export interface OperationTypeTreeNode extends OperationTypeItem {
  children: OperationTypeTreeNode[];
}

// ─── CA6: Crop Operation Sequence Types ─────────────────────────────

export interface CropOperationSequenceItem {
  id: string;
  organizationId: string;
  crop: string;
  operationTypeId: string;
  operationTypeName: string;
  sequenceOrder: number;
  notes: string | null;
}

export interface SetCropSequenceInput {
  crop: string;
  items: Array<{
    operationTypeId: string;
    notes?: string | null;
  }>;
}

// ─── CA6: Default Crop Sequences ────────────────────────────────────

interface DefaultSequenceItem {
  operationName: string;
  notes?: string;
}

interface DefaultCropSequence {
  crop: string;
  items: DefaultSequenceItem[];
}

export const DEFAULT_CROP_SEQUENCES: DefaultCropSequence[] = [
  {
    crop: 'Café',
    items: [
      { operationName: 'Poda', notes: 'Após colheita ou no inverno' },
      { operationName: 'Calagem', notes: 'Correção de solo' },
      { operationName: 'Adubação de cobertura', notes: 'Início das chuvas' },
      { operationName: 'Pulverização', notes: 'Controle fitossanitário' },
      { operationName: 'Capina manual', notes: 'Manutenção das ruas' },
      { operationName: 'Roçada', notes: 'Entrelinhas' },
      { operationName: 'Arruação', notes: 'Preparo para colheita' },
      { operationName: 'Derriça', notes: 'Colheita dos frutos' },
      { operationName: 'Varrição', notes: 'Recolhimento do café do chão' },
      { operationName: 'Lavagem', notes: 'Pós-colheita' },
      { operationName: 'Secagem', notes: 'Terreiro ou secador' },
      { operationName: 'Beneficiamento', notes: 'Descascamento/classificação' },
    ],
  },
  {
    crop: 'Soja',
    items: [
      { operationName: 'Calagem', notes: 'Correção 60-90 dias antes do plantio' },
      { operationName: 'Gessagem', notes: 'Se necessário, junto com calagem' },
      { operationName: 'Dessecação', notes: '10-15 dias pré-plantio' },
      { operationName: 'Tratamento de sementes', notes: 'Inoculação + fungicida' },
      { operationName: 'Plantio mecanizado', notes: 'Início da janela de plantio' },
      { operationName: 'Adubação de cobertura', notes: 'Se necessário, V3-V4' },
      { operationName: 'Pulverização', notes: 'Herbicida pós-emergente' },
      { operationName: 'Pulverização', notes: 'Fungicida preventivo' },
      { operationName: 'Colheita mecanizada', notes: 'Maturação fisiológica' },
      { operationName: 'Secagem', notes: 'Se umidade acima de 14%' },
      { operationName: 'Armazenagem', notes: 'Grãos secos e limpos' },
    ],
  },
  {
    crop: 'Milho',
    items: [
      { operationName: 'Calagem', notes: 'Correção de solo' },
      { operationName: 'Gradagem pesada', notes: 'Incorporação de corretivos' },
      { operationName: 'Gradagem leve', notes: 'Nivelamento' },
      { operationName: 'Tratamento de sementes', notes: 'Inseticida + fungicida' },
      { operationName: 'Plantio mecanizado', notes: 'Com adubação de base' },
      { operationName: 'Pulverização', notes: 'Herbicida pré/pós-emergente' },
      { operationName: 'Adubação de cobertura', notes: 'Nitrogênio em V4-V6' },
      { operationName: 'Pulverização', notes: 'Inseticida se necessário' },
      { operationName: 'Colheita mecanizada', notes: 'Grão seco no campo' },
      { operationName: 'Secagem', notes: 'Se necessário' },
      { operationName: 'Armazenagem', notes: 'Grãos secos' },
    ],
  },
  {
    crop: 'Pastagem',
    items: [
      { operationName: 'Roçada de pastagem', notes: 'Uniformização' },
      { operationName: 'Calagem', notes: 'Correção de solo se necessário' },
      { operationName: 'Adubação de pastagem', notes: 'Início das chuvas' },
      { operationName: 'Controle de invasoras', notes: 'Herbicida seletivo' },
      { operationName: 'Vedação de piquete', notes: 'Descanso para recuperação' },
      { operationName: 'Reforma de pastagem', notes: 'Quando degradação severa' },
    ],
  },
  {
    crop: 'Laranja',
    items: [
      { operationName: 'Poda', notes: 'Limpeza e condução' },
      { operationName: 'Calagem', notes: 'Correção de solo' },
      { operationName: 'Adubação de cobertura', notes: 'Parcelada 3-4x/ano' },
      { operationName: 'Pulverização', notes: 'Controle fitossanitário' },
      { operationName: 'Roçada', notes: 'Entrelinhas' },
      { operationName: 'Desbrota', notes: 'Remoção de brotações indesejadas' },
      { operationName: 'Irrigação', notes: 'Se necessário na seca' },
      { operationName: 'Colheita manual', notes: 'Frutos maduros' },
    ],
  },
];

// ─── Seed Data ──────────────────────────────────────────────────────

interface SeedChild {
  name: string;
  crops: string[];
  sortOrder: number;
  children?: SeedChild[];
}

interface SeedCategory {
  name: string;
  crops: string[];
  sortOrder: number;
  children: SeedChild[];
}

export const DEFAULT_OPERATION_TYPES: SeedCategory[] = [
  {
    name: 'Preparo de Solo',
    crops: ['Todas'],
    sortOrder: 1,
    children: [
      { name: 'Aração', crops: ['Todas'], sortOrder: 1 },
      { name: 'Gradagem leve', crops: ['Todas'], sortOrder: 2 },
      { name: 'Gradagem pesada', crops: ['Todas'], sortOrder: 3 },
      { name: 'Subsolagem', crops: ['Todas'], sortOrder: 4 },
      { name: 'Escarificação', crops: ['Todas'], sortOrder: 5 },
      { name: 'Calagem', crops: ['Todas'], sortOrder: 6 },
      { name: 'Gessagem', crops: ['Todas'], sortOrder: 7 },
      { name: 'Dessecação', crops: ['Soja', 'Milho', 'Feijão', 'Algodão'], sortOrder: 8 },
    ],
  },
  {
    name: 'Plantio',
    crops: ['Todas'],
    sortOrder: 2,
    children: [
      { name: 'Plantio mecanizado', crops: ['Todas'], sortOrder: 1 },
      { name: 'Plantio manual', crops: ['Café', 'Laranja'], sortOrder: 2 },
      { name: 'Replantio', crops: ['Todas'], sortOrder: 3 },
      {
        name: 'Tratamento de sementes',
        crops: ['Soja', 'Milho', 'Feijão', 'Algodão', 'Trigo', 'Arroz'],
        sortOrder: 4,
      },
    ],
  },
  {
    name: 'Tratos Culturais',
    crops: ['Todas'],
    sortOrder: 3,
    children: [
      {
        name: 'Adubação',
        crops: ['Todas'],
        sortOrder: 1,
        children: [
          { name: 'Adubação de cobertura', crops: ['Todas'], sortOrder: 1 },
          { name: 'Adubação foliar', crops: ['Todas'], sortOrder: 2 },
          { name: 'Fertirrigação', crops: ['Café', 'Laranja', 'Cana-de-açúcar'], sortOrder: 3 },
        ],
      },
      { name: 'Pulverização', crops: ['Todas'], sortOrder: 2 },
      { name: 'Capina manual', crops: ['Café', 'Laranja'], sortOrder: 3 },
      { name: 'Roçada', crops: ['Café', 'Pastagem', 'Laranja'], sortOrder: 4 },
      { name: 'Irrigação', crops: ['Todas'], sortOrder: 5 },
      { name: 'Poda', crops: ['Café', 'Laranja'], sortOrder: 6 },
      { name: 'Desbrota', crops: ['Café', 'Laranja'], sortOrder: 7 },
    ],
  },
  {
    name: 'Colheita',
    crops: ['Todas'],
    sortOrder: 4,
    children: [
      {
        name: 'Colheita mecanizada',
        crops: ['Soja', 'Milho', 'Algodão', 'Feijão', 'Trigo', 'Arroz', 'Cana-de-açúcar', 'Sorgo'],
        sortOrder: 1,
      },
      { name: 'Colheita manual', crops: ['Café', 'Laranja'], sortOrder: 2 },
      { name: 'Derriça', crops: ['Café'], sortOrder: 3 },
      { name: 'Varrição', crops: ['Café'], sortOrder: 4 },
      { name: 'Arruação', crops: ['Café'], sortOrder: 5 },
    ],
  },
  {
    name: 'Pós-Colheita',
    crops: ['Todas'],
    sortOrder: 5,
    children: [
      {
        name: 'Secagem',
        crops: ['Soja', 'Milho', 'Café', 'Feijão', 'Trigo', 'Arroz'],
        sortOrder: 1,
      },
      { name: 'Beneficiamento', crops: ['Café', 'Arroz'], sortOrder: 2 },
      { name: 'Armazenagem', crops: ['Todas'], sortOrder: 3 },
      { name: 'Lavagem', crops: ['Café'], sortOrder: 4 },
    ],
  },
  {
    name: 'Manejo de Pastagem',
    crops: ['Pastagem'],
    sortOrder: 6,
    children: [
      { name: 'Roçada de pastagem', crops: ['Pastagem'], sortOrder: 1 },
      { name: 'Adubação de pastagem', crops: ['Pastagem'], sortOrder: 2 },
      { name: 'Vedação de piquete', crops: ['Pastagem'], sortOrder: 3 },
      { name: 'Reforma de pastagem', crops: ['Pastagem'], sortOrder: 4 },
      { name: 'Controle de invasoras', crops: ['Pastagem'], sortOrder: 5 },
    ],
  },
];
