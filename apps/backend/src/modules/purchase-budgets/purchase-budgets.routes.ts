import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { PurchaseBudgetError } from './purchase-budgets.types';
import {
  createPurchaseBudget,
  updatePurchaseBudget,
  listPurchaseBudgets,
  getPurchaseBudgetById,
  deletePurchaseBudget,
  getBudgetExecution,
  getDeviationReport,
} from './purchase-budgets.service';

export const purchaseBudgetsRouter = Router();

const base = '/org/purchase-budgets';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PurchaseBudgetError('Acesso negado: usuario sem organizacao vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof PurchaseBudgetError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/purchase-budgets ─────────────────────────────────────────

purchaseBudgetsRouter.get(
  base,
  authenticate,
  checkPermission('purchases:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listPurchaseBudgets(ctx, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        farmId: req.query.farmId as string | undefined,
        category: req.query.category as string | undefined,
        periodType: req.query.periodType as string | undefined,
        periodStart: req.query.periodStart as string | undefined,
        periodEnd: req.query.periodEnd as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/purchase-budgets/execution (BEFORE /:id) ────────────────

purchaseBudgetsRouter.get(
  `${base}/execution`,
  authenticate,
  checkPermission('purchases:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getBudgetExecution(ctx, {
        farmId: req.query.farmId as string | undefined,
        periodStart: req.query.periodStart as string | undefined,
        periodEnd: req.query.periodEnd as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/purchase-budgets/deviations (BEFORE /:id) ───────────────

purchaseBudgetsRouter.get(
  `${base}/deviations`,
  authenticate,
  checkPermission('purchases:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getDeviationReport(ctx, {
        farmId: req.query.farmId as string | undefined,
        periodStart: req.query.periodStart as string | undefined,
        periodEnd: req.query.periodEnd as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/purchase-budgets ────────────────────────────────────────

purchaseBudgetsRouter.post(
  base,
  authenticate,
  checkPermission('purchases:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createPurchaseBudget(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/purchase-budgets/:id ────────────────────────────────────

purchaseBudgetsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getPurchaseBudgetById(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /org/purchase-budgets/:id ────────────────────────────────────

purchaseBudgetsRouter.put(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updatePurchaseBudget(ctx, req.params.id as string, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/purchase-budgets/:id ─────────────────────────────────

purchaseBudgetsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('purchases:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await deletePurchaseBudget(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
