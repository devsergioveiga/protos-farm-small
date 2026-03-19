import request from 'supertest';
import { app } from '../../app';
import * as fuelRecordsService from './fuel-records.service';
import * as authService from '../auth/auth.service';
import { FuelRecordError } from './fuel-records.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./fuel-records.service', () => ({
  createFuelRecord: jest.fn(),
  listFuelRecords: jest.fn(),
  getFuelStats: jest.fn(),
  deleteFuelRecord: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(fuelRecordsService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const VALID_FUEL_RECORD = {
  id: 'fr-1',
  organizationId: ORG_ID,
  assetId: 'asset-1',
  farmId: 'farm-1',
  fuelDate: new Date('2026-01-15').toISOString(),
  liters: '50.000',
  pricePerLiter: '6.5000',
  totalCost: '325.00',
  hourmeterAtFuel: null,
  odometerAtFuel: null,
  notes: null,
  createdBy: 'manager-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  asset: { name: 'Trator John Deere', assetType: 'MAQUINA' },
};

describe('Fuel Records API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(MANAGER_PAYLOAD);
  });

  describe('POST /api/org/:orgId/fuel-records', () => {
    it('creates fuel record with correct totalCost (liters * pricePerLiter)', async () => {
      mockedService.createFuelRecord.mockResolvedValue(VALID_FUEL_RECORD as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/fuel-records`)
        .set('Authorization', 'Bearer token')
        .send({
          assetId: 'asset-1',
          farmId: 'farm-1',
          fuelDate: '2026-01-15',
          liters: 50,
          pricePerLiter: 6.5,
        });

      expect(res.status).toBe(201);
      expect(mockedService.createFuelRecord).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ assetId: 'asset-1', liters: 50, pricePerLiter: 6.5 }),
      );
      expect(res.body.totalCost).toBe('325.00');
    });

    it('returns 400 when required fields are missing', async () => {
      mockedService.createFuelRecord.mockRejectedValue(
        new FuelRecordError('Ativo é obrigatório', 400),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/fuel-records`)
        .set('Authorization', 'Bearer token')
        .send({ farmId: 'farm-1', fuelDate: '2026-01-15', liters: 50, pricePerLiter: 6.5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/obrigatório/i);
    });
  });

  describe('GET /api/org/:orgId/fuel-records', () => {
    it('returns paginated list filtered by assetId', async () => {
      const mockList = {
        data: [VALID_FUEL_RECORD],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockedService.listFuelRecords.mockResolvedValue(mockList as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/fuel-records?assetId=asset-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listFuelRecords).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ assetId: 'asset-1' }),
      );
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('sorts by fuelDate desc by default', async () => {
      const mockList = { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      mockedService.listFuelRecords.mockResolvedValue(mockList as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/fuel-records`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/org/:orgId/fuel-records/stats/:assetId', () => {
    it('returns asset average and fleet average liters/hour', async () => {
      const mockStats = {
        assetAvgLitersPerHour: 12.5,
        fleetAvgLitersPerHour: 11.2,
        assetCostPerHour: 81.25,
        fleetCostPerHour: 72.8,
        totalLiters: 250,
        totalCost: 1625,
        recordCount: 5,
      };
      mockedService.getFuelStats.mockResolvedValue(mockStats as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/fuel-records/stats/asset-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.getFuelStats).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        'asset-1',
        undefined,
        undefined,
      );
      expect(res.body.assetAvgLitersPerHour).toBe(12.5);
      expect(res.body.fleetAvgLitersPerHour).toBe(11.2);
    });

    it('returns totalLiters and totalCost', async () => {
      const mockStats = {
        assetAvgLitersPerHour: null,
        fleetAvgLitersPerHour: null,
        assetCostPerHour: null,
        fleetCostPerHour: null,
        totalLiters: 100,
        totalCost: 650,
        recordCount: 2,
      };
      mockedService.getFuelStats.mockResolvedValue(mockStats as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/fuel-records/stats/asset-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.totalLiters).toBe(100);
      expect(res.body.totalCost).toBe(650);
    });
  });

  describe('DELETE /api/org/:orgId/fuel-records/:id', () => {
    it('deletes fuel record', async () => {
      mockedService.deleteFuelRecord.mockResolvedValue(VALID_FUEL_RECORD as never);

      const res = await request(app)
        .delete(`/api/org/${ORG_ID}/fuel-records/fr-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
      expect(mockedService.deleteFuelRecord).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        'fr-1',
      );
    });
  });
});
