// ─── Constants ───────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  'RC_APPROVED',
  'RC_REJECTED',
  'RC_RETURNED',
  'RC_PENDING',
  'SLA_REMINDER',
  'QUOTATION_PENDING_APPROVAL',
  'QUOTATION_APPROVED',
  'PO_OVERDUE',
  'QUOTATION_DEADLINE_NEAR',
  'QUOTATION_RECEIVED',
  'PO_GOODS_RECEIVED',
  'BUDGET_EXCEEDED',
  'RETURN_REGISTERED',
  'RETURN_RESOLVED',
  'DAILY_DIGEST',
  'MAINTENANCE_OVERDUE',
  'MAINTENANCE_REQUEST',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ─── Error ───────────────────────────────────────────────────────────

export class NotificationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

// ─── Input Types ─────────────────────────────────────────────────────

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceId?: string;
  referenceType?: string;
}
