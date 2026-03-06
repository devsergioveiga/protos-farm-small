import { Router } from 'express';
import path from 'path';
import multer, { memoryStorage } from 'multer';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import { checkFarmAccess } from '../../middleware/check-farm-access';
import { logAudit } from '../../shared/audit/audit.service';
import type { RlsContext } from '../../database/rls';
import { ALLOWED_GEO_EXTENSIONS, MAX_GEO_FILE_SIZE } from '../farms/farms.types';
import { FarmLocationError } from './farm-locations.types';
import {
  createLocation,
  listLocations,
  getLocation,
  updateLocation,
  softDeleteLocation,
  uploadLocationBoundary,
  getLocationBoundary,
  deleteLocationBoundary,
  getLocationOccupancy,
  listLocationsForMap,
} from './farm-locations.service';

export const farmLocationsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────

function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) {
    throw new FarmLocationError('Acesso negado: usuário sem organização vinculada', 403);
  }
  return { organizationId };
}

// ─── Multer config ──────────────────────────────────────────────────

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

// ─── Map endpoint (before :locationId to avoid conflict) ────────────

farmLocationsRouter.get(
  '/org/farms/:farmId/locations/map',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const result = await listLocationsForMap(ctx, farmId);
      res.json(result);
    } catch (err) {
      if (err instanceof FarmLocationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── Create ─────────────────────────────────────────────────────────

farmLocationsRouter.post(
  '/org/farms/:farmId/locations',
  authenticate,
  checkPermission('animals:create'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const location = await createLocation(ctx, farmId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'CREATE_LOCATION',
        targetType: 'farm_location',
        targetId: location.id,
        metadata: { farmId, name: location.name, type: location.type },
        ipAddress: getClientIp(req),
        farmId,
        organizationId: req.user!.organizationId!,
      });

      res.status(201).json(location);
    } catch (err) {
      if (err instanceof FarmLocationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── List ───────────────────────────────────────────────────────────

farmLocationsRouter.get(
  '/org/farms/:farmId/locations',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const query: import('./farm-locations.types').ListLocationsQuery = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        type: req.query.type as string | undefined as
          | import('./farm-locations.types').FarmLocationTypeValue
          | undefined,
        search: req.query.search as string | undefined,
        pastureStatus: req.query.pastureStatus as string | undefined as
          | import('./farm-locations.types').PastureStatusValue
          | undefined,
        facilityStatus: req.query.facilityStatus as string | undefined as
          | import('./farm-locations.types').FacilityStatusValue
          | undefined,
      };
      const result = await listLocations(ctx, farmId, query);
      res.json(result);
    } catch (err) {
      if (err instanceof FarmLocationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── Get ────────────────────────────────────────────────────────────

farmLocationsRouter.get(
  '/org/farms/:farmId/locations/:locationId',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const locationId = req.params.locationId as string;
      const location = await getLocation(ctx, farmId, locationId);
      res.json(location);
    } catch (err) {
      if (err instanceof FarmLocationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── Update ─────────────────────────────────────────────────────────

farmLocationsRouter.patch(
  '/org/farms/:farmId/locations/:locationId',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const locationId = req.params.locationId as string;
      const location = await updateLocation(ctx, farmId, locationId, req.body);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPDATE_LOCATION',
        targetType: 'farm_location',
        targetId: locationId,
        metadata: { farmId, changes: req.body },
        ipAddress: getClientIp(req),
        farmId,
        organizationId: req.user!.organizationId!,
      });

      res.json(location);
    } catch (err) {
      if (err instanceof FarmLocationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── Delete ─────────────────────────────────────────────────────────

farmLocationsRouter.delete(
  '/org/farms/:farmId/locations/:locationId',
  authenticate,
  checkPermission('animals:delete'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const locationId = req.params.locationId as string;
      await softDeleteLocation(ctx, farmId, locationId);

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'DELETE_LOCATION',
        targetType: 'farm_location',
        targetId: locationId,
        metadata: { farmId },
        ipAddress: getClientIp(req),
        farmId,
        organizationId: req.user!.organizationId!,
      });

      res.status(204).end();
    } catch (err) {
      if (err instanceof FarmLocationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── Upload Boundary ────────────────────────────────────────────────

farmLocationsRouter.post(
  '/org/farms/:farmId/locations/:locationId/boundary',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      await handleGeoUpload(req, res);
      if (res.headersSent) return;

      if (!req.file) {
        res.status(400).json({ error: 'Nenhum arquivo enviado' });
        return;
      }

      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const locationId = req.params.locationId as string;
      const result = await uploadLocationBoundary(
        ctx,
        farmId,
        locationId,
        req.file.buffer,
        req.file.originalname,
      );

      void logAudit({
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'UPLOAD_LOCATION_BOUNDARY',
        targetType: 'farm_location',
        targetId: locationId,
        metadata: {
          farmId,
          filename: req.file.originalname,
          boundaryAreaHa: result.boundaryAreaHa,
        },
        ipAddress: getClientIp(req),
        farmId,
        organizationId: req.user!.organizationId!,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof FarmLocationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── Get Boundary ───────────────────────────────────────────────────

farmLocationsRouter.get(
  '/org/farms/:farmId/locations/:locationId/boundary',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const locationId = req.params.locationId as string;
      const result = await getLocationBoundary(ctx, farmId, locationId);
      res.json(result);
    } catch (err) {
      if (err instanceof FarmLocationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── Delete Boundary ────────────────────────────────────────────────

farmLocationsRouter.delete(
  '/org/farms/:farmId/locations/:locationId/boundary',
  authenticate,
  checkPermission('animals:update'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const locationId = req.params.locationId as string;
      await deleteLocationBoundary(ctx, farmId, locationId);
      res.status(204).end();
    } catch (err) {
      if (err instanceof FarmLocationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);

// ─── Occupancy ──────────────────────────────────────────────────────

farmLocationsRouter.get(
  '/org/farms/:farmId/locations/:locationId/occupancy',
  authenticate,
  checkPermission('animals:read'),
  checkFarmAccess(),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const farmId = req.params.farmId as string;
      const locationId = req.params.locationId as string;
      const result = await getLocationOccupancy(ctx, farmId, locationId);
      res.json(result);
    } catch (err) {
      if (err instanceof FarmLocationError) {
        res.status(err.statusCode).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  },
);
