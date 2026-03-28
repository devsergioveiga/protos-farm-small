// ─── Accounting Dashboard Routes Tests ────────────────────────────────────────
// Route integration tests for GET /org/:orgId/accounting-dashboard.
// Pattern: mock service + auth, use supertest against Express app.

// ─── Setup mocks before imports ──────────────────────────────────────────────

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

jest.mock('./accounting-dashboard.service', () => ({
  getAccountingDashboard: jest.fn(),
}));

import request from 'supertest';
import { app } from '../../app';
import * as service from './accounting-dashboard.service';
import * as authService from '../auth/auth.service';
import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockedService = jest.mocked(service);
const mockedAuth = jest.mocked(authService);
const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const ORG_ID = 'org-1';
const BASE = `/api/org/${ORG_ID}/accounting-dashboard`;

// ─── Mock data helpers ────────────────────────────────────────────────────────

function makeKpiCard(label: string) {
  return {
    label,
    value: '50000.00',
    deltaPercent: '+10.00',
    deltaDirection: 'up' as const,
  };
}

function makeMonthlyEntry(month: number) {
  return {
    month,
    receita: '100000.00',
    despesa: '80000.00',
  };
}

function makeCostItem(label: string) {
  return {
    label,
    value: '30000.00',
    percent: '35.20',
  };
}

function makeBpIndicator(id: string, label: string) {
  return {
    id,
    label,
    value: '2.50',
    sparkline: [
      { month: 1, value: 2.5 },
      { month: 2, value: 2.6 },
    ],
  };
}

function makeAlert(id: string, severity: 'warning' | 'info') {
  return {
    id,
    label: `Alert ${id}`,
    count: 3,
    navigateTo: '/some-route',
    severity,
  };
}

function makeDashboardOutput() {
  return {
    kpiCards: [
      makeKpiCard('Resultado Acumulado'),
      makeKpiCard('Receita Total'),
      makeKpiCard('Despesa Total'),
      makeKpiCard('Margem Operacional'),
    ],
    monthlyChart: Array.from({ length: 12 }, (_, i) => makeMonthlyEntry(i + 1)),
    costComposition: [makeCostItem('CPV'), makeCostItem('Despesas Administrativas')],
    bpIndicators: [
      makeBpIndicator('liquidez-corrente', 'Liquidez Corrente'),
      makeBpIndicator('endividamento-geral', 'Endividamento Geral'),
      makeBpIndicator('roe', 'ROE'),
      makeBpIndicator('pl-ha', 'PL/ha'),
    ],
    alerts: [makeAlert('periodos-abertos', 'warning')],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Accounting Dashboard Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── Parameter validation ─────────────────────────────────────────────────

  it('returns 400 when fiscalYearId is missing', async () => {
    const res = await request(app)
      .get(BASE)
      .query({ month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FISCAL_YEAR_ID');
  });

  it('returns 400 when month is missing', async () => {
    const res = await request(app)
      .get(BASE)
      .query({ fiscalYearId: 'fy-1' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_MONTH');
  });

  it('returns 400 when month is 0 (below range)', async () => {
    const res = await request(app)
      .get(BASE)
      .query({ fiscalYearId: 'fy-1', month: '0' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MONTH');
  });

  it('returns 400 when month is 13 (above range)', async () => {
    const res = await request(app)
      .get(BASE)
      .query({ fiscalYearId: 'fy-1', month: '13' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MONTH');
  });

  it('returns 400 when month is not a number', async () => {
    const res = await request(app)
      .get(BASE)
      .query({ fiscalYearId: 'fy-1', month: 'abc' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MONTH');
  });

  // ─── Successful response ─────────────────────────────────────────────────

  it('returns 200 with correct structure when service succeeds', async () => {
    const dashboardOutput = makeDashboardOutput();
    (mockedService.getAccountingDashboard as jest.Mock).mockResolvedValue(dashboardOutput);

    const res = await request(app)
      .get(BASE)
      .query({ fiscalYearId: 'fy-1', month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('kpiCards');
    expect(res.body).toHaveProperty('monthlyChart');
    expect(res.body).toHaveProperty('costComposition');
    expect(res.body).toHaveProperty('bpIndicators');
    expect(res.body).toHaveProperty('alerts');
  });

  it('returns kpiCards array with 4 items', async () => {
    const dashboardOutput = makeDashboardOutput();
    (mockedService.getAccountingDashboard as jest.Mock).mockResolvedValue(dashboardOutput);

    const res = await request(app)
      .get(BASE)
      .query({ fiscalYearId: 'fy-1', month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.kpiCards).toHaveLength(4);
    expect(res.body.kpiCards[0]).toMatchObject({
      label: 'Resultado Acumulado',
      value: expect.any(String),
      deltaDirection: expect.stringMatching(/^(up|down|neutral)$/),
    });
  });

  it('returns monthlyChart with 12 entries', async () => {
    const dashboardOutput = makeDashboardOutput();
    (mockedService.getAccountingDashboard as jest.Mock).mockResolvedValue(dashboardOutput);

    const res = await request(app)
      .get(BASE)
      .query({ fiscalYearId: 'fy-1', month: '6' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.monthlyChart).toHaveLength(12);
    expect(res.body.monthlyChart[0]).toMatchObject({
      month: expect.any(Number),
      receita: expect.any(String),
      despesa: expect.any(String),
    });
  });

  it('returns bpIndicators with 4 items including sparklines', async () => {
    const dashboardOutput = makeDashboardOutput();
    (mockedService.getAccountingDashboard as jest.Mock).mockResolvedValue(dashboardOutput);

    const res = await request(app)
      .get(BASE)
      .query({ fiscalYearId: 'fy-1', month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.bpIndicators).toHaveLength(4);
    const ids = res.body.bpIndicators.map((i: { id: string }) => i.id);
    expect(ids).toContain('liquidez-corrente');
    expect(ids).toContain('endividamento-geral');
    expect(ids).toContain('roe');
    expect(ids).toContain('pl-ha');
    expect(res.body.bpIndicators[0]).toHaveProperty('sparkline');
    expect(Array.isArray(res.body.bpIndicators[0].sparkline)).toBe(true);
  });

  it('returns alerts array (only non-zero count alerts are included)', async () => {
    const dashboardOutput = makeDashboardOutput();
    (mockedService.getAccountingDashboard as jest.Mock).mockResolvedValue(dashboardOutput);

    const res = await request(app)
      .get(BASE)
      .query({ fiscalYearId: 'fy-1', month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    // All returned alerts must have count > 0
    for (const alert of res.body.alerts as Array<{ count: number }>) {
      expect(alert.count).toBeGreaterThan(0);
    }
  });

  it('calls getAccountingDashboard with correct orgId and parsed filters', async () => {
    const dashboardOutput = makeDashboardOutput();
    (mockedService.getAccountingDashboard as jest.Mock).mockResolvedValue(dashboardOutput);

    await request(app)
      .get(BASE)
      .query({ fiscalYearId: 'fy-1', month: '5' })
      .set('Authorization', 'Bearer token');

    expect(mockedService.getAccountingDashboard).toHaveBeenCalledWith('org-1', {
      fiscalYearId: 'fy-1',
      month: 5,
    });
  });

  // ─── Auth guard ───────────────────────────────────────────────────────────

  it('returns 401 without authorization header', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app).get(BASE).query({ fiscalYearId: 'fy-1', month: '3' });

    expect(res.status).toBe(401);
  });
});
