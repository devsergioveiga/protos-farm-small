// ─── HR Dashboard Routes — Tests ──────────────────────────────────────
// INTEGR-03: Tests for GET /org/hr-dashboard endpoint.
// All service calls are mocked — unit tests for routing/parsing.

import request from 'supertest';
import { app } from '../../app';
import * as hrDashboardService from './hr-dashboard.service';
import * as authService from '../auth/auth.service';
import type { HrDashboardResponse } from './hr-dashboard.types';

jest.mock('../../shared/audit/audit.service', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./hr-dashboard.service', () => ({
  getHrDashboard: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(hrDashboardService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD: authService.TokenPayload = {
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

// ─── Fixtures ────────────────────────────────────────────────────────

const DASHBOARD_OUTPUT: HrDashboardResponse = {
  headcount: {
    total: 12,
    byStatus: { ATIVO: 10, AFASTADO: 1, FERIAS: 1, DESLIGADO: 0 },
    byContractType: { CLT_INDETERMINATE: 8, SEASONAL: 3, TRIAL: 1 },
  },
  currentMonthCost: {
    gross: 60000,
    net: 48000,
    charges: 15000,
    avgPerEmployee: 5000,
    costPerHectare: 120.5,
  },
  trend12Months: [
    { yearMonth: '2025-04', gross: 55000, net: 44000, charges: 13750 },
    { yearMonth: '2025-05', gross: 56000, net: 44800, charges: 14000 },
    { yearMonth: '2025-06', gross: 57000, net: 45600, charges: 14250 },
    { yearMonth: '2025-07', gross: 58000, net: 46400, charges: 14500 },
    { yearMonth: '2025-08', gross: 59000, net: 47200, charges: 14750 },
    { yearMonth: '2025-09', gross: 60000, net: 48000, charges: 15000 },
    { yearMonth: '2025-10', gross: 61000, net: 48800, charges: 15250 },
    { yearMonth: '2025-11', gross: 62000, net: 49600, charges: 15500 },
    { yearMonth: '2025-12', gross: 63000, net: 50400, charges: 15750 },
    { yearMonth: '2026-01', gross: 64000, net: 51200, charges: 16000 },
    { yearMonth: '2026-02', gross: 65000, net: 52000, charges: 16250 },
    { yearMonth: '2026-03', gross: 60000, net: 48000, charges: 15000 },
  ],
  composition: [
    { label: 'Salários', amount: 42000, percentage: 70 },
    { label: 'Horas Extras', amount: 6000, percentage: 10 },
    { label: 'Encargos Patronais', amount: 9000, percentage: 15 },
    { label: 'Benefícios', amount: 3000, percentage: 5 },
  ],
  costByActivity: [
    { activityType: 'PLANTING', totalCost: 12000 },
    { activityType: 'SPRAYING', totalCost: 8000 },
  ],
  turnover: {
    last12MonthsRate: 16.67,
    terminationsLast12: 2,
    admissionsLast12: 2,
  },
  upcomingContractExpirations: [
    {
      days: 30,
      count: 1,
      employees: [
        {
          id: 'emp-1',
          name: 'João Silva',
          endDate: '2026-04-15',
          contractType: 'SEASONAL',
        },
      ],
    },
    { days: 60, count: 0, employees: [] },
    { days: 90, count: 2, employees: [] },
  ],
  alerts: {
    overduePayablesPayroll: 3,
    pendingTimesheets: 5,
    expiredContracts: 1,
  },
};

const EMPTY_DASHBOARD: HrDashboardResponse = {
  headcount: {
    total: 0,
    byStatus: {},
    byContractType: {},
  },
  currentMonthCost: {
    gross: 0,
    net: 0,
    charges: 0,
    avgPerEmployee: 0,
    costPerHectare: null,
  },
  trend12Months: [],
  composition: [],
  costByActivity: [],
  turnover: {
    last12MonthsRate: 0,
    terminationsLast12: 0,
    admissionsLast12: 0,
  },
  upcomingContractExpirations: [
    { days: 30, count: 0, employees: [] },
    { days: 60, count: 0, employees: [] },
    { days: 90, count: 0, employees: [] },
  ],
  alerts: {
    overduePayablesPayroll: 0,
    pendingTimesheets: 0,
    expiredContracts: 0,
  },
};

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── GET /api/org/hr-dashboard ────────────────────────────────────────

describe('GET /api/org/hr-dashboard', () => {
  it('Test 1: returns 200 with correct headcount structure', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHrDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.headcount).toEqual({
      total: 12,
      byStatus: expect.objectContaining({ ATIVO: expect.any(Number) }),
      byContractType: expect.any(Object),
    });
  });

  it('Test 2: returns currentMonthCost when COMPLETED run exists', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHrDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.currentMonthCost).toMatchObject({
      gross: 60000,
      net: 48000,
      charges: 15000,
      avgPerEmployee: 5000,
      costPerHectare: 120.5,
    });
  });

  it('Test 3: returns null costPerHectare when no farm area data', async () => {
    authAs(ADMIN_PAYLOAD);
    const output = {
      ...DASHBOARD_OUTPUT,
      currentMonthCost: { ...DASHBOARD_OUTPUT.currentMonthCost, costPerHectare: null },
    };
    mockedService.getHrDashboard.mockResolvedValue(output);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.currentMonthCost.costPerHectare).toBeNull();
  });

  it('Test 4: trend12Months returns up to 12 entries', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHrDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.trend12Months)).toBe(true);
    expect(res.body.trend12Months.length).toBeLessThanOrEqual(12);
    if (res.body.trend12Months.length > 0) {
      expect(res.body.trend12Months[0]).toMatchObject({
        yearMonth: expect.stringMatching(/^\d{4}-\d{2}$/),
        gross: expect.any(Number),
        net: expect.any(Number),
        charges: expect.any(Number),
      });
    }
  });

  it('Test 5: composition percentages sum to ~100', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHrDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    const composition: Array<{ percentage: number }> = res.body.composition;
    if (composition.length > 0) {
      const sum = composition.reduce((s, c) => s + c.percentage, 0);
      // Allow 1% tolerance for rounding
      expect(sum).toBeGreaterThanOrEqual(99);
      expect(sum).toBeLessThanOrEqual(101);
    }
  });

  it('Test 6: turnover calculation with known admissions/terminations', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHrDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.turnover).toMatchObject({
      last12MonthsRate: 16.67,
      terminationsLast12: 2,
      admissionsLast12: 2,
    });
  });

  it('Test 7: upcomingContractExpirations groups into 30/60/90 day buckets', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHrDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    const expirations: Array<{ days: number; count: number }> =
      res.body.upcomingContractExpirations;
    expect(expirations.map((e) => e.days)).toEqual([30, 60, 90]);
    expect(expirations[0].count).toBe(1);
    expect(expirations[0].employees[0]).toMatchObject({
      id: 'emp-1',
      name: 'João Silva',
      contractType: 'SEASONAL',
    });
  });

  it('Test 8: alerts count overdue payables and pending timesheets', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHrDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.alerts).toEqual({
      overduePayablesPayroll: 3,
      pendingTimesheets: 5,
      expiredContracts: 1,
    });
  });

  it('Test 9: farmId filter is passed through to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHrDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3&farmId=farm-abc')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.getHrDashboard).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      { farmId: 'farm-abc', year: 2026, month: 3 },
    );
  });

  it('Test 10: returns empty/zero values gracefully when no payroll data exists', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHrDashboard.mockResolvedValue(EMPTY_DASHBOARD);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.headcount.total).toBe(0);
    expect(res.body.currentMonthCost.gross).toBe(0);
    expect(res.body.currentMonthCost.costPerHectare).toBeNull();
    expect(res.body.trend12Months).toEqual([]);
    expect(res.body.composition).toEqual([]);
    expect(res.body.turnover.last12MonthsRate).toBe(0);
    expect(res.body.alerts.overduePayablesPayroll).toBe(0);
  });

  it('Test 11: returns 400 when year is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .get('/api/org/hr-dashboard?month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/year/i);
  });

  it('Test 12: returns 400 when month is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/month/i);
  });

  it('Test 13: returns 400 when month is out of range', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=13')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/month/i);
  });

  it('Test 14: returns 401 when not authenticated', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('No token');
    });

    const res = await request(app).get('/api/org/hr-dashboard?year=2026&month=3');

    expect(res.status).toBe(401);
  });

  it('Test 15: service error returns 500', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getHrDashboard.mockRejectedValue(new Error('DB connection failed'));

    const res = await request(app)
      .get('/api/org/hr-dashboard?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
  });
});
