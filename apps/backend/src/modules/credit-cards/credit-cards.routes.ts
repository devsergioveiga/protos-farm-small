/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { withRlsContext } from '../../database/rls';
import type { RlsContext } from '../../database/rls';
import { CreditCardError } from './credit-cards.types';
import {
  createCreditCard,
  listCreditCards,
  getCreditCard,
  updateCreditCard,
  deleteCreditCard,
  addExpense,
  listBills,
  closeBill,
  getOpenBillsCount,
} from './credit-cards.service';

export const creditCardsRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new CreditCardError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof CreditCardError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('CreditCardError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /open-bills-count ────────────────────────────────────────────
// MUST be registered BEFORE /:id to avoid param capture

creditCardsRouter.get(
  '/org/credit-cards/open-bills-count',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await withRlsContext(ctx, async () => getOpenBillsCount(ctx));
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /bills/:billId/close ────────────────────────────────────────
// MUST be registered BEFORE /:id to avoid param capture

creditCardsRouter.post(
  '/org/credit-cards/bills/:billId/close',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const billId = req.params.billId as string;
      const payable = await closeBill(ctx, billId);
      res.status(200).json(payable);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET / ────────────────────────────────────────────────────────────

creditCardsRouter.get(
  '/org/credit-cards',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const cards = await listCreditCards(ctx);
      res.json(cards);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST / ───────────────────────────────────────────────────────────

creditCardsRouter.post(
  '/org/credit-cards',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const body = req.body;

      // Validate closingDay
      const closingDay = parseInt(body.closingDay, 10);
      if (isNaN(closingDay) || closingDay < 1 || closingDay > 28) {
        res.status(400).json({ error: 'O dia de fechamento deve ser entre 1 e 28' });
        return;
      }

      // Validate dueDay
      const dueDay = parseInt(body.dueDay, 10);
      if (isNaN(dueDay) || dueDay < 1 || dueDay > 28) {
        res.status(400).json({ error: 'O dia de vencimento deve ser entre 1 e 28' });
        return;
      }

      // Validate creditLimit
      const creditLimit = parseFloat(body.creditLimit);
      if (isNaN(creditLimit) || creditLimit <= 0) {
        res.status(400).json({ error: 'O limite de crédito deve ser maior que zero' });
        return;
      }

      // Validate lastFourDigits if provided
      if (body.lastFourDigits !== undefined && !/^\d{4}$/.test(body.lastFourDigits)) {
        res.status(400).json({ error: 'Os últimos 4 dígitos devem ser exatamente 4 números' });
        return;
      }

      const card = await createCreditCard(ctx, {
        ...body,
        closingDay,
        dueDay,
        creditLimit,
      });

      res.status(201).json(card);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /:id ─────────────────────────────────────────────────────────

creditCardsRouter.get(
  '/org/credit-cards/:id',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const card = await getCreditCard(ctx, req.params.id as string);
      res.json(card);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /:id ─────────────────────────────────────────────────────────

creditCardsRouter.put(
  '/org/credit-cards/:id',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const body = req.body;
      const updateInput: any = { ...body };

      if (body.closingDay !== undefined) {
        const closingDay = parseInt(body.closingDay, 10);
        if (isNaN(closingDay) || closingDay < 1 || closingDay > 28) {
          res.status(400).json({ error: 'O dia de fechamento deve ser entre 1 e 28' });
          return;
        }
        updateInput.closingDay = closingDay;
      }

      if (body.dueDay !== undefined) {
        const dueDay = parseInt(body.dueDay, 10);
        if (isNaN(dueDay) || dueDay < 1 || dueDay > 28) {
          res.status(400).json({ error: 'O dia de vencimento deve ser entre 1 e 28' });
          return;
        }
        updateInput.dueDay = dueDay;
      }

      if (body.creditLimit !== undefined) {
        const creditLimit = parseFloat(body.creditLimit);
        if (isNaN(creditLimit) || creditLimit <= 0) {
          res.status(400).json({ error: 'O limite de crédito deve ser maior que zero' });
          return;
        }
        updateInput.creditLimit = creditLimit;
      }

      const card = await updateCreditCard(ctx, req.params.id as string, updateInput);
      res.json(card);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /:id ──────────────────────────────────────────────────────

creditCardsRouter.delete(
  '/org/credit-cards/:id',
  authenticate,
  checkPermission('financial:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteCreditCard(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /:id/expenses ───────────────────────────────────────────────

creditCardsRouter.post(
  '/org/credit-cards/:id/expenses',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const body = req.body;

      // Validate amount
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) {
        res.status(400).json({ error: 'O valor deve ser maior que zero' });
        return;
      }

      // Validate totalInstallments
      const totalInstallments = parseInt(body.totalInstallments, 10);
      if (isNaN(totalInstallments) || totalInstallments < 1 || totalInstallments > 24) {
        res.status(400).json({ error: 'O número de parcelas deve ser entre 1 e 24' });
        return;
      }

      const expenses = await addExpense(ctx, req.params.id as string, {
        ...body,
        amount,
        totalInstallments,
      });

      res.status(201).json(expenses);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /:id/bills ───────────────────────────────────────────────────

creditCardsRouter.get(
  '/org/credit-cards/:id/bills',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 3;
      const bills = await listBills(ctx, req.params.id as string, limit);
      res.json(bills);
    } catch (err) {
      handleError(err, res);
    }
  },
);
