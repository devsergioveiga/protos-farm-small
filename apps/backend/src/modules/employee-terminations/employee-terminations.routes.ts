// ─── Employee Terminations Routes ────────────────────────────────────
// 8 endpoints covering the full rescision lifecycle:
//   POST   /org/:orgId/employee-terminations          — create DRAFT
//   GET    /org/:orgId/employee-terminations           — list (filter by type/status)
//   GET    /org/:orgId/employee-terminations/expiring  — near deadline (must be before /:id)
//   GET    /org/:orgId/employee-terminations/:id       — get by id
//   PATCH  /org/:orgId/employee-terminations/:id/confirm — DRAFT → PROCESSED
//   PATCH  /org/:orgId/employee-terminations/:id/pay    — PROCESSED → PAID
//   GET    /org/:orgId/employee-terminations/:id/trct   — TRCT PDF download
//   GET    /org/:orgId/employee-terminations/:id/grrf   — GRRF PDF download

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './employee-terminations.service';
import { TerminationError } from './employee-terminations.types';

export const employeeTerminationsRouter = Router();

const base = '/org/:orgId/employee-terminations';

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof TerminationError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/employee-terminations/expiring ───────────────────
// NOTE: must be registered BEFORE /:id to prevent Express 5 route shadowing

employeeTerminationsRouter.get(
  `${base}/expiring`,
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const daysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead as string, 10) : 10;
      const result = await service.getExpiringDeadlines(orgId, daysAhead);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/employee-terminations ────────────────────────────

employeeTerminationsRouter.get(
  base,
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const rls = { organizationId: orgId, userId: req.user?.userId };
      const result = await service.listTerminations(
        {
          organizationId: orgId,
          terminationType: req.query.terminationType as string | undefined,
          status: req.query.status as string | undefined,
          fromDate: req.query.fromDate as string | undefined,
          toDate: req.query.toDate as string | undefined,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        },
        rls,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/employee-terminations ───────────────────────────

employeeTerminationsRouter.post(
  base,
  authenticate,
  checkPermission('employees:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const rls = { organizationId: orgId, userId: req.user?.userId };
      const termination = await service.processTermination(
        {
          organizationId: orgId,
          employeeId: req.body.employeeId as string,
          terminationType: req.body.terminationType as string,
          terminationDate: req.body.terminationDate as string,
          noticePeriodType: req.body.noticePeriodType as string,
          fgtsBalanceOverride: req.body.fgtsBalanceOverride as string | undefined,
          createdBy: req.user?.userId ?? 'system',
        },
        rls,
      );
      res.status(201).json(termination);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/employee-terminations/:id/trct ───────────────────
// NOTE: must be registered BEFORE /:id to prevent Express 5 route shadowing

employeeTerminationsRouter.get(
  `${base}/:id/trct`,
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const rls = { organizationId: orgId, userId: req.user?.userId };
      const buffer = await service.getTrctPdf(id, rls);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="TRCT-${id}.pdf"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/employee-terminations/:id/grrf ───────────────────

employeeTerminationsRouter.get(
  `${base}/:id/grrf`,
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const rls = { organizationId: orgId, userId: req.user?.userId };
      const buffer = await service.getGrffPdf(id, rls);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="GRRF-${id}.pdf"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/employee-terminations/:id/confirm ─────────────

employeeTerminationsRouter.patch(
  `${base}/:id/confirm`,
  authenticate,
  checkPermission('employees:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const rls = { organizationId: orgId, userId: req.user?.userId };
      const termination = await service.confirmTermination(id, rls);
      res.json(termination);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/employee-terminations/:id/pay ─────────────────

employeeTerminationsRouter.patch(
  `${base}/:id/pay`,
  authenticate,
  checkPermission('employees:write'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const rls = { organizationId: orgId, userId: req.user?.userId };
      const termination = await service.markAsPaid(id, rls);
      res.json(termination);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/employee-terminations/:id ────────────────────────

employeeTerminationsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const rls = { organizationId: orgId, userId: req.user?.userId };
      const termination = await service.getTerminationById(id, rls);
      res.json(termination);
    } catch (err) {
      handleError(err, res);
    }
  },
);
