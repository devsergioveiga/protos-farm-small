import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { AssetDisposalError } from './asset-disposals.types';
import { createDisposal, getDisposal } from './asset-disposals.service';

export const assetDisposalsRouter = Router();

const base = '/org/:orgId/asset-disposals';

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AssetDisposalError('Acesso negado: usuario sem organizacao vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof AssetDisposalError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /:assetId/dispose — Create disposal ────────────────────────

assetDisposalsRouter.post(
  `${base}/:assetId/dispose`,
  authenticate,
  checkPermission('assets:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { assetId } = req.params;
      const userId = req.user!.userId;
      const result = await createDisposal(ctx, assetId, req.body, userId);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /:assetId/disposal — Get disposal record ────────────────────

assetDisposalsRouter.get(
  `${base}/:assetId/disposal`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { assetId } = req.params;
      const result = await getDisposal(ctx, assetId);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
