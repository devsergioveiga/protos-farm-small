// ─── Employee Absences Routes ─────────────────────────────────────────
// 5 endpoints: list, get, create, update, register return

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './employee-absences.service';
import { AbsenceError } from './employee-absences.types';

export const employeeAbsencesRouter = Router();

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof AbsenceError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/employee-absences ────────────────────────────────

employeeAbsencesRouter.get(
  '/org/:orgId/employee-absences',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      const filters = {
        employeeId: req.query.employeeId as string | undefined,
        absenceType: req.query.type as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      };
      const result = await service.listAbsences(orgId, filters, ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/employee-absences/:id ────────────────────────────

employeeAbsencesRouter.get(
  '/org/:orgId/employee-absences/:id',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      const result = await service.getAbsenceById(id, orgId, ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/employee-absences ───────────────────────────────

employeeAbsencesRouter.post(
  '/org/:orgId/employee-absences',
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
      const result = await service.createAbsence(input, ctx);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/employee-absences/:id ─────────────────────────

employeeAbsencesRouter.patch(
  '/org/:orgId/employee-absences/:id',
  authenticate,
  checkPermission('employees:create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      const result = await service.updateAbsence(id, req.body, ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/employee-absences/:id/return ──────────────────

employeeAbsencesRouter.patch(
  '/org/:orgId/employee-absences/:id/return',
  authenticate,
  checkPermission('employees:create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const ctx = { organizationId: orgId, userId: req.user?.userId };
      const result = await service.registerReturn(id, req.body, ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
