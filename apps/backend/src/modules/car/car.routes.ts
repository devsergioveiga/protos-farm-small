import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import {
  createCar,
  listCars,
  getCar,
  updateCar,
  deleteCar,
  uploadCarBoundary,
  getCarBoundary,
  deleteCarBoundary,
} from './car.service';
import { CarError, ALLOWED_GEO_EXTENSIONS, MAX_GEO_FILE_SIZE } from './car.types';

export const carRouter = Router();

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  return { organizationId: req.user!.organizationId };
}

// ─── Multer config for geo file uploads ─────────────────────────────

const geoUpload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_GEO_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ((ALLOWED_GEO_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Formato não suportado. Extensões aceitas: ${ALLOWED_GEO_EXTENSIONS.join(', ')}`),
      );
    }
  },
});

function handleGeoUpload(
  req: import('express').Request,
  res: import('express').Response,
): Promise<void> {
  return new Promise((resolve, reject) => {
    geoUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          res.status(400).json({
            error:
              err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo excede o limite de 10 MB' : err.message,
          });
        } else if (err instanceof Error) {
          res.status(400).json({ error: err.message });
        } else {
          reject(err);
        }
        resolve();
      } else {
        resolve();
      }
    });
  });
}

// ─── POST /org/farms/:farmId/car ─────────────────────────────────────

carRouter.post(
  '/org/farms/:farmId/car',
  authenticate,
  checkPermission('farms:create'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const car = await createCar(ctx, req.params.farmId as string, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_CAR',
        targetType: 'car_registration',
        targetId: car.id,
        metadata: { carCode: car.carCode, farmId: req.params.farmId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.status(201).json(car);
    } catch (err) {
      if (err instanceof CarError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── GET /org/farms/:farmId/car ──────────────────────────────────────

carRouter.get(
  '/org/farms/:farmId/car',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const cars = await listCars(ctx, req.params.farmId as string);
      res.json(cars);
    } catch (err) {
      if (err instanceof CarError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── GET /org/farms/:farmId/car/:carId ───────────────────────────────

carRouter.get(
  '/org/farms/:farmId/car/:carId',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const car = await getCar(ctx, req.params.farmId as string, req.params.carId as string);
      res.json(car);
    } catch (err) {
      if (err instanceof CarError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── PATCH /org/farms/:farmId/car/:carId ─────────────────────────────

carRouter.patch(
  '/org/farms/:farmId/car/:carId',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const car = await updateCar(
        ctx,
        req.params.farmId as string,
        req.params.carId as string,
        req.body,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_CAR',
        targetType: 'car_registration',
        targetId: car.id,
        metadata: { carCode: car.carCode, farmId: req.params.farmId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(car);
    } catch (err) {
      if (err instanceof CarError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── DELETE /org/farms/:farmId/car/:carId ────────────────────────────

carRouter.delete(
  '/org/farms/:farmId/car/:carId',
  authenticate,
  checkPermission('farms:delete'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteCar(ctx, req.params.farmId as string, req.params.carId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_CAR',
        targetType: 'car_registration',
        targetId: req.params.carId as string,
        metadata: { farmId: req.params.farmId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json({ message: 'CAR excluído com sucesso' });
    } catch (err) {
      if (err instanceof CarError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── POST /org/farms/:farmId/car/:carId/boundary ─────────────────────

carRouter.post(
  '/org/farms/:farmId/car/:carId/boundary',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    await handleGeoUpload(req, res);
    if (res.headersSent) return;
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Arquivo é obrigatório' });
        return;
      }

      const ctx = buildRlsContext(req);
      const result = await uploadCarBoundary(
        ctx,
        req.params.farmId as string,
        req.params.carId as string,
        req.file.buffer,
        req.file.originalname,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPLOAD_CAR_BOUNDARY',
        targetType: 'car_registration',
        targetId: req.params.carId as string,
        metadata: {
          filename: req.file.originalname,
          boundaryAreaHa: result.boundaryAreaHa,
          farmId: req.params.farmId,
        },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof CarError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      if (
        err instanceof Error &&
        (err.message.includes('Nenhum') ||
          err.message.includes('inválido') ||
          err.message.includes('mal-formado'))
      ) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── GET /org/farms/:farmId/car/:carId/boundary ──────────────────────

carRouter.get(
  '/org/farms/:farmId/car/:carId/boundary',
  authenticate,
  checkPermission('farms:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await getCarBoundary(
        ctx,
        req.params.farmId as string,
        req.params.carId as string,
      );
      res.json(result);
    } catch (err) {
      if (err instanceof CarError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ─── DELETE /org/farms/:farmId/car/:carId/boundary ───────────────────

carRouter.delete(
  '/org/farms/:farmId/car/:carId/boundary',
  authenticate,
  checkPermission('farms:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      await deleteCarBoundary(ctx, req.params.farmId as string, req.params.carId as string);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_CAR_BOUNDARY',
        targetType: 'car_registration',
        targetId: req.params.carId as string,
        metadata: { farmId: req.params.farmId },
        ipAddress: getClientIp(req),
        organizationId: ctx.organizationId,
        farmId: req.params.farmId as string,
      });

      res.json({ message: 'Perímetro do CAR removido com sucesso' });
    } catch (err) {
      if (err instanceof CarError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);
