import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { AssetLeasingError } from './asset-leasings.types';
import {
  createLeasing,
  listLeasings,
  getLeasing,
  exercisePurchaseOption,
  returnAsset,
  cancelLeasing,
} from './asset-leasings.service';

export const assetLeasingsRouter = Router();

const base = '/org/:orgId/asset-leasings';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AssetLeasingError('Acesso negado: usuário sem organização vinculada', 403);
  }
  const userId = req.user?.userId;
  return { organizationId, userId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof AssetLeasingError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST / — Create leasing contract ────────────────────────────────

assetLeasingsRouter.post(
  base,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createLeasing(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET / — List leasings ────────────────────────────────────────────

assetLeasingsRouter.get(
  base,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const filters = {
        farmId: req.query.farmId as string | undefined,
        status: req.query.status as string | undefined,
      };
      const leasings = await listLeasings(ctx, filters);
      res.status(200).json(leasings);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /:id — Get single leasing ───────────────────────────────────

assetLeasingsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const leasing = await getLeasing(ctx, req.params.id as string);
      res.status(200).json(leasing);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /:id/exercise-purchase — Exercise purchase option ───────────

assetLeasingsRouter.put(
  `${base}/:id/exercise-purchase`,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const leasing = await exercisePurchaseOption(ctx, req.params.id as string);
      res.status(200).json(leasing);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /:id/return — Return asset to lessor ─────────────────────────

assetLeasingsRouter.put(
  `${base}/:id/return`,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const leasing = await returnAsset(ctx, req.params.id as string);
      res.status(200).json(leasing);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /:id/cancel — Cancel leasing ────────────────────────────────

assetLeasingsRouter.put(
  `${base}/:id/cancel`,
  authenticate,
  checkPermission('assets:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const leasing = await cancelLeasing(ctx, req.params.id as string);
      res.status(200).json(leasing);
    } catch (err) {
      handleError(err, res);
    }
  },
);
