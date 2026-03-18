import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { WeaningError } from './weaning.types';
import {
  createSeparation,
  setFeedingProtocol,
  listSeparations,
  getSeparation,
  deleteSeparation,
  setCriteria,
  getCriteria,
  getWeaningCandidates,
  createWeaning,
  listWeanings,
  getWeaning,
  deleteWeaning,
  getWeaningIndicators,
} from './weaning.service';

export const weaningRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new WeaningError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof WeaningError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Weaning error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CALF SEPARATIONS ──────────────────────────────────────────────

// CREATE SEPARATION (CA1)
weaningRouter.post(
  '/org/farms/:farmId/calf-separations',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createSeparation(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_CALF_SEPARATION',
        targetType: 'calf_separation',
        targetId: result.id,
        metadata: {
          calfId: result.calfId,
          motherId: result.motherId,
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

// LIST SEPARATIONS
weaningRouter.get(
  '/org/farms/:farmId/calf-separations',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        calfId: req.query.calfId as string | undefined,
        motherId: req.query.motherId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listSeparations(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET SEPARATION
weaningRouter.get(
  '/org/farms/:farmId/calf-separations/:separationId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getSeparation(
        ctx,
        req.params.farmId as string,
        req.params.separationId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// SET FEEDING PROTOCOL (CA2)
weaningRouter.put(
  '/org/farms/:farmId/calf-separations/:separationId/feeding-protocol',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await setFeedingProtocol(ctx, req.params.separationId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SET_FEEDING_PROTOCOL',
        targetType: 'calf_feeding_protocol',
        targetId: result.id,
        metadata: {
          separationId: req.params.separationId as string,
          feedType: result.feedType,
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

// DELETE SEPARATION
weaningRouter.delete(
  '/org/farms/:farmId/calf-separations/:separationId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteSeparation(ctx, req.params.farmId as string, req.params.separationId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_CALF_SEPARATION',
        targetType: 'calf_separation',
        targetId: req.params.separationId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro de separação excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── WEANING CRITERIA ──────────────────────────────────────────────

// GET CRITERIA
weaningRouter.get(
  '/org/weaning-criteria',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCriteria(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// SET CRITERIA (CA4)
weaningRouter.put(
  '/org/weaning-criteria',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await setCriteria(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SET_WEANING_CRITERIA',
        targetType: 'weaning_criteria',
        targetId: result.id,
        metadata: {
          minAgeDays: result.minAgeDays,
          minWeightKg: result.minWeightKg,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── WEANINGS ──────────────────────────────────────────────────────

// CANDIDATES (CA4)
weaningRouter.get(
  '/org/farms/:farmId/weanings/candidates',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getWeaningCandidates(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// INDICATORS (CA8)
weaningRouter.get(
  '/org/farms/:farmId/weanings/indicators',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getWeaningIndicators(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// CREATE WEANING (CA5-CA7, CA9)
weaningRouter.post(
  '/org/farms/:farmId/weanings',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createWeaning(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_WEANING',
        targetType: 'weaning_record',
        targetId: result.id,
        metadata: {
          calfId: result.calfId,
          weightKg: result.weightKg,
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

// LIST WEANINGS
weaningRouter.get(
  '/org/farms/:farmId/weanings',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        calfId: req.query.calfId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listWeanings(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET WEANING
weaningRouter.get(
  '/org/farms/:farmId/weanings/:weaningId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getWeaning(
        ctx,
        req.params.farmId as string,
        req.params.weaningId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE WEANING
weaningRouter.delete(
  '/org/farms/:farmId/weanings/:weaningId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteWeaning(ctx, req.params.farmId as string, req.params.weaningId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_WEANING',
        targetType: 'weaning_record',
        targetId: req.params.weaningId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro de desmame excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
