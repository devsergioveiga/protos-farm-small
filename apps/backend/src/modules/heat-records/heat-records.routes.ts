import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { HeatRecordError, type HeatStatusValue } from './heat-records.types';
import {
  createHeat,
  listHeats,
  getHeat,
  updateHeat,
  deleteHeat,
  getDailyHeats,
  getHeatHistory,
  getHeatIndicators,
  exportHeatsCsv,
} from './heat-records.service';

export const heatRecordsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new HeatRecordError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof HeatRecordError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('HeatRecord error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── DAILY HEATS (CA5) ─────────────────────────────────────────────

heatRecordsRouter.get(
  '/org/farms/:farmId/heat-records/daily',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getDailyHeats(
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

// ─── INDICATORS (CA6) ──────────────────────────────────────────────

heatRecordsRouter.get(
  '/org/farms/:farmId/heat-records/indicators',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getHeatIndicators(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── HEAT HISTORY PER ANIMAL (CA4) ─────────────────────────────────

heatRecordsRouter.get(
  '/org/farms/:farmId/heat-records/history/:animalId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getHeatHistory(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT CSV ─────────────────────────────────────────────────────

heatRecordsRouter.get(
  '/org/farms/:farmId/heat-records/export',
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
        status: req.query.status as HeatStatusValue | undefined,
      };

      const csv = await exportHeatsCsv(ctx, req.params.farmId as string, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cios-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

heatRecordsRouter.get(
  '/org/farms/:farmId/heat-records',
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
        status: req.query.status as HeatStatusValue | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listHeats(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1) ───────────────────────────────────────────────────

heatRecordsRouter.post(
  '/org/farms/:farmId/heat-records',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createHeat(ctx, req.params.farmId as string, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_HEAT_RECORD',
        targetType: 'heat_record',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          animalEarTag: result.animalEarTag,
          intensity: result.intensity,
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

heatRecordsRouter.get(
  '/org/farms/:farmId/heat-records/:heatId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getHeat(ctx, req.params.farmId as string, req.params.heatId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

heatRecordsRouter.patch(
  '/org/farms/:farmId/heat-records/:heatId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateHeat(
        ctx,
        req.params.farmId as string,
        req.params.heatId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_HEAT_RECORD',
        targetType: 'heat_record',
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

heatRecordsRouter.delete(
  '/org/farms/:farmId/heat-records/:heatId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteHeat(ctx, req.params.farmId as string, req.params.heatId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_HEAT_RECORD',
        targetType: 'heat_record',
        targetId: req.params.heatId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro de cio excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
