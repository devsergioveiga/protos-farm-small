import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { MilkingRecordError, type MilkingShiftValue } from './milking-records.types';
import {
  createMilking,
  bulkCreateMilkings,
  listMilkings,
  getMilking,
  updateMilking,
  deleteMilking,
  getDailySummary,
  getLactatingAnimals,
  getProductionTrend,
  exportMilkingsCsv,
} from './milking-records.service';

export const milkingRecordsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new MilkingRecordError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof MilkingRecordError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('MilkingRecord error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── BULK CREATE (CA2) ──────────────────────────────────────────────

milkingRecordsRouter.post(
  '/org/farms/:farmId/milking-records/bulk',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await bulkCreateMilkings(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BULK_CREATE_MILKING',
        targetType: 'milking_record',
        targetId: 'bulk',
        metadata: {
          created: result.created,
          alertCount: result.alerts.length,
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

// ─── DAILY SUMMARY (CA3) ───────────────────────────────────────────

milkingRecordsRouter.get(
  '/org/farms/:farmId/milking-records/daily-summary',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getDailySummary(
        ctx,
        req.params.farmId as string,
        req.query.date as string | undefined,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LACTATING ANIMALS (CA7) ────────────────────────────────────────

milkingRecordsRouter.get(
  '/org/farms/:farmId/milking-records/lactating-animals',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getLactatingAnimals(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PRODUCTION TREND ───────────────────────────────────────────────

milkingRecordsRouter.get(
  '/org/farms/:farmId/milking-records/trend',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const days = req.query.days ? Number(req.query.days) : undefined;
      const result = await getProductionTrend(ctx, req.params.farmId as string, days);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT CSV ─────────────────────────────────────────────────────

milkingRecordsRouter.get(
  '/org/farms/:farmId/milking-records/export',
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
        shift: req.query.shift as MilkingShiftValue | undefined,
      };

      const csv = await exportMilkingsCsv(ctx, req.params.farmId as string, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ordenha-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

milkingRecordsRouter.get(
  '/org/farms/:farmId/milking-records',
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
        shift: req.query.shift as MilkingShiftValue | undefined,
        variationAlert: req.query.variationAlert === 'true' ? true : undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listMilkings(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1) ───────────────────────────────────────────────────

milkingRecordsRouter.post(
  '/org/farms/:farmId/milking-records',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createMilking(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_MILKING',
        targetType: 'milking_record',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          milkingDate: result.milkingDate,
          shift: result.shift,
          liters: result.liters,
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

milkingRecordsRouter.get(
  '/org/farms/:farmId/milking-records/:milkingId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getMilking(
        ctx,
        req.params.farmId as string,
        req.params.milkingId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

milkingRecordsRouter.patch(
  '/org/farms/:farmId/milking-records/:milkingId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateMilking(
        ctx,
        req.params.farmId as string,
        req.params.milkingId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_MILKING',
        targetType: 'milking_record',
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

milkingRecordsRouter.delete(
  '/org/farms/:farmId/milking-records/:milkingId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteMilking(ctx, req.params.farmId as string, req.params.milkingId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_MILKING',
        targetType: 'milking_record',
        targetId: req.params.milkingId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro de ordenha excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
