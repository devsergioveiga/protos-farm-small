import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { BullError } from './bulls.types';
import { MAX_BULL_FILE_SIZE, ACCEPTED_BULL_EXTENSIONS } from './bulls-csv-parser';
import {
  createBull,
  listBulls,
  getBull,
  updateBull,
  deleteBull,
  createSemenBatch,
  updateSemenBatch,
  useSemen,
  getBullCatalog,
  getBullUsageHistory,
  importBullsCsv,
  exportBullsCsv,
} from './bulls.service';

export const bullsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new BullError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof BullError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Bull error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── Multer for CSV import ─────────────────────────────────────────

const bullImportUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_BULL_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ((ACCEPTED_BULL_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato não suportado. Aceitos: ${ACCEPTED_BULL_EXTENSIONS.join(', ')}`));
    }
  },
});

// ─── CATALOG (CA5) — before :bullId routes ─────────────────────────

bullsRouter.get(
  '/org/farms/:farmId/bulls/catalog',
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
      const result = await getBullCatalog(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT CSV ────────────────────────────────────────────────────

bullsRouter.get(
  '/org/farms/:farmId/bulls/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportBullsCsv(ctx, req.params.farmId as string);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="touros.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── IMPORT CSV (CA7) ─────────────────────────────────────────────

bullsRouter.post(
  '/org/farms/:farmId/bulls/import',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  (req, res) => {
    bullImportUpload.single('file')(req, res, async (uploadErr: unknown) => {
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
        const result = await importBullsCsv(ctx, req.params.farmId as string, req.file);

        void logAudit({
          actorId: req.user!.userId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          action: 'IMPORT_BULLS_CSV',
          targetType: 'bull',
          targetId: 'bulk-import',
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

// ─── LIST ──────────────────────────────────────────────────────────

bullsRouter.get(
  '/org/farms/:farmId/bulls',
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
      const result = await listBulls(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ────────────────────────────────────────────────────────

bullsRouter.post(
  '/org/farms/:farmId/bulls',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createBull(ctx, req.params.farmId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_BULL',
        targetType: 'bull',
        targetId: result.id,
        metadata: {
          name: result.name,
          breedName: result.breedName,
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

// ─── GET ───────────────────────────────────────────────────────────

bullsRouter.get(
  '/org/farms/:farmId/bulls/:bullId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getBull(ctx, req.params.farmId as string, req.params.bullId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ────────────────────────────────────────────────────────

bullsRouter.patch(
  '/org/farms/:farmId/bulls/:bullId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateBull(
        ctx,
        req.params.farmId as string,
        req.params.bullId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_BULL',
        targetType: 'bull',
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

// ─── DELETE (soft) ─────────────────────────────────────────────────

bullsRouter.delete(
  '/org/farms/:farmId/bulls/:bullId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteBull(ctx, req.params.farmId as string, req.params.bullId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_BULL',
        targetType: 'bull',
        targetId: req.params.bullId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Touro excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE SEMEN BATCH (CA4) ─────────────────────────────────────

bullsRouter.post(
  '/org/farms/:farmId/bulls/:bullId/semen-batches',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createSemenBatch(
        ctx,
        req.params.farmId as string,
        req.params.bullId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_SEMEN_BATCH',
        targetType: 'semen_batch',
        targetId: result.id,
        metadata: {
          bullId: req.params.bullId as string,
          batchNumber: result.batchNumber,
          initialDoses: result.initialDoses,
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

// ─── UPDATE SEMEN BATCH ───────────────────────────────────────────

bullsRouter.patch(
  '/org/farms/:farmId/bulls/semen-batches/:batchId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateSemenBatch(ctx, req.params.batchId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_SEMEN_BATCH',
        targetType: 'semen_batch',
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

// ─── USE SEMEN (CA4) ──────────────────────────────────────────────

bullsRouter.post(
  '/org/farms/:farmId/bulls/semen-batches/:batchId/use',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { dosesUsed } = req.body as { dosesUsed: number };
      const result = await useSemen(ctx, req.params.batchId as string, dosesUsed);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'USE_SEMEN',
        targetType: 'semen_batch',
        targetId: result.id,
        metadata: {
          dosesUsed,
          remainingDoses: result.currentDoses,
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

// ─── USAGE HISTORY (CA6) ──────────────────────────────────────────

bullsRouter.get(
  '/org/farms/:farmId/bulls/:bullId/usage-history',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getBullUsageHistory(ctx, req.params.bullId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
