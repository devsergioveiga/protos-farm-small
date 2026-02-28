import request from 'supertest';
import { app } from '../../app';
import * as adminService from './admin.service';
import * as authService from '../auth/auth.service';

jest.mock('./admin.service', () => ({
  getDashboardStats: jest.fn(),
  listAuditLogs: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(adminService);
const mockedAuth = jest.mocked(authService);

const SUPER_ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@test.com',
  role: 'SUPER_ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@test.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
}

describe('Admin endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/admin/dashboard');
      expect(response.status).toBe(401);
    });

    it('should return 403 with non-SUPER_ADMIN role', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });

  // ─── GET /api/admin/dashboard ─────────────────────────────────

  describe('GET /api/admin/dashboard', () => {
    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 200 with dashboard stats', async () => {
      const stats = {
        organizations: {
          total: 10,
          active: 7,
          suspended: 2,
          cancelled: 1,
          byPlan: [
            { plan: 'basic', count: 5 },
            { plan: 'professional', count: 3 },
            { plan: 'enterprise', count: 2 },
          ],
        },
        users: { total: 50 },
        farms: { total: 20 },
      };
      mockedService.getDashboardStats.mockResolvedValue(stats);

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.organizations.total).toBe(10);
      expect(response.body.organizations.active).toBe(7);
      expect(response.body.organizations.byPlan).toHaveLength(3);
      expect(response.body.users.total).toBe(50);
      expect(response.body.farms.total).toBe(20);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.getDashboardStats.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── GET /api/admin/audit-logs ────────────────────────────────

  describe('GET /api/admin/audit-logs', () => {
    beforeEach(() => authAs(SUPER_ADMIN_PAYLOAD));

    it('should return 200 with paginated audit logs', async () => {
      const result = {
        data: [
          {
            id: 'log-1',
            actorId: 'admin-1',
            actorEmail: 'admin@test.com',
            actorRole: 'SUPER_ADMIN',
            action: 'CREATE_ORGANIZATION',
            targetType: 'organization',
            targetId: 'org-1',
            metadata: { name: 'Test Org' },
            ipAddress: '127.0.0.1',
            createdAt: new Date().toISOString(),
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockedService.listAuditLogs.mockResolvedValue(result as never);

      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].action).toBe('CREATE_ORGANIZATION');
      expect(response.body.meta.total).toBe(1);
    });

    it('should pass query params to service', async () => {
      mockedService.listAuditLogs.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      } as never);

      await request(app)
        .get(
          '/api/admin/audit-logs?page=2&limit=10&action=CREATE_ORGANIZATION&actorId=admin-1&dateFrom=2026-01-01&dateTo=2026-12-31',
        )
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listAuditLogs).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        action: 'CREATE_ORGANIZATION',
        actorId: 'admin-1',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      });
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.listAuditLogs.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });
});
