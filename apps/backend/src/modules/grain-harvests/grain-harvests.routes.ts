import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { GrainHarvestError } from './grain-harvests.types';
import {
  createGrainHarvest,
  listGrainHarvests,
  getGrainHarvest,
  updateGrainHarvest,
  deleteGrainHarvest,
  getCostSummary,
} from './grain-harvests.service';

export const grainHarvestsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new GrainHarvestError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof GrainHarvestError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

grainHarvestsRouter.post(
  '/org/farms/:farmId/grain-harvests',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createGrainHarvest(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_GRAIN_HARVEST',
        targetType: 'grain_harvest',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          crop: result.crop,
          fieldPlotId: result.fieldPlotId,
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

grainHarvestsRouter.get(
  '/org/farms/:farmId/grain-harvests',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listGrainHarvests(ctx, req.params.farmId as string, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
        crop: (req.query.crop as string) || undefined,
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
        search: (req.query.search as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA9: COST SUMMARY ──────────────────────────────────────────────

grainHarvestsRouter.get(
  '/org/farms/:farmId/grain-harvests/cost-summary',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCostSummary(ctx, req.params.farmId as string, {
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

grainHarvestsRouter.get(
  '/org/farms/:farmId/grain-harvests/:harvestId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getGrainHarvest(
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

grainHarvestsRouter.patch(
  '/org/farms/:farmId/grain-harvests/:harvestId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateGrainHarvest(
        ctx,
        req.params.farmId as string,
        req.params.harvestId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_GRAIN_HARVEST',
        targetType: 'grain_harvest',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          crop: result.crop,
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

grainHarvestsRouter.delete(
  '/org/farms/:farmId/grain-harvests/:harvestId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteGrainHarvest(ctx, req.params.farmId as string, req.params.harvestId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_GRAIN_HARVEST',
        targetType: 'grain_harvest',
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
