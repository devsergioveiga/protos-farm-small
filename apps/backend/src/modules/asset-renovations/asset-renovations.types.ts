export class RenovationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'RenovationError';
  }
}

export interface CreateRenovationInput {
  description: string;
  renovationDate: string;
  totalCost: number | string;
  accountingDecision: 'CAPITALIZAR' | 'DESPESA';
  newUsefulLifeMonths?: number;
  notes?: string;
}
