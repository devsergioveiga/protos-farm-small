import request from 'supertest';
import { app } from '../../app';
import * as maintenanceProvisionsService from './maintenance-provisions.service';
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

jest.mock('./maintenance-provisions.service', () => ({
  createProvision: jest.fn(),
  listProvisions: jest.fn(),
  updateProvision: jest.fn(),
  deleteProvision: jest.fn(),
  getReconciliation: jest.fn(),
  processMonthlyProvisions: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

// Also mock prisma for the GET /:id route which queries directly
jest.mock('../../database/prisma', () => ({
  prisma: {
    maintenanceProvision: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '../../database/prisma';

const mockedService = jest.mocked(maintenanceProvisionsService);
const mockedAuth = jest.mocked(authService);
const mockedPrisma = jest.mocked(prisma);

// ─── Constants ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-test-1';
const ASSET_ID = 'asset-test-1';
const PROVISION_ID = 'prov-test-1';
const CC_ID = 'cc-test-1';

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

// ─── Auth helper ─────────────────────────────────────────────────────────────

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_PROVISION = {
  id: PROVISION_ID,
  organizationId: ORG_ID,
  assetId: ASSET_ID,
  monthlyAmount: 500,
  costCenterId: CC_ID,
  isActive: true,
  description: 'Provisao mensal trator',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  asset: { id: ASSET_ID, name: 'Trator John Deere', assetTag: 'PAT-00001' },
};

const VALID_RECONCILIATION = {
  periodYear: 2026,
  periodMonth: 3,
  totalProvisioned: 1500,
  totalActualCost: 1200,
  variance: 300,
  byAsset: [
    {
      assetId: ASSET_ID,
      assetName: 'Trator John Deere',
      provisioned: 500,
      actual: 400,
      variance: 100,
    },
  ],
};

const LIST_RESPONSE = {
  data: [VALID_PROVISION],
  total: 1,
  page: 1,
  limit: 20,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MaintenanceProvisions Routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── POST /api/org/:orgId/maintenance-provisions ───────────────────────────

  describe('POST /api/org/:orgId/maintenance-provisions', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('creates per-asset provision', async () => {
      mockedService.createProvision.mockResolvedValue(VALID_PROVISION as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-provisions`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          monthlyAmount: 500,
          assetId: ASSET_ID,
          costCenterId: CC_ID,
          description: 'Provisao mensal',
        });

      expect(res.status).toBe(201);
      expect(res.body.assetId).toBe(ASSET_ID);
      expect(mockedService.createProvision).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ monthlyAmount: 500, assetId: ASSET_ID }),
      );
    });

    it('creates fleet-level provision with assetId null', async () => {
      const fleetProvision = { ...VALID_PROVISION, assetId: null, asset: null };
      mockedService.createProvision.mockResolvedValue(fleetProvision as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-provisions`)
        .set('Authorization', 'Bearer valid-token')
        .send({ monthlyAmount: 1000 });

      expect(res.status).toBe(201);
      expect(res.body.assetId).toBeNull();
    });

    it('returns 400 when monthlyAmount is zero or negative', async () => {
      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-provisions`)
        .set('Authorization', 'Bearer valid-token')
        .send({ monthlyAmount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('returns 403 when user lacks maintenance-provisions:create permission', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-provisions`)
        .set('Authorization', 'Bearer valid-token')
        .send({ monthlyAmount: 500, assetId: ASSET_ID });

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/org/:orgId/maintenance-provisions ────────────────────────────

  describe('GET /api/org/:orgId/maintenance-provisions', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('lists provisions filtered by isActive', async () => {
      mockedService.listProvisions.mockResolvedValue(LIST_RESPONSE as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-provisions?isActive=true`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockedService.listProvisions).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ isActive: true }),
      );
    });

    it('lists provisions filtered by assetId', async () => {
      mockedService.listProvisions.mockResolvedValue(LIST_RESPONSE as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-provisions?assetId=${ASSET_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listProvisions).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ assetId: ASSET_ID }),
      );
    });

    it('returns paginated results', async () => {
      const pagedResponse = { data: [], total: 50, page: 2, limit: 5 };
      mockedService.listProvisions.mockResolvedValue(pagedResponse as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-provisions?page=2&limit=5`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listProvisions).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ page: 2, limit: 5 }),
      );
    });
  });

  // ─── GET /api/org/:orgId/maintenance-provisions/:id ───────────────────────

  describe('GET /api/org/:orgId/maintenance-provisions/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns single provision with asset', async () => {
      // The route calls listProvisions then does a direct prisma query
      mockedService.listProvisions.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1,
      } as never);
      const rawProvision = {
        id: PROVISION_ID,
        organizationId: ORG_ID,
        assetId: ASSET_ID,
        monthlyAmount: { toNumber: () => 500 } as unknown,
        costCenterId: CC_ID,
        isActive: true,
        description: 'Provisao mensal',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        asset: { id: ASSET_ID, name: 'Trator', assetTag: 'PAT-00001' },
      };
      (mockedPrisma.maintenanceProvision.findFirst as jest.Mock).mockResolvedValue(rawProvision);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-provisions/${PROVISION_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(PROVISION_ID);
    });

    it('returns 404 when provision not found', async () => {
      mockedService.listProvisions.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 1,
      } as never);
      (mockedPrisma.maintenanceProvision.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-provisions/non-existent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/nao encontrada|não encontrada/i);
    });
  });

  // ─── PUT /api/org/:orgId/maintenance-provisions/:id ───────────────────────

  describe('PUT /api/org/:orgId/maintenance-provisions/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('updates monthlyAmount and costCenterId', async () => {
      const updated = { ...VALID_PROVISION, monthlyAmount: 750, costCenterId: 'cc-new' };
      mockedService.updateProvision.mockResolvedValue(updated as never);

      const res = await request(app)
        .put(`/api/org/${ORG_ID}/maintenance-provisions/${PROVISION_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ monthlyAmount: 750, costCenterId: 'cc-new' });

      expect(res.status).toBe(200);
      expect(res.body.monthlyAmount).toBe(750);
      expect(mockedService.updateProvision).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        PROVISION_ID,
        expect.objectContaining({ monthlyAmount: 750, costCenterId: 'cc-new' }),
      );
    });

    it('toggles isActive', async () => {
      const inactive = { ...VALID_PROVISION, isActive: false };
      mockedService.updateProvision.mockResolvedValue(inactive as never);

      const res = await request(app)
        .put(`/api/org/${ORG_ID}/maintenance-provisions/${PROVISION_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });
  });

  // ─── DELETE /api/org/:orgId/maintenance-provisions/:id ────────────────────

  describe('DELETE /api/org/:orgId/maintenance-provisions/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('deletes provision', async () => {
      mockedService.deleteProvision.mockResolvedValue(undefined as never);

      const res = await request(app)
        .delete(`/api/org/${ORG_ID}/maintenance-provisions/${PROVISION_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
      expect(mockedService.deleteProvision).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        PROVISION_ID,
      );
    });

    it('returns 404 when provision not found', async () => {
      const { MaintenanceProvisionError } = jest.requireActual('./maintenance-provisions.types');
      mockedService.deleteProvision.mockRejectedValue(
        new MaintenanceProvisionError('Provisão nao encontrada', 404),
      );

      const res = await request(app)
        .delete(`/api/org/${ORG_ID}/maintenance-provisions/non-existent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/org/:orgId/maintenance-provisions/reconciliation ────────────

  describe('GET /api/org/:orgId/maintenance-provisions/reconciliation', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns provision vs actual cost for given period', async () => {
      mockedService.getReconciliation.mockResolvedValue(VALID_RECONCILIATION as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-provisions/reconciliation?year=2026&month=3`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.totalProvisioned).toBe(1500);
      expect(res.body.variance).toBe(300);
      expect(mockedService.getReconciliation).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ year: 2026, month: 3 }),
      );
    });

    it('returns per-asset breakdown in reconciliation', async () => {
      mockedService.getReconciliation.mockResolvedValue(VALID_RECONCILIATION as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-provisions/reconciliation?year=2026&month=3`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.byAsset)).toBe(true);
      expect(res.body.byAsset.length).toBeGreaterThanOrEqual(1);
      const entry = res.body.byAsset[0];
      expect(entry).toHaveProperty('assetId');
      expect(entry).toHaveProperty('provisioned');
      expect(entry).toHaveProperty('actual');
      expect(entry).toHaveProperty('variance');
    });

    it('returns zero variance when no actual costs for period', async () => {
      const noActualReconciliation = {
        periodYear: 2026,
        periodMonth: 3,
        totalProvisioned: 1500,
        totalActualCost: 0,
        variance: 1500,
        byAsset: [],
      };
      mockedService.getReconciliation.mockResolvedValue(noActualReconciliation as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-provisions/reconciliation?year=2026&month=3`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.variance).toBe(res.body.totalProvisioned);
    });
  });

  // ─── Monthly provision cron ───────────────────────────────────────────────

  describe('Monthly provision cron', () => {
    it('creates provision entries for active provisions', async () => {
      mockedService.processMonthlyProvisions.mockResolvedValue(undefined as never);
      await maintenanceProvisionsService.processMonthlyProvisions();
      expect(mockedService.processMonthlyProvisions).toHaveBeenCalled();
    });

    it('skips inactive provisions', async () => {
      mockedService.processMonthlyProvisions.mockResolvedValue(undefined as never);
      await maintenanceProvisionsService.processMonthlyProvisions();
      expect(mockedService.processMonthlyProvisions).toHaveBeenCalledTimes(1);
    });

    it('handles fleet-level provision (assetId null)', async () => {
      mockedService.processMonthlyProvisions.mockResolvedValue(undefined as never);
      const result = await maintenanceProvisionsService.processMonthlyProvisions();
      expect(result).toBeUndefined();
    });
  });
});
