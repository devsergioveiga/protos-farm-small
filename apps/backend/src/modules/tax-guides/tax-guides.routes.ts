// ─── Tax Guides Routes ────────────────────────────────────────────────
// 3 endpoints: generate, list, download.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { taxGuidesService } from './tax-guides.service';
import { TaxGuideError } from './tax-guides.types';

export const taxGuidesRouter = Router();

const base = '/org/:orgId/tax-guides';

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof TaxGuideError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/:orgId/tax-guides/generate — generate guides ──────────
// NOTE: registered BEFORE /:id routes to avoid Express 5 route shadowing

taxGuidesRouter.post(
  `${base}/generate`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const userId = req.user?.userId ?? 'system';
      const guides = await taxGuidesService.generateGuides(orgId, req.body, userId);
      res.status(201).json(guides);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/tax-guides — list guides ─────────────────────────

taxGuidesRouter.get(
  base,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const result = await taxGuidesService.listGuides(orgId, {
        referenceMonth: req.query.referenceMonth as string | undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        guideType: req.query.guideType as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: req.query.status as any,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/tax-guides/:id/download — download guide file ────

taxGuidesRouter.get(
  `${base}/:id/download`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const { buffer, filename, contentType } = await taxGuidesService.downloadGuide(orgId, id);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);
