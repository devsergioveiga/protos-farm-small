import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { TrainingRecordError } from './training-records.types';
import {
  createTrainingRecord,
  listTrainingRecords,
  getTrainingRecord,
  deleteTrainingRecord,
  generateCertificatePdf,
} from './training-records.service';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new TrainingRecordError(
      'Acesso negado: usuário sem organização vinculada',
      'UNAUTHORIZED',
    );
  }
  return { organizationId, userId: req.user?.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof TrainingRecordError) {
    const statusCode =
      err.code === 'NOT_FOUND' ||
      err.code === 'TRAINING_TYPE_NOT_FOUND' ||
      err.code === 'EMPLOYEE_NOT_FOUND' ||
      err.code === 'EMPLOYEE_NOT_IN_RECORD'
        ? 404
        : err.code === 'UNAUTHORIZED'
          ? 403
          : 400;
    res.status(statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /training-records ────────────────────────────────────────────

router.get(
  '/training-records',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        trainingTypeId: req.query.trainingTypeId as string | undefined,
        instructorType: req.query.instructorType as string | undefined,
        farmId: req.query.farmId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listTrainingRecords(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /training-records ───────────────────────────────────────────

router.post(
  '/training-records',
  authenticate,
  checkPermission('employees:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createTrainingRecord(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /training-records/:id ────────────────────────────────────────

router.get(
  '/training-records/:id',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const result = await getTrainingRecord(ctx, id);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /training-records/:id ────────────────────────────────────

router.delete(
  '/training-records/:id',
  authenticate,
  checkPermission('employees:manage'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      await deleteTrainingRecord(ctx, id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /training-records/:id/employees/:employeeId/certificate ──────

router.get(
  '/training-records/:id/employees/:employeeId/certificate',
  authenticate,
  checkPermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const employeeId = req.params.employeeId as string;
      const pdfBuffer = await generateCertificatePdf(ctx, id, employeeId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="certificado-treinamento-${id}-${employeeId}.pdf"`,
      );
      res.send(pdfBuffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default router;
