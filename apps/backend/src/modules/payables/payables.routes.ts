import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { PayableError } from './payables.types';
import {
  createPayable,
  listPayables,
  getPayable,
  updatePayable,
  deletePayable,
  settlePayment,
  batchSettlePayments,
  reversePayment,
  generateRecurrence,
} from './payables.service';

export const payablesRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PayableError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof PayableError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('PayableError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── LIST ─────────────────────────────────────────────────────────────

payablesRouter.get(
  '/org/payables',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await listPayables(ctx, {
        farmId: req.query.farmId as string | undefined,
        status: req.query.status as import('./payables.types').ListPayablesQuery['status'],
        category: req.query.category as import('./payables.types').ListPayablesQuery['category'],
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        search: req.query.search as string | undefined,
        page,
        limit,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ───────────────────────────────────────────────────────────

payablesRouter.post(
  '/org/payables',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const payable = await createPayable(ctx, req.body);
      res.status(201).json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── BATCH SETTLE — BEFORE /:id TO AVOID PARAM CONFLICT ──────────────

payablesRouter.post(
  '/org/payables/batch-settle',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const results = await batchSettlePayments(ctx, req.body);
      res.json(results);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GENERATE RECURRENCE — BEFORE /:id ────────────────────────────────

payablesRouter.post(
  '/org/payables/generate-recurrence',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const generated = await generateRecurrence(ctx);
      res.status(201).json(generated);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ──────────────────────────────────────────────────────────────

payablesRouter.get(
  '/org/payables/:id',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const payable = await getPayable(ctx, req.params.id as string);
      res.json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ───────────────────────────────────────────────────────────

payablesRouter.put(
  '/org/payables/:id',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const payable = await updatePayable(ctx, req.params.id as string, req.body);
      res.json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ───────────────────────────────────────────────────────────

payablesRouter.delete(
  '/org/payables/:id',
  authenticate,
  checkPermission('financial:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deletePayable(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── SETTLE ───────────────────────────────────────────────────────────

payablesRouter.post(
  '/org/payables/:id/settle',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const payable = await settlePayment(ctx, req.params.id as string, req.body);
      res.json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── REVERSE ──────────────────────────────────────────────────────────

payablesRouter.post(
  '/org/payables/:id/reverse',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const payable = await reversePayment(ctx, req.params.id as string);
      res.json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);
