import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { PurchaseDashboardError } from './purchase-dashboard.types';
import { getDashboardMetrics, getDashboardAlerts } from './purchase-dashboard.service';

export const purchaseDashboardRouter = Router();

const base = '/org/purchase-dashboard';

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PurchaseDashboardError('Acesso negado: usuario sem organizacao vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof PurchaseDashboardError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/purchase-dashboard/alerts (BEFORE base to avoid Express param capture) ──

purchaseDashboardRouter.get(
  `${base}/alerts`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.query.farmId as string | undefined;
      const alerts = await getDashboardAlerts(ctx, { farmId });
      res.json(alerts);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/purchase-dashboard ──────────────────────────────────────

purchaseDashboardRouter.get(
  base,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      const { startDate, endDate, farmId, category } = req.query as {
        startDate?: string;
        endDate?: string;
        farmId?: string;
        category?: string;
      };

      if (!startDate || !endDate) {
        res.status(400).json({ error: 'Periodo obrigatorio (startDate, endDate)' });
        return;
      }

      const ctx = buildRlsContext(req);
      const result = await getDashboardMetrics(ctx, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        farmId,
        category,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
