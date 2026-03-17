import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { RuralCreditError } from './rural-credit.types';
import {
  simulateSchedule,
  createContract,
  listContracts,
  getContract,
  updateContract,
  cancelContract,
  settleInstallment,
  applyExtraordinaryAmortization,
  getAlertCount,
} from './rural-credit.service';

export const ruralCreditRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new RuralCreditError('Acesso negado: usuario sem organizacao vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof RuralCreditError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('RuralCreditError nao tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /simulate — BEFORE /:id ────────────────────────────────────

ruralCreditRouter.post(
  '/org/rural-credit/simulate',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const schedule = simulateSchedule(req.body);
      res.json(schedule);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /alert-count — BEFORE /:id ──────────────────────────────────

ruralCreditRouter.get(
  '/org/rural-credit/alert-count',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getAlertCount(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET / — LIST ─────────────────────────────────────────────────────

ruralCreditRouter.get(
  '/org/rural-credit',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await listContracts(ctx, {
        farmId: req.query.farmId as string | undefined,
        status: req.query.status as string | undefined,
        creditLine: req.query.creditLine as string | undefined,
        page,
        limit,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST / — CREATE ──────────────────────────────────────────────────

ruralCreditRouter.post(
  '/org/rural-credit',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const contract = await createContract(ctx, req.body);
      res.status(201).json(contract);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /:id — BEFORE SUBRESOURCE ROUTES ─────────────────────────────

ruralCreditRouter.get(
  '/org/rural-credit/:id',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const contract = await getContract(ctx, req.params.id as string);
      res.json(contract);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /:id — UPDATE ────────────────────────────────────────────────

ruralCreditRouter.put(
  '/org/rural-credit/:id',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const contract = await updateContract(ctx, req.params.id as string, req.body);
      res.json(contract);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /:id/cancel — CANCEL ─────────────────────────────────────

ruralCreditRouter.delete(
  '/org/rural-credit/:id/cancel',
  authenticate,
  checkPermission('financial:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const contract = await cancelContract(ctx, req.params.id as string);
      res.json(contract);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /:id/settle-installment/:payableId ─────────────────────────

ruralCreditRouter.post(
  '/org/rural-credit/:id/settle-installment/:payableId',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const contract = await settleInstallment(
        ctx,
        req.params.id as string,
        req.params.payableId as string,
        req.body,
      );
      res.json(contract);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /:id/extraordinary-amortization ────────────────────────────

ruralCreditRouter.post(
  '/org/rural-credit/:id/extraordinary-amortization',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const contract = await applyExtraordinaryAmortization(ctx, req.params.id as string, req.body);
      res.json(contract);
    } catch (err) {
      handleError(err, res);
    }
  },
);
