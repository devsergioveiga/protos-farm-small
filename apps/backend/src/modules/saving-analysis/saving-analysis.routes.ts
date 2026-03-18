import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import {
  getSavingByQuotation,
  getPriceHistory,
  getCycleIndicators,
  getTopProducts,
  getTopSuppliers,
  getAnalyticsDashboard,
} from './saving-analysis.service';

export const savingAnalysisRouter = Router();

const base = '/org/saving-analysis';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new Error('Acesso negado: usuário sem organização vinculada');
  }
  return { organizationId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

function buildQueryParams(req: Request) {
  return {
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    category: req.query.category as string | undefined,
    supplierId: req.query.supplierId as string | undefined,
  };
}

function validateDates(req: Request, res: Response): boolean {
  if (!req.query.startDate || !req.query.endDate) {
    res.status(400).json({ error: 'startDate e endDate sao obrigatorios' });
    return false;
  }
  return true;
}

// ─── GET /org/saving-analysis/dashboard ───────────────────────────────
// MUST be before /:param routes

savingAnalysisRouter.get(
  `${base}/dashboard`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      if (!validateDates(req, res)) return;
      const ctx = buildRlsContext(req);
      const params = buildQueryParams(req);
      const result = await getAnalyticsDashboard(ctx, params);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/saving-analysis/saving ──────────────────────────────────

savingAnalysisRouter.get(
  `${base}/saving`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      if (!validateDates(req, res)) return;
      const ctx = buildRlsContext(req);
      const params = buildQueryParams(req);
      const result = await getSavingByQuotation(ctx, params);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/saving-analysis/indicators ──────────────────────────────

savingAnalysisRouter.get(
  `${base}/indicators`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      if (!validateDates(req, res)) return;
      const ctx = buildRlsContext(req);
      const params = buildQueryParams(req);
      const result = await getCycleIndicators(ctx, params);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/saving-analysis/top-products ────────────────────────────

savingAnalysisRouter.get(
  `${base}/top-products`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      if (!validateDates(req, res)) return;
      const ctx = buildRlsContext(req);
      const params = buildQueryParams(req);
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const result = await getTopProducts(ctx, params, limit);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/saving-analysis/top-suppliers ───────────────────────────

savingAnalysisRouter.get(
  `${base}/top-suppliers`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      if (!validateDates(req, res)) return;
      const ctx = buildRlsContext(req);
      const params = buildQueryParams(req);
      const limit = req.query.limit ? Number(req.query.limit) : 5;
      const result = await getTopSuppliers(ctx, params, limit);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/saving-analysis/price-history/:productId ────────────────

savingAnalysisRouter.get(
  `${base}/price-history/:productId`,
  authenticate,
  checkPermission('purchases:read'),
  async (req, res) => {
    try {
      if (!validateDates(req, res)) return;
      const ctx = buildRlsContext(req);
      const productId = req.params['productId'] as string;
      const dateParams = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };
      const result = await getPriceHistory(ctx, productId, dateParams);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
