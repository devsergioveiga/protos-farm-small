export class WipError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'WipError';
  }
}

export interface AddContributionInput {
  contributionDate: string;
  amount: number | string;
  description: string;
  stageId?: string;
  supplierId?: string;
  invoiceRef?: string;
  notes?: string;
}

export interface ActivateWipInput {
  activationDate?: string;
}

export interface CreateStageInput {
  name: string;
  targetDate?: string;
  notes?: string;
  sortOrder?: number;
}

export interface CompleteStageInput {
  completedAt?: string;
}
