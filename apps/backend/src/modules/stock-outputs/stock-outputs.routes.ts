import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import {
  StockOutputError,
  type StockOutputTypeValue,
  type StockOutputStatusValue,
} from './stock-outputs.types';
import {
  createStockOutput,
  listStockOutputs,
  getStockOutput,
  cancelStockOutput,
  listMovementHistory,
  exportMovementsCSV,
} from './stock-outputs.service';

export const stockOutputsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new StockOutputError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof StockOutputError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('StockOutputError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE (CA1, CA2, CA3, CA4, CA8) ───────────────────────────────

stockOutputsRouter.post(
  '/org/stock-outputs',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createStockOutput(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_STOCK_OUTPUT',
        targetType: 'stock_output',
        targetId: result.output.id,
        metadata: {
          type: result.output.type,
          itemCount: result.output.items.length,
          totalCost: result.output.totalCost,
          insufficientStockAlerts: JSON.parse(JSON.stringify(result.insufficientStockAlerts)),
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST (CA10) ────────────────────────────────────────────────────

stockOutputsRouter.get(
  '/org/stock-outputs',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listStockOutputs(ctx, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        type: req.query.type as StockOutputTypeValue | undefined,
        status: req.query.status as StockOutputStatusValue | undefined,
        productId: req.query.productId as string | undefined,
        responsibleName: req.query.responsibleName as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET BY ID ──────────────────────────────────────────────────────

stockOutputsRouter.get(
  '/org/stock-outputs/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const output = await getStockOutput(ctx, req.params.id as string);
      res.json(output);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CANCEL ─────────────────────────────────────────────────────────

stockOutputsRouter.patch(
  '/org/stock-outputs/:id/cancel',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const output = await cancelStockOutput(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CANCEL_STOCK_OUTPUT',
        targetType: 'stock_output',
        targetId: output.id,
        metadata: { type: output.type },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(output);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── MOVEMENT HISTORY (CA7, CA10) ───────────────────────────────────

stockOutputsRouter.get(
  '/org/stock-movements',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listMovementHistory(ctx, {
        productId: req.query.productId as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        movementType: req.query.movementType as 'ENTRY' | 'EXIT' | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        responsibleName: req.query.responsibleName as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT MOVEMENTS CSV (CA10) ────────────────────────────────────

stockOutputsRouter.get(
  '/org/stock-movements/export',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportMovementsCSV(ctx, {
        productId: req.query.productId as string,
        movementType: req.query.movementType as 'ENTRY' | 'EXIT' | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        responsibleName: req.query.responsibleName as string | undefined,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="movimentacoes-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);
