import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { DewormingError } from './dewormings.types';
import {
  createDeworming,
  bulkDeworm,
  listDewormings,
  getDeworming,
  updateDeworming,
  deleteDeworming,
  getDewormingReport,
  exportDewormingReportCsv,
  getNextDewormingAlerts,
} from './dewormings.service';

export const dewormingsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new DewormingError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof DewormingError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Deworming error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── BULK DEWORM ────────────────────────────────────────────────────

dewormingsRouter.post(
  '/org/farms/:farmId/dewormings/bulk',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await bulkDeworm(ctx, req.params.farmId as string, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BULK_DEWORM',
        targetType: 'deworming',
        targetId: result.campaignId,
        metadata: {
          campaignId: result.campaignId,
          animalCount: result.animalCount,
          productName: (req.body as Record<string, unknown>).productName as string,
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

// ─── CAMPAIGN REPORT ────────────────────────────────────────────────

dewormingsRouter.get(
  '/org/farms/:farmId/dewormings/campaigns/:campaignId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const report = await getDewormingReport(
        ctx,
        req.params.farmId as string,
        req.params.campaignId as string,
      );
      res.json(report);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CAMPAIGN REPORT CSV EXPORT ─────────────────────────────────────

dewormingsRouter.get(
  '/org/farms/:farmId/dewormings/campaigns/:campaignId/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportDewormingReportCsv(
        ctx,
        req.params.farmId as string,
        req.params.campaignId as string,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="vermifugacao-${req.params.campaignId as string}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── NEXT DEWORMING ALERTS (CA6) ───────────────────────────────────

dewormingsRouter.get(
  '/org/farms/:farmId/dewormings/alerts',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const daysAhead = req.query.daysAhead ? Number(req.query.daysAhead) : 30;
      const alerts = await getNextDewormingAlerts(ctx, req.params.farmId as string, daysAhead);
      res.json(alerts);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

dewormingsRouter.get(
  '/org/farms/:farmId/dewormings',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        animalId: req.query.animalId as string | undefined,
        campaignId: req.query.campaignId as string | undefined,
        productId: req.query.productId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listDewormings(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

dewormingsRouter.post(
  '/org/farms/:farmId/dewormings',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createDeworming(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_DEWORMING',
        targetType: 'deworming',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          productName: result.productName,
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

dewormingsRouter.get(
  '/org/farms/:farmId/dewormings/:dewormingId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getDeworming(
        ctx,
        req.params.farmId as string,
        req.params.dewormingId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

dewormingsRouter.patch(
  '/org/farms/:farmId/dewormings/:dewormingId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateDeworming(
        ctx,
        req.params.farmId as string,
        req.params.dewormingId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_DEWORMING',
        targetType: 'deworming',
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

dewormingsRouter.delete(
  '/org/farms/:farmId/dewormings/:dewormingId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteDeworming(ctx, req.params.farmId as string, req.params.dewormingId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_DEWORMING',
        targetType: 'deworming',
        targetId: req.params.dewormingId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro de vermifugação excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
