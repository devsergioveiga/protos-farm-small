import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { CoffeeHarvestError } from './coffee-harvests.types';
import {
  createCoffeeHarvest,
  listCoffeeHarvests,
  getCoffeeHarvest,
  updateCoffeeHarvest,
  deleteCoffeeHarvest,
  getDailySummary,
} from './coffee-harvests.service';

export const coffeeHarvestsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new CoffeeHarvestError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof CoffeeHarvestError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

coffeeHarvestsRouter.post(
  '/org/farms/:farmId/coffee-harvests',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createCoffeeHarvest(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_COFFEE_HARVEST',
        targetType: 'coffee_harvest',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          harvestType: result.harvestType,
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

coffeeHarvestsRouter.get(
  '/org/farms/:farmId/coffee-harvests',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listCoffeeHarvests(ctx, req.params.farmId as string, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
        harvestType: (req.query.harvestType as string) || undefined,
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
        isSpecialLot:
          req.query.isSpecialLot === 'true'
            ? true
            : req.query.isSpecialLot === 'false'
              ? false
              : undefined,
        search: (req.query.search as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DAILY SUMMARY ─────────────────────────────────────────────────

coffeeHarvestsRouter.get(
  '/org/farms/:farmId/coffee-harvests/daily-summary',
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

coffeeHarvestsRouter.get(
  '/org/farms/:farmId/coffee-harvests/:harvestId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCoffeeHarvest(
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

coffeeHarvestsRouter.patch(
  '/org/farms/:farmId/coffee-harvests/:harvestId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateCoffeeHarvest(
        ctx,
        req.params.farmId as string,
        req.params.harvestId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_COFFEE_HARVEST',
        targetType: 'coffee_harvest',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          harvestType: result.harvestType,
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

coffeeHarvestsRouter.delete(
  '/org/farms/:farmId/coffee-harvests/:harvestId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteCoffeeHarvest(ctx, req.params.farmId as string, req.params.harvestId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_COFFEE_HARVEST',
        targetType: 'coffee_harvest',
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
