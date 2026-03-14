import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { CompositeProductError } from './composite-products.types';
import {
  getCompositeDetail,
  setCompositeIngredients,
  recordProduction,
  listProductions,
  getProduction,
  deleteProduction,
  exportProductionRecipe,
} from './composite-products.service';

export const compositeProductsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new CompositeProductError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof CompositeProductError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('CompositeProduct error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSITE PRODUCT DETAIL & INGREDIENTS
// ═══════════════════════════════════════════════════════════════════

// ─── GET COMPOSITE DETAIL ───────────────────────────────────────────

compositeProductsRouter.get(
  '/org/products/:productId/composite',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCompositeDetail(ctx, req.params.productId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── SET/UPDATE COMPOSITE INGREDIENTS ───────────────────────────────

compositeProductsRouter.put(
  '/org/products/:productId/composite',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await setCompositeIngredients(ctx, req.params.productId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SET_COMPOSITE_INGREDIENTS',
        targetType: 'product',
        targetId: req.params.productId as string,
        metadata: {
          compositeType: req.body.compositeType,
          ingredientCount: req.body.ingredients?.length,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// COMPOSITE PRODUCTIONS
// ═══════════════════════════════════════════════════════════════════

// ─── RECORD PRODUCTION ──────────────────────────────────────────────

compositeProductsRouter.post(
  '/org/composite-productions',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await recordProduction(ctx, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECORD_COMPOSITE_PRODUCTION',
        targetType: 'composite_production',
        targetId: result.id,
        metadata: {
          compositeProductId: result.compositeProductId,
          quantityProduced: result.quantityProduced,
          totalCostCents: result.totalCostCents,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST PRODUCTIONS ───────────────────────────────────────────────

compositeProductsRouter.get(
  '/org/composite-productions',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        compositeProductId: req.query.compositeProductId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listProductions(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET PRODUCTION DETAIL ──────────────────────────────────────────

compositeProductsRouter.get(
  '/org/composite-productions/:productionId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getProduction(ctx, req.params.productionId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE PRODUCTION ──────────────────────────────────────────────

compositeProductsRouter.delete(
  '/org/composite-productions/:productionId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteProduction(ctx, req.params.productionId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_COMPOSITE_PRODUCTION',
        targetType: 'composite_production',
        targetId: req.params.productionId as string,
        metadata: {},
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Produção excluída com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT RECIPE ──────────────────────────────────────────────────

compositeProductsRouter.get(
  '/org/products/:productId/composite/recipe',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportProductionRecipe(ctx, req.params.productId as string);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="receita-producao.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);
