import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';
import { EpiDeliveryError } from './epi-deliveries.types';
import {
  createEpiDelivery,
  deleteEpiDelivery,
  listEpiDeliveries,
  getEpiDelivery,
  listEmployeeDeliveries,
  generateEpiFichaPdf,
} from './epi-deliveries.service';

const epiDeliveriesRouter = Router();
export default epiDeliveriesRouter;

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new EpiDeliveryError('Acesso negado: usuário sem organização vinculada', 'UNAUTHORIZED');
  }
  return { organizationId };
}

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof EpiDeliveryError) {
    const status = err.code === 'NOT_FOUND' ? 404 : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  console.error('EpiDeliveryError não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── GET /epi-deliveries/employees/:employeeId/pdf (BEFORE /:id) ────

epiDeliveriesRouter.get(
  '/epi-deliveries/employees/:employeeId/pdf',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const employeeId = req.params.employeeId as string;
      const buffer = await generateEpiFichaPdf(ctx, employeeId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ficha-epi-${employeeId}.pdf"`);
      res.send(buffer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /epi-deliveries/employees/:employeeId (BEFORE /:id) ────────

epiDeliveriesRouter.get(
  '/epi-deliveries/employees/:employeeId',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const employeeId = req.params.employeeId as string;
      const result = await listEmployeeDeliveries(ctx, employeeId);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /epi-deliveries ─────────────────────────────────────────────

epiDeliveriesRouter.get(
  '/epi-deliveries',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const query = {
        employeeId: req.query.employeeId as string | undefined,
        epiType: req.query.epiType as string | undefined,
        reason: req.query.reason as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const result = await listEpiDeliveries(ctx, query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── POST /epi-deliveries ────────────────────────────────────────────

epiDeliveriesRouter.post(
  '/epi-deliveries',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await createEpiDelivery(ctx, req.body);
      res.status(201).json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── GET /epi-deliveries/:id ─────────────────────────────────────────

epiDeliveriesRouter.get(
  '/epi-deliveries/:id',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      const result = await getEpiDelivery(ctx, id);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── DELETE /epi-deliveries/:id ──────────────────────────────────────

epiDeliveriesRouter.delete(
  '/epi-deliveries/:id',
  authenticate,
  checkPermission('farms:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const id = req.params.id as string;
      await deleteEpiDelivery(ctx, id);
      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  },
);
