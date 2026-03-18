import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { PrescriptionError } from './pesticide-prescriptions.types';
import {
  createPrescription,
  listPrescriptions,
  getPrescription,
  updatePrescription,
  cancelPrescription,
  generatePrescriptionPdf,
  prescriptionsToCsv,
} from './pesticide-prescriptions.service';

export const pesticidePrescriptionsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new PrescriptionError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof PrescriptionError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('PrescriptionError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── POST /org/farms/:farmId/pesticide-prescriptions ────────────────

pesticidePrescriptionsRouter.post(
  '/org/farms/:farmId/pesticide-prescriptions',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await createPrescription(ctx, farmId, req.body, req.user!.userId);
      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_PRESCRIPTION',
        targetType: 'pesticide_prescription',
        targetId: result.id,
        metadata: { sequentialNumber: result.sequentialNumber },
        ipAddress: getClientIp(req),
      });
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/farms/:farmId/pesticide-prescriptions ─────────────────

pesticidePrescriptionsRouter.get(
  '/org/farms/:farmId/pesticide-prescriptions',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const query = {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        fieldPlotId: req.query.fieldPlotId as string | undefined,
      };
      const result = await listPrescriptions(ctx, farmId, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/farms/:farmId/pesticide-prescriptions/export/csv ──────
// NOTE: Must be before /:id to avoid route conflict

pesticidePrescriptionsRouter.get(
  '/org/farms/:farmId/pesticide-prescriptions/export/csv',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await listPrescriptions(ctx, farmId, { limit: 1000 });
      const csv = prescriptionsToCsv(result.data);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="receituarios.csv"');
      res.send('\uFEFF' + csv);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/farms/:farmId/pesticide-prescriptions/:id ─────────────

pesticidePrescriptionsRouter.get(
  '/org/farms/:farmId/pesticide-prescriptions/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const id = req.params.id as string;
      const result = await getPrescription(ctx, farmId, id);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── PATCH /org/farms/:farmId/pesticide-prescriptions/:id ───────────

pesticidePrescriptionsRouter.patch(
  '/org/farms/:farmId/pesticide-prescriptions/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const id = req.params.id as string;
      const result = await updatePrescription(ctx, farmId, id, req.body);
      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_PRESCRIPTION',
        targetType: 'pesticide_prescription',
        targetId: result.id,
        metadata: { sequentialNumber: result.sequentialNumber },
        ipAddress: getClientIp(req),
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /org/farms/:farmId/pesticide-prescriptions/:id ──────────

pesticidePrescriptionsRouter.delete(
  '/org/farms/:farmId/pesticide-prescriptions/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const id = req.params.id as string;
      const result = await cancelPrescription(ctx, farmId, id);
      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CANCEL_PRESCRIPTION',
        targetType: 'pesticide_prescription',
        targetId: result.id,
        metadata: { sequentialNumber: result.sequentialNumber },
        ipAddress: getClientIp(req),
      });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /org/farms/:farmId/pesticide-prescriptions/:id/pdf (CA6) ───

pesticidePrescriptionsRouter.get(
  '/org/farms/:farmId/pesticide-prescriptions/:id/pdf',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const id = req.params.id as string;
      const prescription = await getPrescription(ctx, farmId, id);
      const pdfBuffer = await generatePrescriptionPdf(ctx, farmId, id);

      const filename = `receituario_${String(prescription.sequentialNumber).padStart(6, '0')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);
