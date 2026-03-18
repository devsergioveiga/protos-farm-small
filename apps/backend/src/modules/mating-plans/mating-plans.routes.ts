import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { MatingPlanError } from './mating-plans.types';
import {
  MAX_MATING_PLAN_FILE_SIZE,
  ACCEPTED_MATING_PLAN_EXTENSIONS,
} from './mating-plan-csv-parser';
import {
  createPlan,
  listPlans,
  getPlan,
  updatePlan,
  deletePlan,
  addPairs,
  updatePair,
  removePair,
  getAdherenceReport,
  importPairsCsv,
  exportPlanCsv,
} from './mating-plans.service';

export const matingPlansRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new MatingPlanError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof MatingPlanError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('MatingPlan error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── Multer for CSV import ──────────────────────────────────────────

const matingPlanImportUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_MATING_PLAN_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ((ACCEPTED_MATING_PLAN_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Formato não suportado. Aceitos: ${ACCEPTED_MATING_PLAN_EXTENSIONS.join(', ')}`),
      );
    }
  },
});

// ─── CREATE PLAN ───────────────────────────────────────────────────

matingPlansRouter.post(
  '/org/farms/:farmId/mating-plans',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createPlan(ctx, req.params.farmId as string, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_MATING_PLAN',
        targetType: 'mating_plan',
        targetId: result.id,
        metadata: {
          name: result.name,
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

// ─── LIST PLANS ────────────────────────────────────────────────────

matingPlansRouter.get(
  '/org/farms/:farmId/mating-plans',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listPlans(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET PLAN ──────────────────────────────────────────────────────

matingPlansRouter.get(
  '/org/farms/:farmId/mating-plans/:planId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getPlan(ctx, req.params.farmId as string, req.params.planId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE PLAN ───────────────────────────────────────────────────

matingPlansRouter.patch(
  '/org/farms/:farmId/mating-plans/:planId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updatePlan(
        ctx,
        req.params.farmId as string,
        req.params.planId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_MATING_PLAN',
        targetType: 'mating_plan',
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

// ─── DELETE PLAN ───────────────────────────────────────────────────

matingPlansRouter.delete(
  '/org/farms/:farmId/mating-plans/:planId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deletePlan(ctx, req.params.farmId as string, req.params.planId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_MATING_PLAN',
        targetType: 'mating_plan',
        targetId: req.params.planId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Plano de acasalamento excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── ADD PAIRS ─────────────────────────────────────────────────────

matingPlansRouter.post(
  '/org/farms/:farmId/mating-plans/:planId/pairs',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const pairs = Array.isArray(req.body) ? req.body : req.body.pairs;
      const result = await addPairs(
        ctx,
        req.params.farmId as string,
        req.params.planId as string,
        pairs,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'ADD_MATING_PAIRS',
        targetType: 'mating_plan',
        targetId: req.params.planId as string,
        metadata: {
          pairsCount: result.length,
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

// ─── UPDATE PAIR ───────────────────────────────────────────────────

matingPlansRouter.patch(
  '/org/farms/:farmId/mating-plans/pairs/:pairId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updatePair(ctx, req.params.pairId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_MATING_PAIR',
        targetType: 'mating_pair',
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

// ─── REMOVE PAIR ───────────────────────────────────────────────────

matingPlansRouter.delete(
  '/org/farms/:farmId/mating-plans/pairs/:pairId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await removePair(ctx, req.params.pairId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'REMOVE_MATING_PAIR',
        targetType: 'mating_pair',
        targetId: req.params.pairId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Par de acasalamento removido com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── ADHERENCE REPORT (CA8) ────────────────────────────────────────

matingPlansRouter.get(
  '/org/farms/:farmId/mating-plans/:planId/adherence',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getAdherenceReport(
        ctx,
        req.params.farmId as string,
        req.params.planId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── IMPORT CSV (CA9) ──────────────────────────────────────────────

matingPlansRouter.post(
  '/org/farms/:farmId/mating-plans/:planId/import',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  (req, res) => {
    matingPlanImportUpload.single('file')(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        if (uploadErr instanceof multer.MulterError) {
          res.status(400).json({
            error:
              uploadErr.code === 'LIMIT_FILE_SIZE'
                ? 'Arquivo excede o limite de 5 MB'
                : uploadErr.message,
          });
        } else if (uploadErr instanceof Error) {
          res.status(400).json({ error: uploadErr.message });
        } else {
          res.status(400).json({ error: 'Erro no upload do arquivo' });
        }
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Arquivo é obrigatório' });
        return;
      }

      try {
        const ctx = buildRlsContext(req);
        const result = await importPairsCsv(
          ctx,
          req.params.farmId as string,
          req.params.planId as string,
          req.file,
        );

        void logAudit({
          actorId: req.user!.userId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          action: 'IMPORT_MATING_PAIRS_CSV',
          targetType: 'mating_plan',
          targetId: req.params.planId as string,
          metadata: {
            fileName: req.file.originalname,
            imported: result.imported,
            skipped: result.skipped,
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
    });
  },
);

// ─── EXPORT CSV (CA10) ─────────────────────────────────────────────

matingPlansRouter.get(
  '/org/farms/:farmId/mating-plans/:planId/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportPlanCsv(
        ctx,
        req.params.farmId as string,
        req.params.planId as string,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="plano-acasalamento.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);
