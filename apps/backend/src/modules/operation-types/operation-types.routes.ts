import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { OperationTypeError } from './operation-types.types';
import {
  createOperationType,
  listOperationTypes,
  getOperationTypeTree,
  getOperationType,
  updateOperationType,
  toggleOperationTypeActive,
  deleteOperationType,
  seedOperationTypes,
  getCropSequence,
  listCropSequences,
  setCropSequence,
  deleteCropSequence,
  seedCropSequences,
  listSchedules,
  getSchedule,
  setSchedule,
  deleteSchedule,
  setBulkSchedules,
  listPhenologicalStages,
  getPhenologicalStage,
  createPhenologicalStage,
  updatePhenologicalStage,
  deletePhenologicalStage,
  seedPhenologicalStages,
} from './operation-types.service';

export const operationTypesRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new OperationTypeError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof OperationTypeError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CREATE ─────────────────────────────────────────────────────────

operationTypesRouter.post(
  '/org/operation-types',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createOperationType(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_OPERATION_TYPE',
        targetType: 'operation_type',
        targetId: result.id,
        metadata: { name: result.name, level: result.level, parentId: result.parentId },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST (flat) ────────────────────────────────────────────────────

operationTypesRouter.get(
  '/org/operation-types',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listOperationTypes(ctx, {
        parentId: req.query.parentId === 'null' ? null : (req.query.parentId as string),
        level: req.query.level ? Number(req.query.level) : undefined,
        search: (req.query.search as string) || undefined,
        includeInactive: req.query.includeInactive === 'true',
        crop: (req.query.crop as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── TREE ───────────────────────────────────────────────────────────

operationTypesRouter.get(
  '/org/operation-types/tree',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getOperationTypeTree(ctx, {
        includeInactive: req.query.includeInactive === 'true',
        crop: (req.query.crop as string) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

operationTypesRouter.get(
  '/org/operation-types/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getOperationType(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

operationTypesRouter.patch(
  '/org/operation-types/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateOperationType(ctx, req.params.id as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_OPERATION_TYPE',
        targetType: 'operation_type',
        targetId: result.id,
        metadata: { name: result.name },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── TOGGLE ACTIVE (CA10) ───────────────────────────────────────────

operationTypesRouter.patch(
  '/org/operation-types/:id/toggle-active',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await toggleOperationTypeActive(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'TOGGLE_OPERATION_TYPE_ACTIVE',
        targetType: 'operation_type',
        targetId: result.id,
        metadata: { name: result.name, isActive: result.isActive },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── SEED DEFAULTS (CA4) ────────────────────────────────────────────

operationTypesRouter.post(
  '/org/operation-types/seed',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await seedOperationTypes(ctx);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SEED_OPERATION_TYPES',
        targetType: 'operation_type',
        targetId: 'bulk',
        metadata: { created: result.created },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA6: CROP OPERATION SEQUENCES ──────────────────────────────────

operationTypesRouter.get(
  '/org/operation-sequences',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const crop = req.query.crop as string | undefined;

      if (crop) {
        const result = await getCropSequence(ctx, crop);
        res.json(result);
      } else {
        const result = await listCropSequences(ctx);
        res.json(result);
      }
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.put(
  '/org/operation-sequences',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await setCropSequence(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SET_CROP_OPERATION_SEQUENCE',
        targetType: 'crop_operation_sequence',
        targetId: req.body.crop,
        metadata: { crop: req.body.crop, itemCount: result.length },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.delete(
  '/org/operation-sequences/:crop',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteCropSequence(ctx, req.params.crop as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_CROP_OPERATION_SEQUENCE',
        targetType: 'crop_operation_sequence',
        targetId: req.params.crop as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.post(
  '/org/operation-sequences/seed',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await seedCropSequences(ctx);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SEED_CROP_OPERATION_SEQUENCES',
        targetType: 'crop_operation_sequence',
        targetId: 'bulk',
        metadata: result,
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA7: OPERATION TYPE SCHEDULES ──────────────────────────────────

operationTypesRouter.get(
  '/org/operation-schedules',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listSchedules(ctx, {
        crop: (req.query.crop as string) || undefined,
        operationTypeId: (req.query.operationTypeId as string) || undefined,
        scheduleType: (req.query.scheduleType as 'fixed_date' | 'phenological') || undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.get(
  '/org/operation-schedules/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getSchedule(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.put(
  '/org/operation-schedules',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await setSchedule(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SET_OPERATION_SCHEDULE',
        targetType: 'operation_type_schedule',
        targetId: result.id,
        metadata: {
          operationTypeId: result.operationTypeId,
          crop: result.crop,
          scheduleType: result.scheduleType,
        },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.put(
  '/org/operation-schedules/bulk/:crop',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await setBulkSchedules(ctx, req.params.crop as string, req.body.items);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SET_BULK_OPERATION_SCHEDULES',
        targetType: 'operation_type_schedule',
        targetId: req.params.crop as string,
        metadata: { crop: req.params.crop, count: result.length },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.delete(
  '/org/operation-schedules/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteSchedule(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_OPERATION_SCHEDULE',
        targetType: 'operation_type_schedule',
        targetId: req.params.id as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CA8: PHENOLOGICAL STAGES ───────────────────────────────────────

operationTypesRouter.get(
  '/org/phenological-stages',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listPhenologicalStages(ctx, (req.query.crop as string) || undefined);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.get(
  '/org/phenological-stages/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getPhenologicalStage(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.post(
  '/org/phenological-stages',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createPhenologicalStage(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_PHENOLOGICAL_STAGE',
        targetType: 'crop_phenological_stage',
        targetId: result.id,
        metadata: { crop: result.crop, code: result.code, name: result.name },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.patch(
  '/org/phenological-stages/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updatePhenologicalStage(ctx, req.params.id as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_PHENOLOGICAL_STAGE',
        targetType: 'crop_phenological_stage',
        targetId: result.id,
        metadata: { crop: result.crop, code: result.code },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.delete(
  '/org/phenological-stages/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deletePhenologicalStage(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_PHENOLOGICAL_STAGE',
        targetType: 'crop_phenological_stage',
        targetId: req.params.id as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

operationTypesRouter.post(
  '/org/phenological-stages/seed',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await seedPhenologicalStages(ctx);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SEED_PHENOLOGICAL_STAGES',
        targetType: 'crop_phenological_stage',
        targetId: 'bulk',
        metadata: result,
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE (soft) ──────────────────────────────────────────────────

operationTypesRouter.delete(
  '/org/operation-types/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteOperationType(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_OPERATION_TYPE',
        targetType: 'operation_type',
        targetId: req.params.id as string,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
