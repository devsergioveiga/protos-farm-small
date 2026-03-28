// ─── eSocial Events Routes ────────────────────────────────────────────────────
// 8 endpoints: generate, generate-batch, list, dashboard, download,
// download-batch, update status, reprocess.
// NOTE: /dashboard MUST be registered BEFORE /:id routes to prevent shadowing.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import {
  generateEvent,
  generateBatch,
  listEvents,
  downloadEvent,
  downloadBatch,
  updateStatus,
  reprocessEvent,
  getDashboard,
} from './esocial-events.service';
import { EsocialEventError } from './esocial-events.types';

export const esocialEventsRouter = Router();

const base = '/org/:orgId/esocial-events';

// ─── Error handler ────────────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof EsocialEventError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/:orgId/esocial-events/generate ─────────────────────────────────

esocialEventsRouter.post(
  `${base}/generate`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const userId = (req.user as { userId?: string } | undefined)?.userId ?? 'system';
      const result = await generateEvent(orgId, req.body, userId);

      if (result.validationErrors && result.validationErrors.length > 0) {
        res.status(422).json({ validationErrors: result.validationErrors });
        return;
      }

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/esocial-events/generate-batch ──────────────────────────

esocialEventsRouter.post(
  `${base}/generate-batch`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const userId = (req.user as { userId?: string } | undefined)?.userId ?? 'system';
      const { eventType, referenceMonth } = req.body as {
        eventType: string;
        referenceMonth?: string;
      };
      const results = await generateBatch(orgId, eventType, referenceMonth, userId);
      res.json(results);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/esocial-events/dashboard ─────────────────────────────────
// IMPORTANT: registered BEFORE /:id to avoid Express treating 'dashboard' as :id

esocialEventsRouter.get(
  `${base}/dashboard`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const referenceMonth =
        (req.query.referenceMonth as string) ?? new Date().toISOString().slice(0, 7);
      const result = await getDashboard(orgId, referenceMonth);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/esocial-events ──────────────────────────────────────────

esocialEventsRouter.get(
  base,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const query = {
        eventGroup: req.query.eventGroup as string | undefined,
        eventType: req.query.eventType as string | undefined,
        status: req.query.status as string | undefined,
        referenceMonth: req.query.referenceMonth as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      };
      const result = await listEvents(orgId, query as Parameters<typeof listEvents>[1]);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/esocial-events/:id/download ─────────────────────────────

esocialEventsRouter.get(
  `${base}/:id/download`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const result = await downloadEvent(orgId, id);

      if (result.validationErrors && result.validationErrors.length > 0) {
        res.status(422).json({ validationErrors: result.validationErrors });
        return;
      }

      // Return XML as file download
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.eventType}_v${result.version}_${result.sourceId}.xml"`,
      );
      res.send(result.xmlContent);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/esocial-events/download-batch ──────────────────────────

esocialEventsRouter.post(
  `${base}/download-batch`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const result = await downloadBatch(orgId, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/esocial-events/:id/status ─────────────────────────────

esocialEventsRouter.patch(
  `${base}/:id/status`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const result = await updateStatus(orgId, id, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/esocial-events/:id/reprocess ───────────────────────────

esocialEventsRouter.post(
  `${base}/:id/reprocess`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const userId = (req.user as { userId?: string } | undefined)?.userId ?? 'system';
      const result = await reprocessEvent(orgId, id, userId);

      if (result.validationErrors && result.validationErrors.length > 0) {
        res.status(422).json({ validationErrors: result.validationErrors });
        return;
      }

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
