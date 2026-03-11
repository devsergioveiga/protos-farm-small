import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import type { RlsContext } from '../../database/rls';
import { ProductivityTargetError } from './productivity-targets.types';
import {
  listProductivityTargets,
  createProductivityTarget,
  updateProductivityTarget,
  deleteProductivityTarget,
} from './productivity-targets.service';

export const productivityTargetsRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new ProductivityTargetError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof ProductivityTargetError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── LIST ──────────────────────────────────────────────────────────

productivityTargetsRouter.get(
  '/org/farms/:farmId/productivity-targets',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listProductivityTargets(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ────────────────────────────────────────────────────────

productivityTargetsRouter.post(
  '/org/farms/:farmId/productivity-targets',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createProductivityTarget(ctx, req.params.farmId as string, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ────────────────────────────────────────────────────────

productivityTargetsRouter.put(
  '/org/farms/:farmId/productivity-targets/:targetId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateProductivityTarget(
        ctx,
        req.params.farmId as string,
        req.params.targetId as string,
        req.body,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ────────────────────────────────────────────────────────

productivityTargetsRouter.delete(
  '/org/farms/:farmId/productivity-targets/:targetId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteProductivityTarget(
        ctx,
        req.params.farmId as string,
        req.params.targetId as string,
      );
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
