import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { OpeningBalanceError } from './opening-balance.types';
import { getOpeningBalancePreview, postOpeningBalance } from './opening-balance.service';

export const openingBalanceRouter = Router();

const base = '/org/:orgId/opening-balance';

// ─── Error handler ─────────────────────────────────────────────────

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof OpeningBalanceError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  // Handle errors from journal-entries service (UnbalancedEntryError, PeriodNotOpenError)
  const e = err as Record<string, unknown>;
  if (e && typeof e.statusCode === 'number' && typeof e.message === 'string') {
    res.status(e.statusCode as number).json({ error: e.message, code: e.code });
    return;
  }

  console.error('[opening-balance] Erro nao tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET preview ────────────────────────────────────────────────────
// Returns pre-populated lines from 5 source modules for the wizard

openingBalanceRouter.get(
  `${base}/preview/:fiscalYearId`,
  authenticate,
  checkPermission('financial:read'),
  async (req, res) => {
    try {
      const orgId = req.params.orgId as string;
      const fiscalYearId = req.params.fiscalYearId as string;

      const lines = await getOpeningBalancePreview(orgId, fiscalYearId);
      res.json(lines);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST ───────────────────────────────────────────────────────────
// Creates and posts an OPENING_BALANCE journal entry

openingBalanceRouter.post(
  base,
  authenticate,
  checkPermission('financial:manage'),
  async (req, res) => {
    try {
      const orgId = req.params.orgId as string;
      const userId = req.user!.userId;

      const entry = await postOpeningBalance(orgId, req.body, userId);
      res.status(201).json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);
