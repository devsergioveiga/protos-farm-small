import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { MastitisError } from './mastitis.types';
import {
  createCase,
  listCases,
  getCase,
  updateCase,
  recordApplication,
  updateQuarter,
  closeCase,
  deleteCase,
  getAnimalMastitisHistory,
  getMastitisIndicators,
  exportMastitisCsv,
} from './mastitis.service';

export const mastitisRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new MastitisError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof MastitisError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Mastitis error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── INDICATORS (CA11) ─────────────────────────────────────────────

mastitisRouter.get(
  '/org/farms/:farmId/mastitis/indicators',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getMastitisIndicators(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT CSV ────────────────────────────────────────────────────

mastitisRouter.get(
  '/org/farms/:farmId/mastitis/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        animalId: req.query.animalId as string | undefined,
        status: req.query.status as string | undefined,
        classification: req.query.classification as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const csv = await exportMastitisCsv(ctx, req.params.farmId as string, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="mastite.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── ANIMAL HISTORY (CA10) ─────────────────────────────────────────

mastitisRouter.get(
  '/org/farms/:farmId/mastitis/animal/:animalId/history',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getAnimalMastitisHistory(
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

// ─── LIST ──────────────────────────────────────────────────────────

mastitisRouter.get(
  '/org/farms/:farmId/mastitis',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        animalId: req.query.animalId as string | undefined,
        status: req.query.status as string | undefined,
        classification: req.query.classification as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await listCases(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE (CA1) ──────────────────────────────────────────────────

mastitisRouter.post(
  '/org/farms/:farmId/mastitis',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createCase(ctx, req.params.farmId as string, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_MASTITIS_CASE',
        targetType: 'mastitis_case',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          classification: result.classification,
          quartersAffected: result.quarters.map((q) => q.quarter),
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

mastitisRouter.get(
  '/org/farms/:farmId/mastitis/:caseId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCase(ctx, req.params.farmId as string, req.params.caseId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ────────────────────────────────────────────────────────

mastitisRouter.patch(
  '/org/farms/:farmId/mastitis/:caseId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateCase(
        ctx,
        req.params.farmId as string,
        req.params.caseId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_MASTITIS_CASE',
        targetType: 'mastitis_case',
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

// ─── CLOSE (CA9) ──────────────────────────────────────────────────

mastitisRouter.patch(
  '/org/farms/:farmId/mastitis/:caseId/close',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await closeCase(
        ctx,
        req.params.farmId as string,
        req.params.caseId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CLOSE_MASTITIS_CASE',
        targetType: 'mastitis_case',
        targetId: result.id,
        metadata: {
          closureOutcome: result.closureOutcome,
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

mastitisRouter.delete(
  '/org/farms/:farmId/mastitis/:caseId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteCase(ctx, req.params.farmId as string, req.params.caseId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_MASTITIS_CASE',
        targetType: 'mastitis_case',
        targetId: req.params.caseId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Caso de mastite excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── RECORD APPLICATION (CA6) ──────────────────────────────────────

mastitisRouter.post(
  '/org/farms/:farmId/mastitis/:caseId/applications',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await recordApplication(
        ctx,
        req.params.farmId as string,
        req.params.caseId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECORD_MASTITIS_APPLICATION',
        targetType: 'mastitis_application',
        targetId: result.id,
        metadata: {
          caseId: req.params.caseId as string,
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

// ─── UPDATE QUARTER (CA8) ──────────────────────────────────────────

mastitisRouter.patch(
  '/org/farms/:farmId/mastitis/:caseId/quarters/:quarterId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateQuarter(
        ctx,
        req.params.farmId as string,
        req.params.caseId as string,
        req.params.quarterId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_MASTITIS_QUARTER',
        targetType: 'mastitis_quarter',
        targetId: result.id,
        metadata: {
          caseId: req.params.caseId as string,
          quarter: result.quarter,
          status: result.status,
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
