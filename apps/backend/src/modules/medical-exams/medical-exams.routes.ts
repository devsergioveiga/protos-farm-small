import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { MedicalExamError } from './medical-exams.types';
import {
  createMedicalExam,
  listMedicalExams,
  getMedicalExam,
  updateMedicalExam,
  deleteMedicalExam,
  getEmployeeExams,
} from './medical-exams.service';

export const medicalExamsRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new MedicalExamError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof MedicalExamError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('MedicalExamError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /medical-exams/employees/:employeeId — BEFORE /:id ─────────────────
// Note: path uses '/org/medical-exams/employees/:employeeId'. This is registered
// before the /:id route within this router to avoid ambiguity. In the full app,
// this route is distinct from the employees module's /org/:orgId/employees/:id
// because 'medical-exams' is a literal segment (not a parameterized orgId) and
// the route is registered via a medicalExamsRouter which uses /org/medical-exams/ prefix.

medicalExamsRouter.get(
  '/org/medical-exams/employees/:employeeId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const employeeId = req.params.employeeId as string;
      const exams = await getEmployeeExams(ctx, employeeId);
      res.json(exams);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /medical-exams ──────────────────────────────────────────────────────

medicalExamsRouter.get(
  '/org/medical-exams',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        employeeId: req.query.employeeId as string | undefined,
        type: req.query.type as string | undefined,
        result: req.query.result as string | undefined,
        expiryStatus: req.query.expiryStatus as string | undefined,
        farmId: req.query.farmId as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listMedicalExams(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /medical-exams/:id ──────────────────────────────────────────────────

medicalExamsRouter.get(
  '/org/medical-exams/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const exam = await getMedicalExam(ctx, id);
      res.json(exam);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /medical-exams ─────────────────────────────────────────────────────

medicalExamsRouter.post(
  '/org/medical-exams',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const createdBy = req.user!.userId;
      const exam = await createMedicalExam(ctx, req.body, createdBy);
      res.status(201).json(exam);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /medical-exams/:id ──────────────────────────────────────────────────

medicalExamsRouter.put(
  '/org/medical-exams/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const exam = await updateMedicalExam(ctx, id, req.body);
      res.json(exam);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /medical-exams/:id ───────────────────────────────────────────────

medicalExamsRouter.delete(
  '/org/medical-exams/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      await deleteMedicalExam(ctx, id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default medicalExamsRouter;
