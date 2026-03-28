// ─── checkPeriodOpen Middleware ───────────────────────────────────────────────
// Express middleware that blocks writes on CLOSED or BLOCKED accounting periods.
// Reads entryDate or date from req.body, finds the period, and throws 422 if
// the period is not OPEN.
//
// Usage: apply after authenticate on any write route that needs period gating.
// Example: router.post('/', authenticate, checkPeriodOpen(), createHandler)

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { assertPeriodOpen, PeriodNotOpenError } from '@protos-farm/shared';

export function checkPeriodOpen() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const orgId = req.params.orgId as string;
    const dateStr: string | undefined = req.body?.entryDate ?? req.body?.date;

    // No date in body — no period check needed
    if (!dateStr) {
      next();
      return;
    }

    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const period = await prisma.accountingPeriod.findFirst({
      where: {
        organizationId: orgId,
        month,
        year,
        fiscalYear: { isActive: true },
      },
      select: { month: true, year: true, status: true },
    });

    if (!period) {
      res.status(422).json({
        error: `Nenhum periodo contabil encontrado para ${month}/${year}`,
        code: 'PERIOD_NOT_FOUND',
      });
      return;
    }

    try {
      assertPeriodOpen(period);
      next();
    } catch (err) {
      if (err instanceof PeriodNotOpenError) {
        res.status(422).json({ error: err.message, code: 'PERIOD_NOT_OPEN' });
        return;
      }
      next(err);
    }
  };
}
