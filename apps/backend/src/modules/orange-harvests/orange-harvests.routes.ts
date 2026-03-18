import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { OrangeHarvestError } from './orange-harvests.types';
import {
  createOrangeHarvest,
  listOrangeHarvests,
  getOrangeHarvest,
  updateOrangeHarvest,
  deleteOrangeHarvest,
  getDailySummary,
} from './orange-harvests.service';

export const orangeHarvestsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new OrangeHarvestError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof OrangeHarvestError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

orangeHarvestsRouter.post(
  '/org/farms/:farmId/orange-harvests',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createOrangeHarvest(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_ORANGE_HARVEST',
        targetType: 'orange_harvest',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          fieldPlotId: result.fieldPlotId,
          destination: result.destination,
        },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

orangeHarvestsRouter.get(
  '/org/farms/:farmId/orange-harvests',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listOrangeHarvests(ctx, req.params.farmId as string, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
        destination: (req.query.destination as string) || undefined,
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
        saleContractRef: (req.query.saleContractRef as string) || undefined,
        search: (req.query.search as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DAILY SUMMARY ─────────────────────────────────────────────────

orangeHarvestsRouter.get(
  '/org/farms/:farmId/orange-harvests/daily-summary',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getDailySummary(ctx, req.params.farmId as string, {
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

orangeHarvestsRouter.get(
  '/org/farms/:farmId/orange-harvests/:harvestId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getOrangeHarvest(
        ctx,
        req.params.farmId as string,
        req.params.harvestId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

orangeHarvestsRouter.patch(
  '/org/farms/:farmId/orange-harvests/:harvestId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateOrangeHarvest(
        ctx,
        req.params.farmId as string,
        req.params.harvestId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_ORANGE_HARVEST',
        targetType: 'orange_harvest',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          destination: result.destination,
        },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE (soft) ──────────────────────────────────────────────────

orangeHarvestsRouter.delete(
  '/org/farms/:farmId/orange-harvests/:harvestId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteOrangeHarvest(ctx, req.params.farmId as string, req.params.harvestId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_ORANGE_HARVEST',
        targetType: 'orange_harvest',
        targetId: req.params.harvestId as string,
        metadata: { farmId: req.params.farmId },
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
