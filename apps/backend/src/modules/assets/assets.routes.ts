import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { AssetError } from './assets.types';
import {
  createAsset,
  listAssets,
  getAsset,
  updateAsset,
  deleteAsset,
  getAssetSummary,
  uploadAssetPhoto,
  removeAssetPhoto,
} from './assets.service';
import { exportAssetsCsv, exportAssetsPdf } from './asset-export.service';

export const assetsRouter = Router();

const base = '/org/:orgId/assets';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AssetError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
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

// ─── Multer (photo upload) ─────────────────────────────────────────────

const photoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const orgId = (req.params.orgId as string) ?? req.user?.organizationId ?? 'unknown';
    const assetId = (req.params.id as string) ?? 'unknown';
    const dir = path.join('uploads', 'assets', orgId, assetId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const uploadMulter = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use JPEG, PNG, WEBP ou GIF.'));
    }
  },
});

// ─── GET /org/:orgId/assets/export/csv ────────────────────────────────

assetsRouter.get(
  `${base}/export/csv`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const date = new Date().toISOString().split('T')[0];
      const buffer = await exportAssetsCsv(ctx, req.query as never);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ativos-${date}.csv"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/assets/export/pdf ────────────────────────────────

assetsRouter.get(
  `${base}/export/pdf`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const date = new Date().toISOString().split('T')[0];
      const buffer = await exportAssetsPdf(ctx, req.query as never);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ativos-${date}.pdf"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/assets/summary (BEFORE /:id) ─────────────────────

assetsRouter.get(
  `${base}/summary`,
  authenticate,
  checkPermission('assets:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getAssetSummary(ctx);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/assets ────────────────────────────────────────────

assetsRouter.get(base, authenticate, checkPermission('assets:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const query = {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      farmId: req.query.farmId as string | undefined,
      assetType: req.query.assetType as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      minValue: req.query.minValue as string | undefined,
      maxValue: req.query.maxValue as string | undefined,
      acquisitionFrom: req.query.acquisitionFrom as string | undefined,
      acquisitionTo: req.query.acquisitionTo as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };
    const result = await listAssets(ctx, query);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── GET /org/:orgId/assets/:id ───────────────────────────────────────

assetsRouter.get(`${base}/:id`, authenticate, checkPermission('assets:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const result = await getAsset(ctx, req.params.id as string);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── POST /org/:orgId/assets ──────────────────────────────────────────

assetsRouter.post(base, authenticate, checkPermission('assets:create'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const { name, assetType, classification, farmId } = req.body as {
      name?: string;
      assetType?: string;
      classification?: string;
      farmId?: string;
    };

    if (!name) {
      res.status(400).json({ error: 'Nome do ativo é obrigatório' });
      return;
    }
    if (!assetType) {
      res.status(400).json({ error: 'Tipo do ativo é obrigatório' });
      return;
    }
    if (!classification) {
      res.status(400).json({ error: 'Classificação do ativo é obrigatória' });
      return;
    }
    if (!farmId) {
      res.status(400).json({ error: 'Fazenda é obrigatória' });
      return;
    }

    const result = await createAsset(ctx, req.body);
    res.status(201).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── PATCH /org/:orgId/assets/:id ────────────────────────────────────

assetsRouter.patch(
  `${base}/:id`,
  authenticate,
  checkPermission('assets:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateAsset(ctx, req.params.id as string, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/assets/:id ───────────────────────────────────

assetsRouter.delete(
  `${base}/:id`,
  authenticate,
  checkPermission('assets:delete'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteAsset(ctx, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/assets/:id/photos ──────────────────────────────

assetsRouter.post(
  `${base}/:id/photos`,
  authenticate,
  checkPermission('assets:update'),
  uploadMulter.array('photos', 5),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'Nenhum arquivo enviado' });
        return;
      }

      const orgId = req.params.orgId ?? ctx.organizationId;
      const assetId = req.params.id as string;
      const filePaths = files.map((f) => `/api/uploads/assets/${orgId}/${assetId}/${f.filename}`);

      const photoUrls = await uploadAssetPhoto(ctx, assetId, filePaths);
      res.json({ photoUrls });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/assets/:id/photos ─────────────────────────────

assetsRouter.delete(
  `${base}/:id/photos`,
  authenticate,
  checkPermission('assets:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { photoUrl } = req.body as { photoUrl?: string };

      if (!photoUrl) {
        res.status(400).json({ error: 'URL da foto é obrigatória' });
        return;
      }

      const photoUrls = await removeAssetPhoto(ctx, req.params.id as string, photoUrl);
      res.json({ photoUrls });
    } catch (err) {
      handleError(err, res);
    }
  },
);
