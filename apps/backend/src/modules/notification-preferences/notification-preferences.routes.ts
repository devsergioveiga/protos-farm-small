import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { getPreferences, upsertPreference } from './notification-preferences.service';

export const notificationPreferencesRouter = Router();

// GET /api/org/:orgId/notification-preferences — returns user's preferences matrix
notificationPreferencesRouter.get(
  '/org/:orgId/notification-preferences',
  authenticate,
  checkPermission('purchases:read'),
  async (req, res, next) => {
    try {
      const ctx = {
        organizationId: req.params.orgId as string,
        userId: req.user!.userId,
      };
      const preferences = await getPreferences(ctx);
      res.json(preferences);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/org/:orgId/notification-preferences — body: { eventType, channel, enabled }
notificationPreferencesRouter.put(
  '/org/:orgId/notification-preferences',
  authenticate,
  checkPermission('purchases:read'),
  async (req, res, next) => {
    try {
      const ctx = {
        organizationId: req.params.orgId as string,
        userId: req.user!.userId,
      };
      const { eventType, channel, enabled } = req.body as {
        eventType: string;
        channel: string;
        enabled: boolean;
      };

      if (!eventType || !channel || typeof enabled !== 'boolean') {
        res.status(400).json({ error: 'eventType, channel, and enabled are required' });
        return;
      }

      if (channel !== 'BADGE' && channel !== 'EMAIL') {
        res.status(400).json({ error: 'channel must be BADGE or EMAIL' });
        return;
      }

      const preference = await upsertPreference(ctx, { eventType, channel, enabled });
      res.json(preference);
    } catch (err) {
      next(err);
    }
  },
);
