// ─── Payroll Provisions Routes ────────────────────────────────────────────────
// 5 endpoints: calculate (batch), list, report, report/export, reverse.
// Route order: /report/export and /report before /:id to prevent Express 5 param shadowing.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './payroll-provisions.service';
import { PayrollProvisionError } from './payroll-provisions.types';

export const payrollProvisionsRouter = Router();

const base = '/org/:orgId/payroll-provisions';

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof PayrollProvisionError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/:orgId/payroll-provisions/calculate ─────────────────────
// Body: { referenceMonth: "YYYY-MM" }
// Returns: { processedCount, totalVacation, totalThirteenth, totalCharges }

payrollProvisionsRouter.post(
  `${base}/calculate`,
  authenticate,
  checkPermission('farms:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const { referenceMonth } = req.body;

      if (!referenceMonth || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
        res.status(400).json({ error: 'referenceMonth deve estar no formato YYYY-MM' });
        return;
      }

      const summary = await service.calculateMonthlyProvisions({
        organizationId: orgId,
        referenceMonth,
        createdBy: req.user?.userId ?? '',
      });

      res.status(201).json(summary);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-provisions/report/export ──────────────────
// NOTE: must be registered BEFORE /report and /:id to prevent param shadowing.
// Query: ?referenceMonth=YYYY-MM
// Returns: CSV file

payrollProvisionsRouter.get(
  `${base}/report/export`,
  authenticate,
  checkPermission('farms:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const referenceMonth = req.query.referenceMonth as string | undefined;

      if (!referenceMonth || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
        res.status(400).json({ error: 'referenceMonth deve estar no formato YYYY-MM' });
        return;
      }

      const csv = await service.exportProvisionReport(orgId, referenceMonth, {
        organizationId: orgId,
        userId: req.user?.userId,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="provisoes-${referenceMonth}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-provisions/report ─────────────────────────
// NOTE: must be registered BEFORE /:id to prevent param shadowing.
// Query: ?referenceMonth=YYYY-MM
// Returns: ProvisionReportRow[] by cost center

payrollProvisionsRouter.get(
  `${base}/report`,
  authenticate,
  checkPermission('farms:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const referenceMonth = req.query.referenceMonth as string | undefined;

      if (!referenceMonth || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
        res.status(400).json({ error: 'referenceMonth deve estar no formato YYYY-MM' });
        return;
      }

      const report = await service.getProvisionReport(orgId, referenceMonth, {
        organizationId: orgId,
        userId: req.user?.userId,
      });

      res.json(report);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/payroll-provisions ────────────────────────────────
// Query: ?referenceMonth=YYYY-MM
// Returns: ProvisionOutput[] grouped by employee

payrollProvisionsRouter.get(
  base,
  authenticate,
  checkPermission('farms:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const referenceMonth = req.query.referenceMonth as string | undefined;

      if (!referenceMonth || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
        res.status(400).json({ error: 'referenceMonth deve estar no formato YYYY-MM' });
        return;
      }

      const provisions = await service.listProvisions(orgId, referenceMonth, {
        organizationId: orgId,
        userId: req.user?.userId,
      });

      res.json(provisions);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/payroll-provisions/:id/reverse ──────────────────
// Returns: updated provision

payrollProvisionsRouter.patch(
  `${base}/:id/reverse`,
  authenticate,
  checkPermission('farms:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;

      const updated = await service.reverseProvision(id, req.user?.userId ?? '', {
        organizationId: orgId,
        userId: req.user?.userId,
      });

      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  },
);
