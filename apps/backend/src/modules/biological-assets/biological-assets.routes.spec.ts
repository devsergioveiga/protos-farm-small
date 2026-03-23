import request from 'supertest';
import { app } from '../../app';
import * as biologicalAssetsService from './biological-assets.service';
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

jest.mock('./biological-assets.service', () => ({
  createValuation: jest.fn(),
  listValuations: jest.fn(),
  getValuation: jest.fn(),
  deleteValuation: jest.fn(),
  getSummary: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(biologicalAssetsService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: ORG_ID,
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const VALID_ANIMAL_VALUATION = {
  id: 'val-1',
  organizationId: ORG_ID,
  farmId: 'farm-1',
  farmName: 'Fazenda Boa Vista',
  valuationDate: '2024-06-30',
  assetGroup: 'VACA_LACTACAO',
  groupType: 'ANIMAL' as const,
  groupTypeLabel: 'Rebanho',
  headCount: 50,
  areaHa: null,
  pricePerUnit: 3500,
  totalFairValue: 175000,
  previousValue: null,
  fairValueChange: null,
  notes: null,
  createdBy: 'admin-1',
  createdAt: '2024-06-30T10:00:00.000Z',
};

const VALID_SECOND_VALUATION = {
  ...VALID_ANIMAL_VALUATION,
  id: 'val-2',
  valuationDate: '2024-12-31',
  totalFairValue: 185000,
  previousValue: 175000,
  fairValueChange: 10000,
  createdAt: '2024-12-31T10:00:00.000Z',
};

const VALID_PERENNIAL_VALUATION = {
  id: 'val-3',
  organizationId: ORG_ID,
  farmId: 'farm-1',
  farmName: 'Fazenda Boa Vista',
  valuationDate: '2024-06-30',
  assetGroup: 'CAFE_FORMACAO',
  groupType: 'PERENNIAL_CROP' as const,
  groupTypeLabel: 'Cultura Perene',
  headCount: null,
  areaHa: 12.5,
  pricePerUnit: 8000,
  totalFairValue: 100000,
  previousValue: null,
  fairValueChange: null,
  notes: null,
  createdBy: 'admin-1',
  createdAt: '2024-06-30T10:00:00.000Z',
};

const SUMMARY = [
  {
    assetGroup: 'VACA_LACTACAO' as const,
    groupType: 'ANIMAL' as const,
    latestTotalFairValue: 185000,
    latestFairValueChange: 10000,
    valuationCount: 2,
  },
];

describe('Biological Assets API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ───────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get(`/api/org/${ORG_ID}/biological-assets`);
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/org/:orgId/biological-assets ───────────────────────────

  describe('POST /api/org/:orgId/biological-assets', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('creates ANIMAL valuation with fairValueChange=null (first valuation)', async () => {
      mockedService.createValuation.mockResolvedValue(VALID_ANIMAL_VALUATION);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/biological-assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          farmId: 'farm-1',
          valuationDate: '2024-06-30',
          assetGroup: 'VACA_LACTACAO',
          groupType: 'ANIMAL',
          headCount: 50,
          pricePerUnit: 3500,
          totalFairValue: 175000,
        });

      expect(res.status).toBe(201);
      expect(res.body.fairValueChange).toBeNull();
      expect(res.body.groupType).toBe('ANIMAL');
      expect(mockedService.createValuation).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ assetGroup: 'VACA_LACTACAO', groupType: 'ANIMAL' }),
      );
    });

    it('creates second ANIMAL valuation with non-null fairValueChange', async () => {
      mockedService.createValuation.mockResolvedValue(VALID_SECOND_VALUATION);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/biological-assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          farmId: 'farm-1',
          valuationDate: '2024-12-31',
          assetGroup: 'VACA_LACTACAO',
          groupType: 'ANIMAL',
          headCount: 50,
          pricePerUnit: 3700,
          totalFairValue: 185000,
        });

      expect(res.status).toBe(201);
      expect(res.body.fairValueChange).toBe(10000);
      expect(res.body.previousValue).toBe(175000);
    });

    it('creates PERENNIAL_CROP valuation with areaHa', async () => {
      mockedService.createValuation.mockResolvedValue(VALID_PERENNIAL_VALUATION);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/biological-assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          farmId: 'farm-1',
          valuationDate: '2024-06-30',
          assetGroup: 'CAFE_FORMACAO',
          groupType: 'PERENNIAL_CROP',
          areaHa: 12.5,
          pricePerUnit: 8000,
          totalFairValue: 100000,
        });

      expect(res.status).toBe(201);
      expect(res.body.groupType).toBe('PERENNIAL_CROP');
      expect(res.body.areaHa).toBe(12.5);
    });

    it('returns 400 when service throws BiologicalAssetError (missing required fields)', async () => {
      const { BiologicalAssetError } = jest.requireActual('./biological-assets.types') as {
        BiologicalAssetError: new (msg: string, code: number) => Error & { statusCode: number };
      };
      mockedService.createValuation.mockRejectedValue(
        new BiologicalAssetError('Fazenda é obrigatória', 400),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/biological-assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({ assetGroup: 'VACA_LACTACAO', groupType: 'ANIMAL' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when ANIMAL groupType missing headCount', async () => {
      const { BiologicalAssetError } = jest.requireActual('./biological-assets.types') as {
        BiologicalAssetError: new (msg: string, code: number) => Error & { statusCode: number };
      };
      mockedService.createValuation.mockRejectedValue(
        new BiologicalAssetError('Quantidade de cabeças é obrigatória', 400),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/biological-assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          farmId: 'farm-1',
          valuationDate: '2024-06-30',
          assetGroup: 'VACA_LACTACAO',
          groupType: 'ANIMAL',
          pricePerUnit: 3500,
          totalFairValue: 175000,
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when PERENNIAL_CROP missing areaHa', async () => {
      const { BiologicalAssetError } = jest.requireActual('./biological-assets.types') as {
        BiologicalAssetError: new (msg: string, code: number) => Error & { statusCode: number };
      };
      mockedService.createValuation.mockRejectedValue(
        new BiologicalAssetError('Área (ha) é obrigatória', 400),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/biological-assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          farmId: 'farm-1',
          valuationDate: '2024-06-30',
          assetGroup: 'CAFE_FORMACAO',
          groupType: 'PERENNIAL_CROP',
          pricePerUnit: 8000,
          totalFairValue: 100000,
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/org/:orgId/biological-assets ────────────────────────────

  describe('GET /api/org/:orgId/biological-assets', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns list sorted by valuationDate desc', async () => {
      mockedService.listValuations.mockResolvedValue([
        VALID_SECOND_VALUATION,
        VALID_ANIMAL_VALUATION,
      ]);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/biological-assets`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe('val-2');
    });

    it('passes farmId filter to service', async () => {
      mockedService.listValuations.mockResolvedValue([VALID_ANIMAL_VALUATION]);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/biological-assets?farmId=farm-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listValuations).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ farmId: 'farm-1' }),
      );
    });
  });

  // ─── GET /api/org/:orgId/biological-assets/summary ────────────────────

  describe('GET /api/org/:orgId/biological-assets/summary', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns per-group summary', async () => {
      mockedService.getSummary.mockResolvedValue(SUMMARY);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/biological-assets/summary`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].assetGroup).toBe('VACA_LACTACAO');
      expect(res.body[0].valuationCount).toBe(2);
    });
  });

  // ─── GET /api/org/:orgId/biological-assets/:id ───────────────────────

  describe('GET /api/org/:orgId/biological-assets/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns single valuation', async () => {
      mockedService.getValuation.mockResolvedValue(VALID_ANIMAL_VALUATION);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/biological-assets/val-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('val-1');
    });

    it('returns 404 when not found', async () => {
      const { BiologicalAssetError } = jest.requireActual('./biological-assets.types') as {
        BiologicalAssetError: new (msg: string, code: number) => Error & { statusCode: number };
      };
      mockedService.getValuation.mockRejectedValue(
        new BiologicalAssetError('Avaliação não encontrada', 404),
      );

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/biological-assets/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/org/:orgId/biological-assets/:id ────────────────────

  describe('DELETE /api/org/:orgId/biological-assets/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('deletes valuation and returns 204', async () => {
      mockedService.deleteValuation.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/${ORG_ID}/biological-assets/val-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
    });
  });

  // ─── RBAC guard ───────────────────────────────────────────────────────

  describe('RBAC guard', () => {
    it('returns 403 for OPERATOR trying to create valuation', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/biological-assets`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          farmId: 'farm-1',
          valuationDate: '2024-06-30',
          assetGroup: 'VACA_LACTACAO',
          groupType: 'ANIMAL',
          headCount: 50,
          pricePerUnit: 3500,
          totalFairValue: 175000,
        });

      expect(res.status).toBe(403);
    });
  });
});
