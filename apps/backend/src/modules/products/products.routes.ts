import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { ProductError } from './products.types';
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  listManufacturers,
} from './products.service';

export const productsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new ProductError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof ProductError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('ProductError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

productsRouter.post(
  '/org/products',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createProduct(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_PRODUCT',
        targetType: 'product',
        targetId: result.id,
        metadata: { name: result.name, nature: result.nature, type: result.type },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

productsRouter.get(
  '/org/products',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listProducts(ctx, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        nature: req.query.nature as string | undefined,
        type: req.query.type as string | undefined,
        status: req.query.status as string | undefined,
        category: req.query.category as string | undefined,
        search: req.query.search as string | undefined,
        manufacturerId: req.query.manufacturerId as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

productsRouter.get(
  '/org/products/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getProduct(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

productsRouter.put(
  '/org/products/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateProduct(ctx, req.params.id as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_PRODUCT',
        targetType: 'product',
        targetId: result.id,
        metadata: { name: result.name },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE (soft) ──────────────────────────────────────────────────

productsRouter.delete(
  '/org/products/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteProduct(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_PRODUCT',
        targetType: 'product',
        targetId: req.params.id as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── MANUFACTURERS ──────────────────────────────────────────────────

productsRouter.get(
  '/org/manufacturers',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listManufacturers(ctx, req.query.search as string | undefined);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
