// ─── Constants ───────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  'RC_APPROVED',
  'RC_REJECTED',
  'RC_RETURNED',
  'RC_PENDING',
  'SLA_REMINDER',
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
