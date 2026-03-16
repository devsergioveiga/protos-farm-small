import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { CheckError } from './checks.types';
import {
  createCheck,
  listChecks,
  getCheck,
  markACompensar,
  compensateCheck,
  returnCheck,
  resubmitCheck,
  cancelCheck,
  getAlertCount,
  getAccountingBalanceData,
} from './checks.service';

export const checksRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new CheckError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof CheckError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('CheckError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── ALERT COUNT (must be before /:id) ────────────────────────────────

checksRouter.get(
  '/org/checks/alert-count',
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

// ─── ACCOUNTING BALANCE (must be before /:id) ─────────────────────────

checksRouter.get(
  '/org/checks/accounting-balance',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.query.farmId as string | undefined;
      const result = await getAccountingBalanceData(ctx, farmId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ─────────────────────────────────────────────────────────────

checksRouter.get(
  '/org/checks',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listChecks(ctx, {
        status: req.query.status as string | undefined,
        type: req.query.type as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ───────────────────────────────────────────────────────────

checksRouter.post(
  '/org/checks',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const {
        type,
        checkNumber,
        amount,
        bankAccountId,
        issueDate,
        deliveryDate,
        expectedCompensationDate,
        payeeName,
        description,
        notes,
      } = req.body;

      // Input validation
      if (!type || !['EMITIDO', 'RECEBIDO'].includes(type)) {
        res.status(400).json({ error: 'Tipo deve ser EMITIDO ou RECEBIDO' });
        return;
      }
      if (!checkNumber || typeof checkNumber !== 'string' || checkNumber.length > 20) {
        res.status(400).json({ error: 'Número do cheque é obrigatório (máximo 20 caracteres)' });
        return;
      }
      if (!payeeName || typeof payeeName !== 'string' || payeeName.length > 100) {
        res
          .status(400)
          .json({ error: 'Nome do beneficiário é obrigatório (máximo 100 caracteres)' });
        return;
      }
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        res.status(400).json({ error: 'Valor deve ser maior que zero' });
        return;
      }
      if (!bankAccountId) {
        res.status(400).json({ error: 'Conta bancária é obrigatória' });
        return;
      }
      if (!issueDate) {
        res.status(400).json({ error: 'Data de emissão é obrigatória' });
        return;
      }

      const check = await createCheck(ctx, {
        type,
        checkNumber,
        amount: parsedAmount,
        bankAccountId,
        issueDate,
        deliveryDate,
        expectedCompensationDate,
        payeeName,
        description,
        notes,
      });
      res.status(201).json(check);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ONE ──────────────────────────────────────────────────────────

checksRouter.get(
  '/org/checks/:id',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const check = await getCheck(ctx, req.params.id);
      res.json(check);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── MARK A COMPENSAR ────────────────────────────────────────────────

checksRouter.post(
  '/org/checks/:id/mark-a-compensar',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const check = await markACompensar(ctx, req.params.id);
      res.json(check);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── COMPENSATE ───────────────────────────────────────────────────────

checksRouter.post(
  '/org/checks/:id/compensate',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const check = await compensateCheck(ctx, req.params.id, req.body.compensationDate);
      res.json(check);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── RETURN ───────────────────────────────────────────────────────────

checksRouter.post(
  '/org/checks/:id/return',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const check = await returnCheck(ctx, req.params.id);
      res.json(check);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── RESUBMIT ─────────────────────────────────────────────────────────

checksRouter.post(
  '/org/checks/:id/resubmit',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const check = await resubmitCheck(ctx, req.params.id, req.body.expectedCompensationDate);
      res.json(check);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CANCEL ───────────────────────────────────────────────────────────

checksRouter.post(
  '/org/checks/:id/cancel',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const check = await cancelCheck(ctx, req.params.id);
      res.json(check);
    } catch (err) {
      handleError(err, res);
    }
  },
);
