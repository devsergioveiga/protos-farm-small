import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { AssetTradeInError } from './asset-trade-ins.types';
import { createTradeIn, listTradeIns, getTradeIn } from './asset-trade-ins.service';

export const assetTradeInsRouter = Router();

const base = '/org/:orgId/asset-trade-ins';

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AssetTradeInError('Acesso negado: usuario sem organizacao vinculada', 403);
  }
  return { organizationId, userId: req.user?.userId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof AssetTradeInError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST / — Create trade-in ─────────────────────────────────────────

assetTradeInsRouter.post(
  base,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createTradeIn(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET / — List trade-ins ───────────────────────────────────────────

assetTradeInsRouter.get(
  base,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.query.farmId as string | undefined;
      const result = await listTradeIns(ctx, farmId);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /:id — Get single trade-in ──────────────────────────────────

assetTradeInsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { id } = req.params;
      const result = await getTradeIn(ctx, id);
      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
