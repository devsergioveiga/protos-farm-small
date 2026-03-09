import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { FertilizerApplicationError } from './fertilizer-applications.types';
import {
  createFertilizerApplication,
  listFertilizerApplications,
  getFertilizerApplication,
  updateFertilizerApplication,
  deleteFertilizerApplication,
  getNutrientSummary,
  getApplicationsReport,
  applicationsToCsv,
} from './fertilizer-applications.service';

export const fertilizerApplicationsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new FertilizerApplicationError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof FertilizerApplicationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

fertilizerApplicationsRouter.post(
  '/org/farms/:farmId/fertilizer-applications',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createFertilizerApplication(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_FERTILIZER_APPLICATION',
        targetType: 'fertilizer_application',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          productName: result.productName,
          applicationType: result.applicationType,
          fieldPlotId: result.fieldPlotId,
        },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

fertilizerApplicationsRouter.get(
  '/org/farms/:farmId/fertilizer-applications',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listFertilizerApplications(ctx, req.params.farmId as string, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
        applicationType: (req.query.applicationType as string) || undefined,
        search: (req.query.search as string) || undefined,
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── NUTRIENT SUMMARY (CA7) ────────────────────────────────────────

fertilizerApplicationsRouter.get(
  '/org/farms/:farmId/fertilizer-applications/nutrient-summary',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const summary = await getNutrientSummary(ctx, req.params.farmId as string, {
        seasonYear: (req.query.seasonYear as string) || undefined,
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
      });
      res.json(summary);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── REPORT EXPORT (CSV) ────────────────────────────────────────────

fertilizerApplicationsRouter.get(
  '/org/farms/:farmId/fertilizer-applications/report/export',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const items = await getApplicationsReport(ctx, req.params.farmId as string, {
        dateFrom: (req.query.dateFrom as string) || undefined,
        dateTo: (req.query.dateTo as string) || undefined,
        fieldPlotId: (req.query.fieldPlotId as string) || undefined,
        applicationType: (req.query.applicationType as string) || undefined,
        productName: (req.query.productName as string) || undefined,
      });
      const csv = applicationsToCsv(items);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="aplicacoes-adubacao.csv"');
      res.send('\uFEFF' + csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

fertilizerApplicationsRouter.get(
  '/org/farms/:farmId/fertilizer-applications/:applicationId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getFertilizerApplication(
        ctx,
        req.params.farmId as string,
        req.params.applicationId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

fertilizerApplicationsRouter.patch(
  '/org/farms/:farmId/fertilizer-applications/:applicationId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateFertilizerApplication(
        ctx,
        req.params.farmId as string,
        req.params.applicationId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_FERTILIZER_APPLICATION',
        targetType: 'fertilizer_application',
        targetId: result.id,
        metadata: {
          farmId: req.params.farmId,
          productName: result.productName,
        },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE (soft) ──────────────────────────────────────────────────

fertilizerApplicationsRouter.delete(
  '/org/farms/:farmId/fertilizer-applications/:applicationId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteFertilizerApplication(
        ctx,
        req.params.farmId as string,
        req.params.applicationId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_FERTILIZER_APPLICATION',
        targetType: 'fertilizer_application',
        targetId: req.params.applicationId as string,
        metadata: { farmId: req.params.farmId },
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
