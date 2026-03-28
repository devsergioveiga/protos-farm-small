// ─── Accounting Dashboard Routes ──────────────────────────────────────────────
// REST endpoint for the executive accounting dashboard.
//
// Endpoint:
//  GET /org/:orgId/accounting-dashboard?fiscalYearId=...&month=...
//
// Permission: financial:read
// Express 5 rule: always req.params.orgId as string, never destructure.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { getAccountingDashboard } from './accounting-dashboard.service';
import { FinancialStatementsError } from './financial-statements.types';

export const accountingDashboardRouter = Router();

accountingDashboardRouter.get(
  '/org/:orgId/accounting-dashboard',
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const fiscalYearId = req.query.fiscalYearId as string | undefined;
      const monthStr = req.query.month as string | undefined;

      if (!fiscalYearId) {
        res
          .status(400)
          .json({ error: 'fiscalYearId e obrigatorio', code: 'MISSING_FISCAL_YEAR_ID' });
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

      const result = await getAccountingDashboard(orgId, { fiscalYearId, month });
      res.json(result);
    } catch (err) {
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
  },
);
