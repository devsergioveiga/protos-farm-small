// ─── HR Dashboard Routes ──────────────────────────────────────────────
// INTEGR-03: Single read endpoint returning all HR KPIs.
// GET /org/hr-dashboard?farmId=&year=&month=

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { HrDashboardError, type HrDashboardQuery } from './hr-dashboard.types';
import { getHrDashboard } from './hr-dashboard.service';

export const hrDashboardRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new HrDashboardError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof HrDashboardError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('HrDashboardError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/hr-dashboard ────────────────────────────────────────────

hrDashboardRouter.get(
  '/org/hr-dashboard',
  authenticate,
  checkPermission('farms:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const ctx = buildRlsContext(req);

      const farmId = req.query.farmId as string | undefined;
      const yearRaw = req.query.year as string | undefined;
      const monthRaw = req.query.month as string | undefined;

      if (!yearRaw || !monthRaw) {
        throw new HrDashboardError('Parâmetros year e month são obrigatórios', 400);
      }

      const year = parseInt(yearRaw, 10);
      const month = parseInt(monthRaw, 10);

      if (isNaN(year) || year < 2000 || year > 2100) {
        throw new HrDashboardError('Parâmetro year inválido (esperado 2000–2100)', 400);
      }

      if (isNaN(month) || month < 1 || month > 12) {
        throw new HrDashboardError('Parâmetro month inválido (esperado 1–12)', 400);
      }

      const query: HrDashboardQuery = {
        farmId: farmId || undefined,
        year,
        month,
      };

      const result = await getHrDashboard(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
