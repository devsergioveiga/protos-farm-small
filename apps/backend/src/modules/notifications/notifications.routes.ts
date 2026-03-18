import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { NotificationError } from './notifications.types';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from './notifications.service';

export const notificationsRouter = Router();

const base = '/org/notifications';

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new NotificationError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof NotificationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── Routes (static BEFORE :id) ──────────────────────────────────────

// GET /org/notifications/unread-count
notificationsRouter.get(
  `${base}/unread-count`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const count = await getUnreadCount(ctx);
      res.json({ count });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/notifications/read-all
notificationsRouter.patch(`${base}/read-all`, authenticate, async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const result = await markAllAsRead(ctx);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── CRUD ─────────────────────────────────────────────────────────────

// GET /org/notifications
notificationsRouter.get(base, authenticate, checkPermission('purchases:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const unread = req.query.unread === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const notifications = await listNotifications(ctx, { unread, limit });
    res.json(notifications);
  } catch (err) {
    handleError(err, res);
  }
});

// GET /org/notifications/preferences
notificationsRouter.get(`${base}/preferences`, authenticate, async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const { getPreferences } = await import('./notification-preferences.service');
    const prefs = await getPreferences(ctx);
    res.json(prefs);
  } catch (err) {
    handleError(err, res);
  }
});

// PATCH /org/notifications/preferences
notificationsRouter.patch(`${base}/preferences`, authenticate, async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const { preferences } = req.body as {
      preferences: { eventType: string; channel: string; enabled: boolean }[];
    };
    if (!Array.isArray(preferences)) {
      res.status(400).json({ error: 'Campo preferences deve ser um array' });
      return;
    }
    const { updatePreferences } = await import('./notification-preferences.service');
    await updatePreferences(ctx, preferences);
    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

// PATCH /org/notifications/:id/read
notificationsRouter.patch(`${base}/:id/read`, authenticate, async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const notification = await markAsRead(ctx, req.params.id as string);
    res.json(notification);
  } catch (err) {
    handleError(err, res);
  }
});
