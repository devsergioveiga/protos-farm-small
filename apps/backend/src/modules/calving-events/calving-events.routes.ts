import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { CalvingEventError, type CalvingEventTypeValue } from './calving-events.types';
import {
  createCalvingEvent,
  listCalvingEvents,
  getCalvingEvent,
  updateCalvingEvent,
  deleteCalvingEvent,
  getUpcomingBirths,
  getCalvingIndicators,
} from './calving-events.service';

export const calvingEventsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new CalvingEventError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof CalvingEventError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('CalvingEvent error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── UPCOMING BIRTHS (CA12) ─────────────────────────────────────────

calvingEventsRouter.get(
  '/org/farms/:farmId/calving-events/upcoming',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const daysAhead = req.query.daysAhead ? Number(req.query.daysAhead) : undefined;
      const result = await getUpcomingBirths(ctx, req.params.farmId as string, daysAhead);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── INDICATORS ─────────────────────────────────────────────────────

calvingEventsRouter.get(
  '/org/farms/:farmId/calving-events/indicators',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCalvingIndicators(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

calvingEventsRouter.get(
  '/org/farms/:farmId/calving-events',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        eventType: req.query.eventType as CalvingEventTypeValue | undefined,
        motherId: req.query.motherId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listCalvingEvents(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1-CA9) ───────────────────────────────────────────────

calvingEventsRouter.post(
  '/org/farms/:farmId/calving-events',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createCalvingEvent(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_CALVING_EVENT',
        targetType: 'calving_event',
        targetId: result.id,
        metadata: {
          eventType: result.eventType,
          motherId: result.motherId,
          calvesCount: result.calvesCount,
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

calvingEventsRouter.get(
  '/org/farms/:farmId/calving-events/:eventId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCalvingEvent(
        ctx,
        req.params.farmId as string,
        req.params.eventId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

calvingEventsRouter.patch(
  '/org/farms/:farmId/calving-events/:eventId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateCalvingEvent(
        ctx,
        req.params.farmId as string,
        req.params.eventId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_CALVING_EVENT',
        targetType: 'calving_event',
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

calvingEventsRouter.delete(
  '/org/farms/:farmId/calving-events/:eventId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteCalvingEvent(ctx, req.params.farmId as string, req.params.eventId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_CALVING_EVENT',
        targetType: 'calving_event',
        targetId: req.params.eventId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Evento de parto/aborto excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
