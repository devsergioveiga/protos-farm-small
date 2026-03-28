// ─── Monthly Closing Routes ───────────────────────────────────────────────────
// REST endpoints for 6-step monthly closing checklist.
// Base: /org/:orgId/monthly-closing
//
// Endpoints:
//  GET    /                              — get closing for period
//  POST   /start                         — start a new closing
//  POST   /:closingId/validate-step/:n   — validate step N (1-6)
//  POST   /:closingId/complete           — complete closing (locks period)
//  POST   /:closingId/reopen             — reopen closing (ADMIN only)

import { Router } from 'express';
import type { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { authorize } from '../../middleware/authorize';
import * as service from './monthly-closing.service';
import { MonthlyClosingError } from './monthly-closing.types';

export const monthlyClosingRouter = Router({ mergeParams: true });

const base = '/org/:orgId/monthly-closing';

// ─── Error handler ────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof MonthlyClosingError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/monthly-closing ──────────────────────────────────

monthlyClosingRouter.get(
  base,
  authenticate,
  checkPermission('financial:read'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const periodId = req.query.periodId as string | undefined;

      if (!periodId) {
        res.status(400).json({ error: 'periodId e obrigatorio', code: 'MISSING_PERIOD_ID' });
        return;
      }

      const closing = await service.getClosing(orgId, periodId);

      if (!closing) {
        res.status(404).json({ error: 'Nenhum fechamento encontrado para o periodo', code: 'NOT_FOUND' });
        return;
      }

      res.json(closing);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/monthly-closing/start ───────────────────────────

monthlyClosingRouter.post(
  `${base}/start`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const { periodId } = req.body as { periodId: string };
      const userId = req.user!.userId;

      if (!periodId) {
        res.status(400).json({ error: 'periodId e obrigatorio', code: 'MISSING_PERIOD_ID' });
        return;
      }

      const { closing, created } = await service.startClosing(orgId, periodId, userId);
      res.status(created ? 201 : 200).json(closing);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/monthly-closing/:closingId/validate-step/:stepNumber ───

monthlyClosingRouter.post(
  `${base}/:closingId/validate-step/:stepNumber`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const closingId = req.params.closingId as string;
      const stepNumber = parseInt(req.params.stepNumber as string, 10) as 1 | 2 | 3 | 4 | 5 | 6;

      if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 6) {
        res.status(400).json({ error: 'Numero de etapa invalido (1-6)', code: 'INVALID_STEP' });
        return;
      }

      const result = await service.validateStep(orgId, closingId, stepNumber);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/monthly-closing/:closingId/complete ─────────────

monthlyClosingRouter.post(
  `${base}/:closingId/complete`,
  authenticate,
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const closingId = req.params.closingId as string;
      const userId = req.user!.userId;

      const closing = await service.completeClosing(orgId, closingId, userId);
      res.json(closing);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/monthly-closing/:closingId/reopen ──────────────

monthlyClosingRouter.post(
  `${base}/:closingId/reopen`,
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  checkPermission('financial:manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const closingId = req.params.closingId as string;
      const userId = req.user!.userId;
      const { reason } = req.body as { reason: string };

      const closing = await service.reopenClosing(orgId, closingId, userId, reason);
      res.json(closing);
    } catch (err) {
      handleError(err, res);
    }
  },
);
