import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { FeedIngredientError } from './feed-ingredients.types';
import { MAX_IMPORT_FILE_SIZE, ACCEPTED_IMPORT_EXTENSIONS } from './analysis-file-parser';
import {
  createFeedIngredient,
  listFeedIngredients,
  getFeedIngredient,
  updateFeedIngredient,
  deleteFeedIngredient,
  createAnalysis,
  listAnalyses,
  getAnalysis,
  updateAnalysis,
  deleteAnalysis,
  getLatestAnalysis,
  compareWithReference,
  importAnalysesCsv,
  getQualityTrend,
  uploadAnalysisReport,
  getAnalysisReportFile,
  exportIngredientsCsv,
  exportAnalysesCsv,
} from './feed-ingredients.service';

export const feedIngredientsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new FeedIngredientError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof FeedIngredientError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('FeedIngredient error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ═══════════════════════════════════════════════════════════════════
// FEED INGREDIENTS (CA1 + CA2)
// ═══════════════════════════════════════════════════════════════════

// ─── CREATE ─────────────────────────────────────────────────────────

feedIngredientsRouter.post(
  '/org/feed-ingredients',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createFeedIngredient(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_FEED_INGREDIENT',
        targetType: 'feed_ingredient',
        targetId: result.id,
        metadata: { name: result.name, type: result.type },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

feedIngredientsRouter.get(
  '/org/feed-ingredients',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listFeedIngredients(ctx, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        type: req.query.type as string | undefined,
        subtype: req.query.subtype as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT CSV ─────────────────────────────────────────────────────

feedIngredientsRouter.get(
  '/org/feed-ingredients/export',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportIngredientsCsv(ctx);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="alimentos-ingredientes.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ────────────────────────────────────────────────────────────

feedIngredientsRouter.get(
  '/org/feed-ingredients/:id',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getFeedIngredient(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

feedIngredientsRouter.put(
  '/org/feed-ingredients/:id',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateFeedIngredient(ctx, req.params.id as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_FEED_INGREDIENT',
        targetType: 'feed_ingredient',
        targetId: result.id,
        metadata: { name: result.name, changes: Object.keys(req.body) },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE (soft) ──────────────────────────────────────────────────

feedIngredientsRouter.delete(
  '/org/feed-ingredients/:id',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteFeedIngredient(ctx, req.params.id as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_FEED_INGREDIENT',
        targetType: 'feed_ingredient',
        targetId: req.params.id as string,
        metadata: {},
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// BROMATOLOGICAL ANALYSES (CA3 + CA4)
// ═══════════════════════════════════════════════════════════════════

// ─── CREATE ANALYSIS ────────────────────────────────────────────────

feedIngredientsRouter.post(
  '/org/bromatological-analyses',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createAnalysis(ctx, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_BROMATOLOGICAL_ANALYSIS',
        targetType: 'bromatological_analysis',
        targetId: result.id,
        metadata: {
          feedIngredientId: result.feedIngredientId,
          feedIngredientName: result.feedIngredientName,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ANALYSES ──────────────────────────────────────────────────

feedIngredientsRouter.get(
  '/org/bromatological-analyses',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listAnalyses(ctx, {
        feedIngredientId: req.query.feedIngredientId as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT ANALYSES CSV ────────────────────────────────────────────

feedIngredientsRouter.get(
  '/org/bromatological-analyses/export',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const csv = await exportAnalysesCsv(ctx, req.query.feedIngredientId as string | undefined);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="analises-bromatologicas.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET ANALYSIS ───────────────────────────────────────────────────

feedIngredientsRouter.get(
  '/org/bromatological-analyses/:analysisId',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getAnalysis(ctx, req.params.analysisId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ANALYSIS ────────────────────────────────────────────────

feedIngredientsRouter.patch(
  '/org/bromatological-analyses/:analysisId',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateAnalysis(ctx, req.params.analysisId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_BROMATOLOGICAL_ANALYSIS',
        targetType: 'bromatological_analysis',
        targetId: result.id,
        metadata: { changes: Object.keys(req.body) },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE ANALYSIS ────────────────────────────────────────────────

feedIngredientsRouter.delete(
  '/org/bromatological-analyses/:analysisId',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteAnalysis(ctx, req.params.analysisId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_BROMATOLOGICAL_ANALYSIS',
        targetType: 'bromatological_analysis',
        targetId: req.params.analysisId as string,
        metadata: {},
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Análise bromatológica excluída com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// CA4: Latest analysis for diet calculation
// ═══════════════════════════════════════════════════════════════════

feedIngredientsRouter.get(
  '/org/feed-ingredients/:id/latest-analysis',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getLatestAnalysis(ctx, req.params.id as string);
      if (!result) {
        res.json(null);
        return;
      }
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// CA5: Compare analysis with reference values
// ═══════════════════════════════════════════════════════════════════

feedIngredientsRouter.get(
  '/org/bromatological-analyses/:analysisId/compare',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await compareWithReference(ctx, req.params.analysisId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// CA7: Quality trend
// ═══════════════════════════════════════════════════════════════════

feedIngredientsRouter.get(
  '/org/feed-ingredients/:id/quality-trend',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getQualityTrend(ctx, req.params.id as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// CA3: Upload report PDF
// ═══════════════════════════════════════════════════════════════════

const ACCEPTED_REPORT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_REPORT_SIZE = 10 * 1024 * 1024; // 10 MB

const reportUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_REPORT_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ACCEPTED_REPORT_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato não suportado. Aceitos: ${ACCEPTED_REPORT_EXTENSIONS.join(', ')}`));
    }
  },
});

feedIngredientsRouter.post(
  '/org/bromatological-analyses/:analysisId/report',
  authenticate,
  checkPermission('animals:update'),
  (req, res) => {
    reportUpload.single('file')(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        if (uploadErr instanceof multer.MulterError) {
          res.status(400).json({
            error:
              uploadErr.code === 'LIMIT_FILE_SIZE'
                ? 'Arquivo excede o limite de 10 MB'
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
        const result = await uploadAnalysisReport(ctx, req.params.analysisId as string, req.file);

        void logAudit({
          actorId: req.user!.userId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          action: 'UPLOAD_ANALYSIS_REPORT',
          targetType: 'bromatological_analysis',
          targetId: result.id,
          metadata: { fileName: req.file.originalname },
          ipAddress: getClientIp(req),
          organizationId: ctx.organizationId,
        });

        res.json(result);
      } catch (err) {
        handleError(err, res);
      }
    });
  },
);

feedIngredientsRouter.get(
  '/org/bromatological-analyses/:analysisId/report',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { buffer, filename, mimetype } = await getAnalysisReportFile(
        ctx,
        req.params.analysisId as string,
      );

      res.setHeader('Content-Type', mimetype);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// CA6: Import analyses from CSV/Excel
// ═══════════════════════════════════════════════════════════════════

const importUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMPORT_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ((ACCEPTED_IMPORT_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato não suportado. Aceitos: ${ACCEPTED_IMPORT_EXTENSIONS.join(', ')}`));
    }
  },
});

feedIngredientsRouter.post(
  '/org/bromatological-analyses/import',
  authenticate,
  checkPermission('animals:update'),
  (req, res) => {
    importUpload.single('file')(req, res, async (uploadErr: unknown) => {
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
        const result = await importAnalysesCsv(ctx, req.user!.userId, req.file);

        void logAudit({
          actorId: req.user!.userId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          action: 'IMPORT_BROMATOLOGICAL_ANALYSES',
          targetType: 'bromatological_analysis',
          targetId: 'bulk-import',
          metadata: {
            fileName: req.file.originalname,
            imported: result.imported,
            skipped: result.skipped,
          },
          ipAddress: getClientIp(req),
          organizationId: ctx.organizationId,
        });

        res.json(result);
      } catch (err) {
        handleError(err, res);
      }
    });
  },
);
