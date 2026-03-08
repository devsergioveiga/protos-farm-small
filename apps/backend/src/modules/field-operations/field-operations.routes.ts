import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { FieldOperationError } from './field-operations.types';
import {
  createFieldOperation,
  listFieldOperations,
  getFieldOperation,
  deleteFieldOperation,
} from './field-operations.service';

export const fieldOperationsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new FieldOperationError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

// ─── CREATE ─────────────────────────────────────────────────────────

fieldOperationsRouter.post(
  '/org/farms/:farmId/field-operations',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createFieldOperation(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_FIELD_OPERATION',
        targetType: 'field_operation',
        targetId: result.id,
        metadata: { farmId: req.params.farmId, operationType: result.operationType },
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result);
    } catch (err) {
      if (err instanceof FieldOperationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

fieldOperationsRouter.get(
  '/org/farms/:farmId/field-operations',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const result = await listFieldOperations(ctx, req.params.farmId as string, page, limit);
      res.json(result);
    } catch (err) {
      if (err instanceof FieldOperationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

fieldOperationsRouter.get(
  '/org/farms/:farmId/field-operations/:operationId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getFieldOperation(
        ctx,
        req.params.farmId as string,
        req.params.operationId as string,
      );
      res.json(result);
    } catch (err) {
      if (err instanceof FieldOperationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

fieldOperationsRouter.delete(
  '/org/farms/:farmId/field-operations/:operationId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteFieldOperation(
        ctx,
        req.params.farmId as string,
        req.params.operationId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_FIELD_OPERATION',
        targetType: 'field_operation',
        targetId: req.params.operationId as string,
        metadata: { farmId: req.params.farmId },
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      if (err instanceof FieldOperationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
