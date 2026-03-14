import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { getSanitaryDashboard, exportSanitaryReportCsv } from './sanitary-dashboard.service';
import type { RlsContext } from '../../database/rls';

export const sanitaryDashboardRouter = Router();

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

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof Error && 'statusCode' in err) {
    res.status((err as unknown as { statusCode: number }).statusCode).json({ error: err.message });
    return;
  }
  console.error('SanitaryDashboard error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET dashboard (org-scoped, optional farm filter) ───────────────

sanitaryDashboardRouter.get(
  '/org/sanitary-dashboard',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        farmId: req.query.farmId as string | undefined,
        lotId: req.query.lotId as string | undefined,
        category: req.query.category as string | undefined,
      };
      const result = await getSanitaryDashboard(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET dashboard for specific farm ────────────────────────────────

sanitaryDashboardRouter.get(
  '/org/farms/:farmId/sanitary-dashboard',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        farmId: req.params.farmId as string,
        lotId: req.query.lotId as string | undefined,
        category: req.query.category as string | undefined,
      };
      const result = await getSanitaryDashboard(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CSV export (CA6) ───────────────────────────────────────────────

sanitaryDashboardRouter.get(
  '/org/farms/:farmId/sanitary-dashboard/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        farmId: req.params.farmId as string,
        lotId: req.query.lotId as string | undefined,
        category: req.query.category as string | undefined,
      };
      const csv = await exportSanitaryReportCsv(ctx, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio-sanitario.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);
