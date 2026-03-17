// ─── Error ───────────────────────────────────────────────────────────

export class ApprovalRuleError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ApprovalRuleError';
  }
}

// ─── Constants ───────────────────────────────────────────────────────

export const APPROVAL_ACTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'RETURNED'] as const;
export type ApprovalActionStatus = (typeof APPROVAL_ACTION_STATUSES)[number];

// ─── Input Types ─────────────────────────────────────────────────────

export interface CreateApprovalRuleInput {
  name: string;
  requestType?: string; // null = all types
  minAmount?: number;
  maxAmount?: number;
  approverCount: number; // 1 or 2
  approver1Id: string;
  approver2Id?: string;
  priority: number;
}

export interface UpdateApprovalRuleInput {
  name?: string;
  requestType?: string | null;
  minAmount?: number;
  maxAmount?: number | null;
  approverCount?: number;
  approver1Id?: string;
  approver2Id?: string | null;
  priority?: number;
  active?: boolean;
}

export interface CreateDelegationInput {
  delegateId: string;
  startDate: string; // ISO datetime
  endDate: string; // ISO datetime
  notes?: string;
}
