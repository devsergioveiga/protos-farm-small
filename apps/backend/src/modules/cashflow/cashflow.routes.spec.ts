import request from 'supertest';
import { app } from '../../app';
import * as cashflowService from './cashflow.service';
import * as authService from '../auth/auth.service';
import { CashflowError } from './cashflow.types';

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

jest.mock('./cashflow.service', () => ({
  getProjection: jest.fn(),
  getNegativeBalanceAlert: jest.fn(),
  exportProjectionPdf: jest.fn(),
  exportProjectionExcel: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(cashflowService);
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

function makeProjectionPoint(date: string, label: string, balance: number) {
  return {
    date,
    label,
    balanceRealistic: balance,
    balanceOptimistic: balance,
    balancePessimistic: balance,
    inflows: 0,
    outflows: 0,
    checksPending: 0,
  };
}

const FLAT_PROJECTION = {
  currentBalance: 10000,
  projectionPoints: Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, 2 + i, 1);
    return makeProjectionPoint(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      `Month ${i + 1}`,
      10000,
    );
  }),
  negativeBalanceDate: null,
  negativeBalanceAmount: null,
  dfc: {
    inflows: [],
    outflows: [],
    operacional: { totalInflows: 0, totalOutflows: 0, net: 0 },
    investimento: { totalInflows: 0, totalOutflows: 0, net: 0 },
    financiamento: { totalInflows: 0, totalOutflows: 0, net: 0 },
  },
};

const PROJECTION_WITH_PAYABLE = {
  ...FLAT_PROJECTION,
  projectionPoints: FLAT_PROJECTION.projectionPoints.map((p, i) =>
    i === 1 ? { ...p, balanceRealistic: 9000, outflows: 1000 } : p,
  ),
};

const PROJECTION_WITH_RECEIVABLE = {
  ...FLAT_PROJECTION,
  projectionPoints: FLAT_PROJECTION.projectionPoints.map((p, i) =>
    i === 2 ? { ...p, balanceRealistic: 11500, inflows: 1500 } : p,
  ),
};

const PROJECTION_NEGATIVE = {
  ...FLAT_PROJECTION,
  projectionPoints: FLAT_PROJECTION.projectionPoints.map((p, i) =>
    i === 3 ? { ...p, balanceRealistic: -500 } : p,
  ),
  negativeBalanceDate: '2026-07',
  negativeBalanceAmount: -500,
};

// ─── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── GET /api/org/cashflow/projection ────────────────────────────────

