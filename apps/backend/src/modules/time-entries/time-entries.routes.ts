import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { TimeEntryError } from './time-entries.types';
import {
  createTimeEntry,
  listTimeEntries,
  getTimeEntry,
  updateTimeEntry,
  addActivity,
  addTeamActivity,
} from './time-entries.service';

export const timeEntriesRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new TimeEntryError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user?.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof TimeEntryError) {
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

// POST /org/:orgId/employees/:employeeId/time-entries — create
timeEntriesRouter.post(
  '/org/:orgId/employees/:employeeId/time-entries',
  authenticate,
  checkPermission('attendance:write'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const employeeId = req.params.employeeId as string;
      const ctx = buildRlsContext(req);
      const entry = await createTimeEntry(ctx, orgId, employeeId, req.body);
      res.status(201).json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/time-entries — list
timeEntriesRouter.get(
  '/org/:orgId/time-entries',
  authenticate,
  checkPermission('attendance:read'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const ctx = buildRlsContext(req);
      const result = await listTimeEntries(ctx, orgId, {
        farmId: req.query.farmId as string | undefined,
        employeeId: req.query.employeeId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        source: req.query.source as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      } as Parameters<typeof listTimeEntries>[2]);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/time-entries/:id — detail
timeEntriesRouter.get(
  '/org/:orgId/time-entries/:id',
  authenticate,
  checkPermission('attendance:read'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = buildRlsContext(req);
      const entry = await getTimeEntry(ctx, orgId, id);
      res.json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PUT /org/:orgId/time-entries/:id — update
timeEntriesRouter.put(
  '/org/:orgId/time-entries/:id',
  authenticate,
  checkPermission('attendance:write'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = buildRlsContext(req);
      const entry = await updateTimeEntry(ctx, orgId, id, req.body);
      res.json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/time-entries/:id/activities — add activity link
timeEntriesRouter.post(
  '/org/:orgId/time-entries/:id/activities',
  authenticate,
  checkPermission('attendance:write'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = buildRlsContext(req);
      const activity = await addActivity(ctx, orgId, id, { ...req.body, timeEntryId: id });
      res.status(201).json(activity);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/time-entries/team/:teamId/activities — bulk add activity for all team members (PONTO-02)
timeEntriesRouter.post(
  '/org/:orgId/time-entries/team/:teamId/activities',
  authenticate,
  checkPermission('attendance:write'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const teamId = req.params.teamId as string;
      const ctx = buildRlsContext(req);
      const result = await addTeamActivity(ctx, orgId, teamId, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
