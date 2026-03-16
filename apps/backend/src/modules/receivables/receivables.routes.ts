import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import {
  ReceivableError,
  type ReceivableStatus,
  type ReceivableCategory,
} from './receivables.types';
import {
  createReceivable,
  listReceivables,
  getReceivable,
  updateReceivable,
  deleteReceivable,
  settleReceivable,
  reverseReceivable,
  renegotiateReceivable,
  getReceivablesAging,
  getReceivablesByBucket,
} from './receivables.service';

export const receivablesRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new ReceivableError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof ReceivableError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('ReceivableError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── AGING — register BEFORE /:id to avoid param capture ─────────────

receivablesRouter.get(
  '/org/receivables/aging',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const aging = await getReceivablesAging(ctx, req.query.farmId as string | undefined);
      res.json(aging);
    } catch (err) {
      handleError(err, res);
    }
  },
);

receivablesRouter.get(
  '/org/receivables/aging/:bucket',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const receivables = await getReceivablesByBucket(
        ctx,
        req.params.bucket as string,
        req.query.farmId as string | undefined,
      );
      res.json(receivables);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ─────────────────────────────────────────────────────────────

receivablesRouter.get(
  '/org/receivables',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listReceivables(ctx, {
        farmId: req.query.farmId as string | undefined,
        status: req.query.status as ReceivableStatus | undefined,
        category: req.query.category as ReceivableCategory | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ───────────────────────────────────────────────────────────

receivablesRouter.post(
  '/org/receivables',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const receivable = await createReceivable(ctx, req.body);
      res.status(201).json(receivable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ─────────────────────────────────────────────────────────────

receivablesRouter.get(
  '/org/receivables/:id',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const receivable = await getReceivable(ctx, req.params.id as string);
      res.json(receivable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ──────────────────────────────────────────────────────────

receivablesRouter.put(
  '/org/receivables/:id',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const receivable = await updateReceivable(ctx, req.params.id as string, req.body);
      res.json(receivable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE (cancel) ─────────────────────────────────────────────────

receivablesRouter.delete(
  '/org/receivables/:id',
  authenticate,
  checkPermission('financial:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteReceivable(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── SETTLE ──────────────────────────────────────────────────────────

receivablesRouter.post(
  '/org/receivables/:id/settle',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const receivable = await settleReceivable(ctx, req.params.id as string, req.body);
      res.json(receivable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── REVERSE ──────────────────────────────────────────────────────────

receivablesRouter.post(
  '/org/receivables/:id/reverse',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const receivable = await reverseReceivable(ctx, req.params.id as string);
      res.json(receivable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── RENEGOTIATE ─────────────────────────────────────────────────────

receivablesRouter.post(
  '/org/receivables/:id/renegotiate',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const receivable = await renegotiateReceivable(ctx, req.params.id as string, req.body);
      res.json(receivable);
    } catch (err) {
      handleError(err, res);
    }
  },
);
