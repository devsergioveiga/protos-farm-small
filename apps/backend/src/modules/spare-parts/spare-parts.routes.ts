import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import {
  SparePartError,
  addSparePartCompat,
  removeSparePartCompat,
  listSparePartsForAsset,
  listAssetsForSparePart,
} from './spare-parts.service';

export const sparePartsRouter = Router();

const base = '/org/:orgId/spare-parts';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new SparePartError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof SparePartError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /org/:orgId/spare-parts/by-asset/:assetId ────────────────────
// IMPORTANT: before /:id to avoid Express matching 'by-asset' as id

sparePartsRouter.get(
  `${base}/by-asset/:assetId`,
  authenticate,
  checkPermission('spare-parts:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listSparePartsForAsset(ctx, req.params.assetId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/spare-parts/by-product/:productId ────────────────

sparePartsRouter.get(
  `${base}/by-product/:productId`,
  authenticate,
  checkPermission('spare-parts:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listAssetsForSparePart(ctx, req.params.productId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/spare-parts ─────────────────────────────────────

sparePartsRouter.post(
  base,
  authenticate,
  checkPermission('spare-parts:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { productId, assetId, notes } = req.body as {
        productId?: string;
        assetId?: string;
        notes?: string;
      };

      if (!productId) {
        res.status(400).json({ error: 'productId é obrigatório' });
        return;
      }
      if (!assetId) {
        res.status(400).json({ error: 'assetId é obrigatório' });
        return;
      }

      const result = await addSparePartCompat(ctx, { productId, assetId, notes });
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/spare-parts/:id ───────────────────────────────

sparePartsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('spare-parts:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await removeSparePartCompat(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
