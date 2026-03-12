import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { StockEntryError } from './stock-entries.types';
import {
  createStockEntry,
  listStockEntries,
  getStockEntry,
  cancelStockEntry,
  addRetroactiveExpense,
  listStockBalances,
} from './stock-entries.service';

export const stockEntriesRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new StockEntryError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof StockEntryError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('StockEntryError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

stockEntriesRouter.post(
  '/org/stock-entries',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { entry, costAlerts } = await createStockEntry(ctx, req.body, req.user!.userId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_STOCK_ENTRY',
        targetType: 'stock_entry',
        targetId: entry.id,
        metadata: {
          itemCount: entry.items.length,
          totalCost: entry.totalCost,
          supplierName: entry.supplierName,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json({ ...entry, costAlerts });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

stockEntriesRouter.get(
  '/org/stock-entries',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listStockEntries(ctx, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as string | undefined,
        supplierName: req.query.supplierName as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        productId: req.query.productId as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

stockEntriesRouter.get(
  '/org/stock-entries/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const entry = await getStockEntry(ctx, req.params.id as string);
      res.json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── ADD RETROACTIVE EXPENSE (CA6) ─────────────────────────────────

stockEntriesRouter.post(
  '/org/stock-entries/:id/expenses',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const entry = await addRetroactiveExpense(ctx, req.params.id as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'ADD_STOCK_ENTRY_EXPENSE',
        targetType: 'stock_entry',
        targetId: entry.id,
        metadata: {
          expenseType: req.body.expenseType,
          amount: req.body.amount,
          isRetroactive: true,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CANCEL ─────────────────────────────────────────────────────────

stockEntriesRouter.post(
  '/org/stock-entries/:id/cancel',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const entry = await cancelStockEntry(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CANCEL_STOCK_ENTRY',
        targetType: 'stock_entry',
        targetId: entry.id,
        metadata: { totalCost: entry.totalCost },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── STOCK BALANCES ─────────────────────────────────────────────────

stockEntriesRouter.get(
  '/org/stock-balances',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listStockBalances(ctx, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
