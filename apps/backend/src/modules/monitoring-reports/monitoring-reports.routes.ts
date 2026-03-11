import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { MonitoringReportError } from './monitoring-reports.types';
import {
  generateMonitoringReport,
  generateMonitoringReportExcel,
} from './monitoring-reports.service';

export const monitoringReportsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new MonitoringReportError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof MonitoringReportError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── JSON Report ────────────────────────────────────────────────────

monitoringReportsRouter.get(
  '/org/farms/:farmId/monitoring-report',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await generateMonitoringReport(ctx, farmId, {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        fieldPlotIds: req.query.fieldPlotIds as string | undefined,
      });

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'GENERATE_MONITORING_REPORT',
        targetType: 'farm',
        targetId: farmId,
        metadata: {
          format: 'json',
          period: result.summary.reportPeriod,
          recordCount: result.summary.totalMonitoringRecords,
        },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Excel Report ───────────────────────────────────────────────────

monitoringReportsRouter.get(
  '/org/farms/:farmId/monitoring-report/excel',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const buffer = await generateMonitoringReportExcel(ctx, farmId, {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        fieldPlotIds: req.query.fieldPlotIds as string | undefined,
      });

      const farmName = (req.query._farmName as string) || 'fazenda';
      const date = new Date().toISOString().split('T')[0];
      const filename = `relatorio-mip-${farmName.replace(/\s+/g, '-').toLowerCase()}-${date}.xlsx`;

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'GENERATE_MONITORING_REPORT',
        targetType: 'farm',
        targetId: farmId,
        metadata: { format: 'excel' },
        ipAddress: getClientIp(req),
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);
