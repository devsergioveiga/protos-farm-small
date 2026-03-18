import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import { NotificationError, type CreateNotificationInput } from './notifications.types';
import { logger } from '../../shared/utils/logger';

// ─── Create Notification (inside existing transaction) ───────────────

export async function createNotification(
  tx: TxClient,
  organizationId: string,
  input: CreateNotificationInput,
) {
  return tx.notification.create({
    data: {
      organizationId,
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      referenceId: input.referenceId ?? null,
      referenceType: input.referenceType ?? null,
    },
  });
}

// ─── List Notifications ──────────────────────────────────────────────

export async function listNotifications(
  ctx: RlsContext & { userId: string },
  options?: { unread?: boolean; limit?: number },
) {
  return withRlsContext(ctx, async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
      recipientId: ctx.userId,
    };

    if (options?.unread) {
      where.readAt = null;
    }

    const limit = options?.limit ?? 20;

    return tx.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  });
}

// ─── Mark As Read ────────────────────────────────────────────────────

export async function markAsRead(ctx: RlsContext & { userId: string }, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const notification = await tx.notification.findFirst({
      where: {
        id,
        recipientId: ctx.userId,
        organizationId: ctx.organizationId,
      },
    });

    if (!notification) {
      throw new NotificationError('Notificação não encontrada', 404);
    }

    return tx.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  });
}

// ─── Mark All As Read ────────────────────────────────────────────────

export async function markAllAsRead(ctx: RlsContext & { userId: string }) {
  return withRlsContext(ctx, async (tx) => {
    const result = await tx.notification.updateMany({
      where: {
        organizationId: ctx.organizationId,
        recipientId: ctx.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  });
}

// ─── Get Unread Count ────────────────────────────────────────────────

export async function getUnreadCount(ctx: RlsContext & { userId: string }) {
  return withRlsContext(ctx, async (tx) => {
    const count = await tx.notification.count({
      where: {
        organizationId: ctx.organizationId,
        recipientId: ctx.userId,
        readAt: null,
      },
    });

    return count;
  });
}

// ─── Create Notification If Enabled ──────────────────────────────────

export async function createNotificationIfEnabled(
  tx: TxClient,
  organizationId: string,
  input: CreateNotificationInput,
): Promise<void> {
  const { isNotificationEnabled } = await import('./notification-preferences.service');
  const enabled = await isNotificationEnabled(
    tx,
    organizationId,
    input.recipientId,
    input.type,
    'IN_APP',
  );
  if (!enabled) return;
  await createNotification(tx, organizationId, input);
}

// ─── Dispatch Push Notification (placeholder) ────────────────────────

export async function dispatchPushNotification(notification: {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  body: string;
}): Promise<void> {
  logger.info(
    { notificationId: notification.id, recipientId: notification.recipientId },
    'Push notification dispatch placeholder',
  );
  // Full implementation deferred to Plan 06 (mobile push notifications)
}
