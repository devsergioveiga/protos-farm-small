import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import {
  createProducer,
  listProducers,
  getProducer,
  updateProducer,
  toggleProducerStatus,
  addParticipant,
  updateParticipant,
  deleteParticipant,
  addIe,
  updateIe,
  deleteIe,
  setDefaultIeForFarm,
  addFarmLink,
  listFarmLinks,
  updateFarmLink,
  deleteFarmLink,
  getProducersByFarm,
  validateFarmParticipation,
  getItrDeclarant,
  setItrDeclarant,
  getExpiringContracts,
} from './producers.service';
import { ProducerError } from './producers.types';

export const producersRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  return { organizationId: req.user!.organizationId };
}

function handleError(err: unknown, res: import('express').Response) {
  if (err instanceof ProducerError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── CRUD Producers ─────────────────────────────────────────────────

// POST /org/producers
producersRouter.post(
  '/org/producers',
  authenticate,
  checkPermission('producers:create'),
  async (req, res) => {
    try {
      const { name, type } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Nome é obrigatório' });
        return;
      }

      if (!type) {
        res.status(400).json({ error: 'Tipo é obrigatório' });
        return;
      }

      const ctx = buildRlsContext(req);
      const producer = await createProducer(ctx, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_PRODUCER',
        targetType: 'producer',
        targetId: producer.id,
        metadata: { name, type },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(producer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/producers
producersRouter.get(
  '/org/producers',
  authenticate,
  checkPermission('producers:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const page = req.query.page ? Number(req.query.page as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit as string) : undefined;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;

      const result = await listProducers(ctx, { page, limit, search, status, type });
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/producers/:producerId
producersRouter.get(
  '/org/producers/:producerId',
  authenticate,
  checkPermission('producers:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const producer = await getProducer(ctx, req.params.producerId as string);
      res.json(producer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/producers/:producerId
producersRouter.patch(
  '/org/producers/:producerId',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const producer = await updateProducer(ctx, req.params.producerId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_PRODUCER',
        targetType: 'producer',
        targetId: req.params.producerId as string,
        metadata: req.body,
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(producer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/producers/:producerId/status
producersRouter.patch(
  '/org/producers/:producerId/status',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
        res.status(400).json({ error: 'Status deve ser ACTIVE ou INACTIVE' });
        return;
      }

      const ctx = buildRlsContext(req);
      const producer = await toggleProducerStatus(ctx, req.params.producerId as string, status);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_PRODUCER_STATUS',
        targetType: 'producer',
        targetId: req.params.producerId as string,
        metadata: { status },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(producer);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Society Participants ───────────────────────────────────────────

// POST /org/producers/:producerId/participants
producersRouter.post(
  '/org/producers/:producerId/participants',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const { name, cpf, participationPct } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Nome é obrigatório' });
        return;
      }
      if (!cpf) {
        res.status(400).json({ error: 'CPF é obrigatório' });
        return;
      }
      if (participationPct == null) {
        res.status(400).json({ error: 'Percentual de participação é obrigatório' });
        return;
      }

      const ctx = buildRlsContext(req);
      const participant = await addParticipant(ctx, req.params.producerId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'ADD_PRODUCER_PARTICIPANT',
        targetType: 'society_participant',
        targetId: participant.id,
        metadata: { producerId: req.params.producerId, name },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(participant);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/producers/:producerId/participants/:pid
producersRouter.patch(
  '/org/producers/:producerId/participants/:pid',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const participant = await updateParticipant(
        ctx,
        req.params.producerId as string,
        req.params.pid as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_PRODUCER_PARTICIPANT',
        targetType: 'society_participant',
        targetId: req.params.pid as string,
        metadata: { producerId: req.params.producerId, ...req.body },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(participant);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE /org/producers/:producerId/participants/:pid
producersRouter.delete(
  '/org/producers/:producerId/participants/:pid',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await deleteParticipant(
        ctx,
        req.params.producerId as string,
        req.params.pid as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_PRODUCER_PARTICIPANT',
        targetType: 'society_participant',
        targetId: req.params.pid as string,
        metadata: { producerId: req.params.producerId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── State Registrations (IEs) ──────────────────────────────────────

// POST /org/producers/:producerId/ies
producersRouter.post(
  '/org/producers/:producerId/ies',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const { number, state } = req.body;

      if (!number) {
        res.status(400).json({ error: 'Número da IE é obrigatório' });
        return;
      }
      if (!state) {
        res.status(400).json({ error: 'UF é obrigatória' });
        return;
      }

      const ctx = buildRlsContext(req);
      const ie = await addIe(ctx, req.params.producerId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'ADD_PRODUCER_IE',
        targetType: 'producer_state_registration',
        targetId: ie.id,
        metadata: { producerId: req.params.producerId, number, state },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(ie);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/producers/:producerId/ies/:ieId
producersRouter.patch(
  '/org/producers/:producerId/ies/:ieId',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const ie = await updateIe(
        ctx,
        req.params.producerId as string,
        req.params.ieId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_PRODUCER_IE',
        targetType: 'producer_state_registration',
        targetId: req.params.ieId as string,
        metadata: { producerId: req.params.producerId, ...req.body },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(ie);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE /org/producers/:producerId/ies/:ieId
producersRouter.delete(
  '/org/producers/:producerId/ies/:ieId',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await deleteIe(
        ctx,
        req.params.producerId as string,
        req.params.ieId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_PRODUCER_IE',
        targetType: 'producer_state_registration',
        targetId: req.params.ieId as string,
        metadata: { producerId: req.params.producerId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/producers/:producerId/ies/:ieId/default
producersRouter.patch(
  '/org/producers/:producerId/ies/:ieId/default',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const ie = await setDefaultIeForFarm(
        ctx,
        req.params.producerId as string,
        req.params.ieId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SET_DEFAULT_PRODUCER_IE',
        targetType: 'producer_state_registration',
        targetId: req.params.ieId as string,
        metadata: { producerId: req.params.producerId, farmId: ie.farmId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(ie);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Farm Links ─────────────────────────────────────────────────────

// POST /org/producers/:producerId/farms
producersRouter.post(
  '/org/producers/:producerId/farms',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const { farmId, bondType } = req.body;

      if (!farmId) {
        res.status(400).json({ error: 'ID da fazenda é obrigatório' });
        return;
      }
      if (!bondType) {
        res.status(400).json({ error: 'Tipo de vínculo é obrigatório' });
        return;
      }

      const ctx = buildRlsContext(req);
      const link = await addFarmLink(ctx, req.params.producerId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'ADD_PRODUCER_FARM_LINK',
        targetType: 'producer_farm_link',
        targetId: link.id,
        metadata: { producerId: req.params.producerId, farmId, bondType },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.status(201).json(link);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/producers/:producerId/farms
producersRouter.get(
  '/org/producers/:producerId/farms',
  authenticate,
  checkPermission('producers:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const links = await listFarmLinks(ctx, req.params.producerId as string);
      res.json(links);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// PATCH /org/producers/:producerId/farms/:linkId
producersRouter.patch(
  '/org/producers/:producerId/farms/:linkId',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const link = await updateFarmLink(
        ctx,
        req.params.producerId as string,
        req.params.linkId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_PRODUCER_FARM_LINK',
        targetType: 'producer_farm_link',
        targetId: req.params.linkId as string,
        metadata: { producerId: req.params.producerId, ...req.body },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(link);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// DELETE /org/producers/:producerId/farms/:linkId
producersRouter.delete(
  '/org/producers/:producerId/farms/:linkId',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await deleteFarmLink(
        ctx,
        req.params.producerId as string,
        req.params.linkId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_PRODUCER_FARM_LINK',
        targetType: 'producer_farm_link',
        targetId: req.params.linkId as string,
        metadata: { producerId: req.params.producerId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── ITR Declarant ──────────────────────────────────────────────────

// PATCH /org/producers/:producerId/farms/:linkId/itr-declarant
producersRouter.patch(
  '/org/producers/:producerId/farms/:linkId/itr-declarant',
  authenticate,
  checkPermission('producers:update'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const link = await setItrDeclarant(
        ctx,
        req.params.producerId as string,
        req.params.linkId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'SET_ITR_DECLARANT',
        targetType: 'producer_farm_link',
        targetId: req.params.linkId as string,
        metadata: { producerId: req.params.producerId, farmId: link.farm.id },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
      });

      res.json(link);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Reverse: Farm → Producers ──────────────────────────────────────

// GET /org/farms/:farmId/producers
producersRouter.get(
  '/org/farms/:farmId/producers',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const links = await getProducersByFarm(ctx, req.params.farmId as string);
      res.json(links);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/farms/:farmId/participation
producersRouter.get(
  '/org/farms/:farmId/participation',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await validateFarmParticipation(ctx, req.params.farmId as string);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// GET /org/farms/:farmId/itr-declarant
producersRouter.get(
  '/org/farms/:farmId/itr-declarant',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const link = await getItrDeclarant(ctx, req.params.farmId as string);
      res.json(link);
    } catch (err) {
      handleError(err, res);
    }
  },
);

// ─── Expiring Contracts ─────────────────────────────────────────────

// GET /org/contracts/expiring
producersRouter.get(
  '/org/contracts/expiring',
  authenticate,
  checkPermission('producers:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const days = req.query.days ? Number(req.query.days as string) : 30;
      if (isNaN(days) || days < 1 || days > 365) {
        res.status(400).json({ error: 'Parâmetro days deve ser entre 1 e 365' });
        return;
      }
      const result = await getExpiringContracts(ctx, days);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
