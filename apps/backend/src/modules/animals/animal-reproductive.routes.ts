import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { AnimalReproductiveError, isValidReproductiveEventType } from './animal-reproductive.types';
import type { ReproductiveEventType } from './animal-reproductive.types';
import {
  listReproductiveRecords,
  createReproductiveRecord,
  updateReproductiveRecord,
  deleteReproductiveRecord,
  getReproductiveStats,
  exportReproductiveRecordsCsv,
} from './animal-reproductive.service';

export const animalReproductiveRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new AnimalReproductiveError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

// ─── STATS ──────────────────────────────────────────────────────────

animalReproductiveRouter.get(
  '/org/farms/:farmId/animals/:animalId/reproductive/stats',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const stats = await getReproductiveStats(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );
      res.json(stats);
    } catch (err) {
      if (err instanceof AnimalReproductiveError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── EXPORT CSV ─────────────────────────────────────────────────────

animalReproductiveRouter.get(
  '/org/farms/:farmId/animals/:animalId/reproductive/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportReproductiveRecordsCsv(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="reprodutivo-${req.params.animalId as string}.csv"`,
      );
      res.send(csv);
    } catch (err) {
      if (err instanceof AnimalReproductiveError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

animalReproductiveRouter.get(
  '/org/farms/:farmId/animals/:animalId/reproductive',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const typeFilter = req.query.type as string | undefined;
      const validType =
        typeFilter && isValidReproductiveEventType(typeFilter)
          ? (typeFilter as ReproductiveEventType)
          : undefined;

      const data = await listReproductiveRecords(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
        validType,
      );
      res.json(data);
    } catch (err) {
      if (err instanceof AnimalReproductiveError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

animalReproductiveRouter.post(
  '/org/farms/:farmId/animals/:animalId/reproductive',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const record = await createReproductiveRecord(
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
        action: 'CREATE_REPRODUCTIVE_RECORD',
        targetType: 'animal_reproductive_record',
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
      if (err instanceof AnimalReproductiveError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

animalReproductiveRouter.patch(
  '/org/farms/:farmId/animals/:animalId/reproductive/:recordId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const record = await updateReproductiveRecord(
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
        action: 'UPDATE_REPRODUCTIVE_RECORD',
        targetType: 'animal_reproductive_record',
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
      if (err instanceof AnimalReproductiveError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

animalReproductiveRouter.delete(
  '/org/farms/:farmId/animals/:animalId/reproductive/:recordId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteReproductiveRecord(
        ctx,
        req.params.farmId as string,
        req.params.animalId as string,
        req.params.recordId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_REPRODUCTIVE_RECORD',
        targetType: 'animal_reproductive_record',
        targetId: req.params.recordId as string,
        metadata: {
          animalId: req.params.animalId as string,
          farmId: req.params.farmId as string,
        },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Registro reprodutivo excluído com sucesso' });
    } catch (err) {
      if (err instanceof AnimalReproductiveError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
