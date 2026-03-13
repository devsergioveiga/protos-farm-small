import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { StockAlertError, type StockLevel } from './stock-alerts.types';
import {
  getStockLevelDashboard,
  listStockLevelAlerts,
  listExpiryAlerts,
  getExpiryReportCSV,
} from './stock-alerts.service';

export const stockAlertsRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new StockAlertError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof StockAlertError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('StockAlertError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CA5: Dashboard de estoque (semáforo) ───────────────────────────

stockAlertsRouter.get(
  '/org/stock-alerts/dashboard',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const dashboard = await getStockLevelDashboard(ctx);
      res.json(dashboard);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA3: Alertas de nível de estoque (paginado) ────────────────────

stockAlertsRouter.get(
  '/org/stock-alerts/levels',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listStockLevelAlerts(ctx, {
        level: req.query.level as StockLevel | undefined,
        productType: req.query.productType as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA4 + CA6: Alertas de validade ─────────────────────────────────

stockAlertsRouter.get(
  '/org/stock-alerts/expiry',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listExpiryAlerts(ctx, {
        daysAhead: req.query.daysAhead ? Number(req.query.daysAhead) : undefined,
        includeExpired: req.query.includeExpired !== 'false',
        productType: req.query.productType as string | undefined,
        isPesticide: req.query.isPesticide === 'true',
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA7: Relatório de validade (CSV export) ────────────────────────

stockAlertsRouter.get(
  '/org/stock-alerts/expiry/export',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await getExpiryReportCSV(
        ctx,
        req.query.daysAhead ? Number(req.query.daysAhead) : undefined,
        req.query.includeExpired !== 'false',
        req.query.productType as string | undefined,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="relatorio-validade-${new Date().toISOString().split('T')[0]}.csv"`,
      );
      // BOM for Excel UTF-8 detection
      res.send('\ufeff' + csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);
