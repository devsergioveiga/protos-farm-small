import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { TransferError } from './transfers.types';
import { createTransfer, listTransfers, getTransfer, deleteTransfer } from './transfers.service';

export const transfersRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new TransferError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof TransferError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('TransferError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── LIST ─────────────────────────────────────────────────────────────

transfersRouter.get(
  '/org/transfers',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listTransfers(ctx, {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        type: req.query.type as string | undefined,
        accountId: req.query.accountId as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ONE ──────────────────────────────────────────────────────────

transfersRouter.get(
  '/org/transfers/:id',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getTransfer(ctx, req.params.id);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ───────────────────────────────────────────────────────────

transfersRouter.post(
  '/org/transfers',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createTransfer(ctx, {
        fromAccountId: req.body.fromAccountId,
        toAccountId: req.body.toAccountId,
        type: req.body.type,
        amount: Number(req.body.amount),
        feeAmount: req.body.feeAmount != null ? Number(req.body.feeAmount) : undefined,
        description: req.body.description,
        transferDate: req.body.transferDate,
        notes: req.body.notes,
      });
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ───────────────────────────────────────────────────────────

transfersRouter.delete(
  '/org/transfers/:id',
  authenticate,
  checkPermission('financial:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteTransfer(ctx, req.params.id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
