import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { FinancialDashboardError, type FinancialDashboardQuery } from './financial-dashboard.types';
import {
  getFinancialDashboard,
  getNegativeBalanceAlertForDashboard,
} from './financial-dashboard.service';

export const financialDashboardRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new FinancialDashboardError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof FinancialDashboardError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('FinancialDashboardError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/financial-dashboard/negative-balance-alert ─────────────

financialDashboardRouter.get(
  '/org/financial-dashboard/negative-balance-alert',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.query.farmId as string | undefined;
      const result = await getNegativeBalanceAlertForDashboard(ctx, farmId);
      if (result === null) {
        res.json({ negativeBalanceDate: null, negativeBalanceAmount: null });
      } else {
        res.json(result);
      }
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/financial-dashboard ────────────────────────────────────

financialDashboardRouter.get(
  '/org/financial-dashboard',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const now = new Date();
      const query: FinancialDashboardQuery = {
        farmId: req.query.farmId as string | undefined,
        year: req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear(),
        month: req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1,
      };
      const result = await getFinancialDashboard(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
