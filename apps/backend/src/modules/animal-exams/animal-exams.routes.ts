import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { AnimalExamError } from './animal-exams.types';
import { MAX_EXAM_FILE_SIZE, ACCEPTED_EXAM_EXTENSIONS } from './exam-file-parser';
import {
  createExamType,
  listExamTypes,
  getExamType,
  updateExamType,
  deleteExamType,
  createAnimalExam,
  bulkExam,
  listAnimalExams,
  getAnimalExam,
  updateAnimalExam,
  deleteAnimalExam,
  recordResults,
  getExamIndicators,
  exportExamsCsv,
  uploadExamReport,
  getExamReportFile,
  importExamResults,
} from './animal-exams.service';

export const animalExamsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new AnimalExamError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof AnimalExamError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('AnimalExam error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ═══════════════════════════════════════════════════════════════════
// EXAM TYPES (org-scoped, no farmId)
// ═══════════════════════════════════════════════════════════════════

// ─── CREATE EXAM TYPE ───────────────────────────────────────────────

animalExamsRouter.post(
  '/org/exam-types',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createExamType(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_EXAM_TYPE',
        targetType: 'exam_type',
        targetId: result.id,
        metadata: { name: result.name },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST EXAM TYPES ────────────────────────────────────────────────

animalExamsRouter.get(
  '/org/exam-types',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        category: req.query.category as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listExamTypes(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET EXAM TYPE ──────────────────────────────────────────────────

animalExamsRouter.get(
  '/org/exam-types/:examTypeId',
  authenticate,
  checkPermission('animals:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getExamType(ctx, req.params.examTypeId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE EXAM TYPE ───────────────────────────────────────────────

animalExamsRouter.patch(
  '/org/exam-types/:examTypeId',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateExamType(ctx, req.params.examTypeId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_EXAM_TYPE',
        targetType: 'exam_type',
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

// ─── DELETE EXAM TYPE ───────────────────────────────────────────────

animalExamsRouter.delete(
  '/org/exam-types/:examTypeId',
  authenticate,
  checkPermission('animals:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteExamType(ctx, req.params.examTypeId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_EXAM_TYPE',
        targetType: 'exam_type',
        targetId: req.params.examTypeId as string,
        metadata: {},
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Tipo de exame excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// ANIMAL EXAMS (farm-scoped)
// ═══════════════════════════════════════════════════════════════════

// ─── BULK EXAM (before :examId routes) ──────────────────────────────

animalExamsRouter.post(
  '/org/farms/:farmId/animal-exams/bulk',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await bulkExam(ctx, req.params.farmId as string, req.user!.userId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'BULK_EXAM',
        targetType: 'animal_exam',
        targetId: result.campaignId,
        metadata: {
          campaignId: result.campaignId,
          animalCount: result.animalCount,
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

// ─── INDICATORS (CA12) ─────────────────────────────────────────────

animalExamsRouter.get(
  '/org/farms/:farmId/animal-exams/indicators',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getExamIndicators(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── EXPORT CSV ─────────────────────────────────────────────────────

animalExamsRouter.get(
  '/org/farms/:farmId/animal-exams/export',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        animalId: req.query.animalId as string | undefined,
        examTypeId: req.query.examTypeId as string | undefined,
        status: req.query.status as string | undefined,
      };
      const csv = await exportExamsCsv(ctx, req.params.farmId as string, query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="exames.csv"');
      res.send(csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── LIST ───────────────────────────────────────────────────────────

animalExamsRouter.get(
  '/org/farms/:farmId/animal-exams',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        animalId: req.query.animalId as string | undefined,
        examTypeId: req.query.examTypeId as string | undefined,
        status: req.query.status as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listAnimalExams(ctx, req.params.farmId as string, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────

animalExamsRouter.post(
  '/org/farms/:farmId/animal-exams',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createAnimalExam(
        ctx,
        req.params.farmId as string,
        req.user!.userId,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_ANIMAL_EXAM',
        targetType: 'animal_exam',
        targetId: result.id,
        metadata: {
          animalId: result.animalId,
          examTypeName: result.examTypeName,
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

// ─── GET ────────────────────────────────────────────────────────────

animalExamsRouter.get(
  '/org/farms/:farmId/animal-exams/:examId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getAnimalExam(
        ctx,
        req.params.farmId as string,
        req.params.examId as string,
      );
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── UPDATE ─────────────────────────────────────────────────────────

animalExamsRouter.patch(
  '/org/farms/:farmId/animal-exams/:examId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await updateAnimalExam(
        ctx,
        req.params.farmId as string,
        req.params.examId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_ANIMAL_EXAM',
        targetType: 'animal_exam',
        targetId: result.id,
        metadata: { changes: Object.keys(req.body), farmId: req.params.farmId as string },
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

// ─── RECORD RESULTS (CA4) ──────────────────────────────────────────

animalExamsRouter.post(
  '/org/farms/:farmId/animal-exams/:examId/results',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await recordResults(
        ctx,
        req.params.farmId as string,
        req.params.examId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'RECORD_EXAM_RESULTS',
        targetType: 'animal_exam',
        targetId: result.id,
        metadata: {
          resultsCount: result.results.length,
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

// ─── DELETE ─────────────────────────────────────────────────────────

animalExamsRouter.delete(
  '/org/farms/:farmId/animal-exams/:examId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteAnimalExam(ctx, req.params.farmId as string, req.params.examId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_ANIMAL_EXAM',
        targetType: 'animal_exam',
        targetId: req.params.examId as string,
        metadata: { farmId: req.params.farmId as string },
        ipAddress: getClientIp(req),
        farmId: req.params.farmId as string,
        organizationId: ctx.organizationId,
      });

      res.json({ message: 'Exame excluído com sucesso' });
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// CA6: UPLOAD / DOWNLOAD REPORT
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

animalExamsRouter.post(
  '/org/farms/:farmId/animal-exams/:examId/report',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
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
        const result = await uploadExamReport(
          ctx,
          req.params.farmId as string,
          req.params.examId as string,
          req.file,
        );

        void logAudit({
          actorId: req.user!.userId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          action: 'UPLOAD_EXAM_REPORT',
          targetType: 'animal_exam',
          targetId: result.id,
          metadata: { fileName: req.file.originalname, farmId: req.params.farmId as string },
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

animalExamsRouter.get(
  '/org/farms/:farmId/animal-exams/:examId/report',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const { buffer, filename, mimetype } = await getExamReportFile(
        ctx,
        req.params.farmId as string,
        req.params.examId as string,
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
// CA11: IMPORT RESULTS FROM CSV/EXCEL
// ═══════════════════════════════════════════════════════════════════

const examImportUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_EXAM_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ((ACCEPTED_EXAM_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato não suportado. Aceitos: ${ACCEPTED_EXAM_EXTENSIONS.join(', ')}`));
    }
  },
});

animalExamsRouter.post(
  '/org/farms/:farmId/animal-exams/import-results',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  (req, res) => {
    examImportUpload.single('file')(req, res, async (uploadErr: unknown) => {
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
        const resultDate = (req.body as Record<string, string>).resultDate;
        const result = await importExamResults(
          ctx,
          req.params.farmId as string,
          req.file,
          resultDate,
        );

        void logAudit({
          actorId: req.user!.userId,
          actorEmail: req.user!.email,
          actorRole: req.user!.role,
          action: 'IMPORT_EXAM_RESULTS',
          targetType: 'animal_exam',
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
