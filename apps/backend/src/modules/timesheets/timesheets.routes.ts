import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { TimesheetError } from './timesheets.types';
import {
  createTimesheet,
  calculateTimesheet,
  approveTimesheet,
  correctTimeEntry,
  getTimesheet,
  listTimesheets,
  generateTimesheetPdf,
} from './timesheets.service';

export const timesheetsRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new TimesheetError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user?.id };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof TimesheetError) {
    res.status(err.statusCode).json({ error: err.message, ...err.data });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── Routes ───────────────────────────────────────────────────────────

// POST /org/:orgId/timesheets — create
timesheetsRouter.post(
  '/org/:orgId/timesheets',
  authenticate,
  checkPermission('attendance:write'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const ctx = buildRlsContext(req);
      const sheet = await createTimesheet(ctx, orgId, req.body);
      res.status(201).json(sheet);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/timesheets — list
timesheetsRouter.get(
  '/org/:orgId/timesheets',
  authenticate,
  checkPermission('attendance:read'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const ctx = buildRlsContext(req);
      const result = await listTimesheets(ctx, orgId, {
        farmId: req.query.farmId as string | undefined,
        employeeId: req.query.employeeId as string | undefined,
        referenceMonth: req.query.referenceMonth as string | undefined,
        status: req.query.status as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      } as Parameters<typeof listTimesheets>[2]);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/timesheets/:id — detail
timesheetsRouter.get(
  '/org/:orgId/timesheets/:id',
  authenticate,
  checkPermission('attendance:read'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = buildRlsContext(req);
      const sheet = await getTimesheet(ctx, orgId, id);
      res.json(sheet);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/timesheets/:id/calculate — run calculations
timesheetsRouter.post(
  '/org/:orgId/timesheets/:id/calculate',
  authenticate,
  checkPermission('attendance:write'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = buildRlsContext(req);
      const sheet = await calculateTimesheet(ctx, orgId, id);
      res.json(sheet);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/:orgId/timesheets/:id/approve — approve/reject
timesheetsRouter.patch(
  '/org/:orgId/timesheets/:id/approve',
  authenticate,
  checkPermission('attendance:write'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = buildRlsContext(req);
      const userId = req.user?.id ?? 'unknown';
      const sheet = await approveTimesheet(ctx, orgId, id, userId, req.body);
      res.json(sheet);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/timesheets/:id/corrections — add correction
timesheetsRouter.post(
  '/org/:orgId/timesheets/:id/corrections',
  authenticate,
  checkPermission('attendance:write'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = buildRlsContext(req);
      const sheet = await correctTimeEntry(ctx, orgId, id, req.body);
      res.status(201).json(sheet);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/timesheets/:id/pdf — export PDF
timesheetsRouter.get(
  '/org/:orgId/timesheets/:id/pdf',
  authenticate,
  checkPermission('attendance:read'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = buildRlsContext(req);
      const { buffer, filename } = await generateTimesheetPdf(ctx, orgId, id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);
