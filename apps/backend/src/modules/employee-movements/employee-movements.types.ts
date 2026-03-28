export type MovementTypeLiteral =
  | 'PROMOTION'
  | 'SALARY_ADJUSTMENT'
  | 'TRANSFER'
  | 'POSITION_CHANGE';

export interface CreateMovementInput {
  employeeId: string;
  movementType: MovementTypeLiteral;
  effectiveAt: string; // ISO date
  fromValue?: string; // JSON string — previous value
  toValue?: string; // JSON string — new value
  reason: string;
  approvedBy?: string;
}

export interface BulkSalaryAdjustmentInput {
  positionId?: string; // filter by position
  farmId?: string; // filter by farm
  percentage?: number; // e.g. 5.5 for 5.5% increase
  fixedAmount?: number; // absolute increase in BRL
  reason: string;
  effectiveAt: string; // ISO date
}

export interface BulkSalaryAdjustmentResult {
  updated: number;
  errors: string[];
}

export interface ListMovementsParams {
  employeeId?: string;
  movementType?: string;
  page?: number;
  limit?: number;
}

export interface MovementOutput {
  id: string;
  employeeId: string;
  employeeName?: string;
  movementType: MovementTypeLiteral;
  effectiveAt: string;
  fromValue: string | null;
  toValue: string | null;
  reason: string;
  approvedBy: string | null;
  createdBy: string;
  createdAt: string;
}

export interface TimelineEntry {
  type: 'movement' | 'status';
  date: string;
  movementType?: MovementTypeLiteral;
  fromStatus?: string;
  toStatus?: string;
  reason: string;
  fromValue?: string | null;
  toValue?: string | null;
}

export class EmployeeMovementError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'EmployeeMovementError';
    this.statusCode = statusCode;
  }
}
