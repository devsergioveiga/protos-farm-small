import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import {
  NaturalMatingError,
  type MatingReasonValue,
  type PaternityTypeValue,
} from './natural-matings.types';
import {
  createNaturalMating,
  listNaturalMatings,
  getNaturalMating,
  updateNaturalMating,
  deleteNaturalMating,
  getOverstayAlerts,
  getMatingIndicators,
} from './natural-matings.service';

export const naturalMatingsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new NaturalMatingError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof NaturalMatingError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('NaturalMating error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── OVERSTAY ALERTS (CA4) ──────────────────────────────────────────

naturalMatingsRouter.get(
  '/org/farms/:farmId/natural-matings/overstay-alerts',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getOverstayAlerts(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── INDICATORS (CA5) ──────────────────────────────────────────────

naturalMatingsRouter.get(
  '/org/farms/:farmId/natural-matings/indicators',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getMatingIndicators(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

naturalMatingsRouter.get(
  '/org/farms/:farmId/natural-matings',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        bullId: req.query.bullId as string | undefined,
        reason: req.query.reason as MatingReasonValue | undefined,
        paternityType: req.query.paternityType as PaternityTypeValue | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        overstayOnly: req.query.overstayOnly === 'true',
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listNaturalMatings(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1, CA2, CA3) ─────────────────────────────────────────

naturalMatingsRouter.post(
  '/org/farms/:farmId/natural-matings',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createNaturalMating(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_NATURAL_MATING',
        targetType: 'natural_mating',
        targetId: result.id,
        metadata: {
          bullId: result.bullId,
          reason: result.reason,
          animalCount: result.animalCount,
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

// ─── GET ────────────────────────────────────────────────────────────

naturalMatingsRouter.get(
  '/org/farms/:farmId/natural-matings/:matingId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getNaturalMating(
        ctx,
        req.params.farmId as string,
        req.params.matingId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

naturalMatingsRouter.patch(
  '/org/farms/:farmId/natural-matings/:matingId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateNaturalMating(
        ctx,
        req.params.farmId as string,
        req.params.matingId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_NATURAL_MATING',
        targetType: 'natural_mating',
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

naturalMatingsRouter.delete(
  '/org/farms/:farmId/natural-matings/:matingId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteNaturalMating(ctx, req.params.farmId as string, req.params.matingId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_NATURAL_MATING',
        targetType: 'natural_mating',
        targetId: req.params.matingId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro de monta natural excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
