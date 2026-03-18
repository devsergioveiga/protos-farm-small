import request from 'supertest';
import { app } from '../../app';
import * as dashboardService from './purchase-dashboard.service';
import * as notifPrefsService from '../notifications/notification-preferences.service';
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

jest.mock('./purchase-dashboard.service', () => ({
  getDashboardMetrics: jest.fn(),
  getDashboardAlerts: jest.fn(),
}));

jest.mock('../notifications/notification-preferences.service', () => ({
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
  isNotificationEnabled: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedDashboard = jest.mocked(dashboardService);
const mockedPrefs = jest.mocked(notifPrefsService);
const mockedAuth = jest.mocked(authService);

// ─── Fixtures ─────────────────────────────────────────────────────────

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const BASE_PARAMS = '?startDate=2026-01-01&endDate=2026-03-31';

const VALID_KPI: { current: number; previous: number; changePercent: number } = {
  current: 100,
  previous: 80,
  changePercent: 25,
};

const VALID_METRICS = {
  totalVolume: VALID_KPI,
  requestCount: VALID_KPI,
  avgCycleTimeDays: VALID_KPI,
  onTimeDeliveryPct: VALID_KPI,
  accumulatedSaving: VALID_KPI,
};

const VALID_CHARTS = {
  purchasesByCategory: [{ category: 'INSUMO_AGRICOLA', label: 'Insumos Agricolas', value: 5000 }],
  savingEvolution: [{ month: '2026-01', saving: 500 }],
  budgetVsActual: [
    { category: 'INSUMO_AGRICOLA', label: 'Insumos Agricolas', budget: 10000, actual: 5000 },
  ],
};

const VALID_ALERTS = [
  {
    type: 'PENDING_RC_AGING',
    message: '2 requisicoes pendentes ha mais de 3 dias',
    count: 2,
    referenceIds: ['rc-1', 'rc-2'],
  },
];

// ─── Tests: GET /org/purchase-dashboard ───────────────────────────────

describe('GET /org/purchase-dashboard', () => {
  it('returns 400 when startDate and endDate are missing', async () => {
    authAs(MANAGER_PAYLOAD);

    const res = await request(app)
      .get('/api/org/purchase-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/startDate/);
  });

  it('returns 400 when only startDate is provided', async () => {
    authAs(MANAGER_PAYLOAD);

    const res = await request(app)
      .get('/api/org/purchase-dashboard?startDate=2026-01-01')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
  });

  it('returns 200 with metrics and charts when dates are provided', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedDashboard.getDashboardMetrics.mockResolvedValue({
      metrics: VALID_METRICS,
      charts: VALID_CHARTS,
    });

    const res = await request(app)
      .get(`/api/org/purchase-dashboard${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.metrics).toBeDefined();
    expect(res.body.charts).toBeDefined();
  });

  it('metrics has 5 KPI fields each with current, previous, changePercent', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedDashboard.getDashboardMetrics.mockResolvedValue({
      metrics: VALID_METRICS,
      charts: VALID_CHARTS,
    });

    const res = await request(app)
      .get(`/api/org/purchase-dashboard${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    const { metrics } = res.body;
    expect(metrics.totalVolume).toMatchObject({
      current: expect.any(Number),
      previous: expect.any(Number),
      changePercent: expect.any(Number),
    });
    expect(metrics.requestCount).toMatchObject({
      current: expect.any(Number),
      previous: expect.any(Number),
      changePercent: expect.any(Number),
    });
    expect(metrics.avgCycleTimeDays).toMatchObject({
      current: expect.any(Number),
      previous: expect.any(Number),
      changePercent: expect.any(Number),
    });
    expect(metrics.onTimeDeliveryPct).toMatchObject({
      current: expect.any(Number),
      previous: expect.any(Number),
      changePercent: expect.any(Number),
    });
    expect(metrics.accumulatedSaving).toMatchObject({
      current: expect.any(Number),
      previous: expect.any(Number),
      changePercent: expect.any(Number),
    });
  });

  it('charts has purchasesByCategory, savingEvolution, budgetVsActual arrays', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedDashboard.getDashboardMetrics.mockResolvedValue({
      metrics: VALID_METRICS,
      charts: VALID_CHARTS,
    });

    const res = await request(app)
      .get(`/api/org/purchase-dashboard${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    const { charts } = res.body;
    expect(Array.isArray(charts.purchasesByCategory)).toBe(true);
    expect(Array.isArray(charts.savingEvolution)).toBe(true);
    expect(Array.isArray(charts.budgetVsActual)).toBe(true);
  });
});

// ─── Tests: GET /org/purchase-dashboard/alerts ────────────────────────

describe('GET /org/purchase-dashboard/alerts', () => {
  it('returns 200 with array of alerts', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedDashboard.getDashboardAlerts.mockResolvedValue(
      VALID_ALERTS as ReturnType<typeof mockedDashboard.getDashboardAlerts> extends Promise<infer T>
        ? T
        : never,
    );

    const res = await request(app)
      .get('/api/org/purchase-dashboard/alerts')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns empty array when no alerts', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedDashboard.getDashboardAlerts.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/org/purchase-dashboard/alerts')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ─── Tests: GET /org/notifications/preferences ────────────────────────

describe('GET /org/notifications/preferences', () => {
  it('returns 200 with array of preferences', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedPrefs.getPreferences.mockResolvedValue([
      { eventType: 'RC_APPROVED', channel: 'IN_APP', enabled: true },
      { eventType: 'PO_OVERDUE', channel: 'IN_APP', enabled: false },
    ]);

    const res = await request(app)
      .get('/api/org/notifications/preferences')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      eventType: expect.any(String),
      channel: expect.any(String),
      enabled: expect.any(Boolean),
    });
  });

  it('returns empty array when user has no preferences saved', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedPrefs.getPreferences.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/org/notifications/preferences')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ─── Tests: PATCH /org/notifications/preferences ──────────────────────

describe('PATCH /org/notifications/preferences', () => {
  it('returns 200 success when valid preferences array is provided', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedPrefs.updatePreferences.mockResolvedValue(undefined);

    const res = await request(app)
      .patch('/api/org/notifications/preferences')
      .set('Authorization', 'Bearer token')
      .send({ preferences: [{ eventType: 'RC_APPROVED', channel: 'IN_APP', enabled: false }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 400 when preferences is not an array', async () => {
    authAs(MANAGER_PAYLOAD);

    const res = await request(app)
      .patch('/api/org/notifications/preferences')
      .set('Authorization', 'Bearer token')
      .send({ preferences: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/array/);
  });

  it('returns 400 when preferences key is missing', async () => {
    authAs(MANAGER_PAYLOAD);

    const res = await request(app)
      .patch('/api/org/notifications/preferences')
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(400);
  });
});
