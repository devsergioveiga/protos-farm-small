export class ProductivityTargetError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ProductivityTargetError';
  }
}

export interface ProductivityTargetItem {
  id: string;
  farmId: string;
  operationType: string;
  operationTypeLabel: string;
  targetValue: number;
  targetUnit: string;
  period: string;
  ratePerUnit: number | null;
  rateUnit: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductivityTargetInput {
  operationType: string;
  targetValue: number;
  targetUnit: string;
  period?: string;
  ratePerUnit?: number | null;
  rateUnit?: string | null;
}

export interface UpdateProductivityTargetInput {
  targetValue?: number;
  targetUnit?: string;
  period?: string;
  ratePerUnit?: number | null;
  rateUnit?: string | null;
}
