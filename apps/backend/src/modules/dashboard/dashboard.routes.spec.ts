import request from 'supertest';
import { app } from '../../app';
import * as dashboardService from './dashboard.service';
import * as authService from '../auth/auth.service';

jest.mock('./dashboard.service', () => ({
  getOrgDashboardStats: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

// checkPermission relies on getUserPermissions
jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn().mockResolvedValue(['farms:read', 'farms:create']),
}));

const mockedService = jest.mocked(dashboardService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'user-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'user-2',
  email: 'op@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
}

const MOCK_STATS = {
  summary: {
    totalFarms: 5,
    totalPlots: 12,
    totalAreaHa: 1500.5,
    activeUsers: 8,
  },
  farmsByUf: [
    { uf: 'MG', count: 3 },
    { uf: 'SP', count: 2 },
  ],
  recentActivity: [
    {
      id: 'log-1',
      actorEmail: 'admin@org.com',
      action: 'CREATE_FARM',
      targetType: 'farm',
      targetId: 'farm-1',
      metadata: { name: 'Fazenda Teste' },
      createdAt: new Date('2026-03-01'),
    },
  ],
  alerts: {
    farmLimit: { current: 5, max: 10, percentage: 50, warning: false },
    userLimit: { current: 8, max: 10, percentage: 80, warning: true },
    expiringContracts: { total: 0, alerts: [] },
  },
};

describe('Dashboard endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Re-mock getUserPermissions after reset
    jest
      .requireMock('../../shared/rbac/rbac.service')
      .getUserPermissions.mockResolvedValue(['farms:read', 'farms:create']);
  });

  describe('Auth guard', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/org/dashboard');
      expect(response.status).toBe(401);
    });

    it('should return 403 without farms:read permission', async () => {
      authAs(OPERATOR_PAYLOAD);
      jest.requireMock('../../shared/rbac/rbac.service').getUserPermissions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/org/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/org/dashboard', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with dashboard stats', async () => {
      mockedService.getOrgDashboardStats.mockResolvedValue(MOCK_STATS);

      const response = await request(app)
        .get('/api/org/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.summary.totalFarms).toBe(5);
      expect(response.body.summary.totalPlots).toBe(12);
      expect(response.body.summary.totalAreaHa).toBe(1500.5);
      expect(response.body.summary.activeUsers).toBe(8);
      expect(response.body.farmsByUf).toHaveLength(2);
      expect(response.body.recentActivity).toHaveLength(1);
      expect(response.body.alerts.farmLimit.warning).toBe(false);
      expect(response.body.alerts.userLimit.warning).toBe(true);
    });

    it('should pass correct organizationId to service', async () => {
      mockedService.getOrgDashboardStats.mockResolvedValue(MOCK_STATS);

      await request(app).get('/api/org/dashboard').set('Authorization', 'Bearer valid-token');

      expect(mockedService.getOrgDashboardStats).toHaveBeenCalledWith({
        organizationId: 'org-1',
      });
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.getOrgDashboardStats.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .get('/api/org/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });

    it('should return 403 if user has no organizationId', async () => {
      authAs({ ...ADMIN_PAYLOAD, organizationId: '' });

      const response = await request(app)
        .get('/api/org/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });
});
