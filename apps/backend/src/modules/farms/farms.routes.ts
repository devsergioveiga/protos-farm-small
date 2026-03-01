import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import {
  createFarm,
  listFarms,
  getFarm,
  updateFarm,
  toggleFarmStatus,
  getFarmLimit,
  addRegistration,
  updateRegistration,
  deleteRegistration,
} from './farms.service';
import { FarmError } from './farms.types';

export const farmsRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  return { organizationId: req.user!.organizationId };
}

// POST /org/farms
farmsRouter.post('/org/farms', authenticate, checkPermission('farms:create'), async (req, res) => {
  try {
    const { name, state, totalAreaHa } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Nome é obrigatório' });
      return;
    }

    if (!state) {
      res.status(400).json({ error: 'UF é obrigatória' });
      return;
    }

    if (totalAreaHa == null || totalAreaHa <= 0) {
      res.status(400).json({ error: 'Área total deve ser maior que zero' });
      return;
    }

    const ctx = buildRlsContext(req);
    const farm = await createFarm(ctx, req.user!.userId, req.body);

    void logAudit({
      actorId: req.user!.userId,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE_FARM',
      targetType: 'farm',
      targetId: farm.id,
      metadata: { name, state, totalAreaHa },
      ipAddress: getClientIp(req),
      organizationId: ctx.organizationId,
    });

    res.status(201).json(farm);
  } catch (err) {
    if (err instanceof FarmError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /org/farms/limit (MUST be before /:farmId)
farmsRouter.get(
  '/org/farms/limit',
  authenticate,
  checkPermission('farms:read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getFarmLimit(ctx);
      res.json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// GET /org/farms
farmsRouter.get('/org/farms', authenticate, checkPermission('farms:read'), async (req, res) => {
  try {
    const ctx = buildRlsContext(req);
    const page = req.query.page ? Number(req.query.page as string) : undefined;
    const limit = req.query.limit ? Number(req.query.limit as string) : undefined;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const state = req.query.state as string | undefined;

    const result = await listFarms(ctx, { page, limit, search, status, state });
    res.json(result);
  } catch (err) {
    if (err instanceof FarmError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /org/farms/:farmId
farmsRouter.get(
  '/org/farms/:farmId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farm = await getFarm(ctx, req.params.farmId as string);
      res.json(farm);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// PATCH /org/farms/:farmId
farmsRouter.patch(
  '/org/farms/:farmId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farm = await updateFarm(ctx, req.params.farmId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_FARM',
        targetType: 'farm',
        targetId: req.params.farmId as string,
        metadata: req.body,
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(farm);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// PATCH /org/farms/:farmId/status
farmsRouter.patch(
  '/org/farms/:farmId/status',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
        res.status(400).json({ error: 'Status deve ser ACTIVE ou INACTIVE' });
        return;
      }

      const ctx = buildRlsContext(req);
      const farm = await toggleFarmStatus(ctx, req.params.farmId as string, status);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_FARM_STATUS',
        targetType: 'farm',
        targetId: req.params.farmId as string,
        metadata: { status },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(farm);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// POST /org/farms/:farmId/registrations
farmsRouter.post(
  '/org/farms/:farmId/registrations',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const { number, cartorioName, comarca, state: regState, areaHa } = req.body;

      if (!number) {
        res.status(400).json({ error: 'Número da matrícula é obrigatório' });
        return;
      }
      if (!cartorioName) {
        res.status(400).json({ error: 'Nome do cartório é obrigatório' });
        return;
      }
      if (!comarca) {
        res.status(400).json({ error: 'Comarca é obrigatória' });
        return;
      }
      if (!regState) {
        res.status(400).json({ error: 'UF da matrícula é obrigatória' });
        return;
      }
      if (areaHa == null || areaHa <= 0) {
        res.status(400).json({ error: 'Área da matrícula deve ser maior que zero' });
        return;
      }

      const ctx = buildRlsContext(req);
      const registration = await addRegistration(ctx, req.params.farmId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'ADD_FARM_REGISTRATION',
        targetType: 'farm_registration',
        targetId: registration.id,
        metadata: { farmId: req.params.farmId, number },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.status(201).json(registration);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// PATCH /org/farms/:farmId/registrations/:regId
farmsRouter.patch(
  '/org/farms/:farmId/registrations/:regId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const registration = await updateRegistration(
        ctx,
        req.params.farmId as string,
        req.params.regId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_FARM_REGISTRATION',
        targetType: 'farm_registration',
        targetId: req.params.regId as string,
        metadata: { farmId: req.params.farmId, ...req.body },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(registration);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// DELETE /org/farms/:farmId/registrations/:regId
farmsRouter.delete(
  '/org/farms/:farmId/registrations/:regId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await deleteRegistration(
        ctx,
        req.params.farmId as string,
        req.params.regId as string,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_FARM_REGISTRATION',
        targetType: 'farm_registration',
        targetId: req.params.regId as string,
        metadata: { farmId: req.params.farmId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof FarmError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
