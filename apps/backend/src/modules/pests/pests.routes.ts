import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { PestError } from './pests.types';
import {
  createPest,
  listPests,
  getPest,
  updatePest,
  deletePest,
  listCategories,
} from './pests.service';

export const pestsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PestError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof PestError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CATEGORIES ─────────────────────────────────────────────────────

pestsRouter.get(
  '/org/pests/categories',
  authenticate,
  checkPermission('farms:read'),
  (_req, res) => {
    res.json(listCategories());
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

pestsRouter.post('/org/pests', authenticate, checkPermission('farms:update'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const result = await createPest(ctx, req.body);

    void logAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_PEST',
      targetType: 'pest',
      targetId: result.id,
      metadata: { commonName: result.commonName, category: result.category },
      ipAddress: getClientIp(req),
    });

    res.status(201).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── LIST ───────────────────────────────────────────────────────────

pestsRouter.get('/org/pests', authenticate, checkPermission('farms:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const result = await listPests(ctx, {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      category: req.query.category as string | undefined,
      crop: req.query.crop as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── GET ────────────────────────────────────────────────────────────

pestsRouter.get(
  '/org/pests/:pestId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getPest(ctx, req.params.pestId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

pestsRouter.patch(
  '/org/pests/:pestId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updatePest(ctx, req.params.pestId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_PEST',
        targetType: 'pest',
        targetId: result.id,
        metadata: { commonName: result.commonName, category: result.category },
        ipAddress: getClientIp(req),
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────

pestsRouter.delete(
  '/org/pests/:pestId',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const pestId = req.params.pestId as string;
      await deletePest(ctx, pestId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_PEST',
        targetType: 'pest',
        targetId: pestId,
        metadata: {},
        ipAddress: getClientIp(req),
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
