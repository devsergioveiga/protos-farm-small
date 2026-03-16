import request from 'supertest';
import { app } from '../../app';
import * as financialDashboardService from './financial-dashboard.service';
import * as authService from '../auth/auth.service';
import { FinancialDashboardError } from './financial-dashboard.types';

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

jest.mock('./financial-dashboard.service', () => ({
  getFinancialDashboard: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(financialDashboardService);
const mockedAuth = jest.mocked(authService);

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

// ─── Fixtures ────────────────────────────────────────────────────────

const DASHBOARD_OUTPUT = {
  totalBankBalance: 50000,
  totalBankBalancePrevYear: null,
  payablesDue30d: 8000,
  payablesDue30dPrevYear: null,
  receivablesDue30d: 12000,
  receivablesDue30dPrevYear: null,
  monthResult: 4000,
  monthResultPrevYear: null,
  monthlyTrend: [
    { yearMonth: '2025-10', revenues: 10000, expenses: 8000 },
    { yearMonth: '2025-11', revenues: 12000, expenses: 9000 },
    { yearMonth: '2025-12', revenues: 15000, expenses: 11000 },
    { yearMonth: '2026-01', revenues: 11000, expenses: 7000 },
    { yearMonth: '2026-02', revenues: 13000, expenses: 9000 },
    { yearMonth: '2026-03', revenues: 14000, expenses: 10000 },
  ],
  topExpenseCategories: [
    { category: 'INPUTS', categoryLabel: 'Insumos', total: 5000, percentage: 62.5 },
    { category: 'PAYROLL', categoryLabel: 'Folha de Pagamento', total: 3000, percentage: 37.5 },
  ],
  topPayablesByCategory: [
    {
      rank: 1,
      category: 'INPUTS',
      categoryLabel: 'Insumos',
      total: 5000,
      relativePercent: 100,
    },
    {
      rank: 2,
      category: 'PAYROLL',
      categoryLabel: 'Folha de Pagamento',
      total: 3000,
      relativePercent: 60,
    },
  ],
  topReceivablesByClient: [
    { rank: 1, clientName: 'Cooperativa São João', total: 12000, relativePercent: 100 },
  ],
  alerts: {
    overduePayablesCount: 2,
    overduePayablesTotal: 1500,
    projectedBalanceNegative: false,
  },
};

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── GET /api/org/financial-dashboard ────────────────────────────────

describe('GET /api/org/financial-dashboard', () => {
  it('Test 1: returns 200 with all expected fields', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getFinancialDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/financial-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalBankBalance: expect.any(Number),
      payablesDue30d: expect.any(Number),
      receivablesDue30d: expect.any(Number),
      monthResult: expect.any(Number),
      monthlyTrend: expect.any(Array),
      topExpenseCategories: expect.any(Array),
      topPayablesByCategory: expect.any(Array),
      topReceivablesByClient: expect.any(Array),
      alerts: expect.objectContaining({
        overduePayablesCount: expect.any(Number),
        overduePayablesTotal: expect.any(Number),
        projectedBalanceNegative: expect.any(Boolean),
      }),
    });
  });

  it('Test 2: totalBankBalance is present as a number (only from BankAccountBalance, not pending AP/AR)', async () => {
    authAs(ADMIN_PAYLOAD);
    // Simulate a balance of 50000 - pending payable does NOT affect it
    const outputWithBalance = { ...DASHBOARD_OUTPUT, totalBankBalance: 50000 };
    mockedService.getFinancialDashboard.mockResolvedValue(outputWithBalance);

    const res = await request(app)
      .get('/api/org/financial-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.totalBankBalance).toBe(50000);
    // Service is called once - no additional call after adding pending payable
    expect(mockedService.getFinancialDashboard).toHaveBeenCalledTimes(1);
  });

  it('Test 3: payablesDue30d sums only PENDING/OVERDUE installments within 30 days', async () => {
    authAs(ADMIN_PAYLOAD);
    const outputWithPayables = { ...DASHBOARD_OUTPUT, payablesDue30d: 8000 };
    mockedService.getFinancialDashboard.mockResolvedValue(outputWithPayables);

    const res = await request(app)
      .get('/api/org/financial-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.payablesDue30d).toBe(8000);
  });

  it('Test 4: monthResult = settled CR receivedAmount minus settled CP amountPaid', async () => {
    authAs(ADMIN_PAYLOAD);
    // revenues settled: 14000, expenses settled: 10000, result: 4000
    const outputWithResult = { ...DASHBOARD_OUTPUT, monthResult: 4000 };
    mockedService.getFinancialDashboard.mockResolvedValue(outputWithResult);

    const res = await request(app)
      .get('/api/org/financial-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.monthResult).toBe(4000);
  });

  it('Test 5: prevYear values return null when no prior-year data exists', async () => {
    authAs(ADMIN_PAYLOAD);
    const outputWithNullPrevYear = {
      ...DASHBOARD_OUTPUT,
      totalBankBalancePrevYear: null,
      payablesDue30dPrevYear: null,
      receivablesDue30dPrevYear: null,
      monthResultPrevYear: null,
    };
    mockedService.getFinancialDashboard.mockResolvedValue(outputWithNullPrevYear);

    const res = await request(app)
      .get('/api/org/financial-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.totalBankBalancePrevYear).toBeNull();
    expect(res.body.payablesDue30dPrevYear).toBeNull();
    expect(res.body.receivablesDue30dPrevYear).toBeNull();
    expect(res.body.monthResultPrevYear).toBeNull();
  });

  it('Test 6: farmId query param is passed through to service', async () => {
    authAs(ADMIN_PAYLOAD);
    const outputForFarmA = { ...DASHBOARD_OUTPUT, totalBankBalance: 20000 };
    mockedService.getFinancialDashboard.mockResolvedValue(outputForFarmA);

    const res = await request(app)
      .get('/api/org/financial-dashboard?farmId=farm-A')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.getFinancialDashboard).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({ farmId: 'farm-A' }),
    );
  });

  it('Test 7: alerts.overduePayablesCount counts only OVERDUE installments', async () => {
    authAs(ADMIN_PAYLOAD);
    const outputWithAlerts = {
      ...DASHBOARD_OUTPUT,
      alerts: {
        overduePayablesCount: 3,
        overduePayablesTotal: 2500,
        projectedBalanceNegative: false,
      },
    };
    mockedService.getFinancialDashboard.mockResolvedValue(outputWithAlerts);

    const res = await request(app)
      .get('/api/org/financial-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.alerts.overduePayablesCount).toBe(3);
    expect(res.body.alerts.overduePayablesTotal).toBe(2500);
  });

  it('Test 8: alerts.projectedBalanceNegative is true when totalBankBalance - payablesDue30d < 0', async () => {
    authAs(ADMIN_PAYLOAD);
    // totalBankBalance: 5000, payablesDue30d: 8000 → projected: -3000 → negative
    const outputWithNegativeProjection = {
      ...DASHBOARD_OUTPUT,
      totalBankBalance: 5000,
      payablesDue30d: 8000,
      alerts: {
        ...DASHBOARD_OUTPUT.alerts,
        projectedBalanceNegative: true,
      },
    };
    mockedService.getFinancialDashboard.mockResolvedValue(outputWithNegativeProjection);

    const res = await request(app)
      .get('/api/org/financial-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.alerts.projectedBalanceNegative).toBe(true);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/org/financial-dashboard');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user lacks financial:read permission', async () => {
    mockedAuth.verifyAccessToken.mockReturnValue({
      userId: 'user-2',
      email: 'user@org.com',
      role: 'OPERATOR' as const,
      organizationId: 'org-1',
    });
    mockGetUserPermissions.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/org/financial-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });

  it('passes year and month query params to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getFinancialDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/financial-dashboard?year=2025&month=6')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.getFinancialDashboard).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({ year: 2025, month: 6 }),
    );
  });

  it('handles FinancialDashboardError with correct status code', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getFinancialDashboard.mockRejectedValue(
      new FinancialDashboardError('Dados não encontrados', 404),
    );

    const res = await request(app)
      .get('/api/org/financial-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Dados não encontrados');
  });

  it('handles unexpected errors with 500', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getFinancialDashboard.mockRejectedValue(new Error('DB connection failed'));

    const res = await request(app)
      .get('/api/org/financial-dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
  });
});
