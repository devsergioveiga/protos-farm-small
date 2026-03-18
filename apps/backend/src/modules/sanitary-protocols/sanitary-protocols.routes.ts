import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { SanitaryProtocolError } from './sanitary-protocols.types';
import {
  createSanitaryProtocol,
  listSanitaryProtocols,
  getSanitaryProtocol,
  updateSanitaryProtocol,
  deleteSanitaryProtocol,
  duplicateSanitaryProtocol,
  listSanitaryProtocolVersions,
  seedSanitaryProtocols,
  getSanitaryAlerts,
  listProcedureTypes,
  listTriggerTypes,
  listEventTriggers,
  listCalendarFrequencies,
  listSanitaryStatuses,
  listTargetCategories,
} from './sanitary-protocols.service';

export const sanitaryProtocolsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new SanitaryProtocolError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof SanitaryProtocolError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('SanitaryProtocolError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── METADATA ──────────────────────────────────────────────────────

sanitaryProtocolsRouter.get(
  '/org/sanitary-protocols/procedure-types',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listProcedureTypes());
  },
);

sanitaryProtocolsRouter.get(
  '/org/sanitary-protocols/trigger-types',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listTriggerTypes());
  },
);

sanitaryProtocolsRouter.get(
  '/org/sanitary-protocols/event-triggers',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listEventTriggers());
  },
);

sanitaryProtocolsRouter.get(
  '/org/sanitary-protocols/calendar-frequencies',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listCalendarFrequencies());
  },
);

sanitaryProtocolsRouter.get(
  '/org/sanitary-protocols/statuses',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listSanitaryStatuses());
  },
);

sanitaryProtocolsRouter.get(
  '/org/sanitary-protocols/target-categories',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listTargetCategories());
  },
);

// ─── ALERTS (CA12) ──────────────────────────────────────────────────

sanitaryProtocolsRouter.get(
  '/org/sanitary-protocols/alerts',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getSanitaryAlerts(ctx, {
        farmId: req.query.farmId as string | undefined,
        daysAhead: req.query.daysAhead ? Number(req.query.daysAhead) : undefined,
        urgency: req.query.urgency as import('./sanitary-protocols.types').AlertUrgency | undefined,
        procedureType: req.query.procedureType as string | undefined,
        targetCategory: req.query.targetCategory as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── SEED (CA8, CA9, CA10) ──────────────────────────────────────────

sanitaryProtocolsRouter.post(
  '/org/sanitary-protocols/seed',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await seedSanitaryProtocols(ctx);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SEED_SANITARY_PROTOCOLS',
        targetType: 'sanitary_protocol',
        targetId: '',
        metadata: { created: result.created, total: result.total },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

sanitaryProtocolsRouter.post(
  '/org/sanitary-protocols',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createSanitaryProtocol(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_SANITARY_PROTOCOL',
        targetType: 'sanitary_protocol',
        targetId: result.id,
        metadata: { name: result.name, itemsCount: result.items.length },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

sanitaryProtocolsRouter.get(
  '/org/sanitary-protocols',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listSanitaryProtocols(ctx, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as string | undefined,
        procedureType: req.query.procedureType as string | undefined,
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

sanitaryProtocolsRouter.get(
  '/org/sanitary-protocols/:protocolId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getSanitaryProtocol(ctx, req.params.protocolId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── VERSION HISTORY ────────────────────────────────────────────────

sanitaryProtocolsRouter.get(
  '/org/sanitary-protocols/:protocolId/versions',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listSanitaryProtocolVersions(ctx, req.params.protocolId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

sanitaryProtocolsRouter.patch(
  '/org/sanitary-protocols/:protocolId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateSanitaryProtocol(ctx, req.params.protocolId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_SANITARY_PROTOCOL',
        targetType: 'sanitary_protocol',
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

// ─── DUPLICATE ──────────────────────────────────────────────────────

sanitaryProtocolsRouter.post(
  '/org/sanitary-protocols/:protocolId/duplicate',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await duplicateSanitaryProtocol(ctx, req.params.protocolId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DUPLICATE_SANITARY_PROTOCOL',
        targetType: 'sanitary_protocol',
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

sanitaryProtocolsRouter.delete(
  '/org/sanitary-protocols/:protocolId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const protocolId = req.params.protocolId as string;
      await deleteSanitaryProtocol(ctx, protocolId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_SANITARY_PROTOCOL',
        targetType: 'sanitary_protocol',
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
