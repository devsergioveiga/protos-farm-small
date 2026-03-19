import request from 'supertest';
import { app } from '../../app';
import * as dashboardService from './purchasing-dashboard.service';
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

jest.mock('./purchasing-dashboard.service', () => ({
  getDashboardData: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(dashboardService);
const mockedAuth = jest.mocked(authService);

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
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

const MOCK_DASHBOARD_DATA = {
  pendingApprovalCount: 5,
  pendingApprovalCountPrev: 3,
  overduePoCount: 2,
  overduePoCountPrev: 4,
  avgCycleDays: 8,
  avgCycleDaysPrev: 10,
  lateDeliveriesCount: 1,
  lateDeliveriesCountPrev: 2,
  volumeByStage: [
    { stage: 'RC_PENDENTE', count: 3, totalValue: 5000 },
    { stage: 'RC_APROVADA', count: 2, totalValue: 3000 },
    { stage: 'EM_COTACAO', count: 4, totalValue: 8000 },
    { stage: 'OC_EMITIDA', count: 1, totalValue: 2000 },
    { stage: 'AGUARDANDO_ENTREGA', count: 2, totalValue: 4000 },
    { stage: 'RECEBIDO', count: 1, totalValue: 1500 },
    { stage: 'PAGO', count: 5, totalValue: 10000 },
  ],
  purchasesByCategory: [
    { category: 'DEFENSIVO', totalValue: 15000 },
    { category: 'FERTILIZANTE', totalValue: 8000 },
  ],
  monthlyEvolution: [
    { month: '2026-01', totalValue: 12000 },
    { month: '2026-02', totalValue: 15000 },
  ],
  urgentVsPlanned: [
    { month: '2025-10', urgent: 2, planned: 8 },
    { month: '2025-11', urgent: 1, planned: 6 },
  ],
  alerts: {
    overduePoCount: 2,
    rcAboveSlaCount: 3,
    budgetExceededCount: 1,
    lateDeliveriesCount: 1,
  },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PurchasingDashboard endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/org/:orgId/purchasing/dashboard', () => {
    it('should return all 4 KPI fields with _Prev variants', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getDashboardData.mockResolvedValue(MOCK_DASHBOARD_DATA);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      const body = response.body;
      expect(body).toHaveProperty('pendingApprovalCount', 5);
      expect(body).toHaveProperty('pendingApprovalCountPrev', 3);
      expect(body).toHaveProperty('overduePoCount', 2);
      expect(body).toHaveProperty('overduePoCountPrev', 4);
      expect(body).toHaveProperty('avgCycleDays', 8);
      expect(body).toHaveProperty('avgCycleDaysPrev', 10);
      expect(body).toHaveProperty('lateDeliveriesCount', 1);
      expect(body).toHaveProperty('lateDeliveriesCountPrev', 2);
    });

    it('should return volumeByStage with 7 entries (one per stage)', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getDashboardData.mockResolvedValue(MOCK_DASHBOARD_DATA);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.volumeByStage).toHaveLength(7);
      const stageIds = response.body.volumeByStage.map((s: { stage: string }) => s.stage);
      expect(stageIds).toContain('RC_PENDENTE');
      expect(stageIds).toContain('PAGO');
    });

    it('should return purchasesByCategory and monthlyEvolution chart data', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getDashboardData.mockResolvedValue(MOCK_DASHBOARD_DATA);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.purchasesByCategory)).toBe(true);
      expect(Array.isArray(response.body.monthlyEvolution)).toBe(true);
      expect(Array.isArray(response.body.urgentVsPlanned)).toBe(true);
    });

    it('should return alerts section', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getDashboardData.mockResolvedValue(MOCK_DASHBOARD_DATA);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.alerts).toHaveProperty('overduePoCount');
      expect(response.body.alerts).toHaveProperty('rcAboveSlaCount');
      expect(response.body.alerts).toHaveProperty('budgetExceededCount');
      expect(response.body.alerts).toHaveProperty('lateDeliveriesCount');
    });

    it('should pass farmId filter to service', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getDashboardData.mockResolvedValue(MOCK_DASHBOARD_DATA);

      await request(app)
        .get('/api/org/org-1/purchasing/dashboard?farmId=farm-1')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.getDashboardData).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ farmId: 'farm-1' }),
      );
    });

    it('should pass periodStart and periodEnd to service', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getDashboardData.mockResolvedValue(MOCK_DASHBOARD_DATA);

      const start = '2026-01-01T00:00:00.000Z';
      const end = '2026-01-31T23:59:59.999Z';

      await request(app)
        .get(`/api/org/org-1/purchasing/dashboard?periodStart=${start}&periodEnd=${end}`)
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.getDashboardData).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({
          periodStart: new Date(start),
          periodEnd: new Date(end),
        }),
      );
    });

    it('should return 400 for invalid date format', async () => {
      authAs(MANAGER_PAYLOAD);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/dashboard?periodStart=not-a-date')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/org/org-1/purchasing/dashboard');
      expect(response.status).toBe(401);
    });

    it('should return 403 for OPERATOR without purchases:read permission', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });
});
