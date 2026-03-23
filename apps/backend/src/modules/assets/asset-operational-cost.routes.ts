import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { OperationalCostError, getOperationalCost } from './asset-operational-cost.service';

export const operationalCostRouter = Router();

const base = '/org/:orgId/assets/:assetId/operational-cost';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildCtx(req: Request): { organizationId: string } {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new OperationalCostError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof OperationalCostError) {
    res.status(err.statusCode).json({ error: err.message, ...err.data });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/assets/:assetId/operational-cost ─────────────────

operationalCostRouter.get(
  base,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const periodStart = req.query.periodStart as string | undefined;
      const periodEnd = req.query.periodEnd as string | undefined;
      const result = await getOperationalCost(ctx, req.params.assetId as string, periodStart, periodEnd);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
