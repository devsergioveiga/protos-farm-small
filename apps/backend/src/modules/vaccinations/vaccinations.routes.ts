import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { VaccinationError } from './vaccinations.types';
import {
  createVaccination,
  bulkVaccinate,
  listVaccinations,
  getVaccination,
  updateVaccination,
  deleteVaccination,
  getVaccinationReport,
  exportVaccinationReportCsv,
} from './vaccinations.service';

export const vaccinationsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new VaccinationError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof VaccinationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Vaccination error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── BULK VACCINATE (CA2) ───────────────────────────────────────────

vaccinationsRouter.post(
  '/org/farms/:farmId/vaccinations/bulk',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await bulkVaccinate(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BULK_VACCINATE',
        targetType: 'vaccination',
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

// ─── CAMPAIGN REPORT (CA6) ──────────────────────────────────────────

vaccinationsRouter.get(
  '/org/farms/:farmId/vaccinations/campaigns/:campaignId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const report = await getVaccinationReport(
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

// ─── CAMPAIGN REPORT CSV EXPORT (CA6) ───────────────────────────────

vaccinationsRouter.get(
  '/org/farms/:farmId/vaccinations/campaigns/:campaignId/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportVaccinationReportCsv(
        ctx,
        req.params.farmId as string,
        req.params.campaignId as string,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="vacinacao-${req.params.campaignId as string}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

vaccinationsRouter.get(
  '/org/farms/:farmId/vaccinations',
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

      const result = await listVaccinations(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1) ───────────────────────────────────────────────────

vaccinationsRouter.post(
  '/org/farms/:farmId/vaccinations',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createVaccination(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_VACCINATION',
        targetType: 'vaccination',
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

vaccinationsRouter.get(
  '/org/farms/:farmId/vaccinations/:vaccinationId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getVaccination(
        ctx,
        req.params.farmId as string,
        req.params.vaccinationId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

vaccinationsRouter.patch(
  '/org/farms/:farmId/vaccinations/:vaccinationId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateVaccination(
        ctx,
        req.params.farmId as string,
        req.params.vaccinationId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_VACCINATION',
        targetType: 'vaccination',
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

vaccinationsRouter.delete(
  '/org/farms/:farmId/vaccinations/:vaccinationId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteVaccination(ctx, req.params.farmId as string, req.params.vaccinationId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_VACCINATION',
        targetType: 'vaccination',
        targetId: req.params.vaccinationId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro de vacinação excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
