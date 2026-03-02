import request from 'supertest';
import path from 'path';
import { app } from '../../app';
import * as farmsService from './farms.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { FarmError } from './farms.types';

jest.mock('../../shared/audit/audit.service', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./farms.service', () => {
  const actual = jest.requireActual('./farms.service');
  return {
    ...actual,
    createFarm: jest.fn(),
    listFarms: jest.fn(),
    getFarm: jest.fn(),
    updateFarm: jest.fn(),
    toggleFarmStatus: jest.fn(),
    getFarmLimit: jest.fn(),
    addRegistration: jest.fn(),
    updateRegistration: jest.fn(),
    deleteRegistration: jest.fn(),
    uploadFarmBoundary: jest.fn(),
    uploadRegistrationBoundary: jest.fn(),
    getFarmBoundary: jest.fn(),
    getRegistrationBoundary: jest.fn(),
    deleteFarmBoundary: jest.fn(),
    deleteRegistrationBoundary: jest.fn(),
  };
});

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(farmsService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const COWBOY_PAYLOAD = {
  userId: 'cowboy-1',
  email: 'cowboy@org.com',
  role: 'COWBOY' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const sampleGeoJSONPath = path.join(__dirname, '__fixtures__', 'sample-polygon.geojson');

describe('Farm boundary endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── POST /org/farms/:farmId/boundary ─────────────────────────

  describe('POST /org/farms/:farmId/boundary', () => {
    it('should upload boundary and return result', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.uploadFarmBoundary.mockResolvedValue({
        boundaryAreaHa: 5200.1234,
        areaDivergence: null,
        warnings: [],
      });

      const res = await request(app)
        .post('/api/org/farms/farm-1/boundary')
        .set('Authorization', 'Bearer token')
        .attach('file', sampleGeoJSONPath);

      expect(res.status).toBe(200);
      expect(res.body.boundaryAreaHa).toBe(5200.1234);
      expect(mockedService.uploadFarmBoundary).toHaveBeenCalledTimes(1);
    });

    it('should log audit on successful upload', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.uploadFarmBoundary.mockResolvedValue({
        boundaryAreaHa: 5200,
        areaDivergence: null,
        warnings: [],
      });

      await request(app)
        .post('/api/org/farms/farm-1/boundary')
        .set('Authorization', 'Bearer token')
        .attach('file', sampleGeoJSONPath);

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPLOAD_FARM_BOUNDARY',
          targetType: 'farm',
          targetId: 'farm-1',
        }),
      );
    });

    it('should return 400 without file', async () => {
      authAs(ADMIN_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/boundary')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Arquivo é obrigatório/);
    });

    it('should return 400 for unsupported file format', async () => {
      authAs(ADMIN_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/boundary')
        .set('Authorization', 'Bearer token')
        .attach('file', Buffer.from('data'), {
          filename: 'farm.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Formato não suportado/);
    });

    it('should return 400 for invalid geometry from service', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.uploadFarmBoundary.mockRejectedValue(
        new FarmError('Geometria inválida: Polígono possui 1 auto-interseção(ões)', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/boundary')
        .set('Authorization', 'Bearer token')
        .attach('file', sampleGeoJSONPath);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Geometria inválida/);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/org/farms/farm-1/boundary')
        .attach('file', sampleGeoJSONPath);

      expect(res.status).toBe(401);
    });

    it('should deny COWBOY role (no farms:update permission)', async () => {
      authAs(COWBOY_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/boundary')
        .set('Authorization', 'Bearer token')
        .attach('file', sampleGeoJSONPath);

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /org/farms/:farmId/boundary ──────────────────────────

  describe('GET /org/farms/:farmId/boundary', () => {
    it('should return boundary info', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getFarmBoundary.mockResolvedValue({
        hasBoundary: true,
        boundaryAreaHa: 5200,
        boundaryGeoJSON: {
          type: 'Polygon',
          coordinates: [
            [
              [-55.75, -12.5],
              [-55.5, -12.5],
              [-55.5, -12.7],
              [-55.75, -12.7],
              [-55.75, -12.5],
            ],
          ],
        },
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/boundary')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.hasBoundary).toBe(true);
      expect(res.body.boundaryGeoJSON.type).toBe('Polygon');
    });

    it('should return empty when no boundary', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getFarmBoundary.mockResolvedValue({
        hasBoundary: false,
        boundaryAreaHa: null,
        boundaryGeoJSON: null,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/boundary')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.hasBoundary).toBe(false);
    });
  });

  // ─── DELETE /org/farms/:farmId/boundary ───────────────────────

  describe('DELETE /org/farms/:farmId/boundary', () => {
    it('should delete boundary', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteFarmBoundary.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/boundary')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/removido/);
    });

    it('should log audit on delete', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteFarmBoundary.mockResolvedValue(undefined);

      await request(app)
        .delete('/api/org/farms/farm-1/boundary')
        .set('Authorization', 'Bearer token');

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_FARM_BOUNDARY',
        }),
      );
    });

    it('should return 404 when farm not found', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteFarmBoundary.mockRejectedValue(
        new FarmError('Fazenda não encontrada', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/non-existent/boundary')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /org/farms/:farmId/registrations/:regId/boundary ────

  describe('POST /org/farms/:farmId/registrations/:regId/boundary', () => {
    it('should upload registration boundary', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.uploadRegistrationBoundary.mockResolvedValue({
        boundaryAreaHa: 3200.5,
        areaDivergence: {
          referenceAreaHa: 3200,
          boundaryAreaHa: 3200.5,
          percentage: 0.02,
          warning: false,
        },
        warnings: [],
      });

      const res = await request(app)
        .post('/api/org/farms/farm-1/registrations/reg-1/boundary')
        .set('Authorization', 'Bearer token')
        .attach('file', sampleGeoJSONPath);

      expect(res.status).toBe(200);
      expect(res.body.boundaryAreaHa).toBe(3200.5);
      expect(res.body.areaDivergence.warning).toBe(false);
    });

    it('should log audit for registration boundary upload', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.uploadRegistrationBoundary.mockResolvedValue({
        boundaryAreaHa: 3200,
        areaDivergence: null,
        warnings: [],
      });

      await request(app)
        .post('/api/org/farms/farm-1/registrations/reg-1/boundary')
        .set('Authorization', 'Bearer token')
        .attach('file', sampleGeoJSONPath);

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPLOAD_REGISTRATION_BOUNDARY',
          targetType: 'farm_registration',
          targetId: 'reg-1',
        }),
      );
    });
  });

  // ─── GET /org/farms/:farmId/registrations/:regId/boundary ─────

  describe('GET /org/farms/:farmId/registrations/:regId/boundary', () => {
    it('should return registration boundary', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getRegistrationBoundary.mockResolvedValue({
        hasBoundary: true,
        boundaryAreaHa: 3200,
        boundaryGeoJSON: {
          type: 'Polygon',
          coordinates: [
            [
              [-55.75, -12.5],
              [-55.6, -12.5],
              [-55.6, -12.65],
              [-55.75, -12.65],
              [-55.75, -12.5],
            ],
          ],
        },
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/registrations/reg-1/boundary')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.hasBoundary).toBe(true);
    });
  });

  // ─── DELETE /org/farms/:farmId/registrations/:regId/boundary ──

  describe('DELETE /org/farms/:farmId/registrations/:regId/boundary', () => {
    it('should delete registration boundary', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteRegistrationBoundary.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/registrations/reg-1/boundary')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/removido/);
    });

    it('should log audit on registration boundary delete', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteRegistrationBoundary.mockResolvedValue(undefined);

      await request(app)
        .delete('/api/org/farms/farm-1/registrations/reg-1/boundary')
        .set('Authorization', 'Bearer token');

      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_REGISTRATION_BOUNDARY',
          targetType: 'farm_registration',
        }),
      );
    });

    it('should return 404 when registration not found', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteRegistrationBoundary.mockRejectedValue(
        new FarmError('Matrícula não encontrada', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/registrations/non-existent/boundary')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });
});
