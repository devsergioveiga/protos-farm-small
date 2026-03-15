import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { getMilkDashboard, exportMilkDashboardCsv } from './milk-dashboard.service';
import {
  isValidPeriod,
  type DashboardPeriod,
  type MilkDashboardQuery,
} from './milk-dashboard.types';
import type { RlsContext } from '../../database/rls';

export const milkDashboardRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw Object.assign(new Error('Acesso negado: usuário sem organização vinculada'), {
      statusCode: 403,
    });
  }
  return { organizationId };
}

function buildQuery(req: import('express').Request): MilkDashboardQuery {
  const period = (req.query.period as string) ?? '30d';
  if (!isValidPeriod(period)) {
    throw Object.assign(new Error('Período inválido. Use 30d, 90d ou 365d.'), {
      statusCode: 400,
    });
  }
  return {
    farmId: req.params.farmId as string,
    period: period as DashboardPeriod,
    lotId: req.query.lotId as string | undefined,
    breedName: req.query.breedName as string | undefined,
  };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof Error && 'statusCode' in err) {
    res.status((err as unknown as { statusCode: number }).statusCode).json({ error: err.message });
    return;
  }
  console.error('MilkDashboard error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET full dashboard ─────────────────────────────────────────────

milkDashboardRouter.get(
  '/org/farms/:farmId/milk-dashboard',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = buildQuery(req);
      const result = await getMilkDashboard(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET CSV export ─────────────────────────────────────────────────

milkDashboardRouter.get(
  '/org/farms/:farmId/milk-dashboard/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = buildQuery(req);
      const csv = await exportMilkDashboardCsv(ctx, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="dashboard-leite.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);
