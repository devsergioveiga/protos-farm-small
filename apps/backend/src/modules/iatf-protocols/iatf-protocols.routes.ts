import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { IatfProtocolError } from './iatf-protocols.types';
import {
  createProtocol,
  listProtocols,
  getProtocol,
  updateProtocol,
  deleteProtocol,
  duplicateProtocol,
  calculateEstimatedCost,
  listVersions,
  exportProtocolCsv,
  listTargetCategories,
  listIatfStatuses,
  listDoseUnits,
  listAdminRoutes,
  SEED_IATF_PROTOCOLS,
} from './iatf-protocols.service';

export const iatfProtocolsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new IatfProtocolError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof IatfProtocolError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('IatfProtocolError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── METADATA ──────────────────────────────────────────────────────

iatfProtocolsRouter.get(
  '/org/iatf-protocols/target-categories',
  authenticate,
  checkPermission('animals:read'),
  (_req, res) => {
    res.json(listTargetCategories());
  },
);

iatfProtocolsRouter.get(
  '/org/iatf-protocols/statuses',
  authenticate,
  checkPermission('animals:read'),
  (_req, res) => {
    res.json(listIatfStatuses());
  },
);

iatfProtocolsRouter.get(
  '/org/iatf-protocols/dose-units',
  authenticate,
  checkPermission('animals:read'),
  (_req, res) => {
    res.json(listDoseUnits());
  },
);

iatfProtocolsRouter.get(
  '/org/iatf-protocols/admin-routes',
  authenticate,
  checkPermission('animals:read'),
  (_req, res) => {
    res.json(listAdminRoutes());
  },
);

// ─── SEED (CA4) ────────────────────────────────────────────────────

iatfProtocolsRouter.post(
  '/org/iatf-protocols/seed',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const userId = req.user!.userId;
      const results = [];

      for (const seed of SEED_IATF_PROTOCOLS) {
        try {
          const result = await createProtocol(ctx, userId, {
            name: seed.name,
            description: seed.description,
            targetCategory: seed.targetCategory,
            veterinaryAuthor: seed.veterinaryAuthor,
            steps: seed.steps,
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
        action: 'SEED_IATF_PROTOCOLS',
        targetType: 'iatf_protocol',
        targetId: '',
        metadata: { count: results.length },
        ipAddress: getClientIp(req),
      });

      res.status(201).json({ created: results.length, total: SEED_IATF_PROTOCOLS.length });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

iatfProtocolsRouter.post(
  '/org/iatf-protocols',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createProtocol(ctx, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_IATF_PROTOCOL',
        targetType: 'iatf_protocol',
        targetId: result.id,
        metadata: { name: result.name, targetCategory: result.targetCategory },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

iatfProtocolsRouter.get(
  '/org/iatf-protocols',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listProtocols(ctx, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as string | undefined,
        targetCategory: req.query.targetCategory as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

iatfProtocolsRouter.get(
  '/org/iatf-protocols/:protocolId',
  authenticate,
  checkPermission('animals:read'),
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

// ─── COST (CA6) ────────────────────────────────────────────────────

iatfProtocolsRouter.get(
  '/org/iatf-protocols/:protocolId/cost',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await calculateEstimatedCost(ctx, req.params.protocolId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── VERSION HISTORY (CA7) ─────────────────────────────────────────

iatfProtocolsRouter.get(
  '/org/iatf-protocols/:protocolId/versions',
  authenticate,
  checkPermission('animals:read'),
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

// ─── EXPORT CSV ────────────────────────────────────────────────────

iatfProtocolsRouter.get(
  '/org/iatf-protocols/:protocolId/export',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportProtocolCsv(ctx, req.params.protocolId as string);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="protocolo-iatf.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

iatfProtocolsRouter.patch(
  '/org/iatf-protocols/:protocolId',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateProtocol(
        ctx,
        req.params.protocolId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_IATF_PROTOCOL',
        targetType: 'iatf_protocol',
        targetId: result.id,
        metadata: { name: result.name, version: result.version },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DUPLICATE (CA5) ───────────────────────────────────────────────

iatfProtocolsRouter.post(
  '/org/iatf-protocols/:protocolId/duplicate',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await duplicateProtocol(
        ctx,
        req.params.protocolId as string,
        req.user!.userId,
        req.body.name,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DUPLICATE_IATF_PROTOCOL',
        targetType: 'iatf_protocol',
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

iatfProtocolsRouter.delete(
  '/org/iatf-protocols/:protocolId',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const protocolId = req.params.protocolId as string;
      await deleteProtocol(ctx, protocolId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_IATF_PROTOCOL',
        targetType: 'iatf_protocol',
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
