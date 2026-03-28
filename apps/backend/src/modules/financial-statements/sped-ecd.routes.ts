// ─── SPED ECD Routes ──────────────────────────────────────────────────────────
// Endpoints for SPED Contabil (ECD) pre-validation and file download.
//
// Endpoints:
//  GET /org/:orgId/sped-ecd/validate?fiscalYearId=xxx  — validation items
//  GET /org/:orgId/sped-ecd/download?fiscalYearId=xxx  — pipe-delimited .txt
//
// Permission: financial:read
// Express 5 rule: req.params.orgId as string, req.query.fiscalYearId as string.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { validateSpedEcd, generateSpedEcd, SpedEcdError } from './sped-ecd.service';

export const spedEcdRouter = Router();

const base = '/org/:orgId/sped-ecd';

// ─── Error handler ────────────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof SpedEcdError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/sped-ecd/validate ───────────────────────────────────────

spedEcdRouter.get(
  `${base}/validate`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const fiscalYearId = req.query.fiscalYearId as string | undefined;

      if (!fiscalYearId) {
        res.status(400).json({ error: 'fiscalYearId e obrigatorio', code: 'MISSING_FISCAL_YEAR_ID' });
        return;
      }

      const result = await validateSpedEcd(orgId, fiscalYearId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/sped-ecd/download ───────────────────────────────────────

spedEcdRouter.get(
  `${base}/download`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const fiscalYearId = req.query.fiscalYearId as string | undefined;

      if (!fiscalYearId) {
        res.status(400).json({ error: 'fiscalYearId e obrigatorio', code: 'MISSING_FISCAL_YEAR_ID' });
        return;
      }

      const { content, filename } = await generateSpedEcd(orgId, fiscalYearId);

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(content, 'utf-8'));
    } catch (err) {
      handleError(err, res);
    }
  },
);
