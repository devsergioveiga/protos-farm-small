import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { SafetyComplianceError } from './safety-compliance.types';
import {
  getComplianceSummary,
  listNonCompliantEmployees,
  getEmployeeCompliance,
  generateComplianceReportCsv,
  generateComplianceReportPdf,
} from './safety-compliance.service';

export const safetyComplianceRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new SafetyComplianceError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof SafetyComplianceError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('SafetyComplianceError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /safety-compliance/summary ─────────────────────────────────────────

safetyComplianceRouter.get(
  '/org/safety-compliance/summary',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.query.farmId as string | undefined;
      const summary = await getComplianceSummary(ctx, farmId);
      res.json(summary);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /safety-compliance/report/csv ──────────────────────────────────────

safetyComplianceRouter.get(
  '/org/safety-compliance/report/csv',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.query.farmId as string | undefined;
      const csvContent = await generateComplianceReportCsv(ctx, farmId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="conformidade-nr31.csv"');
      res.send(csvContent);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /safety-compliance/report/pdf ──────────────────────────────────────

safetyComplianceRouter.get(
  '/org/safety-compliance/report/pdf',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.query.farmId as string | undefined;
      const pdfBuffer = await generateComplianceReportPdf(ctx, farmId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="conformidade-nr31.pdf"');
      res.send(pdfBuffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /safety-compliance/employees/:employeeId ───────────────────────────

safetyComplianceRouter.get(
  '/org/safety-compliance/employees/:employeeId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const employeeId = req.params.employeeId as string;
      const compliance = await getEmployeeCompliance(ctx, employeeId);
      res.json(compliance);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /safety-compliance/employees ───────────────────────────────────────

safetyComplianceRouter.get(
  '/org/safety-compliance/employees',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        farmId: req.query.farmId as string | undefined,
        pendingType: req.query.pendingType as 'EPI' | 'TRAINING' | 'ASO' | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listNonCompliantEmployees(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

export default safetyComplianceRouter;
