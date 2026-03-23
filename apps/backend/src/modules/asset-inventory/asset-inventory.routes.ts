import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { AssetInventoryError } from './asset-inventory.types';
import {
  createInventory,
  countItems,
  reconcileInventory,
  getInventory,
  listInventories,
} from './asset-inventory.service';

export const assetInventoryRouter = Router();

const base = '/org/:orgId/asset-inventories';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AssetInventoryError('Acesso negado: usuario sem organizacao vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof AssetInventoryError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST / — Create inventory ────────────────────────────────────────

assetInventoryRouter.post(
  base,
  authenticate,
  checkPermission('assets:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const userId = req.user?.userId ?? '';
      const result = await createInventory(ctx, req.body, userId);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET / — List inventories ─────────────────────────────────────────

assetInventoryRouter.get(
  base,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { page, limit, status, farmId } = req.query;
      const result = await listInventories(ctx, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status: status as string | undefined,
        farmId: farmId as string | undefined,
      });
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /:id — Get inventory detail ─────────────────────────────────

assetInventoryRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getInventory(ctx, req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /:id/count — Count items ──────────────────────────────────

assetInventoryRouter.patch(
  `${base}/:id/count`,
  authenticate,
  checkPermission('assets:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await countItems(ctx, req.params.id as string, req.body.items ?? []);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /:id/reconcile — Reconcile inventory ───────────────────────

assetInventoryRouter.post(
  `${base}/:id/reconcile`,
  authenticate,
  checkPermission('assets:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const userId = req.user?.userId ?? '';
      const result = await reconcileInventory(ctx, req.params.id as string, userId);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
