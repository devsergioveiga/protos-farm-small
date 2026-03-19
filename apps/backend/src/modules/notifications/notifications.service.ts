import { withRlsContext, withRlsBypass, type RlsContext, type TxClient } from '../../database/rls';
import { NotificationError, type CreateNotificationInput } from './notifications.types';
import { logger } from '../../shared/utils/logger';
import { sendMail } from '../../shared/mail/mail.service';
import { shouldNotify } from '../notification-preferences/notification-preferences.service';

// ─── Email Helper ─────────────────────────────────────────────────────────────

async function sendNotificationEmail(
  to: string,
  notification: { type: string; title: string; body: string },
): Promise<void> {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2E7D32; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Protos Farm</h1>
      </div>
      <div style="padding: 24px; background: #fff;">
        <h2 style="color: #2A2520; font-size: 18px; margin-top: 0;">${notification.title}</h2>
        <p style="color: #3E3833; line-height: 1.6;">${notification.body}</p>
      </div>
      <div style="padding: 16px; background: #FAFAF8; text-align: center; font-size: 13px; color: #3E3833;">
        <a href="/notification-preferences" style="color: #2E7D32;">Gerenciar preferências</a>
      </div>
    </div>
  `;

  await sendMail({
    to,
    subject: notification.title,
    text: `${notification.title}\n\n${notification.body}`,
    html,
  });
}

// ─── Create Notification (inside existing transaction) ───────────────

export async function createNotification(
  tx: TxClient,
  organizationId: string,
  input: CreateNotificationInput,
) {
  // Check BADGE preference — if disabled, mark as read immediately
  const badgeEnabled = await shouldNotify(
    tx,
    input.recipientId,
    organizationId,
    input.type,
    'BADGE',
  );

  const notification = await tx.notification.create({
    data: {
      organizationId,
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      referenceId: input.referenceId ?? null,
      referenceType: input.referenceType ?? null,
      // If badge disabled, mark as read immediately (effectively hidden)
      readAt: badgeEnabled ? null : new Date(),
    },
  });

  // Fire-and-forget email dispatch (outside transaction context)
  void (async () => {
    try {
      const emailEnabled = await withRlsBypass(async (bypassTx) => {
        const enabled = await shouldNotify(
          bypassTx,
          input.recipientId,
          organizationId,
          input.type,
          'EMAIL',
        );
        if (!enabled) return false;

        const user = await bypassTx.user.findUnique({
          where: { id: input.recipientId },
          select: { email: true },
        });
        return user?.email ?? null;
      });

      if (emailEnabled && typeof emailEnabled === 'string') {
        await sendNotificationEmail(emailEnabled, {
          type: input.type,
          title: input.title,
          body: input.body,
        });
      }
    } catch (err) {
      logger.error({ err, notificationId: notification.id }, 'Failed to send notification email');
    }
  })();

  return notification;
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
