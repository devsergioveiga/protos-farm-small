import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { BankAccountError, type ExportFormat } from './bank-accounts.types';
import {
  createBankAccount,
  listBankAccounts,
  getBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getStatement,
  exportStatement,
  getDashboard,
} from './bank-accounts.service';

export const bankAccountsRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new BankAccountError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof BankAccountError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('BankAccountError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── LIST ────────────────────────────────────────────────────────────

bankAccountsRouter.get(
  '/org/bank-accounts',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const accounts = await listBankAccounts(ctx, {
        farmId: req.query.farmId as string | undefined,
        type: req.query.type as import('./bank-accounts.types').ListBankAccountsQuery['type'],
        bankCode: req.query.bankCode as string | undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      });
      res.json(accounts);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ──────────────────────────────────────────────────────────

bankAccountsRouter.post(
  '/org/bank-accounts',
  authenticate,
  checkPermission('financial:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const account = await createBankAccount(ctx, req.body);
      res.status(201).json(account);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DASHBOARD — BEFORE /:id TO AVOID PARAM CONFLICT ─────────────────

bankAccountsRouter.get(
  '/org/bank-accounts/dashboard',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const dashboard = await getDashboard(ctx);
      res.json(dashboard);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ─────────────────────────────────────────────────────────────

bankAccountsRouter.get(
  '/org/bank-accounts/:id',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const account = await getBankAccount(ctx, req.params.id as string);
      res.json(account);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ──────────────────────────────────────────────────────────

bankAccountsRouter.patch(
  '/org/bank-accounts/:id',
  authenticate,
  checkPermission('financial:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const account = await updateBankAccount(ctx, req.params.id as string, req.body);
      res.json(account);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ──────────────────────────────────────────────────────────

bankAccountsRouter.delete(
  '/org/bank-accounts/:id',
  authenticate,
  checkPermission('financial:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteBankAccount(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── STATEMENT EXPORT — BEFORE /:id/statement TO AVOID CONFLICT ──────

bankAccountsRouter.get(
  '/org/bank-accounts/:id/statement/export',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const format = (req.query.format as string) ?? 'pdf';

      if (!['pdf', 'xlsx', 'csv'].includes(format)) {
        res.status(400).json({ error: 'Formato inválido. Use: pdf, xlsx ou csv' });
        return;
      }

      const accountId = req.params.id as string;
      const date = new Date().toISOString().slice(0, 10);

      const buffer = await exportStatement(ctx, accountId, {
        format: format as ExportFormat,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        type: req.query.type as 'CREDIT' | 'DEBIT' | undefined,
      });

      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="extrato-${accountId}-${date}.pdf"`,
        );
      } else if (format === 'xlsx') {
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="extrato-${accountId}-${date}.xlsx"`,
        );
      } else {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="extrato-${accountId}-${date}.csv"`,
        );
      }

      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── STATEMENT ────────────────────────────────────────────────────────

bankAccountsRouter.get(
  '/org/bank-accounts/:id/statement',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const transactions = await getStatement(ctx, req.params.id as string, {
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        type: req.query.type as 'CREDIT' | 'DEBIT' | undefined,
      });
      res.json(transactions);
    } catch (err) {
      handleError(err, res);
    }
  },
);
