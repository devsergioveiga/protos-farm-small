import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { FeedingRecordError } from './feeding-records.types';
import {
  createFeedingRecord,
  recordLeftovers,
  listFeedingRecords,
  getFeedingRecord,
  updateFeedingRecord,
  deleteFeedingRecord,
  getConsumptionIndicators,
  exportFeedingsCsv,
} from './feeding-records.service';

export const feedingRecordsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new FeedingRecordError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof FeedingRecordError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Feeding record error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── INDICATORS (CA7) ──────────────────────────────────────────────

feedingRecordsRouter.get(
  '/org/farms/:farmId/feeding-records/indicators',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        lotId: req.query.lotId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const result = await getConsumptionIndicators(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT CSV ─────────────────────────────────────────────────────

feedingRecordsRouter.get(
  '/org/farms/:farmId/feeding-records/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        lotId: req.query.lotId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        shift: req.query.shift as string | undefined,
      };
      const csv = await exportFeedingsCsv(ctx, req.params.farmId as string, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="registros-trato.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

feedingRecordsRouter.get(
  '/org/farms/:farmId/feeding-records',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        lotId: req.query.lotId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        shift: req.query.shift as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listFeedingRecords(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1) ───────────────────────────────────────────────────

feedingRecordsRouter.post(
  '/org/farms/:farmId/feeding-records',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createFeedingRecord(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_FEEDING_RECORD',
        targetType: 'feeding_record',
        targetId: result.id,
        metadata: {
          lotId: result.lotId,
          lotName: result.lotName,
          shift: result.shift,
          totalProvidedKg: result.totalProvidedKg,
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

feedingRecordsRouter.get(
  '/org/farms/:farmId/feeding-records/:feedingId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getFeedingRecord(
        ctx,
        req.params.farmId as string,
        req.params.feedingId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

feedingRecordsRouter.patch(
  '/org/farms/:farmId/feeding-records/:feedingId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateFeedingRecord(
        ctx,
        req.params.farmId as string,
        req.params.feedingId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_FEEDING_RECORD',
        targetType: 'feeding_record',
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

// ─── RECORD LEFTOVERS (CA2, CA3) ────────────────────────────────────

feedingRecordsRouter.patch(
  '/org/farms/:farmId/feeding-records/:feedingId/leftovers',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await recordLeftovers(
        ctx,
        req.params.farmId as string,
        req.params.feedingId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECORD_FEEDING_LEFTOVERS',
        targetType: 'feeding_record',
        targetId: result.id,
        metadata: {
          totalLeftoverKg: result.totalLeftoverKg,
          leftoverPercent: result.leftoverPercent,
          leftoverAlert: result.leftoverAlert,
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

feedingRecordsRouter.delete(
  '/org/farms/:farmId/feeding-records/:feedingId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteFeedingRecord(ctx, req.params.farmId as string, req.params.feedingId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_FEEDING_RECORD',
        targetType: 'feeding_record',
        targetId: req.params.feedingId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro de trato excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
