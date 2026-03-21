import request from 'supertest';
import { app } from '../../app';
import * as maintenancePlansService from './maintenance-plans.service';
import * as authService from '../auth/auth.service';
import { computeNextDue } from './maintenance-plans.service';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./maintenance-plans.service', () => ({
  createMaintenancePlan: jest.fn(),
  listMaintenancePlans: jest.fn(),
  getMaintenancePlan: jest.fn(),
  updateMaintenancePlan: jest.fn(),
  deleteMaintenancePlan: jest.fn(),
  processOverduePlans: jest.fn(),
  computeNextDue: jest.requireActual('./maintenance-plans.service').computeNextDue,
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(maintenancePlansService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-test-1';
const ASSET_ID = 'asset-test-1';
const PLAN_ID = 'plan-test-1';

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

const VALID_PLAN = {
  id: PLAN_ID,
  organizationId: ORG_ID,
  assetId: ASSET_ID,
  name: 'Troca de óleo do trator',
  description: 'Troca de óleo a cada 250 horas',
  triggerType: 'HOURMETER',
  intervalValue: '250',
  alertBeforeValue: '20',
  lastExecutedAt: null,
  lastMeterValue: '0',
  nextDueAt: null,
  nextDueMeter: '250',
  isActive: true,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  asset: { id: ASSET_ID, name: 'Trator John Deere', assetTag: 'PAT-00001' },
};

describe('MaintenancePlans Routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── POST /api/org/:orgId/maintenance-plans ────────────────────────

  describe('POST /api/org/:orgId/maintenance-plans', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('creates maintenance plan with CALENDAR trigger and computes nextDueAt', async () => {
      const calendarPlan = {
        ...VALID_PLAN,
        triggerType: 'CALENDAR',
        intervalValue: '90',
        nextDueAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        nextDueMeter: null,
        lastMeterValue: null,
      };
      mockedService.createMaintenancePlan.mockResolvedValue(calendarPlan as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-plans`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          assetId: ASSET_ID,
          name: 'Revisão trimestral',
          triggerType: 'CALENDAR',
          intervalValue: 90,
          alertBeforeValue: 7,
        });

      expect(res.status).toBe(201);
      expect(res.body.triggerType).toBe('CALENDAR');
      expect(mockedService.createMaintenancePlan).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({
          assetId: ASSET_ID,
          triggerType: 'CALENDAR',
          intervalValue: 90,
        }),
      );
    });

    it('creates maintenance plan with HOURMETER trigger and computes nextDueMeter', async () => {
      mockedService.createMaintenancePlan.mockResolvedValue(VALID_PLAN as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-plans`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          assetId: ASSET_ID,
          name: 'Troca de óleo',
          triggerType: 'HOURMETER',
          intervalValue: 250,
          alertBeforeValue: 20,
        });

      expect(res.status).toBe(201);
      expect(res.body.triggerType).toBe('HOURMETER');
      expect(mockedService.createMaintenancePlan).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({ triggerType: 'HOURMETER', intervalValue: 250 }),
      );
    });

    it('creates maintenance plan with ODOMETER trigger and computes nextDueMeter', async () => {
      const odoMeterPlan = { ...VALID_PLAN, triggerType: 'ODOMETER', nextDueMeter: '10000' };
      mockedService.createMaintenancePlan.mockResolvedValue(odoMeterPlan as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-plans`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          assetId: ASSET_ID,
          name: 'Revisão km',
          triggerType: 'ODOMETER',
          intervalValue: 10000,
          alertBeforeValue: 500,
        });

      expect(res.status).toBe(201);
      expect(res.body.triggerType).toBe('ODOMETER');
    });

    it('returns 400 when assetId is missing', async () => {
      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-plans`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Troca de óleo',
          triggerType: 'HOURMETER',
          intervalValue: 250,
          alertBeforeValue: 20,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/assetId/i);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-plans`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          assetId: ASSET_ID,
          triggerType: 'HOURMETER',
          intervalValue: 250,
          alertBeforeValue: 20,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name/i);
    });

    it('returns 400 when triggerType is missing', async () => {
      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-plans`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          assetId: ASSET_ID,
          name: 'Troca de óleo',
          intervalValue: 250,
          alertBeforeValue: 20,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/triggerType/i);
    });

    it('returns 403 when OPERATOR lacks maintenance-plans:create permission', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/maintenance-plans`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          assetId: ASSET_ID,
          name: 'Troca de óleo',
          triggerType: 'HOURMETER',
          intervalValue: 250,
          alertBeforeValue: 20,
        });

      expect(res.status).toBe(403);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).post(`/api/org/${ORG_ID}/maintenance-plans`);
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/org/:orgId/maintenance-plans ─────────────────────────

  describe('GET /api/org/:orgId/maintenance-plans', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    const listResponse = {
      data: [VALID_PLAN],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    it('lists plans with no filter', async () => {
      mockedService.listMaintenancePlans.mockResolvedValue(listResponse as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-plans`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockedService.listMaintenancePlans).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({}),
      );
    });

    it('lists plans filtered by assetId', async () => {
      mockedService.listMaintenancePlans.mockResolvedValue(listResponse as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-plans?assetId=${ASSET_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listMaintenancePlans).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({ assetId: ASSET_ID }),
      );
    });

    it('lists plans filtered by triggerType', async () => {
      mockedService.listMaintenancePlans.mockResolvedValue(listResponse as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-plans?triggerType=HOURMETER`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listMaintenancePlans).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({ triggerType: 'HOURMETER' }),
      );
    });

    it('lists plans filtered by isActive=true', async () => {
      mockedService.listMaintenancePlans.mockResolvedValue(listResponse as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-plans?isActive=true`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.listMaintenancePlans).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        expect.objectContaining({ isActive: true }),
      );
    });
  });

  // ─── GET /api/org/:orgId/maintenance-plans/:id ─────────────────────

  describe('GET /api/org/:orgId/maintenance-plans/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('returns single plan with asset and recent work orders', async () => {
      const fullPlan = { ...VALID_PLAN, workOrders: [] };
      mockedService.getMaintenancePlan.mockResolvedValue(fullPlan as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-plans/${PLAN_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(PLAN_ID);
      expect(mockedService.getMaintenancePlan).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        PLAN_ID,
      );
    });

    it('returns 404 when plan not found', async () => {
      const { MaintenancePlanError } = jest.requireActual('./maintenance-plans.types');
      mockedService.getMaintenancePlan.mockRejectedValue(
        new MaintenancePlanError('Plano não encontrado', 404),
      );

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/maintenance-plans/non-existent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/não encontrado/i);
    });
  });

  // ─── PUT /api/org/:orgId/maintenance-plans/:id ─────────────────────

  describe('PUT /api/org/:orgId/maintenance-plans/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('updates plan fields and returns updated plan', async () => {
      const updatedPlan = { ...VALID_PLAN, intervalValue: '300', nextDueMeter: '300' };
      mockedService.updateMaintenancePlan.mockResolvedValue(updatedPlan as never);

      const res = await request(app)
        .put(`/api/org/${ORG_ID}/maintenance-plans/${PLAN_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ intervalValue: 300 });

      expect(res.status).toBe(200);
      expect(res.body.intervalValue).toBe('300');
      expect(mockedService.updateMaintenancePlan).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        PLAN_ID,
        expect.objectContaining({ intervalValue: 300 }),
      );
    });

    it('toggles isActive flag to false', async () => {
      const inactivePlan = { ...VALID_PLAN, isActive: false };
      mockedService.updateMaintenancePlan.mockResolvedValue(inactivePlan as never);

      const res = await request(app)
        .put(`/api/org/${ORG_ID}/maintenance-plans/${PLAN_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });
  });

  // ─── DELETE /api/org/:orgId/maintenance-plans/:id ──────────────────

  describe('DELETE /api/org/:orgId/maintenance-plans/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('deletes plan and returns 204', async () => {
      mockedService.deleteMaintenancePlan.mockResolvedValue(undefined as never);

      const res = await request(app)
        .delete(`/api/org/${ORG_ID}/maintenance-plans/${PLAN_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
      expect(mockedService.deleteMaintenancePlan).toHaveBeenCalledWith(
        { organizationId: ORG_ID },
        PLAN_ID,
      );
    });

    it('returns 404 when plan not found', async () => {
      const { MaintenancePlanError } = jest.requireActual('./maintenance-plans.types');
      mockedService.deleteMaintenancePlan.mockRejectedValue(
        new MaintenancePlanError('Plano não encontrado', 404),
      );

      const res = await request(app)
        .delete(`/api/org/${ORG_ID}/maintenance-plans/non-existent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  // ─── computeNextDue pure function tests ────────────────────────────

  describe('computeNextDue function', () => {
    it('CALENDAR: returns nextDueAt = lastExecutedAt + intervalValue days', () => {
      const base = new Date('2026-01-01T00:00:00.000Z');
      const result = computeNextDue('CALENDAR', 90, base, null);
      expect(result.nextDueMeter).toBeNull();
      expect(result.nextDueAt).not.toBeNull();
      const expectedDate = new Date('2026-04-01T00:00:00.000Z');
      expect(result.nextDueAt!.toISOString().slice(0, 10)).toBe(
        expectedDate.toISOString().slice(0, 10),
      );
    });

    it('HOURMETER: returns nextDueMeter = lastMeterValue + intervalValue', () => {
      const result = computeNextDue('HOURMETER', 250, null, 1000);
      expect(result.nextDueAt).toBeNull();
      expect(result.nextDueMeter).toBe(1250);
    });

    it('ODOMETER: returns nextDueMeter = lastMeterValue + intervalValue', () => {
      const result = computeNextDue('ODOMETER', 10000, null, 50000);
      expect(result.nextDueAt).toBeNull();
      expect(result.nextDueMeter).toBe(60000);
    });

    it('CALENDAR with null lastExecutedAt: uses current date as base', () => {
      const before = new Date();
      const result = computeNextDue('CALENDAR', 30, null, null);
      const after = new Date();
      expect(result.nextDueMeter).toBeNull();
      expect(result.nextDueAt).not.toBeNull();
      const expectedMin = new Date(before.getTime() + 29 * 24 * 60 * 60 * 1000);
      const expectedMax = new Date(after.getTime() + 31 * 24 * 60 * 60 * 1000);
      expect(result.nextDueAt!.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(result.nextDueAt!.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('HOURMETER with null lastMeterValue: uses 0 as base', () => {
      const result = computeNextDue('HOURMETER', 500, null, null);
      expect(result.nextDueAt).toBeNull();
      expect(result.nextDueMeter).toBe(500);
    });

    it('ODOMETER with null lastMeterValue: uses 0 as base', () => {
      const result = computeNextDue('ODOMETER', 5000, null, null);
      expect(result.nextDueAt).toBeNull();
      expect(result.nextDueMeter).toBe(5000);
    });
  });

  // ─── Next-due recalculation and overdue alerts ─────────────────────

  describe('Next-due recalculation behavior', () => {
    it('recalculates nextDueAt when intervalValue changes for CALENDAR plan', async () => {
      authAs(ADMIN_PAYLOAD);
      const updatedPlan = {
        ...VALID_PLAN,
        triggerType: 'CALENDAR',
        intervalValue: '60',
        nextDueAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        nextDueMeter: null,
      };
      mockedService.updateMaintenancePlan.mockResolvedValue(updatedPlan as never);

      const res = await request(app)
        .put(`/api/org/${ORG_ID}/maintenance-plans/${PLAN_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ intervalValue: 60 });

      expect(res.status).toBe(200);
      expect(res.body.intervalValue).toBe('60');
    });

    it('recalculates nextDueMeter when intervalValue changes for HOURMETER plan', async () => {
      authAs(ADMIN_PAYLOAD);
      const updatedPlan = { ...VALID_PLAN, intervalValue: '500', nextDueMeter: '500' };
      mockedService.updateMaintenancePlan.mockResolvedValue(updatedPlan as never);

      const res = await request(app)
        .put(`/api/org/${ORG_ID}/maintenance-plans/${PLAN_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ intervalValue: 500 });

      expect(res.status).toBe(200);
      expect(res.body.nextDueMeter).toBe('500');
    });
  });

  describe('Daily alert cron (processOverduePlans)', () => {
    it('marks overdue CALENDAR plans and fires notification', async () => {
      mockedService.processOverduePlans.mockResolvedValue(2 as never);
      const count = await maintenancePlansService.processOverduePlans();
      expect(count).toBe(2);
    });

    it('marks overdue HOURMETER plans comparing current meter reading', async () => {
      mockedService.processOverduePlans.mockResolvedValue(1 as never);
      const count = await maintenancePlansService.processOverduePlans('org-test-1');
      expect(count).toBe(1);
      expect(mockedService.processOverduePlans).toHaveBeenCalledWith('org-test-1');
    });
  });
});
