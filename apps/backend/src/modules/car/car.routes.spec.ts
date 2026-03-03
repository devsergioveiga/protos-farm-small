import request from 'supertest';
import { app } from '../../app';
import * as carService from './car.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { CarError } from './car.types';

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

jest.mock('./car.service', () => ({
  createCar: jest.fn(),
  listCars: jest.fn(),
  getCar: jest.fn(),
  updateCar: jest.fn(),
  deleteCar: jest.fn(),
  uploadCarBoundary: jest.fn(),
  getCarBoundary: jest.fn(),
  deleteCarBoundary: jest.fn(),
}));

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

const mockedService = jest.mocked(carService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const FARM_ID = 'farm-1';
const CAR_ID = 'car-1';

const SAMPLE_CAR = {
  id: CAR_ID,
  farmId: FARM_ID,
  carCode: 'MT-5107248-F8A9B1C2D3E4F5A6B7C8D9E0F1A2B3C4',
  status: 'ATIVO',
  inscriptionDate: null,
  lastRectificationDate: null,
  areaHa: 5200,
  modulosFiscais: null,
  city: 'Sorriso',
  state: 'MT',
  nativeVegetationHa: null,
  consolidatedAreaHa: null,
  administrativeEasementHa: null,
  legalReserveRecordedHa: null,
  legalReserveApprovedHa: null,
  legalReserveProposedHa: null,
  appTotalHa: null,
  appConsolidatedHa: null,
  appNativeVegetationHa: null,
  restrictedUseHa: null,
  legalReserveSurplusDeficit: null,
  legalReserveToRestoreHa: null,
  appToRestoreHa: null,
  restrictedUseToRestoreHa: null,
  boundaryAreaHa: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  registrationLinks: [],
};

describe('CAR endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get(`/api/org/farms/${FARM_ID}/car`);
      expect(response.status).toBe(401);
    });

    it('should return 403 for OPERATOR trying to create CAR', async () => {
      authAs(OPERATOR_PAYLOAD);
      const response = await request(app)
        .post(`/api/org/farms/${FARM_ID}/car`)
        .set('Authorization', 'Bearer valid-token')
        .send({ carCode: 'MT-123' });
      expect(response.status).toBe(403);
    });

    it('should allow ADMIN to list CARs', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listCars.mockResolvedValue([]);
      const response = await request(app)
        .get(`/api/org/farms/${FARM_ID}/car`)
        .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(200);
    });
  });

  // ─── POST /org/farms/:farmId/car ─────────────────────────────────

  describe('POST /org/farms/:farmId/car', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should create CAR and return 201', async () => {
      mockedService.createCar.mockResolvedValue(SAMPLE_CAR as never);

      const response = await request(app)
        .post(`/api/org/farms/${FARM_ID}/car`)
        .set('Authorization', 'Bearer valid-token')
        .send({ carCode: 'MT-5107248-F8A9B1C2D3E4F5A6B7C8D9E0F1A2B3C4', areaHa: 5200 });

      expect(response.status).toBe(201);
      expect(response.body.carCode).toBe(SAMPLE_CAR.carCode);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_CAR' }),
      );
    });

    it('should create CAR with registrationIds', async () => {
      mockedService.createCar.mockResolvedValue({
        ...SAMPLE_CAR,
        registrationLinks: [
          {
            id: 'link-1',
            farmRegistrationId: 'reg-1',
            farmRegistration: { id: 'reg-1', number: '15.234', areaHa: 3200, state: 'MT' },
          },
        ],
      } as never);

      const response = await request(app)
        .post(`/api/org/farms/${FARM_ID}/car`)
        .set('Authorization', 'Bearer valid-token')
        .send({ carCode: 'MT-123', registrationIds: ['reg-1'] });

      expect(response.status).toBe(201);
      expect(response.body.registrationLinks).toHaveLength(1);
    });

    it('should return 400 when service throws CarError(400)', async () => {
      mockedService.createCar.mockRejectedValue(new CarError('Código do CAR é obrigatório', 400));

      const response = await request(app)
        .post(`/api/org/farms/${FARM_ID}/car`)
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('obrigatório');
    });

    it('should return 404 when farm not found', async () => {
      mockedService.createCar.mockRejectedValue(new CarError('Fazenda não encontrada', 404));

      const response = await request(app)
        .post(`/api/org/farms/nonexistent/car`)
        .set('Authorization', 'Bearer valid-token')
        .send({ carCode: 'MT-123' });

      expect(response.status).toBe(404);
    });
  });

  // ─── GET /org/farms/:farmId/car ───────────────────────────────────

  describe('GET /org/farms/:farmId/car', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should list CARs for farm', async () => {
      mockedService.listCars.mockResolvedValue([SAMPLE_CAR] as never);

      const response = await request(app)
        .get(`/api/org/farms/${FARM_ID}/car`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].carCode).toBe(SAMPLE_CAR.carCode);
    });

    it('should return empty array when no CARs', async () => {
      mockedService.listCars.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/org/farms/${FARM_ID}/car`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  // ─── GET /org/farms/:farmId/car/:carId ────────────────────────────

  describe('GET /org/farms/:farmId/car/:carId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return CAR detail', async () => {
      mockedService.getCar.mockResolvedValue(SAMPLE_CAR as never);

      const response = await request(app)
        .get(`/api/org/farms/${FARM_ID}/car/${CAR_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(CAR_ID);
    });

    it('should return 404 when CAR not found', async () => {
      mockedService.getCar.mockRejectedValue(new CarError('CAR não encontrado', 404));

      const response = await request(app)
        .get(`/api/org/farms/${FARM_ID}/car/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  // ─── PATCH /org/farms/:farmId/car/:carId ──────────────────────────

  describe('PATCH /org/farms/:farmId/car/:carId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should update CAR', async () => {
      mockedService.updateCar.mockResolvedValue({
        ...SAMPLE_CAR,
        status: 'PENDENTE',
      } as never);

      const response = await request(app)
        .patch(`/api/org/farms/${FARM_ID}/car/${CAR_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'PENDENTE' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('PENDENTE');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_CAR' }),
      );
    });

    it('should update CAR registrationIds', async () => {
      mockedService.updateCar.mockResolvedValue({
        ...SAMPLE_CAR,
        registrationLinks: [
          {
            id: 'link-1',
            farmRegistrationId: 'reg-1',
            farmRegistration: { id: 'reg-1', number: '15.234', areaHa: 3200, state: 'MT' },
          },
          {
            id: 'link-2',
            farmRegistrationId: 'reg-2',
            farmRegistration: { id: 'reg-2', number: '15.235', areaHa: 2000, state: 'MT' },
          },
        ],
      } as never);

      const response = await request(app)
        .patch(`/api/org/farms/${FARM_ID}/car/${CAR_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ registrationIds: ['reg-1', 'reg-2'] });

      expect(response.status).toBe(200);
      expect(response.body.registrationLinks).toHaveLength(2);
    });

    it('should return 400 for invalid status', async () => {
      mockedService.updateCar.mockRejectedValue(
        new CarError('Status inválido. Valores aceitos: ATIVO, PENDENTE, CANCELADO, SUSPENSO', 400),
      );

      const response = await request(app)
        .patch(`/api/org/farms/${FARM_ID}/car/${CAR_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'INVALID' });

      expect(response.status).toBe(400);
    });

    it('should return 404 when CAR not found', async () => {
      mockedService.updateCar.mockRejectedValue(new CarError('CAR não encontrado', 404));

      const response = await request(app)
        .patch(`/api/org/farms/${FARM_ID}/car/nonexistent`)
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'ATIVO' });

      expect(response.status).toBe(404);
    });
  });

  // ─── DELETE /org/farms/:farmId/car/:carId ─────────────────────────

  describe('DELETE /org/farms/:farmId/car/:carId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should delete CAR', async () => {
      mockedService.deleteCar.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/car/${CAR_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('excluído');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_CAR' }),
      );
    });

    it('should return 403 for OPERATOR trying to delete', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/car/${CAR_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });

    it('should return 404 when CAR not found', async () => {
      mockedService.deleteCar.mockRejectedValue(new CarError('CAR não encontrado', 404));

      const response = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/car/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  // ─── POST /org/farms/:farmId/car/:carId/boundary ──────────────────

  describe('POST /org/farms/:farmId/car/:carId/boundary', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should upload boundary and return result', async () => {
      const uploadResult = {
        boundaryAreaHa: 5200.1234,
        areaDivergence: null,
        warnings: [],
      };
      mockedService.uploadCarBoundary.mockResolvedValue(uploadResult);

      const geojson = JSON.stringify({
        type: 'Polygon',
        coordinates: [
          [
            [-55.78, -12.47],
            [-55.55, -12.47],
            [-55.55, -12.69],
            [-55.78, -12.69],
            [-55.78, -12.47],
          ],
        ],
      });

      const response = await request(app)
        .post(`/api/org/farms/${FARM_ID}/car/${CAR_ID}/boundary`)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', Buffer.from(geojson), 'boundary.geojson');

      expect(response.status).toBe(200);
      expect(response.body.boundaryAreaHa).toBe(5200.1234);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPLOAD_CAR_BOUNDARY' }),
      );
    });

    it('should return 400 when no file provided', async () => {
      const response = await request(app)
        .post(`/api/org/farms/${FARM_ID}/car/${CAR_ID}/boundary`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('obrigatório');
    });

    it('should return 400 for invalid geo format', async () => {
      const response = await request(app)
        .post(`/api/org/farms/${FARM_ID}/car/${CAR_ID}/boundary`)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', Buffer.from('invalid'), 'file.txt');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Formato não suportado');
    });
  });

  // ─── GET /org/farms/:farmId/car/:carId/boundary ───────────────────

  describe('GET /org/farms/:farmId/car/:carId/boundary', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return boundary info', async () => {
      mockedService.getCarBoundary.mockResolvedValue({
        hasBoundary: true,
        boundaryAreaHa: 5200,
        boundaryGeoJSON: {
          type: 'Polygon',
          coordinates: [
            [
              [-55.78, -12.47],
              [-55.55, -12.47],
              [-55.55, -12.69],
              [-55.78, -12.69],
              [-55.78, -12.47],
            ],
          ],
        },
      });

      const response = await request(app)
        .get(`/api/org/farms/${FARM_ID}/car/${CAR_ID}/boundary`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.hasBoundary).toBe(true);
    });

    it('should return no boundary when not uploaded', async () => {
      mockedService.getCarBoundary.mockResolvedValue({
        hasBoundary: false,
        boundaryAreaHa: null,
        boundaryGeoJSON: null,
      });

      const response = await request(app)
        .get(`/api/org/farms/${FARM_ID}/car/${CAR_ID}/boundary`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.hasBoundary).toBe(false);
    });
  });

  // ─── DELETE /org/farms/:farmId/car/:carId/boundary ────────────────

  describe('DELETE /org/farms/:farmId/car/:carId/boundary', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should delete boundary', async () => {
      mockedService.deleteCarBoundary.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/car/${CAR_ID}/boundary`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Perímetro');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_CAR_BOUNDARY' }),
      );
    });

    it('should return 404 when CAR not found', async () => {
      mockedService.deleteCarBoundary.mockRejectedValue(new CarError('CAR não encontrado', 404));

      const response = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/car/nonexistent/boundary`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });
});
