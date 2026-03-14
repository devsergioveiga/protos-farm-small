import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { TherapeuticTreatmentError } from './therapeutic-treatments.types';
import {
  createTreatment,
  listTreatments,
  getTreatment,
  updateTreatment,
  closeTreatment,
  deleteTreatment,
  recordApplication,
  skipApplication,
  recordEvolution,
  getPendingApplications,
  exportTreatmentsCsv,
} from './therapeutic-treatments.service';

export const therapeuticTreatmentsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new TherapeuticTreatmentError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof TherapeuticTreatmentError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Therapeutic treatment error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── PENDING APPLICATIONS (CA4) ───────────────────────────────────

therapeuticTreatmentsRouter.get(
  '/org/farms/:farmId/therapeutic-treatments/pending-applications',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getPendingApplications(
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

// ─── EXPORT CSV ────────────────────────────────────────────────────

therapeuticTreatmentsRouter.get(
  '/org/farms/:farmId/therapeutic-treatments/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        animalId: req.query.animalId as string | undefined,
        diseaseId: req.query.diseaseId as string | undefined,
        status: req.query.status as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const csv = await exportTreatmentsCsv(ctx, req.params.farmId as string, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tratamentos-terapeuticos.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ──────────────────────────────────────────────────────────

therapeuticTreatmentsRouter.get(
  '/org/farms/:farmId/therapeutic-treatments',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        animalId: req.query.animalId as string | undefined,
        diseaseId: req.query.diseaseId as string | undefined,
        status: req.query.status as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listTreatments(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1) ──────────────────────────────────────────────────

therapeuticTreatmentsRouter.post(
  '/org/farms/:farmId/therapeutic-treatments',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createTreatment(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_THERAPEUTIC_TREATMENT',
        targetType: 'therapeutic_treatment',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          diseaseName: result.diseaseName,
          protocolName: result.treatmentProtocolName,
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

// ─── GET ───────────────────────────────────────────────────────────

therapeuticTreatmentsRouter.get(
  '/org/farms/:farmId/therapeutic-treatments/:treatmentId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getTreatment(
        ctx,
        req.params.farmId as string,
        req.params.treatmentId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ────────────────────────────────────────────────────────

therapeuticTreatmentsRouter.patch(
  '/org/farms/:farmId/therapeutic-treatments/:treatmentId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateTreatment(
        ctx,
        req.params.farmId as string,
        req.params.treatmentId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_THERAPEUTIC_TREATMENT',
        targetType: 'therapeutic_treatment',
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

// ─── CLOSE (CA8) ───────────────────────────────────────────────────

therapeuticTreatmentsRouter.patch(
  '/org/farms/:farmId/therapeutic-treatments/:treatmentId/close',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await closeTreatment(
        ctx,
        req.params.farmId as string,
        req.params.treatmentId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CLOSE_THERAPEUTIC_TREATMENT',
        targetType: 'therapeutic_treatment',
        targetId: result.id,
        metadata: {
          outcome: result.outcome,
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

// ─── DELETE ────────────────────────────────────────────────────────

therapeuticTreatmentsRouter.delete(
  '/org/farms/:farmId/therapeutic-treatments/:treatmentId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteTreatment(ctx, req.params.farmId as string, req.params.treatmentId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_THERAPEUTIC_TREATMENT',
        targetType: 'therapeutic_treatment',
        targetId: req.params.treatmentId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Tratamento excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── RECORD APPLICATION (CA4) ──────────────────────────────────────

therapeuticTreatmentsRouter.patch(
  '/org/farms/:farmId/therapeutic-treatments/:treatmentId/applications/:applicationId/done',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await recordApplication(
        ctx,
        req.params.farmId as string,
        req.params.treatmentId as string,
        req.params.applicationId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECORD_TREATMENT_APPLICATION',
        targetType: 'treatment_application',
        targetId: result.id,
        metadata: {
          treatmentId: req.params.treatmentId as string,
          productName: result.productName,
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

// ─── SKIP APPLICATION (CA4) ───────────────────────────────────────

therapeuticTreatmentsRouter.patch(
  '/org/farms/:farmId/therapeutic-treatments/:treatmentId/applications/:applicationId/skip',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await skipApplication(
        ctx,
        req.params.farmId as string,
        req.params.treatmentId as string,
        req.params.applicationId as string,
        req.body,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── RECORD EVOLUTION (CA5) ───────────────────────────────────────

therapeuticTreatmentsRouter.post(
  '/org/farms/:farmId/therapeutic-treatments/:treatmentId/evolutions',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await recordEvolution(
        ctx,
        req.params.farmId as string,
        req.params.treatmentId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECORD_CLINICAL_EVOLUTION',
        targetType: 'clinical_evolution',
        targetId: result.id,
        metadata: {
          treatmentId: req.params.treatmentId as string,
          evolutionType: result.evolutionType,
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
