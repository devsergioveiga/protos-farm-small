import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { FuelRecordError } from './fuel-records.types';
import {
  createFuelRecord,
  listFuelRecords,
  getFuelStats,
  deleteFuelRecord,
} from './fuel-records.service';

export const fuelRecordsRouter = Router();

const base = '/org/:orgId/fuel-records';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildCtx(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.userId;
  if (!organizationId || !userId) {
    throw new FuelRecordError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof FuelRecordError) {
    res.status(err.statusCode).json({ error: err.message, ...err.data });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /stats/:assetId (BEFORE /:id) ────────────────────────────────

fuelRecordsRouter.get(
  `${base}/stats/:assetId`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const result = await getFuelStats(
        ctx,
        req.params.assetId as string,
        req.query.periodStart as string | undefined,
        req.query.periodEnd as string | undefined,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST / ────────────────────────────────────────────────────────────

fuelRecordsRouter.post(base, authenticate, checkPermission('assets:create'), async (req, res) => {
  try {
    const ctx = buildCtx(req);
    const result = await createFuelRecord(ctx, req.body);
    res.status(201).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── GET / ─────────────────────────────────────────────────────────────

fuelRecordsRouter.get(base, authenticate, checkPermission('assets:read'), async (req, res) => {
  try {
    const ctx = buildCtx(req);
    const query = {
      assetId: req.query.assetId as string | undefined,
      farmId: req.query.farmId as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };
    const result = await listFuelRecords(ctx, query);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── DELETE /:id ───────────────────────────────────────────────────────

fuelRecordsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('assets:delete'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      await deleteFuelRecord(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
