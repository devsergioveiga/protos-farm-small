import request from 'supertest';
import { app } from '../../app';
import * as service from './asset-reports.service';
import * as authService from '../auth/auth.service';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./asset-reports.service', () => ({
  getInventoryReport: jest.fn(),
  getDepreciationProjection: jest.fn(),
  getTCOFleet: jest.fn(),
  exportInventoryReport: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(service);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const BASE_INVENTORY = {
  rows: [
    {
      classification: 'MAQUINA',
      count: 2,
      grossValue: 150000,
      accumulatedDepreciation: 30000,
      netBookValue: 120000,
      acquisitionsInPeriod: 0,
      disposalsInPeriod: 0,
    },
  ],
  totals: { count: 2, grossValue: 150000, accumulatedDepreciation: 30000, netBookValue: 120000 },
  generatedAt: new Date().toISOString(),
};

const BASE_PROJECTION = {
  rows: Array.from({ length: 12 }, (_, i) => ({
    year: 2025,
    month: i + 1,
    projectedDepreciation: 750,
    cumulativeDepreciation: (i + 1) * 750,
    remainingBookValue: 90000 - (i + 1) * 750,
  })),
  assetsIncluded: 1,
  assetsEstimated: 0,
  generatedAt: new Date().toISOString(),
};

const BASE_TCO = {
  assets: [
    {
      assetId: 'a1',
      assetName: 'Trator A',
      assetTag: 'PAT-001',
      assetType: 'MAQUINA',
      acquisitionValue: 100000,
      accumulatedDepreciation: 20000,
      maintenanceCost: 50000,
      fuelCost: 10000,
      totalCost: 160000,
      repairRatio: 0.5,
      alert: 'OK' as const,
      costPerHour: 320,
    },
  ],
  summary: { avgCostPerHour: 320, totalMaintenanceCost: 50000, totalFuelCost: 10000 },
  generatedAt: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Asset Reports Routes', () => {
  describe('GET /api/orgs/:orgId/asset-reports/inventory', () => {
    it('returns 200 with rows array and totals object', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getInventoryReport.mockResolvedValue(BASE_INVENTORY);

      const res = await request(app)
        .get(`/api/orgs/${ORG_ID}/asset-reports/inventory`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.rows).toBeInstanceOf(Array);
      expect(res.body.totals).toBeDefined();
      expect(res.body.rows[0].classification).toBe('MAQUINA');
    });

    it('with farmId query param passes it to service', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getInventoryReport.mockResolvedValue(BASE_INVENTORY);

      await request(app)
        .get(`/api/orgs/${ORG_ID}/asset-reports/inventory`)
        .query({ farmId: 'farm-1' })
        .set('Authorization', 'Bearer token');

      expect(mockedService.getInventoryReport).toHaveBeenCalledWith(
        expect.objectContaining({ farmId: 'farm-1' }),
      );
    });
  });

  describe('GET /api/orgs/:orgId/asset-reports/inventory/export', () => {
    it('format=pdf returns 200 with content-type application/pdf', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.exportInventoryReport.mockResolvedValue(
        Buffer.from('%PDF-1.4 fake content'),
      );

      const res = await request(app)
        .get(`/api/orgs/${ORG_ID}/asset-reports/inventory/export`)
        .query({ format: 'pdf' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });

    it('format=xlsx returns 200 with correct content-type', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.exportInventoryReport.mockResolvedValue(Buffer.from('xlsx fake'));

      const res = await request(app)
        .get(`/api/orgs/${ORG_ID}/asset-reports/inventory/export`)
        .query({ format: 'xlsx' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(
        /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
      );
    });

    it('format=invalid returns 400', async () => {
      authAs(ADMIN_PAYLOAD);

      const res = await request(app)
        .get(`/api/orgs/${ORG_ID}/asset-reports/inventory/export`)
        .query({ format: 'invalid' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Formato invalido/);
    });
  });

  describe('GET /api/orgs/:orgId/asset-reports/depreciation-projection', () => {
    it('horizonMonths=12 returns 200 with rows array', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getDepreciationProjection.mockResolvedValue(BASE_PROJECTION);

      const res = await request(app)
        .get(`/api/orgs/${ORG_ID}/asset-reports/depreciation-projection`)
        .query({ horizonMonths: '12' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.rows).toBeInstanceOf(Array);
      expect(res.body.rows).toHaveLength(12);
    });

    it('horizonMonths=99 returns 400', async () => {
      authAs(ADMIN_PAYLOAD);

      const res = await request(app)
        .get(`/api/orgs/${ORG_ID}/asset-reports/depreciation-projection`)
        .query({ horizonMonths: '99' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/horizonMonths/);
    });
  });

  describe('GET /api/orgs/:orgId/asset-reports/tco-fleet', () => {
    it('returns 200 with assets array and summary', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getTCOFleet.mockResolvedValue(BASE_TCO);

      const res = await request(app)
        .get(`/api/orgs/${ORG_ID}/asset-reports/tco-fleet`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.assets).toBeInstanceOf(Array);
      expect(res.body.summary).toBeDefined();
    });

    it('includes repair alert field in each asset row', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getTCOFleet.mockResolvedValue(BASE_TCO);

      const res = await request(app)
        .get(`/api/orgs/${ORG_ID}/asset-reports/tco-fleet`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.assets[0].alert).toBe('OK');
      expect(res.body.assets[0].repairRatio).toBe(0.5);
    });
  });

  describe('Auth guards', () => {
    it('returns 401 without token on inventory endpoint', async () => {
      const res = await request(app).get(`/api/orgs/${ORG_ID}/asset-reports/inventory`);

      expect(res.status).toBe(401);
    });

    it('returns 401 without token on tco-fleet endpoint', async () => {
      const res = await request(app).get(`/api/orgs/${ORG_ID}/asset-reports/tco-fleet`);

      expect(res.status).toBe(401);
    });

    it('returns 403 when user lacks assets:read permission', async () => {
      // CONSULTANT role does not have assets:read
      mockedAuth.verifyAccessToken.mockReturnValue({
        userId: 'user-1',
        email: 'user@org.com',
        role: 'CONSULTANT' as never,
        organizationId: ORG_ID,
      });
      mockGetUserPermissions.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/orgs/${ORG_ID}/asset-reports/inventory`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
    });
  });
});
