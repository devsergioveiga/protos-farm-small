import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { AnimalHealthError, isValidHealthEventType } from './animal-health.types';
import type { HealthEventType } from './animal-health.types';
import {
  listHealthRecords,
  createHealthRecord,
  bulkCreateHealthRecords,
  updateHealthRecord,
  deleteHealthRecord,
  getHealthStats,
  exportHealthRecordsCsv,
} from './animal-health.service';

export const animalHealthRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new AnimalHealthError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

// ─── BULK CREATE ────────────────────────────────────────────────────

animalHealthRouter.post(
  '/org/farms/:farmId/animals/bulk-health',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const body = req.body as Record<string, unknown>;
      const animalIds = body.animalIds as string[] | undefined;

      if (!Array.isArray(animalIds) || animalIds.length === 0) {
        res.status(400).json({ error: 'animalIds é obrigatório e deve ser um array não vazio' });
        return;
      }

      const input = {
        type: body.type as string,
        eventDate: body.eventDate as string,
        productName: body.productName as string | undefined,
        dosage: body.dosage as string | undefined,
        applicationMethod: body.applicationMethod as string | undefined,
        batchNumber: body.batchNumber as string | undefined,
        diagnosis: body.diagnosis as string | undefined,
        durationDays: body.durationDays as number | undefined,
        examResult: body.examResult as string | undefined,
        labName: body.labName as string | undefined,
        isFieldExam: body.isFieldExam as boolean | undefined,
        veterinaryName: body.veterinaryName as string | undefined,
        notes: body.notes as string | undefined,
      } as import('./animal-health.types').CreateHealthRecordInput;

      const result = await bulkCreateHealthRecords(
        ctx,
        req.params.farmId as string,
        animalIds,
        req.user!.userId,
        input,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BULK_CREATE_HEALTH_RECORD',
        targetType: 'animal_health_record',
        targetId: 'bulk',
        metadata: {
          animalCount: animalIds.length,
          created: result.created,
          failed: result.failed,
          type: String(body.type ?? ''),
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      if (err instanceof AnimalHealthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── STATS (before :recordId to avoid route conflict) ───────────────

animalHealthRouter.get(
  '/org/farms/:farmId/animals/:animalId/health/stats',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const stats = await getHealthStats(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );
      res.json(stats);
    } catch (err) {
      if (err instanceof AnimalHealthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── EXPORT CSV ─────────────────────────────────────────────────────

animalHealthRouter.get(
  '/org/farms/:farmId/animals/:animalId/health/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportHealthRecordsCsv(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="sanitario-${req.params.animalId as string}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      if (err instanceof AnimalHealthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

animalHealthRouter.get(
  '/org/farms/:farmId/animals/:animalId/health',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const typeFilter = req.query.type as string | undefined;
      const validType =
        typeFilter && isValidHealthEventType(typeFilter)
          ? (typeFilter as HealthEventType)
          : undefined;

      const data = await listHealthRecords(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
        validType,
      );
      res.json(data);
    } catch (err) {
      if (err instanceof AnimalHealthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

animalHealthRouter.post(
  '/org/farms/:farmId/animals/:animalId/health',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const record = await createHealthRecord(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_HEALTH_RECORD',
        targetType: 'animal_health_record',
        targetId: record.id,
        metadata: {
          animalId: req.params.animalId as string,
          type: record.type,
          eventDate: record.eventDate,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.status(201).json(record);
    } catch (err) {
      if (err instanceof AnimalHealthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

animalHealthRouter.patch(
  '/org/farms/:farmId/animals/:animalId/health/:recordId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const record = await updateHealthRecord(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
        req.params.recordId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_HEALTH_RECORD',
        targetType: 'animal_health_record',
        targetId: record.id,
        metadata: {
          changes: Object.keys(req.body),
          animalId: req.params.animalId as string,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json(record);
    } catch (err) {
      if (err instanceof AnimalHealthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

animalHealthRouter.delete(
  '/org/farms/:farmId/animals/:animalId/health/:recordId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteHealthRecord(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
        req.params.recordId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_HEALTH_RECORD',
        targetType: 'animal_health_record',
        targetId: req.params.recordId as string,
        metadata: {
          animalId: req.params.animalId as string,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro sanitário excluído com sucesso' });
    } catch (err) {
      if (err instanceof AnimalHealthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
