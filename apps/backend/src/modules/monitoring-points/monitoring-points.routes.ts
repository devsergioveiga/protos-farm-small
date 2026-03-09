import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { MonitoringPointError } from './monitoring-points.types';
import {
  createMonitoringPoint,
  listMonitoringPoints,
  getMonitoringPoint,
  updateMonitoringPoint,
  deleteMonitoringPoint,
  generateGrid,
} from './monitoring-points.service';

export const monitoringPointsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new MonitoringPointError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof MonitoringPointError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

monitoringPointsRouter.post(
  '/org/farms/:farmId/monitoring-points',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await createMonitoringPoint(ctx, farmId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_MONITORING_POINT',
        targetType: 'monitoring_point',
        targetId: result.id,
        metadata: { code: result.code, fieldPlotId: result.fieldPlotId },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST (by field plot) ───────────────────────────────────────────

monitoringPointsRouter.get(
  '/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-points',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const fieldPlotId = req.params.fieldPlotId as string;
      const result = await listMonitoringPoints(ctx, farmId, fieldPlotId, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

monitoringPointsRouter.get(
  '/org/farms/:farmId/monitoring-points/:pointId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const pointId = req.params.pointId as string;
      const result = await getMonitoringPoint(ctx, farmId, pointId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

monitoringPointsRouter.patch(
  '/org/farms/:farmId/monitoring-points/:pointId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const pointId = req.params.pointId as string;
      const result = await updateMonitoringPoint(ctx, farmId, pointId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_MONITORING_POINT',
        targetType: 'monitoring_point',
        targetId: result.id,
        metadata: { code: result.code },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

monitoringPointsRouter.delete(
  '/org/farms/:farmId/monitoring-points/:pointId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const pointId = req.params.pointId as string;
      await deleteMonitoringPoint(ctx, farmId, pointId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_MONITORING_POINT',
        targetType: 'monitoring_point',
        targetId: pointId,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GENERATE GRID ──────────────────────────────────────────────────

monitoringPointsRouter.post(
  '/org/farms/:farmId/monitoring-points/generate-grid',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await generateGrid(ctx, farmId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'GENERATE_MONITORING_GRID',
        targetType: 'monitoring_point',
        targetId: req.body.fieldPlotId,
        metadata: { spacingMeters: req.body.spacingMeters, pointsCreated: result.length },
        ipAddress: getClientIp(req),
      });

      res.status(201).json({ data: result, total: result.length });
    } catch (err) {
      handleError(err, res);
    }
  },
);
