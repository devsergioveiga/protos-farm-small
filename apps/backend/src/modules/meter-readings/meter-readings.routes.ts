import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { MeterReadingError } from './meter-readings.types';
import { createMeterReading, listMeterReadings, getLatestReadings } from './meter-readings.service';

export const meterReadingsRouter = Router();

const base = '/org/:orgId/meter-readings';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildCtx(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.userId;
  if (!organizationId || !userId) {
    throw new MeterReadingError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof MeterReadingError) {
    res.status(err.statusCode).json({ error: err.message, ...err.data });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /latest/:assetId (BEFORE /:id) ───────────────────────────────

meterReadingsRouter.get(
  `${base}/latest/:assetId`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const result = await getLatestReadings(ctx, req.params.assetId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST / ────────────────────────────────────────────────────────────

meterReadingsRouter.post(base, authenticate, checkPermission('assets:update'), async (req, res) => {
  try {
    const ctx = buildCtx(req);
    const result = await createMeterReading(ctx, req.body);
    res.status(201).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── GET / ─────────────────────────────────────────────────────────────

meterReadingsRouter.get(base, authenticate, checkPermission('assets:read'), async (req, res) => {
  try {
    const ctx = buildCtx(req);
    const query = {
      assetId: req.query.assetId as string | undefined,
      readingType: req.query.readingType as 'HOURMETER' | 'ODOMETER' | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await listMeterReadings(ctx, query);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});
