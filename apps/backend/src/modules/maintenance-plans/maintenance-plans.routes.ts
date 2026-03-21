import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { MaintenancePlanError } from './maintenance-plans.types';
import {
  createMaintenancePlan,
  listMaintenancePlans,
  getMaintenancePlan,
  updateMaintenancePlan,
  deleteMaintenancePlan,
} from './maintenance-plans.service';

export const maintenancePlansRouter = Router();

const base = '/org/:orgId/maintenance-plans';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new MaintenancePlanError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof MaintenancePlanError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/:orgId/maintenance-plans ───────────────────────────────

maintenancePlansRouter.post(
  base,
  authenticate,
  checkPermission('maintenance-plans:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { assetId, name, triggerType, intervalValue, alertBeforeValue } = req.body as {
        assetId?: string;
        name?: string;
        triggerType?: string;
        intervalValue?: unknown;
        alertBeforeValue?: unknown;
      };

      if (!assetId) {
        res.status(400).json({ error: 'assetId é obrigatório' });
        return;
      }
      if (!name) {
        res.status(400).json({ error: 'name é obrigatório' });
        return;
      }
      if (!triggerType) {
        res.status(400).json({ error: 'triggerType é obrigatório' });
        return;
      }
      if (intervalValue == null || isNaN(Number(intervalValue))) {
        res.status(400).json({ error: 'intervalValue é obrigatório e deve ser numérico' });
        return;
      }
      if (alertBeforeValue == null || isNaN(Number(alertBeforeValue))) {
        res.status(400).json({ error: 'alertBeforeValue é obrigatório e deve ser numérico' });
        return;
      }

      const result = await createMaintenancePlan(ctx, {
        assetId,
        name,
        description: req.body.description,
        triggerType: triggerType as 'HOURMETER' | 'ODOMETER' | 'CALENDAR',
        intervalValue: Number(intervalValue),
        alertBeforeValue: Number(alertBeforeValue),
      });
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/maintenance-plans ────────────────────────────────

maintenancePlansRouter.get(
  base,
  authenticate,
  checkPermission('maintenance-plans:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        assetId: req.query.assetId as string | undefined,
        triggerType: req.query.triggerType as 'HOURMETER' | 'ODOMETER' | 'CALENDAR' | undefined,
        isActive:
          req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        farmId: req.query.farmId as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listMaintenancePlans(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/maintenance-plans/:id ────────────────────────────

maintenancePlansRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('maintenance-plans:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getMaintenancePlan(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /org/:orgId/maintenance-plans/:id ────────────────────────────

maintenancePlansRouter.put(
  `${base}/:id`,
  authenticate,
  checkPermission('maintenance-plans:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateMaintenancePlan(ctx, req.params.id as string, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/maintenance-plans/:id ─────────────────────────

maintenancePlansRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('maintenance-plans:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteMaintenancePlan(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
