import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { WipError } from './asset-wip.types';
import {
  addContribution,
  getWipSummary,
  activateWipAsset,
  createStage,
  completeStage,
  listStages,
} from './asset-wip.service';

export const assetWipRouter = Router();

const base = '/org/:orgId/asset-wip/:assetId';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new WipError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof WipError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/:orgId/asset-wip/:assetId/contributions ───────────────

assetWipRouter.post(
  `${base}/contributions`,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const assetId = req.params.assetId as string;
      const result = await addContribution(ctx, assetId, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/asset-wip/:assetId/summary ──────────────────────

assetWipRouter.get(
  `${base}/summary`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const assetId = req.params.assetId as string;
      const result = await getWipSummary(ctx, assetId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/asset-wip/:assetId/activate ────────────────────

assetWipRouter.post(
  `${base}/activate`,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const assetId = req.params.assetId as string;
      const result = await activateWipAsset(ctx, assetId, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/asset-wip/:assetId/stages ──────────────────────

assetWipRouter.post(
  `${base}/stages`,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const assetId = req.params.assetId as string;
      const result = await createStage(ctx, assetId, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/asset-wip/:assetId/stages/:stageId/complete ───

assetWipRouter.patch(
  `${base}/stages/:stageId/complete`,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const stageId = req.params.stageId as string;
      const result = await completeStage(ctx, stageId, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/asset-wip/:assetId/stages ───────────────────────

assetWipRouter.get(
  `${base}/stages`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const assetId = req.params.assetId as string;
      const result = await listStages(ctx, assetId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
