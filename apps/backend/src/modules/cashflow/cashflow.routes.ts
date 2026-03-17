import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { CashflowError, type CashflowQuery } from './cashflow.types';
import {
  getProjection,
  getNegativeBalanceAlert,
  exportProjectionPdf,
  exportProjectionExcel,
} from './cashflow.service';

export const cashflowRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new CashflowError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof CashflowError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('CashflowError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/cashflow/projection/export/pdf ──────────────────────────
// IMPORTANT: Must be before /projection to avoid param capture

cashflowRouter.get(
  '/org/cashflow/projection/export/pdf',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query: CashflowQuery = {
        farmId: req.query.farmId as string | undefined,
      };
      const buffer = await exportProjectionPdf(ctx, query);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="fluxo-de-caixa.pdf"');
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/cashflow/projection/export/excel ────────────────────────
// IMPORTANT: Must be before /projection to avoid param capture

cashflowRouter.get(
  '/org/cashflow/projection/export/excel',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query: CashflowQuery = {
        farmId: req.query.farmId as string | undefined,
      };
      const buffer = await exportProjectionExcel(ctx, query);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="fluxo-de-caixa.xlsx"');
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/cashflow/projection ────────────────────────────────────

cashflowRouter.get(
  '/org/cashflow/projection',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query: CashflowQuery = {
        farmId: req.query.farmId as string | undefined,
      };
      const result = await getProjection(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/cashflow/negative-balance-alert ─────────────────────────

cashflowRouter.get(
  '/org/cashflow/negative-balance-alert',
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.query.farmId as string | undefined;
      const alert = await getNegativeBalanceAlert(ctx, farmId);
      res.json({ alert });
    } catch (err) {
      handleError(err, res);
    }
  },
);
