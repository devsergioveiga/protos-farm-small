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
  createdAt: string;
  updatedAt: string;
}

export interface OperationTypeTreeNode extends OperationTypeItem {
  children: OperationTypeTreeNode[];
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateOperationTypeInput {
  name: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export type UpdateOperationTypeInput = Partial<CreateOperationTypeInput>;
