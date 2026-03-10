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

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateOperationTypeInput {
  name: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  crops?: string[];
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
  createdAt: string;
  updatedAt: string;
}

export interface OperationTypeTreeNode extends OperationTypeItem {
  children: OperationTypeTreeNode[];
}

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
