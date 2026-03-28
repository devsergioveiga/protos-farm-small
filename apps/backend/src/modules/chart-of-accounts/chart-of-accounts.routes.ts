// ─── Chart of Accounts Routes ─────────────────────────────────────────────────
// COA-01/COA-02/COA-03: CRUD + tree query + rural template seed + unmapped SPED report
//
// Route order:
//   /unmapped-sped and /seed before /:id to prevent Express 5 param shadowing.
// Permission: financial:read / financial:manage
// Express 5 rule: always `req.params.orgId as string`, never destructure.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import * as service from './chart-of-accounts.service';
import { ChartOfAccountError } from './chart-of-accounts.types';

export const chartOfAccountsRouter = Router();

const base = '/org/:orgId/chart-of-accounts';

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof ChartOfAccountError) {
    const status = err.statusCode;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/chart-of-accounts/unmapped-sped ──────────────────
// Must be registered BEFORE /:id to avoid param shadowing.

chartOfAccountsRouter.get(
  `${base}/unmapped-sped`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const accounts = await service.getUnmappedSpedAccounts(orgId);
      res.json(accounts);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/chart-of-accounts/seed ──────────────────────────
// Must be registered BEFORE /:id to avoid param shadowing.

chartOfAccountsRouter.post(
  `${base}/seed`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const result = await service.seedRuralTemplate(orgId);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/chart-of-accounts ────────────────────────────────

chartOfAccountsRouter.get(
  base,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const accounts = await service.getAccountTree(orgId);
      res.json(accounts);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/chart-of-accounts ───────────────────────────────

chartOfAccountsRouter.post(
  base,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const account = await service.createAccount(orgId, req.body);
      res.status(201).json(account);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/chart-of-accounts/:id ────────────────────────────

chartOfAccountsRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const account = await service.getAccountById(orgId, id);
      res.json(account);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /org/:orgId/chart-of-accounts/:id ────────────────────────────

chartOfAccountsRouter.put(
  `${base}/:id`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const account = await service.updateAccount(orgId, id, req.body);
      res.json(account);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/chart-of-accounts/:id ─────────────────────────
// Soft delete — sets isActive = false.

chartOfAccountsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const id = req.params.id as string;
      const account = await service.deactivateAccount(orgId, id);
      res.json(account);
    } catch (err) {
      handleError(err, res);
    }
  },
);
