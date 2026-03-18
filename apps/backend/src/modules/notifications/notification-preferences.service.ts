import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import { NotificationError } from './notifications.types';

// ─── Output Types ────────────────────────────────────────────────────

export interface NotificationPreferenceOutput {
  eventType: string;
  channel: string;
  enabled: boolean;
}

// ─── Get Preferences ─────────────────────────────────────────────────

export async function getPreferences(
  ctx: RlsContext & { userId: string },
): Promise<NotificationPreferenceOutput[]> {
  return withRlsContext(ctx, async (tx) => {
    const prefs = await tx.notificationPreference.findMany({
      where: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      },
      orderBy: [{ eventType: 'asc' }, { channel: 'asc' }],
    });

    return prefs.map(
      (p: {
        eventType: string;
        channel: string;
        enabled: boolean;
      }): NotificationPreferenceOutput => ({
        eventType: p.eventType,
        channel: p.channel,
        enabled: p.enabled,
      }),
    );
  });
}

// ─── Update Preferences ──────────────────────────────────────────────

export async function updatePreferences(
  ctx: RlsContext & { userId: string },
  prefs: { eventType: string; channel: string; enabled: boolean }[],
): Promise<void> {
  if (!Array.isArray(prefs) || prefs.length === 0) return;

  await withRlsContext(ctx, async (tx) => {
    for (const pref of prefs) {
      await tx.notificationPreference.upsert({
        where: {
          organizationId_userId_eventType_channel: {
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            eventType: pref.eventType,
            channel: pref.channel,
          },
        },
        create: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          eventType: pref.eventType,
          channel: pref.channel,
          enabled: pref.enabled,
        },
        update: {
          enabled: pref.enabled,
        },
      });
    }
  });
}

// ─── Is Notification Enabled ─────────────────────────────────────────

export async function isNotificationEnabled(
  tx: TxClient,
  organizationId: string,
  userId: string,
  eventType: string,
  channel: string,
): Promise<boolean> {
  const pref = await tx.notificationPreference.findFirst({
    where: {
      organizationId,
      userId,
      eventType,
      channel,
    },
  });

  if (!pref) {
    // No record found — default is enabled (opt-out model)
    return true;
  }

  return pref.enabled;
}

// ─── Suppressed import guard ─────────────────────────────────────────
void NotificationError; // prevents unused import warning if type is not directly used
