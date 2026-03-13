import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { DiseaseError } from './diseases.types';
import {
  createDisease,
  listDiseases,
  getDisease,
  updateDisease,
  deleteDisease,
  listCategories,
  listSeverityLevels,
  listAffectedSystems,
  SEED_DISEASES,
} from './diseases.service';

export const diseasesRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new DiseaseError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof DiseaseError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('DiseaseError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CATEGORIES ─────────────────────────────────────────────────────

diseasesRouter.get(
  '/org/diseases/categories',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listCategories());
  },
);

// ─── SEVERITY LEVELS ────────────────────────────────────────────────

diseasesRouter.get(
  '/org/diseases/severity-levels',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listSeverityLevels());
  },
);

// ─── AFFECTED SYSTEMS ───────────────────────────────────────────────

diseasesRouter.get(
  '/org/diseases/affected-systems',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listAffectedSystems());
  },
);

// ─── SEED ───────────────────────────────────────────────────────────

diseasesRouter.post(
  '/org/diseases/seed',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const results = [];
      for (const seed of SEED_DISEASES) {
        try {
          const result = await createDisease(ctx, seed);
          results.push(result);
        } catch {
          // Skip duplicates silently
        }
      }

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SEED_DISEASES',
        targetType: 'disease',
        targetId: '',
        metadata: { count: results.length },
        ipAddress: getClientIp(req),
      });

      res.status(201).json({ created: results.length, total: SEED_DISEASES.length });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

diseasesRouter.post(
  '/org/diseases',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createDisease(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_DISEASE',
        targetType: 'disease',
        targetId: result.id,
        metadata: { name: result.name, category: result.category },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

diseasesRouter.get(
  '/org/diseases',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listDiseases(ctx, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        category: req.query.category as string | undefined,
        severity: req.query.severity as string | undefined,
        isNotifiable:
          req.query.isNotifiable !== undefined ? req.query.isNotifiable === 'true' : undefined,
        search: req.query.search as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

diseasesRouter.get(
  '/org/diseases/:diseaseId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getDisease(ctx, req.params.diseaseId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

diseasesRouter.patch(
  '/org/diseases/:diseaseId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateDisease(ctx, req.params.diseaseId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_DISEASE',
        targetType: 'disease',
        targetId: result.id,
        metadata: { name: result.name, category: result.category },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

diseasesRouter.delete(
  '/org/diseases/:diseaseId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const diseaseId = req.params.diseaseId as string;
      await deleteDisease(ctx, diseaseId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_DISEASE',
        targetType: 'disease',
        targetId: diseaseId,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
