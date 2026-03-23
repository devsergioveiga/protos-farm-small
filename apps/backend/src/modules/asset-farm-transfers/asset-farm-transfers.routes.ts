import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { AssetTransferError } from './asset-farm-transfers.types';
import { createTransfer, listTransfers } from './asset-farm-transfers.service';

export const assetFarmTransfersRouter = Router();

const base = '/org/:orgId/asset-farm-transfers';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AssetTransferError('Acesso negado: usuario sem organizacao vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof AssetTransferError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /:assetId/transfer — Create transfer ────────────────────────

assetFarmTransfersRouter.post(
  `${base}/:assetId/transfer`,
  authenticate,
  checkPermission('assets:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const userId = req.user?.userId ?? '';
      const result = await createTransfer(ctx, req.params.assetId, req.body, userId);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /:assetId/transfers — List transfer history ─────────────────

assetFarmTransfersRouter.get(
  `${base}/:assetId/transfers`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { page, limit } = req.query;
      const result = await listTransfers(ctx, req.params.assetId, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
