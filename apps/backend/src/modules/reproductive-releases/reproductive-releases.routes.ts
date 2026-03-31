import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { ReproductiveReleaseError } from './reproductive-releases.types';
import {
  getCriteria,
  setCriteria,
  getCandidates,
  createRelease,
  bulkRelease,
  listReleases,
  getRelease,
  getIndicators,
} from './reproductive-releases.service';

export const reproductiveReleasesRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new ReproductiveReleaseError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof ReproductiveReleaseError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('ReproductiveRelease error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET CRITERIA (CA2) ─────────────────────────────────────────────

reproductiveReleasesRouter.get(
  '/org/reproductive-criteria',
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

// ─── SET CRITERIA (CA2) ─────────────────────────────────────────────

reproductiveReleasesRouter.put(
  '/org/reproductive-criteria',
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
        action: 'SET_REPRODUCTIVE_CRITERIA',
        targetType: 'reproductive_criteria',
        targetId: result.id,
        metadata: {
          minWeightKg: result.minWeightKg,
          minAgeMonths: result.minAgeMonths,
          minBodyScore: result.minBodyScore,
          targetLotId: result.targetLotId,
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

// ─── CANDIDATES (CA6) ──────────────────────────────────────────────

reproductiveReleasesRouter.get(
  '/org/farms/:farmId/reproductive-releases/candidates',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCandidates(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── BULK RELEASE (CA7) ────────────────────────────────────────────

reproductiveReleasesRouter.post(
  '/org/farms/:farmId/reproductive-releases/bulk',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await bulkRelease(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BULK_REPRODUCTIVE_RELEASE',
        targetType: 'reproductive_release',
        targetId: 'bulk',
        metadata: {
          released: result.released,
          failed: result.failed,
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

// ─── INDICATORS (CA9) ──────────────────────────────────────────────

reproductiveReleasesRouter.get(
  '/org/farms/:farmId/reproductive-releases/indicators',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getIndicators(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST (CA8) ────────────────────────────────────────────────────

reproductiveReleasesRouter.get(
  '/org/farms/:farmId/reproductive-releases',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        animalId: req.query.animalId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listReleases(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1) ──────────────────────────────────────────────────

reproductiveReleasesRouter.post(
  '/org/farms/:farmId/reproductive-releases',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createRelease(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_REPRODUCTIVE_RELEASE',
        targetType: 'reproductive_release',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          animalEarTag: result.animalEarTag,
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

// ─── GET ───────────────────────────────────────────────────────────

reproductiveReleasesRouter.get(
  '/org/farms/:farmId/reproductive-releases/:releaseId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getRelease(
        ctx,
        req.params.farmId as string,
        req.params.releaseId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
