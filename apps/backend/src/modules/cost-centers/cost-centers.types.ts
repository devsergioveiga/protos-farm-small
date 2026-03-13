export class CostCenterError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'CostCenterError';
  }
}

export interface CreateCostCenterInput {
  code: string;
  name: string;
  description?: string | null;
}

export interface UpdateCostCenterInput {
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CostCenterItem {
  id: string;
  farmId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  teamCount: number;
  createdAt: string;
  updatedAt: string;
}
