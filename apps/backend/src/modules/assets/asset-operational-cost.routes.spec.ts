import request from 'supertest';
import { app } from '../../app';
import * as operationalCostService from './asset-operational-cost.service';
import * as authService from '../auth/auth.service';
import { OperationalCostError } from './asset-operational-cost.service';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./asset-operational-cost.service', () => ({
  getOperationalCost: jest.fn(),
  OperationalCostError: jest.requireActual('./asset-operational-cost.service').OperationalCostError,
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(operationalCostService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';
const ASSET_ID = 'asset-1';

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

const FULL_COST_RESULT = {
  acquisitionValue: 150000,
  accumulatedDepreciation: 30000,
  netBookValue: 120000,
  maintenanceCost: 5000,
  fuelCost: 3000,
  insuranceCost: null,
  totalOperationalCost: 8000,
  totalLifetimeCost: 158000,
  costPerHour: 79.0,
  currentHourmeter: 2000,
  fuelRecordCount: 12,
  notes: ['Custo de seguro não disponível — campo não modelado'],
};

describe('Operational Cost API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(MANAGER_PAYLOAD);
  });

  describe('GET /api/org/:orgId/assets/:assetId/operational-cost', () => {
    it('returns 200 with all cost components and calculated costPerHour', async () => {
      mockedService.getOperationalCost.mockResolvedValue(FULL_COST_RESULT as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets/${ASSET_ID}/operational-cost`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.acquisitionValue).toBe(150000);
      expect(res.body.accumulatedDepreciation).toBe(30000);
      expect(res.body.netBookValue).toBe(120000);
      expect(res.body.maintenanceCost).toBe(5000);
      expect(res.body.fuelCost).toBe(3000);
      expect(res.body.totalOperationalCost).toBe(8000);
      expect(res.body.totalLifetimeCost).toBe(158000);
      expect(res.body.costPerHour).toBe(79.0);
      expect(res.body.fuelRecordCount).toBe(12);
      expect(mockedService.getOperationalCost).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        ASSET_ID,
        undefined,
        undefined,
      );
    });

    it('returns 404 when asset not found', async () => {
      mockedService.getOperationalCost.mockRejectedValue(
        new OperationalCostError('Ativo não encontrado', 404),
      );

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets/nonexistent/operational-cost`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Ativo não encontrado');
    });

    it('returns costPerHour as null when currentHourmeter is null', async () => {
      const resultWithoutHourmeter = { ...FULL_COST_RESULT, costPerHour: null, currentHourmeter: null };
      mockedService.getOperationalCost.mockResolvedValue(resultWithoutHourmeter as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets/${ASSET_ID}/operational-cost`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.costPerHour).toBeNull();
      expect(res.body.currentHourmeter).toBeNull();
    });

    it('returns zeros when all aggregates have no data', async () => {
      const emptyResult = {
        acquisitionValue: 0,
        accumulatedDepreciation: 0,
        netBookValue: 0,
        maintenanceCost: 0,
        fuelCost: 0,
        insuranceCost: null,
        totalOperationalCost: 0,
        totalLifetimeCost: 0,
        costPerHour: null,
        currentHourmeter: null,
        fuelRecordCount: 0,
        notes: ['Custo de seguro não disponível — campo não modelado'],
      };
      mockedService.getOperationalCost.mockResolvedValue(emptyResult as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets/${ASSET_ID}/operational-cost`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.acquisitionValue).toBe(0);
      expect(res.body.maintenanceCost).toBe(0);
      expect(res.body.fuelCost).toBe(0);
      expect(res.body.totalLifetimeCost).toBe(0);
    });

    it('passes periodStart and periodEnd query params to service', async () => {
      mockedService.getOperationalCost.mockResolvedValue(FULL_COST_RESULT as never);

      const res = await request(app)
        .get(
          `/api/org/${ORG_ID}/assets/${ASSET_ID}/operational-cost?periodStart=2026-01-01&periodEnd=2026-12-31`,
        )
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.getOperationalCost).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        ASSET_ID,
        '2026-01-01',
        '2026-12-31',
      );
    });

    it('always returns insuranceCost as null and notes with insurance unavailability message', async () => {
      mockedService.getOperationalCost.mockResolvedValue(FULL_COST_RESULT as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/assets/${ASSET_ID}/operational-cost`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.insuranceCost).toBeNull();
      expect(res.body.notes).toEqual(
        expect.arrayContaining([expect.stringMatching(/seguro/i)]),
      );
    });

    it('returns 401 when no authorization header is provided', async () => {
      const res = await request(app).get(
        `/api/org/${ORG_ID}/assets/${ASSET_ID}/operational-cost`,
      );

      expect(res.status).toBe(401);
    });
  });
});
