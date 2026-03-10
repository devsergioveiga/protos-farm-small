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
