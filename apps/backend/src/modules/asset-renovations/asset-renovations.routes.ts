import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { RenovationError } from './asset-renovations.types';
import { createRenovation, listRenovations } from './asset-renovations.service';

export const assetRenovationsRouter = Router();

const base = '/org/:orgId/assets/:assetId/renovations';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new RenovationError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof RenovationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/:orgId/assets/:assetId/renovations ────────────────────

assetRenovationsRouter.post(
  base,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const assetId = req.params.assetId as string;
      const result = await createRenovation(ctx, assetId, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/assets/:assetId/renovations ─────────────────────

assetRenovationsRouter.get(base, authenticate, checkPermission('assets:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const assetId = req.params.assetId as string;
    const result = await listRenovations(ctx, assetId);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});
