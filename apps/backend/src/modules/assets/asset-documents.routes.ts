import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { AssetError } from './assets.types';
import {
  createAssetDocument,
  listAssetDocuments,
  getExpiringDocuments,
  updateAssetDocument,
  deleteAssetDocument,
} from './asset-documents.service';

export const assetDocumentsRouter = Router();

const base = '/org/:orgId/asset-documents';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildCtx(req: Request): RlsContext & { userId: string } {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.userId;
  if (!organizationId || !userId) {
    throw new AssetError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof AssetError) {
    res.status(err.statusCode).json({ error: err.message, ...err.data });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /expiring (BEFORE /:id) ──────────────────────────────────────

assetDocumentsRouter.get(
  `${base}/expiring`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const result = await getExpiringDocuments(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST / ────────────────────────────────────────────────────────────

assetDocumentsRouter.post(
  base,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const result = await createAssetDocument(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET / ─────────────────────────────────────────────────────────────

assetDocumentsRouter.get(base, authenticate, checkPermission('assets:read'), async (req, res) => {
  try {
    const ctx = buildCtx(req);
    const query = {
      assetId: req.query.assetId as string | undefined,
      expiringWithinDays: req.query.expiringWithinDays
        ? Number(req.query.expiringWithinDays)
        : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await listAssetDocuments(ctx, query);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── PATCH /:id ────────────────────────────────────────────────────────

assetDocumentsRouter.patch(
  `${base}/:id`,
  authenticate,
  checkPermission('assets:update'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      const result = await updateAssetDocument(ctx, req.params.id as string, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /:id ───────────────────────────────────────────────────────

assetDocumentsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('assets:delete'),
  async (req, res) => {
    try {
      const ctx = buildCtx(req);
      await deleteAssetDocument(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
