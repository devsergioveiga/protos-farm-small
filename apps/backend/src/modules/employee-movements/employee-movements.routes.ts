import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { EmployeeMovementError } from './employee-movements.types';
import {
  createMovement,
  listMovements,
  getTimeline,
  bulkSalaryAdjustment,
} from './employee-movements.service';

export const employeeMovementsRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new EmployeeMovementError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof EmployeeMovementError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// GET /org/:orgId/employee-movements — list movements
employeeMovementsRouter.get(
  '/org/:orgId/employee-movements',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const employeeId = req.query.employeeId as string | undefined;
      const movementType = req.query.movementType as string | undefined;
      const page = req.query.page ? Number(req.query.page as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit as string) : undefined;

      const result = await listMovements(ctx, { employeeId, movementType, page, limit });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/employee-movements — create movement
employeeMovementsRouter.post(
  '/org/:orgId/employee-movements',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const movement = await createMovement(ctx, req.body);
      res.status(201).json(movement);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/employee-movements/timeline/:employeeId
// Must be before /:id routes to avoid conflict
employeeMovementsRouter.get(
  '/org/:orgId/employee-movements/timeline/:employeeId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const timeline = await getTimeline(ctx, req.params.employeeId as string);
      res.json(timeline);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/employees/bulk-salary-adjustment
employeeMovementsRouter.post(
  '/org/:orgId/employees/bulk-salary-adjustment',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await bulkSalaryAdjustment(ctx, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
