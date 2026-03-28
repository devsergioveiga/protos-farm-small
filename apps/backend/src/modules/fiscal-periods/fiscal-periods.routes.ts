// ─── Fiscal Periods Routes ────────────────────────────────────────────────────
// COA-04: Express 5 router for fiscal year and accounting period endpoints.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { FiscalPeriodError } from './fiscal-periods.types';
import * as service from './fiscal-periods.service';

export const fiscalPeriodsRouter = Router({ mergeParams: true });

// ─── Error handler ────────────────────────────────────────────────────────────

function handleError(err: unknown, res: Response): void {
  if (err instanceof FiscalPeriodError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /fiscal-years ────────────────────────────────────────────────────────
// List all fiscal years with their accounting periods.

fiscalPeriodsRouter.get('/fiscal-years', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.params.orgId as string;
    const years = await service.getFiscalYears(prisma, orgId);
    res.json(years);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── POST /fiscal-years ───────────────────────────────────────────────────────
// Create a new fiscal year with auto-generated monthly periods.

fiscalPeriodsRouter.post('/fiscal-years', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.params.orgId as string;
    const result = await service.createFiscalYear(prisma, orgId, req.body);
    res.status(201).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── GET /fiscal-years/:yearId/periods ───────────────────────────────────────
// List periods for a specific fiscal year.

fiscalPeriodsRouter.get(
  '/fiscal-years/:yearId/periods',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const yearId = req.params.yearId as string;

      const period = await prisma.accountingPeriod.findMany({
        where: { organizationId: orgId, fiscalYearId: yearId },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      });

      res.json(period);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /accounting-periods/for-date ────────────────────────────────────────
// Find the accounting period for a given date.
// Must be registered BEFORE /:periodId routes to prevent param shadowing.

fiscalPeriodsRouter.get(
  '/accounting-periods/for-date',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const dateStr = req.query.date as string | undefined;

      if (!dateStr) {
        res.status(400).json({ error: 'Query param "date" e obrigatorio (YYYY-MM-DD)' });
        return;
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        res.status(400).json({ error: 'Formato de data invalido. Use YYYY-MM-DD' });
        return;
      }

      const period = await service.getPeriodForDate(prisma, orgId, date);

      if (!period) {
        res.status(404).json({ error: 'Nenhum periodo contabil encontrado para a data informada' });
        return;
      }

      res.json(period);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /accounting-periods/:periodId/close ─────────────────────────────────
// Transition period from OPEN to CLOSED.

fiscalPeriodsRouter.post(
  '/accounting-periods/:periodId/close',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const periodId = req.params.periodId as string;

      const result = await service.closePeriod(prisma, orgId, periodId, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /accounting-periods/:periodId/reopen ────────────────────────────────
// Transition period from CLOSED to OPEN with reason and audit trail.

fiscalPeriodsRouter.post(
  '/accounting-periods/:periodId/reopen',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const periodId = req.params.periodId as string;

      const result = await service.reopenPeriod(prisma, orgId, periodId, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /accounting-periods/:periodId/block ─────────────────────────────────
// Transition period to BLOCKED (from OPEN or CLOSED).

fiscalPeriodsRouter.post(
  '/accounting-periods/:periodId/block',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.params.orgId as string;
      const periodId = req.params.periodId as string;

      const result = await service.blockPeriod(prisma, orgId, periodId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
