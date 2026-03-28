// ─── Financial Statements Routes ─────────────────────────────────────────────
// REST endpoints for DRE, Balanco Patrimonial, and cross-validation.
//
// Endpoints:
//  GET /org/:orgId/financial-statements/dre?fiscalYearId=...&month=...&costCenterId=...
//  GET /org/:orgId/financial-statements/balance-sheet?fiscalYearId=...&month=...
//  GET /org/:orgId/financial-statements/cross-validation?fiscalYearId=...&month=...
//
// Permission: financial:read
// Express 5 rule: always req.params.orgId as string, never destructure.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './financial-statements.service';
import { FinancialStatementsError } from './financial-statements.types';

export const financialStatementsRouter = Router();

const base = '/org/:orgId/financial-statements';

// ─── Error handler ────────────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof FinancialStatementsError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/financial-statements/dre ────────────────────────────────

financialStatementsRouter.get(
  `${base}/dre`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const fiscalYearId = req.query.fiscalYearId as string | undefined;
      const monthStr = req.query.month as string | undefined;
      const costCenterId = req.query.costCenterId as string | undefined;

      if (!fiscalYearId) {
        res.status(400).json({ error: 'fiscalYearId e obrigatorio', code: 'MISSING_FISCAL_YEAR_ID' });
        return;
      }
      if (!monthStr) {
        res.status(400).json({ error: 'month e obrigatorio', code: 'MISSING_MONTH' });
        return;
      }

      const month = parseInt(monthStr, 10);
      if (isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({ error: 'month deve ser entre 1 e 12', code: 'INVALID_MONTH' });
        return;
      }

      const result = await service.getDre(orgId, { fiscalYearId, month, costCenterId });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/financial-statements/balance-sheet ──────────────────────

financialStatementsRouter.get(
  `${base}/balance-sheet`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const fiscalYearId = req.query.fiscalYearId as string | undefined;
      const monthStr = req.query.month as string | undefined;

      if (!fiscalYearId) {
        res.status(400).json({ error: 'fiscalYearId e obrigatorio', code: 'MISSING_FISCAL_YEAR_ID' });
        return;
      }
      if (!monthStr) {
        res.status(400).json({ error: 'month e obrigatorio', code: 'MISSING_MONTH' });
        return;
      }

      const month = parseInt(monthStr, 10);
      if (isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({ error: 'month deve ser entre 1 e 12', code: 'INVALID_MONTH' });
        return;
      }

      const result = await service.getBalanceSheet(orgId, { fiscalYearId, month });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/financial-statements/dfc ────────────────────────────────

financialStatementsRouter.get(
  `${base}/dfc`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const fiscalYearId = req.query.fiscalYearId as string | undefined;
      const monthStr = req.query.month as string | undefined;

      if (!fiscalYearId) {
        res.status(400).json({ error: 'fiscalYearId e obrigatorio', code: 'MISSING_FISCAL_YEAR_ID' });
        return;
      }
      if (!monthStr) {
        res.status(400).json({ error: 'month e obrigatorio', code: 'MISSING_MONTH' });
        return;
      }

      const month = parseInt(monthStr, 10);
      if (isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({ error: 'month deve ser entre 1 e 12', code: 'INVALID_MONTH' });
        return;
      }

      const result = await service.getDfc(orgId, { fiscalYearId, month });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/financial-statements/cross-validation ───────────────────

financialStatementsRouter.get(
  `${base}/cross-validation`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const fiscalYearId = req.query.fiscalYearId as string | undefined;
      const monthStr = req.query.month as string | undefined;

      if (!fiscalYearId) {
        res.status(400).json({ error: 'fiscalYearId e obrigatorio', code: 'MISSING_FISCAL_YEAR_ID' });
        return;
      }
      if (!monthStr) {
        res.status(400).json({ error: 'month e obrigatorio', code: 'MISSING_MONTH' });
        return;
      }

      const month = parseInt(monthStr, 10);
      if (isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({ error: 'month deve ser entre 1 e 12', code: 'INVALID_MONTH' });
        return;
      }

      const result = await service.getCrossValidation(orgId, { fiscalYearId, month });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
