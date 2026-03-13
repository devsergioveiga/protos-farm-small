import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { ConversionHistoryError } from './conversion-history.types';
import type { OperationType } from './conversion-history.types';
import { listConversionHistory, exportConversionHistoryCsv } from './conversion-history.service';

export const conversionHistoryRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new ConversionHistoryError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof ConversionHistoryError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('[conversion-history] Error:', err);
  res.status(500).json({ error: 'Erro interno ao processar histórico de conversões' });
}

// ─── GET /org/conversion-history ────────────────────────────────────

conversionHistoryRouter.get(
  '/org/conversion-history',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listConversionHistory(ctx, {
        farmId: req.query.farmId as string | undefined,
        operationType: req.query.operationType as OperationType | undefined,
        productName: req.query.productName as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/conversion-history/export ─────────────────────────────

conversionHistoryRouter.get(
  '/org/conversion-history/export',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportConversionHistoryCsv(ctx, {
        farmId: req.query.farmId as string | undefined,
        operationType: req.query.operationType as OperationType | undefined,
        productName: req.query.productName as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="historico-conversoes-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);
