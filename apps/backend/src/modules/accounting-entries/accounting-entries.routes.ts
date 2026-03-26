// ─── Accounting Entries Routes ────────────────────────────────────────────────
// INTEGR-02: Read-only endpoints for listing and exporting accounting entries.
//
// Route order: /export/csv before /:id to prevent Express 5 param shadowing.
// Permission: payroll-params:read (no dedicated accounting permission in RBAC v1.3).

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './accounting-entries.service';
import { AccountingEntryError } from './accounting-entries.types';
import type { AccountingEntryType } from '@prisma/client';

export const accountingEntriesRouter = Router();

const base = '/org/:orgId/accounting-entries';

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof AccountingEntryError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/accounting-entries/export/csv ─────────────────────
// CSV export with filters. Must be registered BEFORE /:id.

accountingEntriesRouter.get(
  `${base}/export/csv`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const rls = { organizationId: orgId, userId: req.user?.userId };

      const filters = {
        referenceMonth: req.query.referenceMonth as string | undefined,
        farmId: req.query.farmId as string | undefined,
        entryType: req.query.entryType as AccountingEntryType | undefined,
      };

      const csv = await service.exportCsv(rls, filters);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="accounting-entries.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/accounting-entries ───────────────────────────────
// List with optional filters and pagination.

accountingEntriesRouter.get(
  base,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const rls = { organizationId: orgId, userId: req.user?.userId };

      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      const result = await service.list(rls, {
        referenceMonth: req.query.referenceMonth as string | undefined,
        farmId: req.query.farmId as string | undefined,
        entryType: req.query.entryType as AccountingEntryType | undefined,
        page,
        limit,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/accounting-entries/:id ───────────────────────────
// Single entry detail.

accountingEntriesRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const entryId = req.params.id as string;
      const rls = { organizationId: orgId, userId: req.user?.userId };

      const entry = await service.getById(rls, entryId);
      res.json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);
