// ─── Salary Advances Routes ───────────────────────────────────────────

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './salary-advances.service';
import { SalaryAdvanceError } from './salary-advances.types';

export const salaryAdvancesRouter = Router();

const base = '/org/:orgId/salary-advances';

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof SalaryAdvanceError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/:orgId/salary-advances/batch ───────────────────────────
// NOTE: /batch must be registered BEFORE /:id/receipt to prevent Express 5 param shadowing

salaryAdvancesRouter.post(
  `${base}/batch`,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const result = await service.createBatchAdvances(
        { organizationId: orgId, userId: req.user?.userId },
        req.body,
      );
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/salary-advances ─────────────────────────────────

salaryAdvancesRouter.post(
  base,
  authenticate,
  checkPermission('payroll-params:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const advance = await service.createAdvance(
        { organizationId: orgId, userId: req.user?.userId },
        req.body,
      );
      res.status(201).json(advance);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/salary-advances ──────────────────────────────────

salaryAdvancesRouter.get(
  base,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const result = await service.listAdvances(
        { organizationId: orgId, userId: req.user?.userId },
        {
          referenceMonth: req.query.referenceMonth as string | undefined,
          employeeId: req.query.employeeId as string | undefined,
          page: req.query.page ? Number(req.query.page) : undefined,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
        },
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/salary-advances/:id/receipt ──────────────────────

salaryAdvancesRouter.get(
  `${base}/:id/receipt`,
  authenticate,
  checkPermission('payroll-params:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const pdf = await service.generateAdvanceReceiptPdf(
        { organizationId: orgId, userId: req.user?.userId },
        id,
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="recibo-adiantamento-${id}.pdf"`);
      res.send(pdf);
    } catch (err) {
      handleError(err, res);
    }
  },
);
