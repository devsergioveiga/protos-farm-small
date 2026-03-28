import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import { NOTIFICATION_TYPES } from '../notifications/notifications.types';
import type {
  NotificationChannel,
  PreferenceToggleInput,
  UserPreferences,
} from './notification-preferences.types';

// ─── Get Preferences ─────────────────────────────────────────────────────────

export async function getPreferences(
  ctx: RlsContext & { userId: string },
): Promise<UserPreferences[]> {
  return withRlsContext(ctx, async (tx) => {
    const saved = await tx.notificationPreference.findMany({
      where: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
      },
    });

    // Build a map of saved preferences: eventType+channel -> enabled
    const savedMap = new Map<string, boolean>();
    for (const pref of saved) {
      savedMap.set(`${pref.eventType}:${pref.channel}`, pref.enabled);
    }

    // Return all event types, defaulting to true (opt-out model)
    return NOTIFICATION_TYPES.map((eventType) => ({
      eventType,
      badge: savedMap.get(`${eventType}:BADGE`) ?? true,
      email: savedMap.get(`${eventType}:EMAIL`) ?? true,
    }));
  });
}

// ─── Upsert Preference ───────────────────────────────────────────────────────

export async function upsertPreference(
  ctx: RlsContext & { userId: string },
  input: PreferenceToggleInput,
) {
  return withRlsContext(ctx, async (tx) => {
    return tx.notificationPreference.upsert({
      where: {
        userId_organizationId_eventType_channel: {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          eventType: input.eventType,
          channel: input.channel,
        },
      },
      create: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        eventType: input.eventType,
        channel: input.channel,
        enabled: input.enabled,
      },
      update: {
        enabled: input.enabled,
      },
    });
  });
}

// ─── shouldNotify ────────────────────────────────────────────────────────────

export async function shouldNotify(
  tx: TxClient,
  userId: string,
  organizationId: string,
  eventType: string,
  channel: NotificationChannel,
): Promise<boolean> {
  const pref = await tx.notificationPreference.findUnique({
    where: {
      userId_organizationId_eventType_channel: {
        userId,
        organizationId,
        eventType,
        channel,
      },
    },
  });

  // Opt-out model: if no preference saved, default to true (send notification)
  if (!pref) return true;
  return pref.enabled;
}
