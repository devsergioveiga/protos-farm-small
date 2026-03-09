import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { MonitoringRecordError } from './monitoring-records.types';
import {
  createMonitoringRecord,
  listMonitoringRecords,
  getMonitoringRecord,
  updateMonitoringRecord,
  deleteMonitoringRecord,
  getMonitoringHeatmap,
  getMonitoringTimeline,
  getMonitoringRecommendations,
} from './monitoring-records.service';

export const monitoringRecordsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new MonitoringRecordError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof MonitoringRecordError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

monitoringRecordsRouter.post(
  '/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-records',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const fieldPlotId = req.params.fieldPlotId as string;
      const result = await createMonitoringRecord(ctx, farmId, fieldPlotId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_MONITORING_RECORD',
        targetType: 'monitoring_record',
        targetId: result.id,
        metadata: { pestName: result.pestName, infestationLevel: result.infestationLevel },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

monitoringRecordsRouter.get(
  '/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-records',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const fieldPlotId = req.params.fieldPlotId as string;
      const result = await listMonitoringRecords(ctx, farmId, fieldPlotId, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        monitoringPointId: req.query.monitoringPointId as string | undefined,
        pestId: req.query.pestId as string | undefined,
        infestationLevel: req.query.infestationLevel as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── HEATMAP ─────────────────────────────────────────────────────────

monitoringRecordsRouter.get(
  '/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-heatmap',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const fieldPlotId = req.params.fieldPlotId as string;
      const result = await getMonitoringHeatmap(ctx, farmId, fieldPlotId, {
        pestId: req.query.pestId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.json({ data: result });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── TIMELINE ───────────────────────────────────────────────────────

monitoringRecordsRouter.get(
  '/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-timeline',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const fieldPlotId = req.params.fieldPlotId as string;
      const aggregation = (req.query.aggregation as string) || undefined;
      const validAggregations = ['daily', 'weekly', 'monthly'];
      const result = await getMonitoringTimeline(ctx, farmId, fieldPlotId, {
        pestIds: req.query.pestIds as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        aggregation:
          aggregation && validAggregations.includes(aggregation)
            ? (aggregation as 'daily' | 'weekly' | 'monthly')
            : undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── RECOMMENDATIONS ────────────────────────────────────────────────

monitoringRecordsRouter.get(
  '/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-recommendations',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const fieldPlotId = req.params.fieldPlotId as string;
      const result = await getMonitoringRecommendations(ctx, farmId, fieldPlotId, {
        pestId: req.query.pestId as string | undefined,
        urgency: req.query.urgency as 'ALERTA' | 'CRITICO' | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

monitoringRecordsRouter.get(
  '/org/farms/:farmId/monitoring-records/:recordId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const recordId = req.params.recordId as string;
      const result = await getMonitoringRecord(ctx, farmId, recordId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

monitoringRecordsRouter.patch(
  '/org/farms/:farmId/monitoring-records/:recordId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const recordId = req.params.recordId as string;
      const result = await updateMonitoringRecord(ctx, farmId, recordId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_MONITORING_RECORD',
        targetType: 'monitoring_record',
        targetId: result.id,
        metadata: { pestName: result.pestName, infestationLevel: result.infestationLevel },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

monitoringRecordsRouter.delete(
  '/org/farms/:farmId/monitoring-records/:recordId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const recordId = req.params.recordId as string;
      await deleteMonitoringRecord(ctx, farmId, recordId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_MONITORING_RECORD',
        targetType: 'monitoring_record',
        targetId: recordId,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
