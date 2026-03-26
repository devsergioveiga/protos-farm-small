import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { TimeEntryError } from '../time-entries/time-entries.types';
import {
  getOvertimeBankSummary,
  listOvertimeBankEntries,
  createOvertimeBankEntry,
} from './overtime-bank.service';

export const overtimeBankRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new TimeEntryError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user?.id };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof TimeEntryError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── Routes ───────────────────────────────────────────────────────────

// GET /org/:orgId/overtime-bank — list with filters
overtimeBankRouter.get(
  '/org/:orgId/overtime-bank',
  authenticate,
  checkPermission('attendance:read'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const ctx = buildRlsContext(req);
      const result = await listOvertimeBankEntries(ctx, orgId, {
        employeeId: req.query.employeeId as string | undefined,
        expiringBefore: req.query.expiringBefore as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/:orgId/overtime-bank/summary/:employeeId — employee summary
overtimeBankRouter.get(
  '/org/:orgId/overtime-bank/summary/:employeeId',
  authenticate,
  checkPermission('attendance:read'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const employeeId = req.params.employeeId as string;
      const ctx = buildRlsContext(req);
      const summary = await getOvertimeBankSummary(ctx, orgId, employeeId);
      res.json(summary);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// POST /org/:orgId/overtime-bank — create entry
overtimeBankRouter.post(
  '/org/:orgId/overtime-bank',
  authenticate,
  checkPermission('attendance:write'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId as string;
      const ctx = buildRlsContext(req);
      const entry = await createOvertimeBankEntry(ctx, orgId, req.body);
      res.status(201).json(entry);
    } catch (err) {
      handleError(err, res);
    }
  },
);
