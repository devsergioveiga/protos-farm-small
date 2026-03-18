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
  'GR_CONFIRMED',
  'DELIVERY_CONFIRMED',
  'DAILY_DIGEST',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH', 'DIGEST'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_EVENT_GROUPS = {
  SOLICITANTE: ['RC_APPROVED', 'RC_REJECTED', 'DELIVERY_CONFIRMED'],
  APROVADOR: ['RC_PENDING', 'SLA_REMINDER'],
  COMPRADOR: ['RC_APPROVED', 'QUOTATION_DEADLINE_NEAR', 'PO_OVERDUE'],
  FINANCEIRO: ['GR_CONFIRMED'],
  GERENTE: ['DAILY_DIGEST'],
} as const;

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
