import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import {
  getPayablesAging,
  getPayablesByBucket,
  getOverdueCount,
  getFinancialCalendar,
} from './payables-aging.service';

export const payablesAgingRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new Error('Acesso negado: usuário sem organização vinculada');
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof Error && (err as Error & { statusCode?: number }).statusCode) {
    const e = err as Error & { statusCode: number };
    res.status(e.statusCode).json({ error: e.message });
    return;
  }
  console.error('PayablesAgingError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/payables-aging — Aging with 7 buckets ───────────────────────

payablesAgingRouter.get(
  '/org/payables-aging',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.query.farmId as string | undefined;
      const result = await getPayablesAging(ctx, farmId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/payables-aging/bucket/:bucket — Payables in a specific bucket

payablesAgingRouter.get(
  '/org/payables-aging/bucket/:bucket',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const bucket = req.params.bucket as string;
      const farmId = req.query.farmId as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await getPayablesByBucket(ctx, bucket, farmId, page, limit);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/payables-aging/overdue-count — Overdue count for sidebar badge

payablesAgingRouter.get(
  '/org/payables-aging/overdue-count',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const count = await getOverdueCount(ctx);
      res.json({ count });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/payables-aging/calendar — Financial calendar for monthly view

payablesAgingRouter.get(
  '/org/payables-aging/calendar',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const year = req.query.year
        ? parseInt(req.query.year as string, 10)
        : new Date().getFullYear();
      const month = req.query.month
        ? parseInt(req.query.month as string, 10)
        : new Date().getMonth() + 1;
      const farmId = req.query.farmId as string | undefined;

      if (isNaN(year) || year < 2000 || year > 2100) {
        res.status(400).json({ error: 'Parâmetro year inválido' });
        return;
      }
      if (isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({ error: 'Parâmetro month inválido (1-12)' });
        return;
      }

      const result = await getFinancialCalendar(ctx, year, month, farmId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
