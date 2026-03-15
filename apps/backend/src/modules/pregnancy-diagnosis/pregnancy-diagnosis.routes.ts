import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { PregnancyDiagnosisError, type DgResultValue } from './pregnancy-diagnosis.types';
import {
  createDiagnosis,
  listDiagnoses,
  getDiagnosis,
  updateDiagnosis,
  deleteDiagnosis,
  confirmPregnancy,
  recordLoss,
  getCalvingCalendar,
  getEmptyFemales,
  getDgIndicators,
  referToIatf,
} from './pregnancy-diagnosis.service';

export const pregnancyDiagnosisRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PregnancyDiagnosisError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof PregnancyDiagnosisError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('PregnancyDiagnosis error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CALVING CALENDAR (CA8) ────────────────────────────────────────

pregnancyDiagnosisRouter.get(
  '/org/farms/:farmId/pregnancy-diagnoses/calving-calendar',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const monthsAhead = req.query.monthsAhead ? Number(req.query.monthsAhead) : undefined;
      const result = await getCalvingCalendar(ctx, req.params.farmId as string, monthsAhead);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EMPTY FEMALES (CA10) ──────────────────────────────────────────

pregnancyDiagnosisRouter.get(
  '/org/farms/:farmId/pregnancy-diagnoses/empty-females',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getEmptyFemales(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── INDICATORS (CA9) ─────────────────────────────────────────────

pregnancyDiagnosisRouter.get(
  '/org/farms/:farmId/pregnancy-diagnoses/indicators',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getDgIndicators(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

pregnancyDiagnosisRouter.get(
  '/org/farms/:farmId/pregnancy-diagnoses',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        result: req.query.result as DgResultValue | undefined,
        animalId: req.query.animalId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listDiagnoses(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1-CA7) ──────────────────────────────────────────────

pregnancyDiagnosisRouter.post(
  '/org/farms/:farmId/pregnancy-diagnoses',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createDiagnosis(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_PREGNANCY_DIAGNOSIS',
        targetType: 'pregnancy_diagnosis',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          result: result.result,
          method: result.method,
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

pregnancyDiagnosisRouter.get(
  '/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getDiagnosis(
        ctx,
        req.params.farmId as string,
        req.params.diagnosisId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

pregnancyDiagnosisRouter.patch(
  '/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateDiagnosis(
        ctx,
        req.params.farmId as string,
        req.params.diagnosisId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_PREGNANCY_DIAGNOSIS',
        targetType: 'pregnancy_diagnosis',
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

// ─── CONFIRM PREGNANCY (CA12) ──────────────────────────────────────

pregnancyDiagnosisRouter.post(
  '/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId/confirm',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await confirmPregnancy(
        ctx,
        req.params.farmId as string,
        req.params.diagnosisId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CONFIRM_PREGNANCY',
        targetType: 'pregnancy_diagnosis',
        targetId: result.id,
        metadata: { farmId: req.params.farmId as string },
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

// ─── RECORD LOSS (CA12) ────────────────────────────────────────────

pregnancyDiagnosisRouter.post(
  '/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId/loss',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await recordLoss(
        ctx,
        req.params.farmId as string,
        req.params.diagnosisId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECORD_PREGNANCY_LOSS',
        targetType: 'pregnancy_diagnosis',
        targetId: result.id,
        metadata: {
          lossReason: result.lossReason,
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

// ─── REFER TO IATF (CA11) ─────────────────────────────────────────

pregnancyDiagnosisRouter.post(
  '/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId/refer-iatf',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await referToIatf(
        ctx,
        req.params.farmId as string,
        req.params.diagnosisId as string,
        req.body ?? {},
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'REFER_TO_IATF',
        targetType: 'pregnancy_diagnosis',
        targetId: result.id,
        metadata: {
          referredProtocolId: result.referredProtocolId,
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

pregnancyDiagnosisRouter.delete(
  '/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteDiagnosis(ctx, req.params.farmId as string, req.params.diagnosisId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_PREGNANCY_DIAGNOSIS',
        targetType: 'pregnancy_diagnosis',
        targetId: req.params.diagnosisId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Diagnóstico de gestação excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);
