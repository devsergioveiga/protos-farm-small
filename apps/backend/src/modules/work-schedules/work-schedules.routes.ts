import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { WorkScheduleError } from './work-schedules.types';
import {
  createWorkSchedule,
  listWorkSchedules,
  getWorkSchedule,
  updateWorkSchedule,
  deleteWorkSchedule,
  seedTemplates,
} from './work-schedules.service';

export const workSchedulesRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new WorkScheduleError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof WorkScheduleError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// POST /org/:orgId/work-schedules/seed-templates — must be before /:id
workSchedulesRouter.post(
  '/org/:orgId/work-schedules/seed-templates',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await seedTemplates(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/work-schedules
workSchedulesRouter.get(
  '/org/:orgId/work-schedules',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const type = req.query.type as string | undefined;
      const isTemplateRaw = req.query.isTemplate as string | undefined;
      const isTemplate =
        isTemplateRaw === 'true' ? true : isTemplateRaw === 'false' ? false : undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? Number(req.query.page as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit as string) : undefined;

      const result = await listWorkSchedules(ctx, { type, isTemplate, search, page, limit });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/work-schedules
workSchedulesRouter.post(
  '/org/:orgId/work-schedules',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const schedule = await createWorkSchedule(ctx, req.body);
      res.status(201).json(schedule);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/work-schedules/:id
workSchedulesRouter.get(
  '/org/:orgId/work-schedules/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const schedule = await getWorkSchedule(ctx, req.params.id as string);
      res.json(schedule);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PUT /org/:orgId/work-schedules/:id
workSchedulesRouter.put(
  '/org/:orgId/work-schedules/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const schedule = await updateWorkSchedule(ctx, req.params.id as string, req.body);
      res.json(schedule);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE /org/:orgId/work-schedules/:id
workSchedulesRouter.delete(
  '/org/:orgId/work-schedules/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteWorkSchedule(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
