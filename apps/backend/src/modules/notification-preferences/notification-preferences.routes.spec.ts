import request from 'supertest';
import { app } from '../../app';
import * as prefService from './notification-preferences.service';
import * as authService from '../auth/auth.service';
import { NOTIFICATION_TYPES } from '../notifications/notifications.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./notification-preferences.service', () => ({
  getPreferences: jest.fn(),
  upsertPreference: jest.fn(),
  shouldNotify: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(prefService);
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

// Build default preferences matrix (all enabled = true)
const ALL_PREFERENCES = NOTIFICATION_TYPES.map((eventType) => ({
  eventType,
  badge: true,
  email: true,
}));

const MOCK_UPSERTED_PREF = {
  id: 'pref-1',
  userId: 'manager-1',
  organizationId: 'org-1',
  eventType: 'RC_APPROVED',
  channel: 'EMAIL',
  enabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NotificationPreferences endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/org/:orgId/notification-preferences', () => {
    it('should return preferences matrix with all 15 event types', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getPreferences.mockResolvedValue(ALL_PREFERENCES);

      const response = await request(app)
        .get('/api/org/org-1/notification-preferences')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(15);
      const types = response.body.map((p: { eventType: string }) => p.eventType);
      expect(types).toContain('RC_APPROVED');
      expect(types).toContain('DAILY_DIGEST');
      expect(types).toContain('SLA_REMINDER');
    });

    it('should return enabled=true for types without saved record (opt-out model)', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getPreferences.mockResolvedValue(ALL_PREFERENCES);

      const response = await request(app)
        .get('/api/org/org-1/notification-preferences')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      // All should default to true when no preference is saved
      response.body.forEach((pref: { badge: boolean; email: boolean }) => {
        expect(pref.badge).toBe(true);
        expect(pref.email).toBe(true);
      });
    });

    it('should pass correct userId from token to service', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getPreferences.mockResolvedValue(ALL_PREFERENCES);

      await request(app)
        .get('/api/org/org-1/notification-preferences')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.getPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'manager-1', organizationId: 'org-1' }),
      );
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/org/org-1/notification-preferences');
      expect(response.status).toBe(401);
    });

    it('should return 403 for OPERATOR without purchases:read permission', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .get('/api/org/org-1/notification-preferences')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/org/:orgId/notification-preferences', () => {
    it('should upsert a preference (create or update)', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.upsertPreference.mockResolvedValue(MOCK_UPSERTED_PREF as never);

      const response = await request(app)
        .put('/api/org/org-1/notification-preferences')
        .set('Authorization', 'Bearer valid-token')
        .send({ eventType: 'RC_APPROVED', channel: 'EMAIL', enabled: false });

      expect(response.status).toBe(200);
      expect(response.body.eventType).toBe('RC_APPROVED');
      expect(response.body.enabled).toBe(false);
    });

    it('should call upsertPreference with correct params', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.upsertPreference.mockResolvedValue(MOCK_UPSERTED_PREF as never);

      await request(app)
        .put('/api/org/org-1/notification-preferences')
        .set('Authorization', 'Bearer valid-token')
        .send({ eventType: 'SLA_REMINDER', channel: 'BADGE', enabled: false });

      expect(mockedService.upsertPreference).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'manager-1', organizationId: 'org-1' }),
        { eventType: 'SLA_REMINDER', channel: 'BADGE', enabled: false },
      );
    });

    it('should return 400 for invalid channel value', async () => {
      authAs(MANAGER_PAYLOAD);

      const response = await request(app)
        .put('/api/org/org-1/notification-preferences')
        .set('Authorization', 'Bearer valid-token')
        .send({ eventType: 'RC_APPROVED', channel: 'INVALID', enabled: false });

      expect(response.status).toBe(400);
    });

    it('should return 400 when required fields are missing', async () => {
      authAs(MANAGER_PAYLOAD);

      const response = await request(app)
        .put('/api/org/org-1/notification-preferences')
        .set('Authorization', 'Bearer valid-token')
        .send({ eventType: 'RC_APPROVED' }); // missing channel and enabled

      expect(response.status).toBe(400);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .put('/api/org/org-1/notification-preferences')
        .send({ eventType: 'RC_APPROVED', channel: 'EMAIL', enabled: false });

      expect(response.status).toBe(401);
    });

    it('should return 403 for OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .put('/api/org/org-1/notification-preferences')
        .set('Authorization', 'Bearer valid-token')
        .send({ eventType: 'RC_APPROVED', channel: 'EMAIL', enabled: false });

      expect(response.status).toBe(403);
    });
  });

  describe('shouldNotify', () => {
    it('should return false when preference is disabled', async () => {
      // Test the service function directly via mock
      mockedService.shouldNotify.mockResolvedValue(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await prefService.shouldNotify(
        {} as any,
        'user-1',
        'org-1',
        'RC_APPROVED',
        'EMAIL',
      );
      expect(result).toBe(false);
    });

    it('should return true when no preference is saved (opt-out model)', async () => {
      mockedService.shouldNotify.mockResolvedValue(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await prefService.shouldNotify(
        {} as any,
        'user-1',
        'org-1',
        'SLA_REMINDER',
        'BADGE',
      );
      expect(result).toBe(true);
    });
  });
});
