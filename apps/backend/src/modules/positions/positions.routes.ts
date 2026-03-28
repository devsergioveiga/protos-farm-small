import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { PositionError } from './positions.types';
import {
  createPosition,
  listPositions,
  getPosition,
  updatePosition,
  setSalaryBands,
  getStaffingView,
} from './positions.service';

export const positionsRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PositionError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user!.userId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof PositionError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// GET /org/:orgId/positions/staffing-view — must be before /:id
positionsRouter.get(
  '/org/:orgId/positions/staffing-view',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getStaffingView(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/positions
positionsRouter.get(
  '/org/:orgId/positions',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const search = req.query.search as string | undefined;
      const isActiveRaw = req.query.isActive as string | undefined;
      const isActive = isActiveRaw === 'true' ? true : isActiveRaw === 'false' ? false : undefined;
      const page = req.query.page ? Number(req.query.page as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit as string) : undefined;

      const result = await listPositions(ctx, { search, isActive, page, limit });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/positions
positionsRouter.post(
  '/org/:orgId/positions',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const position = await createPosition(ctx, req.body);
      res.status(201).json(position);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/positions/:id
positionsRouter.get(
  '/org/:orgId/positions/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const position = await getPosition(ctx, req.params.id as string);
      res.json(position);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PUT /org/:orgId/positions/:id
positionsRouter.put(
  '/org/:orgId/positions/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const position = await updatePosition(ctx, req.params.id as string, req.body);
      res.json(position);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PUT /org/:orgId/positions/:id/salary-bands
positionsRouter.put(
  '/org/:orgId/positions/:id/salary-bands',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const bands = req.body;
      if (!Array.isArray(bands)) {
        res.status(400).json({ error: 'Body deve ser um array de faixas salariais' });
        return;
      }
      const result = await setSalaryBands(ctx, req.params.id as string, bands);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