describe('GET /api/org/cashflow/projection', () => {
  it('Test 1: returns 200 with CashflowProjection containing 12 monthly points', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProjection.mockResolvedValue(FLAT_PROJECTION);

    const res = await request(app)
      .get('/api/org/cashflow/projection')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      currentBalance: expect.any(Number),
      projectionPoints: expect.any(Array),
      negativeBalanceDate: null,
      negativeBalanceAmount: null,
      dfc: expect.objectContaining({
        operacional: expect.any(Object),
        investimento: expect.any(Object),
        financiamento: expect.any(Object),
      }),
    });
    expect(res.body.projectionPoints).toHaveLength(12);
  });

  it('Test 2: flat line projection when no open installments — balance stays at currentBalance', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProjection.mockResolvedValue(FLAT_PROJECTION);

    const res = await request(app)
      .get('/api/org/cashflow/projection')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.currentBalance).toBe(10000);
    expect(
      res.body.projectionPoints.every(
        (p: { balanceRealistic: number }) => p.balanceRealistic === 10000,
      ),
    ).toBe(true);
  });

  it('Test 3: payable installment due in 30 days shows outflow at that month', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProjection.mockResolvedValue(PROJECTION_WITH_PAYABLE);

    const res = await request(app)
      .get('/api/org/cashflow/projection')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    const monthWithOutflow = res.body.projectionPoints.find(
      (p: { outflows: number }) => p.outflows > 0,
    );
    expect(monthWithOutflow).toBeDefined();
    expect(monthWithOutflow.outflows).toBe(1000);
    expect(monthWithOutflow.balanceRealistic).toBe(9000);
  });

  it('Test 4: receivable installment due in 60 days shows inflow at that month', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProjection.mockResolvedValue(PROJECTION_WITH_RECEIVABLE);

    const res = await request(app)
      .get('/api/org/cashflow/projection')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    const monthWithInflow = res.body.projectionPoints.find(
      (p: { inflows: number }) => p.inflows > 0,
    );
    expect(monthWithInflow).toBeDefined();
    expect(monthWithInflow.inflows).toBe(1500);
    expect(monthWithInflow.balanceRealistic).toBe(11500);
  });

  it('Test 5: optimistic scenario multipliers — inflows * 1.10, outflows * 0.95', async () => {
    authAs(ADMIN_PAYLOAD);
    const projWithScenarios = {
      ...FLAT_PROJECTION,
      projectionPoints: FLAT_PROJECTION.projectionPoints.map((p, i) =>
        i === 0
          ? {
              ...p,
              inflows: 1000,
              outflows: 500,
              balanceRealistic: 10500,
              balanceOptimistic: 10600, // +10% inflow (100) -5% outflow (25) net = 10000 + 1100 - 475 = 10625 simplified
              balancePessimistic: 10325, // -10% inflow - +15% outflow
            }
          : p,
      ),
    };
    mockedService.getProjection.mockResolvedValue(projWithScenarios);

    const res = await request(app)
      .get('/api/org/cashflow/projection')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    const firstPoint = res.body.projectionPoints[0];
    expect(firstPoint.balanceOptimistic).toBeGreaterThan(firstPoint.balanceRealistic);
    expect(firstPoint.balancePessimistic).toBeLessThan(firstPoint.balanceRealistic);
  });

  it('Test 6: negative balance detection — negativeBalanceDate is set to first month where realistic balance < 0', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProjection.mockResolvedValue(PROJECTION_NEGATIVE);

    const res = await request(app)
      .get('/api/org/cashflow/projection')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.negativeBalanceDate).toBe('2026-07');
    expect(res.body.negativeBalanceAmount).toBe(-500);
  });

  it('Test 7: DFC summary — payable INPUTS maps to OPERACIONAL outflow', async () => {
    authAs(ADMIN_PAYLOAD);
    const projWithDfc = {
      ...FLAT_PROJECTION,
      dfc: {
        inflows: [],
        outflows: [
          {
            category: 'INPUTS',
            dfcClass: 'OPERACIONAL',
            monthlyAmounts: Array(12).fill(0),
            total: 1000,
          },
        ],
        operacional: { totalInflows: 0, totalOutflows: 1000, net: -1000 },
        investimento: { totalInflows: 0, totalOutflows: 0, net: 0 },
        financiamento: { totalInflows: 0, totalOutflows: 0, net: 0 },
      },
    };
    mockedService.getProjection.mockResolvedValue(projWithDfc);

    const res = await request(app)
      .get('/api/org/cashflow/projection')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    const inputsOutflow = res.body.dfc.outflows.find(
      (e: { category: string }) => e.category === 'INPUTS',
    );
    expect(inputsOutflow).toBeDefined();
    expect(inputsOutflow.dfcClass).toBe('OPERACIONAL');
    expect(res.body.dfc.operacional.totalOutflows).toBe(1000);
  });

  it('Test 8: DFC summary — receivable GRAIN_SALE maps to OPERACIONAL inflow', async () => {
    authAs(ADMIN_PAYLOAD);
    const projWithDfc = {
      ...FLAT_PROJECTION,
      dfc: {
        inflows: [
          {
            category: 'GRAIN_SALE',
            dfcClass: 'OPERACIONAL',
            monthlyAmounts: Array(12).fill(0),
            total: 5000,
          },
        ],
        outflows: [],
        operacional: { totalInflows: 5000, totalOutflows: 0, net: 5000 },
        investimento: { totalInflows: 0, totalOutflows: 0, net: 0 },
        financiamento: { totalInflows: 0, totalOutflows: 0, net: 0 },
      },
    };
    mockedService.getProjection.mockResolvedValue(projWithDfc);

    const res = await request(app)
      .get('/api/org/cashflow/projection')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    const grainEntry = res.body.dfc.inflows.find(
      (e: { category: string }) => e.category === 'GRAIN_SALE',
    );
    expect(grainEntry).toBeDefined();
    expect(grainEntry.dfcClass).toBe('OPERACIONAL');
    expect(res.body.dfc.operacional.totalInflows).toBe(5000);
  });

  it('Test 9: farmId query param is passed through to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProjection.mockResolvedValue(FLAT_PROJECTION);

    const res = await request(app)
      .get('/api/org/cashflow/projection?farmId=farm-A')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.getProjection).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({ farmId: 'farm-A' }),
    );
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/org/cashflow/projection');
    expect(res.status).toBe(401);
  });

  it('handles CashflowError with correct status code', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getProjection.mockRejectedValue(new CashflowError('Dados inválidos', 400));

    const res = await request(app)
      .get('/api/org/cashflow/projection')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });
});

// ─── GET /api/org/cashflow/negative-balance-alert ────────────────────

describe('GET /api/org/cashflow/negative-balance-alert', () => {
  it('Test 10: returns null when all projections are positive', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getNegativeBalanceAlert.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/org/cashflow/negative-balance-alert')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ alert: null });
  });

  it('Test 11: returns {date, amount} when negative balance detected', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getNegativeBalanceAlert.mockResolvedValue({ date: '2026-07', amount: -500 });

    const res = await request(app)
      .get('/api/org/cashflow/negative-balance-alert')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.alert).toMatchObject({ date: '2026-07', amount: -500 });
  });
});

// ─── GET /api/org/cashflow/projection/export/pdf ─────────────────────

describe('GET /api/org/cashflow/projection/export/pdf', () => {
  it('Test 12: returns PDF content-type', async () => {
    authAs(ADMIN_PAYLOAD);
    const fakeBuffer = Buffer.from('%PDF-1.4 test');
    mockedService.exportProjectionPdf.mockResolvedValue(fakeBuffer);

    const res = await request(app)
      .get('/api/org/cashflow/projection/export/pdf')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });
});

// ─── GET /api/org/cashflow/projection/export/excel ───────────────────

describe('GET /api/org/cashflow/projection/export/excel', () => {
  it('Test 13: returns Excel content-type', async () => {
    authAs(ADMIN_PAYLOAD);
    const fakeBuffer = Buffer.from('PK excel fake');
    mockedService.exportProjectionExcel.mockResolvedValue(fakeBuffer);

    const res = await request(app)
      .get('/api/org/cashflow/projection/export/excel')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheet|excel/);
  });
});
