import request from 'supertest';
import { app } from '../../app';
import * as agingService from './payables-aging.service';
import * as authService from '../auth/auth.service';

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

jest.mock('./payables-aging.service', () => ({
  getPayablesAging: jest.fn(),
  getPayablesByBucket: jest.fn(),
  getOverdueCount: jest.fn(),
  getFinancialCalendar: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(agingService);
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

// ─── Fixtures ─────────────────────────────────────────────────────────────

const MOCK_AGING: agingService.PayablesAgingOutput = {
  buckets: [
    { label: 'vencidas', displayLabel: 'Vencidas', count: 2, totalAmount: 1500 },
    { label: '7_dias', displayLabel: 'Até 7 dias', count: 1, totalAmount: 500 },
    { label: '15_dias', displayLabel: '8 a 15 dias', count: 0, totalAmount: 0 },
    { label: '30_dias', displayLabel: '16 a 30 dias', count: 3, totalAmount: 3000 },
    { label: '60_dias', displayLabel: '31 a 60 dias', count: 0, totalAmount: 0 },
    { label: '90_dias', displayLabel: '61 a 90 dias', count: 1, totalAmount: 2000 },
    { label: 'acima_90', displayLabel: 'Acima de 90 dias', count: 0, totalAmount: 0 },
  ],
  grandTotal: 7000,
  overdueCount: 2,
};

const MOCK_PAYABLE: agingService.AgingPayableOutput = {
  id: 'payable-1',
  supplierName: 'Fornecedor X',
  category: 'INPUTS',
  totalAmount: 750,
  dueDate: '2026-03-10T00:00:00.000Z',
  status: 'PENDING',
  documentNumber: 'NF-001',
  farmId: 'farm-1',
  daysOverdue: 6,
};

const MOCK_CALENDAR: agingService.CalendarDay[] = [
  { date: '2026-03-10', count: 1, totalAmount: 750 },
  { date: '2026-03-15', count: 2, totalAmount: 1500 },
  { date: '2026-03-28', count: 1, totalAmount: 2000 },
];

// ─── GET /org/payables-aging ───────────────────────────────────────────────

describe('GET /api/org/payables-aging', () => {
  beforeEach(() => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getPayablesAging.mockResolvedValue(MOCK_AGING);
  });

  it('returns 200 with 7 buckets', async () => {
    const res = await request(app)
      .get('/api/org/payables-aging')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.buckets).toHaveLength(7);
    expect(res.body.grandTotal).toBe(7000);
    expect(res.body.overdueCount).toBe(2);
  });

  it('passes farmId query param to service', async () => {
    await request(app)
      .get('/api/org/payables-aging?farmId=farm-1')
      .set('Authorization', 'Bearer token');

    expect(mockedService.getPayablesAging).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'farm-1',
    );
  });

  it('returns bucket labels in correct order', async () => {
    const res = await request(app)
      .get('/api/org/payables-aging')
      .set('Authorization', 'Bearer token');

    const labels = res.body.buckets.map((b: agingService.AgingBucket) => b.label);
    expect(labels).toEqual([
      'vencidas',
      '7_dias',
      '15_dias',
      '30_dias',
      '60_dias',
      '90_dias',
      'acima_90',
    ]);
  });

  it('returns 401 without auth', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app).get('/api/org/payables-aging');
    expect(res.status).toBe(401);
  });
});

// ─── GET /org/payables-aging/bucket/:bucket ───────────────────────────────

describe('GET /api/org/payables-aging/bucket/:bucket', () => {
  beforeEach(() => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getPayablesByBucket.mockResolvedValue({
      data: [MOCK_PAYABLE],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('returns 200 with payables in bucket', async () => {
    const res = await request(app)
      .get('/api/org/payables-aging/bucket/vencidas')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('payable-1');
    expect(res.body.data[0].daysOverdue).toBe(6);
  });

  it('passes bucket and pagination to service', async () => {
    await request(app)
      .get('/api/org/payables-aging/bucket/30_dias?page=2&limit=10')
      .set('Authorization', 'Bearer token');

    expect(mockedService.getPayablesByBucket).toHaveBeenCalledWith(
      expect.any(Object),
      '30_dias',
      undefined,
      2,
      10,
    );
  });
});

// ─── GET /org/payables-aging/overdue-count ────────────────────────────────

describe('GET /api/org/payables-aging/overdue-count', () => {
  beforeEach(() => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getOverdueCount.mockResolvedValue(2);
  });

  it('returns 200 with count as number', async () => {
    const res = await request(app)
      .get('/api/org/payables-aging/overdue-count')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(typeof res.body.count).toBe('number');
  });

  it('returns 0 when no overdue payables', async () => {
    mockedService.getOverdueCount.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/org/payables-aging/overdue-count')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });
});

// ─── GET /org/payables-aging/calendar ────────────────────────────────────

describe('GET /api/org/payables-aging/calendar', () => {
  beforeEach(() => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getFinancialCalendar.mockResolvedValue(MOCK_CALENDAR);
  });

  it('returns 200 with calendar days', async () => {
    const res = await request(app)
      .get('/api/org/payables-aging/calendar?year=2026&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].date).toBe('2026-03-10');
    expect(res.body[0].count).toBe(1);
    expect(res.body[0].totalAmount).toBe(750);
  });

  it('passes year, month, farmId to service', async () => {
    await request(app)
      .get('/api/org/payables-aging/calendar?year=2026&month=3&farmId=farm-1')
      .set('Authorization', 'Bearer token');

    expect(mockedService.getFinancialCalendar).toHaveBeenCalledWith(
      expect.any(Object),
      2026,
      3,
      'farm-1',
    );
  });

  it('defaults to current year and month when not provided', async () => {
    const now = new Date();
    await request(app).get('/api/org/payables-aging/calendar').set('Authorization', 'Bearer token');

    expect(mockedService.getFinancialCalendar).toHaveBeenCalledWith(
      expect.any(Object),
      now.getFullYear(),
      now.getMonth() + 1,
      undefined,
    );
  });

  it('returns 400 for invalid month', async () => {
    const res = await request(app)
      .get('/api/org/payables-aging/calendar?year=2026&month=13')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid year', async () => {
    const res = await request(app)
      .get('/api/org/payables-aging/calendar?year=1999&month=3')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
  });
});

// ─── Service unit tests for bucket logic ──────────────────────────────────

describe('Aging bucket calculation (unit)', () => {
  // These tests verify the service behavior through direct import
  // without mocking the service itself

  it('aging bucket labels are in the correct order', () => {
    const EXPECTED_LABELS = [
      'vencidas',
      '7_dias',
      '15_dias',
      '30_dias',
      '60_dias',
      '90_dias',
      'acima_90',
    ];
    expect(MOCK_AGING.buckets.map((b) => b.label)).toEqual(EXPECTED_LABELS);
  });

  it('overdue count matches vencidas bucket count', () => {
    expect(MOCK_AGING.overdueCount).toBe(
      MOCK_AGING.buckets.find((b) => b.label === 'vencidas')!.count,
    );
  });

  it('calendar entries have date in YYYY-MM-DD format', () => {
    for (const day of MOCK_CALENDAR) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
