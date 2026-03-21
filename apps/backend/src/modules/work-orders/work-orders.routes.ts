import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { WorkOrderError, type RlsContext } from './work-orders.types';
import {
  createWorkOrder,
  listWorkOrders,
  getWorkOrder,
  updateWorkOrder,
  addWorkOrderPart,
  removeWorkOrderPart,
  closeWorkOrder,
  cancelWorkOrder,
  getMaintenanceDashboard,
} from './work-orders.service';

export const workOrdersRouter = Router();

const base = '/org/:orgId/work-orders';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new WorkOrderError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return {
    organizationId,
    userId: req.user?.userId ?? 'unknown',
  };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof WorkOrderError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/work-orders/dashboard ───────────────────────────
// IMPORTANT: /dashboard route BEFORE /:id to prevent Express treating
// "dashboard" as an id parameter.

workOrdersRouter.get(
  `${base}/dashboard`,
  authenticate,
  checkPermission('work-orders:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const year = req.query.year ? Number(req.query.year) : undefined;
      const result = await getMaintenanceDashboard(ctx, { year });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/work-orders ────────────────────────────────────

workOrdersRouter.post(
  base,
  authenticate,
  checkPermission('work-orders:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createWorkOrder(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/work-orders ─────────────────────────────────────

workOrdersRouter.get(base, authenticate, checkPermission('work-orders:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const result = await listWorkOrders(ctx, req.query as never);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── GET /org/:orgId/work-orders/:id ─────────────────────────────────

workOrdersRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('work-orders:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getWorkOrder(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/work-orders/:id ───────────────────────────────

workOrdersRouter.patch(
  `${base}/:id`,
  authenticate,
  checkPermission('work-orders:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateWorkOrder(ctx, req.params.id as string, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/work-orders/:id/parts ──────────────────────────

workOrdersRouter.post(
  `${base}/:id/parts`,
  authenticate,
  checkPermission('work-orders:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await addWorkOrderPart(ctx, req.params.id as string, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/work-orders/:id/parts/:partId ────────────────

workOrdersRouter.delete(
  `${base}/:id/parts/:partId`,
  authenticate,
  checkPermission('work-orders:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await removeWorkOrderPart(
        ctx,
        req.params.id as string,
        req.params.partId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/work-orders/:id/close ─────────────────────────

workOrdersRouter.patch(
  `${base}/:id/close`,
  authenticate,
  checkPermission('work-orders:manage'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await closeWorkOrder(ctx, req.params.id as string, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/work-orders/:id/cancel ────────────────────────

workOrdersRouter.patch(
  `${base}/:id/cancel`,
  authenticate,
  checkPermission('work-orders:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await cancelWorkOrder(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
