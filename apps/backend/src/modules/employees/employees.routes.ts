import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { EmployeeError } from './employees.types';
import {
  createEmployee,
  listEmployees,
  getEmployee,
  updateEmployee,
  transitionEmployeeStatus,
  addDependent,
  removeDependent,
  addFarmAssociation,
  removeFarmAssociation,
  uploadDocument,
  deleteDocument,
  getSalaryHistory,
} from './employees.service';
import {
  uploadAndParse,
  previewBulkImport,
  confirmBulkImport,
  generateTemplate,
} from './employee-bulk-import.service';

export const employeesRouter = Router();

const base = '/org/:orgId/employees';

// ─── Helpers ──────────────────────────────────────────────────────────

function buildRlsContext(req: Request): RlsContext {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new EmployeeError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId, userId: req.user?.userId };
}

function handleError(err: unknown, res: Response): void {
  if (err instanceof EmployeeError) {
    res.status(err.statusCode).json({ error: err.message, ...err.data });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── Multer — bulk import (memoryStorage) ──────────────────────────

const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (
      ext.endsWith('.csv') ||
      ext.endsWith('.xlsx') ||
      ext.endsWith('.xls') ||
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use CSV ou XLSX.'));
    }
  },
});

// ─── Multer — document upload (diskStorage) ────────────────────────

const docStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const orgId = (req.params.orgId as string) ?? req.user?.organizationId ?? 'unknown';
    const employeeId = (req.params.id as string) ?? 'unknown';
    const dir = path.join('uploads', 'employees', orgId, employeeId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const ext = file.originalname.toLowerCase();
    if (
      allowed.includes(file.mimetype) ||
      ext.endsWith('.pdf') ||
      ext.endsWith('.jpg') ||
      ext.endsWith('.jpeg') ||
      ext.endsWith('.png')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Use PDF, JPG ou PNG.'));
    }
  },
});

// ─── GET /org/:orgId/employees ─────────────────────────────────────

employeesRouter.get(base, authenticate, checkPermission('employees:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const result = await listEmployees(ctx, {
      status: req.query.status as string | undefined,
      farmId: req.query.farmId as string | undefined,
      positionId: req.query.positionId as string | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── POST /org/:orgId/employees ────────────────────────────────────

employeesRouter.post(base, authenticate, checkPermission('employees:create'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const result = await createEmployee(ctx, req.body);
    res.status(201).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// ─── GET /org/:orgId/employees/bulk/template ──────────────────────

employeesRouter.get(
  `${base}/bulk/template`,
  authenticate,
  checkPermission('employees:read'),
  async (_req, res) => {
    try {
      const buffer = await generateTemplate();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', 'attachment; filename="template-colaboradores.xlsx"');
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/employees/bulk/upload ────────────────────────

employeesRouter.post(
  `${base}/bulk/upload`,
  authenticate,
  checkPermission('employees:create'),
  bulkUpload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Nenhum arquivo enviado' });
        return;
      }
      const ctx = buildRlsContext(req);
      const result = await uploadAndParse(ctx, req.file);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/employees/bulk/preview ──────────────────────

employeesRouter.post(
  `${base}/bulk/preview`,
  authenticate,
  checkPermission('employees:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await previewBulkImport(ctx, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/employees/bulk/confirm ──────────────────────

employeesRouter.post(
  `${base}/bulk/confirm`,
  authenticate,
  checkPermission('employees:create'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await confirmBulkImport(ctx, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/employees/:id ────────────────────────────────

employeesRouter.get(
  `${base}/:id`,
  authenticate,
  checkPermission('employees:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const employee = await getEmployee(ctx, id);
      res.json(employee);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PUT /org/:orgId/employees/:id ────────────────────────────────

employeesRouter.put(
  `${base}/:id`,
  authenticate,
  checkPermission('employees:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const result = await updateEmployee(ctx, id, req.body);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/employees/:id/status ───────────────────────

employeesRouter.patch(
  `${base}/:id/status`,
  authenticate,
  checkPermission('employees:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const employee = await transitionEmployeeStatus(ctx, id, req.body);
      res.json(employee);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/employees/:id/dependents ────────────────────

employeesRouter.post(
  `${base}/:id/dependents`,
  authenticate,
  checkPermission('employees:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const employeeId = req.params.id as string;
      const dependent = await addDependent(ctx, employeeId, req.body);
      res.status(201).json(dependent);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/employees/:id/dependents/:depId ───────────

employeesRouter.delete(
  `${base}/:id/dependents/:depId`,
  authenticate,
  checkPermission('employees:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const depId = req.params.depId as string;
      await removeDependent(ctx, depId);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/employees/:id/farms ─────────────────────────

employeesRouter.post(
  `${base}/:id/farms`,
  authenticate,
  checkPermission('employees:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const employeeId = req.params.id as string;
      const assoc = await addFarmAssociation(ctx, employeeId, req.body);
      res.status(201).json(assoc);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/:orgId/employees/:id/farms/:farmAssocId ───────────

employeesRouter.patch(
  `${base}/:id/farms/:farmAssocId`,
  authenticate,
  checkPermission('employees:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmAssocId = req.params.farmAssocId as string;
      const assoc = await removeFarmAssociation(ctx, farmAssocId);
      res.json(assoc);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /org/:orgId/employees/:id/documents ─────────────────────

employeesRouter.post(
  `${base}/:id/documents`,
  authenticate,
  checkPermission('employees:update'),
  docUpload.single('file'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const employeeId = req.params.id as string;

      if (!req.file) {
        res.status(400).json({ error: 'Nenhum arquivo enviado' });
        return;
      }

      const documentType = req.body.documentType as string;
      if (!documentType) {
        res.status(400).json({ error: 'Tipo de documento é obrigatório' });
        return;
      }

      const doc = await uploadDocument(ctx, employeeId, req.file, {
        documentType: documentType as 'RG' | 'CPF' | 'CTPS' | 'ASO' | 'CONTRATO' | 'OUTRO',
      });
      res.status(201).json(doc);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/:orgId/employees/:id/documents/:docId ────────────

employeesRouter.delete(
  `${base}/:id/documents/:docId`,
  authenticate,
  checkPermission('employees:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const docId = req.params.docId as string;
      await deleteDocument(ctx, docId);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/:orgId/employees/:id/salary-history ─────────────────

employeesRouter.get(
  `${base}/:id/salary-history`,
  authenticate,
  checkPermission('employees:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const history = await getSalaryHistory(ctx, id);
      res.json(history);
    } catch (err) {
      handleError(err, res);
    }
  },
);
