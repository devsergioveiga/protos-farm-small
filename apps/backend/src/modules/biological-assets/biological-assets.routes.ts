import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { BiologicalAssetError } from './biological-assets.types';
import {
  createValuation,
  listValuations,
  getValuation,
  deleteValuation,
  getSummary,
} from './biological-assets.service';

export const biologicalAssetsRouter = Router();

const base = '/org/:orgId/biological-assets';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new BiologicalAssetError('Acesso negado: usuário sem organização vinculada', 403);
  }
  const userId = req.user?.userId ?? 'system';
  return { organizationId, userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof BiologicalAssetError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/biological-assets/summary (BEFORE /:id) ─────────

biologicalAssetsRouter.get(
  `${base}/summary`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.query.farmId as string | undefined;
      const result = await getSummary(ctx, farmId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/biological-assets ───────────────────────────────

biologicalAssetsRouter.get(base, authenticate, checkPermission('assets:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const filters = {
      farmId: req.query.farmId as string | undefined,
      assetGroup: req.query.assetGroup as string | undefined,
      groupType: req.query.groupType as string | undefined,
    };
    const result = await listValuations(ctx, filters);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── GET /org/:orgId/biological-assets/:id ───────────────────────────

biologicalAssetsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getValuation(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/biological-assets ──────────────────────────────

biologicalAssetsRouter.post(
  base,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createValuation(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/biological-assets/:id ────────────────────────

biologicalAssetsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('assets:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteValuation(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
