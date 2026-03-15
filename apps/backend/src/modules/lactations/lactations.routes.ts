import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { LactationError, type LactationStatusValue } from './lactations.types';
import {
  createLactation,
  induceLactation,
  listLactations,
  getLactation,
  updateLactation,
  dryOff,
  deleteLactation,
  getLactationCurve,
  calculateIndicators,
  getDryingAlerts,
  getAnimalLactationHistory,
  getActiveLactations,
  exportLactationsCsv,
} from './lactations.service';

export const lactationsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new LactationError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof LactationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Lactation error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── INDUCE (CA3) — must come before /:lactationId ────────────────

lactationsRouter.post(
  '/org/farms/:farmId/lactations/induce',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await induceLactation(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'INDUCE_LACTATION',
        targetType: 'lactation',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          startDate: result.startDate,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── ACTIVE LACTATIONS ─────────────────────────────────────────────

lactationsRouter.get(
  '/org/farms/:farmId/lactations/active',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getActiveLactations(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DRYING ALERTS (CA9) ───────────────────────────────────────────

lactationsRouter.get(
  '/org/farms/:farmId/lactations/drying-alerts',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const options = {
        maxDel: req.query.maxDel ? Number(req.query.maxDel) : undefined,
        minProductionLiters: req.query.minProductionLiters
          ? Number(req.query.minProductionLiters)
          : undefined,
        maxGestationDays: req.query.maxGestationDays
          ? Number(req.query.maxGestationDays)
          : undefined,
      };
      const result = await getDryingAlerts(ctx, req.params.farmId as string, options);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── ANIMAL HISTORY (CA11) ─────────────────────────────────────────

lactationsRouter.get(
  '/org/farms/:farmId/lactations/animal/:animalId/history',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getAnimalLactationHistory(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT CSV ─────────────────────────────────────────────────────

lactationsRouter.get(
  '/org/farms/:farmId/lactations/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        animalId: req.query.animalId as string | undefined,
        status: req.query.status as LactationStatusValue | undefined,
      };

      const csv = await exportLactationsCsv(ctx, req.params.farmId as string, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="lactacoes-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CURVE (CA5) ────────────────────────────────────────────────────

lactationsRouter.get(
  '/org/farms/:farmId/lactations/:lactationId/curve',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getLactationCurve(
        ctx,
        req.params.farmId as string,
        req.params.lactationId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── INDICATORS (CA6) ──────────────────────────────────────────────

lactationsRouter.post(
  '/org/farms/:farmId/lactations/:lactationId/indicators',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await calculateIndicators(
        ctx,
        req.params.farmId as string,
        req.params.lactationId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DRY OFF (CA8) ─────────────────────────────────────────────────

lactationsRouter.post(
  '/org/farms/:farmId/lactations/:lactationId/dry-off',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await dryOff(
        ctx,
        req.params.farmId as string,
        req.params.lactationId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DRY_OFF_LACTATION',
        targetType: 'lactation',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          endDate: result.endDate,
          dryingReason: result.dryingReason,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

lactationsRouter.get(
  '/org/farms/:farmId/lactations',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        animalId: req.query.animalId as string | undefined,
        status: req.query.status as LactationStatusValue | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listLactations(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1) ───────────────────────────────────────────────────

lactationsRouter.post(
  '/org/farms/:farmId/lactations',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createLactation(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_LACTATION',
        targetType: 'lactation',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          startDate: result.startDate,
          origin: result.origin,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET (CA4) ──────────────────────────────────────────────────────

lactationsRouter.get(
  '/org/farms/:farmId/lactations/:lactationId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getLactation(
        ctx,
        req.params.farmId as string,
        req.params.lactationId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

lactationsRouter.patch(
  '/org/farms/:farmId/lactations/:lactationId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateLactation(
        ctx,
        req.params.farmId as string,
        req.params.lactationId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_LACTATION',
        targetType: 'lactation',
        targetId: result.id,
        metadata: {
          changes: Object.keys(req.body),
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

lactationsRouter.delete(
  '/org/farms/:farmId/lactations/:lactationId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteLactation(ctx, req.params.farmId as string, req.params.lactationId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_LACTATION',
        targetType: 'lactation',
        targetId: req.params.lactationId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Lactação excluída com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
