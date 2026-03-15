import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { TreatmentProtocolError } from './treatment-protocols.types';
import {
  createProtocol,
  listProtocols,
  getProtocol,
  updateProtocol,
  deleteProtocol,
  duplicateProtocol,
  listVersions,
  listAdministrationRoutes,
  listDosageUnits,
  listProtocolStatuses,
  SEED_PROTOCOLS,
} from './treatment-protocols.service';

export const treatmentProtocolsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new TreatmentProtocolError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof TreatmentProtocolError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('TreatmentProtocolError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── METADATA ──────────────────────────────────────────────────────

treatmentProtocolsRouter.get(
  '/org/treatment-protocols/administration-routes',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listAdministrationRoutes());
  },
);

treatmentProtocolsRouter.get(
  '/org/treatment-protocols/dosage-units',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listDosageUnits());
  },
);

treatmentProtocolsRouter.get(
  '/org/treatment-protocols/statuses',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listProtocolStatuses());
  },
);

// ─── SEED (CA5) ────────────────────────────────────────────────────

treatmentProtocolsRouter.post(
  '/org/treatment-protocols/seed',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const results = [];

      for (const seed of SEED_PROTOCOLS) {
        try {
          // Find disease IDs by name
          const { withRlsContext } = await import('../../database/rls');
          const diseaseIds = await withRlsContext(ctx, async (tx) => {
            const diseases = await tx.disease.findMany({
              where: {
                organizationId: ctx.organizationId,
                name: { in: seed.diseaseNames },
                deletedAt: null,
              },
              select: { id: true },
            });
            return diseases.map((d) => d.id);
          });

          const result = await createProtocol(ctx, {
            name: seed.name,
            description: seed.description,
            severity: seed.severity,
            authorName: seed.authorName,
            diseaseIds,
            steps: seed.steps.map((s) => ({ ...s, productId: null })),
          });
          results.push(result);
        } catch {
          // Skip duplicates silently
        }
      }

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SEED_TREATMENT_PROTOCOLS',
        targetType: 'treatment_protocol',
        targetId: '',
        metadata: { count: results.length },
        ipAddress: getClientIp(req),
      });

      res.status(201).json({ created: results.length, total: SEED_PROTOCOLS.length });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

treatmentProtocolsRouter.post(
  '/org/treatment-protocols',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createProtocol(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_TREATMENT_PROTOCOL',
        targetType: 'treatment_protocol',
        targetId: result.id,
        metadata: { name: result.name, stepsCount: result.steps.length },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

treatmentProtocolsRouter.get(
  '/org/treatment-protocols',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listProtocols(ctx, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as string | undefined,
        diseaseId: req.query.diseaseId as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

treatmentProtocolsRouter.get(
  '/org/treatment-protocols/:protocolId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getProtocol(ctx, req.params.protocolId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── VERSION HISTORY (CA8) ─────────────────────────────────────────

treatmentProtocolsRouter.get(
  '/org/treatment-protocols/:protocolId/versions',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listVersions(ctx, req.params.protocolId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

treatmentProtocolsRouter.patch(
  '/org/treatment-protocols/:protocolId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateProtocol(ctx, req.params.protocolId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_TREATMENT_PROTOCOL',
        targetType: 'treatment_protocol',
        targetId: result.id,
        metadata: {
          name: result.name,
          version: result.version,
          reason: req.body.versionReason,
        },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DUPLICATE (CA6) ───────────────────────────────────────────────

treatmentProtocolsRouter.post(
  '/org/treatment-protocols/:protocolId/duplicate',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await duplicateProtocol(ctx, req.params.protocolId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DUPLICATE_TREATMENT_PROTOCOL',
        targetType: 'treatment_protocol',
        targetId: result.id,
        metadata: { name: result.name, sourceId: req.params.protocolId },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

treatmentProtocolsRouter.delete(
  '/org/treatment-protocols/:protocolId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const protocolId = req.params.protocolId as string;
      await deleteProtocol(ctx, protocolId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_TREATMENT_PROTOCOL',
        targetType: 'treatment_protocol',
        targetId: protocolId,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
