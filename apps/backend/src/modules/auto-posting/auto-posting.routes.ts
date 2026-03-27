// ─── Auto-Posting Routes ─────────────────────────────────────────────────────
// REST endpoints for AccountingRule CRUD, PendingJournalPosting list/retry.
//
// Route order: /pending/counts and /pending/retry-batch BEFORE /pending/:id
// to avoid Express 5 param shadowing.
// Permission: financial:read (GET) / financial:manage (PATCH/POST)
// Express 5 rule: always `req.params.xxx as string`, never destructure.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './auto-posting.service';
import { AutoPostingError } from './auto-posting.service';

export const autoPostingRouter = Router();

const base = '/org/:orgId/auto-posting';

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof AutoPostingError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/auto-posting/rules ───────────────────────────────
// List all accounting rules for the org.

autoPostingRouter.get(
  `${base}/rules`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const rules = await service.listRules(orgId);
      res.json(rules);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/auto-posting/rules/:ruleId ───────────────────────
// Get a single rule with its lines.

autoPostingRouter.get(
  `${base}/rules/:ruleId`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const ruleId = req.params.ruleId as string;
      const rule = await service.getRule(orgId, ruleId);
      if (!rule) {
        res.status(404).json({ error: 'Regra nao encontrada', code: 'NOT_FOUND' });
        return;
      }
      res.json(rule);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/auto-posting/rules/:ruleId/preview ───────────────
// Preview what a rule would generate based on last completed data.
// Must be registered BEFORE PATCH /:ruleId to avoid param shadowing.

autoPostingRouter.get(
  `${base}/rules/:ruleId/preview`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const ruleId = req.params.ruleId as string;
      const preview = await service.previewRule(orgId, ruleId);
      if (!preview) {
        res.status(404).json({ error: 'Nenhuma operacao encontrada para preview', code: 'NO_DATA' });
        return;
      }
      res.json(preview);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/auto-posting/rules/:ruleId ─────────────────────
// Update a rule: isActive, historyTemplate, requireCostCenter, lines.

autoPostingRouter.patch(
  `${base}/rules/:ruleId`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const ruleId = req.params.ruleId as string;
      const updated = await service.updateRule(orgId, ruleId, req.body);
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/auto-posting/pending/counts ──────────────────────
// Returns { error: N, pending: N } for badge display.
// MUST be registered BEFORE /pending/:id to avoid param shadowing.

autoPostingRouter.get(
  `${base}/pending/counts`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const counts = await service.getPendingCounts(orgId);
      res.json(counts);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/auto-posting/pending/retry-batch ────────────────
// Retry all ERROR postings matching optional filters.
// MUST be registered BEFORE /pending/:id to avoid param shadowing.

autoPostingRouter.post(
  `${base}/pending/retry-batch`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const result = await service.retryBatch(req.body ?? {}, orgId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/auto-posting/pending ─────────────────────────────
// List pending postings with optional status/sourceType filters.

autoPostingRouter.get(
  `${base}/pending`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const status = req.query.status as string | undefined;
      const sourceType = req.query.sourceType as string | undefined;
      const pending = await service.listPending(orgId, {
        ...(status ? { status: status as Parameters<typeof service.listPending>[1]['status'] } : {}),
        ...(sourceType ? { sourceType: sourceType as Parameters<typeof service.listPending>[1]['sourceType'] } : {}),
      });
      res.json(pending);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/auto-posting/pending/:id/retry ─────────────────
// Retry a single ERROR pending posting.

autoPostingRouter.post(
  `${base}/pending/:id/retry`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const pendingId = req.params.id as string;
      const result = await service.retry(pendingId, orgId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
