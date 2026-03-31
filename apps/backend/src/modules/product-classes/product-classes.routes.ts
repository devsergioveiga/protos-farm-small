import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import {
  listProductClasses,
  createProductClass,
  updateProductClass,
  deleteProductClass,
} from './product-classes.service';

export const productClassesRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    const err = new Error('Acesso negado: usuário sem organização vinculada') as Error & {
      statusCode: number;
    };
    err.statusCode = 403;
    throw err;
  }
  return { organizationId };
}

// ─── LIST ──────────────────────────────────────────────────────────

productClassesRouter.get(
  '/org/product-classes',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const search = req.query.search as string | undefined;
      const items = await listProductClasses(ctx, search);
      res.json(items);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
);

// ─── CREATE ────────────────────────────────────────────────────────

productClassesRouter.post(
  '/org/product-classes',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const item = await createProductClass(ctx, req.body);
      res.status(201).json(item);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
);

// ─── UPDATE ────────────────────────────────────────────────────────

productClassesRouter.patch(
  '/org/product-classes/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const item = await updateProductClass(ctx, id, req.body);
      res.json(item);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
);

// ─── DELETE ────────────────────────────────────────────────────────

productClassesRouter.delete(
  '/org/product-classes/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      await deleteProductClass(ctx, id);
      res.status(204).send();
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
);
