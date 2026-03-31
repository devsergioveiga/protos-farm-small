import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import {
  listActiveIngredients,
  createActiveIngredient,
  updateActiveIngredient,
  deleteActiveIngredient,
} from './active-ingredients.service';

export const activeIngredientsRouter = Router();

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

activeIngredientsRouter.get(
  '/org/active-ingredients',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const items = await listActiveIngredients(ctx);
      res.json(items);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
);

// ─── CREATE ────────────────────────────────────────────────────────

activeIngredientsRouter.post(
  '/org/active-ingredients',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const item = await createActiveIngredient(ctx, req.body);
      res.status(201).json(item);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
);

// ─── UPDATE ───────────────────────────────────────────────────────

activeIngredientsRouter.put(
  '/org/active-ingredients/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const item = await updateActiveIngredient(ctx, id, req.body);
      res.json(item);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
);

// ─── DELETE ───────────────────────────────────────────────────────

activeIngredientsRouter.delete(
  '/org/active-ingredients/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      await deleteActiveIngredient(ctx, id);
      res.status(204).end();
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
);
