// ─── Vacation Schedules Routes ────────────────────────────────────────
// 8 endpoints: periods list, schedules list, get, create, pay, cancel, expiring

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './vacation-schedules.service';
import { VacationError } from './vacation-schedules.types';

export const vacationSchedulesRouter = Router();

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof VacationError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/vacation-schedules/expiring ──────────────────────
// Must be registered before /:id to avoid Express param shadowing

vacationSchedulesRouter.get(
  '/org/:orgId/vacation-schedules/expiring',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const daysAhead = parseInt((req.query.daysAhead as string) ?? '60', 10);
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      const result = await service.getExpiringPeriods(orgId, daysAhead, ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/vacation-schedules/periods ───────────────────────

vacationSchedulesRouter.get(
  '/org/:orgId/vacation-schedules/periods',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const employeeId = req.query.employeeId as string;
      if (!employeeId) {
        res.status(400).json({ error: 'employeeId é obrigatório' });
        return;
      }
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      const result = await service.listAcquisitivePeriods(employeeId, orgId, ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/vacation-schedules ───────────────────────────────

vacationSchedulesRouter.get(
  '/org/:orgId/vacation-schedules',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      const filters = {
        employeeId: req.query.employeeId as string | undefined,
        status: req.query.status as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      };
      const result = await service.listSchedules(orgId, filters, ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/vacation-schedules/:id ───────────────────────────

vacationSchedulesRouter.get(
  '/org/:orgId/vacation-schedules/:id',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      const result = await service.getScheduleById(id, orgId, ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/vacation-schedules ──────────────────────────────

vacationSchedulesRouter.post(
  '/org/:orgId/vacation-schedules',
  authenticate,
  checkPermission('employees:create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      const input = {
        ...req.body,
        organizationId: orgId,
        createdBy: req.user?.userId ?? 'system',
      };
      const result = await service.scheduleVacation(input, ctx);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/vacation-schedules/:id/pay ─────────────────────

vacationSchedulesRouter.patch(
  '/org/:orgId/vacation-schedules/:id/pay',
  authenticate,
  checkPermission('employees:create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      const result = await service.markAsPaid(id, ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/vacation-schedules/:id/cancel ─────────────────

vacationSchedulesRouter.patch(
  '/org/:orgId/vacation-schedules/:id/cancel',
  authenticate,
  checkPermission('employees:create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      await service.cancelVacation(id, ctx);
      res.status(204).end();
    } catch (err) {
      handleError(err, res);
    }
  },
);
