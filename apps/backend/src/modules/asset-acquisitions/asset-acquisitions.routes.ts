import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { AssetAcquisitionError } from './asset-acquisitions.types';
import {
  createAcquisitionAndPayable,
  parseNfeUpload,
  createFromNfe,
} from './asset-acquisitions.service';

export const assetAcquisitionsRouter = Router();

const base = '/org/:orgId/asset-acquisitions';

// ─── Multer (NF-e XML upload — memory storage) ────────────────────────

const nfeUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (
      file.mimetype === 'text/xml' ||
      file.mimetype === 'application/xml' ||
      ext.endsWith('.xml')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use um arquivo .xml de NF-e.'));
    }
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AssetAcquisitionError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof AssetAcquisitionError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST / — Create asset acquisition with CP ───────────────────────

assetAcquisitionsRouter.post(
  base,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createAcquisitionAndPayable(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /parse-nfe — Parse NF-e XML ───────────────────────────────

assetAcquisitionsRouter.post(
  `${base}/parse-nfe`,
  authenticate,
  checkPermission('assets:create'),
  nfeUpload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Arquivo XML não enviado' });
        return;
      }
      const parsed = await parseNfeUpload(req.file.buffer);
      res.status(200).json(parsed);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /from-nfe — Create assets from NF-e XML ───────────────────

assetAcquisitionsRouter.post(
  `${base}/from-nfe`,
  authenticate,
  checkPermission('assets:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { nfeParsed, ...input } = req.body;
      const result = await createFromNfe(ctx, { ...input, nfeParsed });
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
