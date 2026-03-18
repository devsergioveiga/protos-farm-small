import request from 'supertest';
import { app } from '../../app';
import * as savingAnalysisService from './saving-analysis.service';
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

jest.mock('./saving-analysis.service', () => ({
  getSavingByQuotation: jest.fn(),
  getPriceHistory: jest.fn(),
  getCycleIndicators: jest.fn(),
  getTopProducts: jest.fn(),
  getTopSuppliers: jest.fn(),
  getAnalyticsDashboard: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(savingAnalysisService);
const mockedAuth = jest.mocked(authService);

// ─── Test fixtures ────────────────────────────────────────────────────

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

const BASE_PARAMS = '?startDate=2026-01-01&endDate=2026-12-31';

const VALID_SAVING_SUMMARY = {
  totalSaving: '500.00',
  quotationCount: 1,
  avgSavingPercent: '10.00',
  savings: [
    {
      quotationId: 'sc-1',
      sequentialNumber: 'SC-2026/0001',
      createdAt: new Date('2026-03-01').toISOString(),
      supplierCount: 2,
      savingTotal: '500.00',
      items: [
        {
          productName: 'Herbicida XYZ',
          maxPrice: '100.0000',
          winnerPrice: '80.0000',
          saving: '500.00',
        },
      ],
    },
  ],
};

const VALID_PRICE_HISTORY = {
  productId: 'prod-1',
  productName: 'Herbicida XYZ',
  points: [
    {
      date: new Date('2026-01-15').toISOString(),
      price: '80.0000',
      purchaseOrderNumber: 'OC-2026/0001',
      supplierName: 'Agro Insumos Ltda',
    },
    {
      date: new Date('2026-02-20').toISOString(),
      price: '85.0000',
      purchaseOrderNumber: 'OC-2026/0002',
      supplierName: 'Agro Insumos Ltda',
    },
  ],
};

const VALID_CYCLE_INDICATORS = {
  percentFormal: '75.00',
  percentEmergency: '25.00',
  avgCycleDays: '14.50',
  totalOrders: 4,
};

const VALID_TOP_PRODUCTS = [
  { productId: 'prod-1', productName: 'Herbicida XYZ', totalSpent: '12000.00', orderCount: 3 },
  { productId: 'prod-2', productName: 'Fertilizante ABC', totalSpent: '8500.00', orderCount: 2 },
];

const VALID_TOP_SUPPLIERS = [
  {
    supplierId: 'sup-1',
    supplierName: 'Agro Insumos Ltda',
    totalVolume: '50000.00',
    orderCount: 5,
  },
  {
    supplierId: 'sup-2',
    supplierName: 'Distribuidora Campo Verde',
    totalVolume: '35000.00',
    orderCount: 3,
  },
];

const VALID_DASHBOARD = {
  saving: VALID_SAVING_SUMMARY,
  indicators: VALID_CYCLE_INDICATORS,
  topProducts: VALID_TOP_PRODUCTS,
  topSuppliers: VALID_TOP_SUPPLIERS,
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('GET /org/saving-analysis/saving', () => {
  it('returns saving summary for manager with purchases:read', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getSavingByQuotation.mockResolvedValue(VALID_SAVING_SUMMARY);

    const res = await request(app)
      .get(`/api/org/saving-analysis/saving${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.totalSaving).toBe('500.00');
    expect(res.body.quotationCount).toBe(1);
    expect(res.body.savings).toHaveLength(1);
    expect(res.body.savings[0].supplierCount).toBe(2);
  });

  it('returns 400 when startDate is missing', async () => {
    authAs(MANAGER_PAYLOAD);

    const res = await request(app)
      .get('/api/org/saving-analysis/saving?endDate=2026-12-31')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/startDate e endDate/);
  });

  it('returns saving with empty list when no quotations have 2+ proposals', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getSavingByQuotation.mockResolvedValue({
      totalSaving: '0.00',
      quotationCount: 0,
      avgSavingPercent: '0.00',
      savings: [],
    });

    const res = await request(app)
      .get(`/api/org/saving-analysis/saving${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.quotationCount).toBe(0);
    expect(res.body.savings).toHaveLength(0);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app)
      .get(`/api/org/saving-analysis/saving${BASE_PARAMS}`)
      .set('Authorization', 'Bearer invalid');

    expect(res.status).toBe(401);
  });

  it('returns 403 for operator without purchases:read', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockGetUserPermissions.mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/org/saving-analysis/saving${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});

describe('GET /org/saving-analysis/price-history/:productId', () => {
  it('returns price history points sorted by date for a product', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getPriceHistory.mockResolvedValue(VALID_PRICE_HISTORY);

    const res = await request(app)
      .get(`/api/org/saving-analysis/price-history/prod-1${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.productId).toBe('prod-1');
    expect(res.body.productName).toBe('Herbicida XYZ');
    expect(res.body.points).toHaveLength(2);
    expect(res.body.points[0].purchaseOrderNumber).toBe('OC-2026/0001');
    expect(res.body.points[0].supplierName).toBe('Agro Insumos Ltda');
  });

  it('returns empty points array for product with no POs', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getPriceHistory.mockResolvedValue({
      productId: 'prod-unknown',
      productName: 'Produto',
      points: [],
    });

    const res = await request(app)
      .get(`/api/org/saving-analysis/price-history/prod-unknown${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.points).toHaveLength(0);
  });

  it('calls service with correct productId', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getPriceHistory.mockResolvedValue(VALID_PRICE_HISTORY);

    await request(app)
      .get(`/api/org/saving-analysis/price-history/prod-abc${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(mockedService.getPriceHistory).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'prod-abc',
      expect.objectContaining({ startDate: '2026-01-01', endDate: '2026-12-31' }),
    );
  });
});

describe('GET /org/saving-analysis/indicators', () => {
  it('returns cycle indicators with % formal, % emergency, avgCycleDays', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getCycleIndicators.mockResolvedValue(VALID_CYCLE_INDICATORS);

    const res = await request(app)
      .get(`/api/org/saving-analysis/indicators${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.percentFormal).toBe('75.00');
    expect(res.body.percentEmergency).toBe('25.00');
    expect(res.body.avgCycleDays).toBe('14.50');
    expect(res.body.totalOrders).toBe(4);
  });

  it('returns 0s when no orders in period', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getCycleIndicators.mockResolvedValue({
      percentFormal: '0.00',
      percentEmergency: '0.00',
      avgCycleDays: '0.00',
      totalOrders: 0,
    });

    const res = await request(app)
      .get(`/api/org/saving-analysis/indicators${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.totalOrders).toBe(0);
    expect(res.body.avgCycleDays).toBe('0.00');
  });

  it('respects date filtering by passing params to service', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getCycleIndicators.mockResolvedValue(VALID_CYCLE_INDICATORS);

    await request(app)
      .get('/api/org/saving-analysis/indicators?startDate=2026-02-01&endDate=2026-02-28')
      .set('Authorization', 'Bearer token');

    expect(mockedService.getCycleIndicators).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ startDate: '2026-02-01', endDate: '2026-02-28' }),
    );
  });
});

describe('GET /org/saving-analysis/top-products', () => {
  it('returns top products ordered by totalSpent desc', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getTopProducts.mockResolvedValue(VALID_TOP_PRODUCTS);

    const res = await request(app)
      .get(`/api/org/saving-analysis/top-products${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(Number(res.body[0].totalSpent)).toBeGreaterThanOrEqual(Number(res.body[1].totalSpent));
  });

  it('passes limit=10 by default', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getTopProducts.mockResolvedValue(VALID_TOP_PRODUCTS);

    await request(app)
      .get(`/api/org/saving-analysis/top-products${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(mockedService.getTopProducts).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      10,
    );
  });

  it('accepts custom limit parameter', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getTopProducts.mockResolvedValue([VALID_TOP_PRODUCTS[0]]);

    const res = await request(app)
      .get(`/api/org/saving-analysis/top-products${BASE_PARAMS}&limit=1`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.getTopProducts).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      1,
    );
  });
});

describe('GET /org/saving-analysis/top-suppliers', () => {
  it('returns top suppliers ordered by totalVolume desc', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getTopSuppliers.mockResolvedValue(VALID_TOP_SUPPLIERS);

    const res = await request(app)
      .get(`/api/org/saving-analysis/top-suppliers${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(Number(res.body[0].totalVolume)).toBeGreaterThanOrEqual(Number(res.body[1].totalVolume));
  });

  it('passes limit=5 by default', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getTopSuppliers.mockResolvedValue(VALID_TOP_SUPPLIERS);

    await request(app)
      .get(`/api/org/saving-analysis/top-suppliers${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(mockedService.getTopSuppliers).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      5,
    );
  });

  it('returns each supplier with supplierId, supplierName, totalVolume, orderCount', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getTopSuppliers.mockResolvedValue(VALID_TOP_SUPPLIERS);

    const res = await request(app)
      .get(`/api/org/saving-analysis/top-suppliers${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.body[0]).toMatchObject({
      supplierId: expect.any(String),
      supplierName: expect.any(String),
      totalVolume: expect.any(String),
      orderCount: expect.any(Number),
    });
  });
});

describe('GET /org/saving-analysis/dashboard', () => {
  it('returns combined saving, indicators, topProducts, topSuppliers', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getAnalyticsDashboard.mockResolvedValue(VALID_DASHBOARD);

    const res = await request(app)
      .get(`/api/org/saving-analysis/dashboard${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.saving).toBeDefined();
    expect(res.body.indicators).toBeDefined();
    expect(res.body.topProducts).toBeDefined();
    expect(res.body.topSuppliers).toBeDefined();
  });

  it('returns full nested structure', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getAnalyticsDashboard.mockResolvedValue(VALID_DASHBOARD);

    const res = await request(app)
      .get(`/api/org/saving-analysis/dashboard${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(res.body.saving.totalSaving).toBe('500.00');
    expect(res.body.indicators.percentFormal).toBe('75.00');
    expect(res.body.topProducts).toHaveLength(2);
    expect(res.body.topSuppliers).toHaveLength(2);
  });

  it('calls getAnalyticsDashboard service function', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getAnalyticsDashboard.mockClear();
    mockedService.getSavingByQuotation.mockClear();
    mockedService.getCycleIndicators.mockClear();
    mockedService.getAnalyticsDashboard.mockResolvedValue(VALID_DASHBOARD);

    await request(app)
      .get(`/api/org/saving-analysis/dashboard${BASE_PARAMS}`)
      .set('Authorization', 'Bearer token');

    expect(mockedService.getAnalyticsDashboard).toHaveBeenCalledTimes(1);
    // Individual functions should NOT have been called separately by the route handler
    expect(mockedService.getSavingByQuotation).not.toHaveBeenCalled();
    expect(mockedService.getCycleIndicators).not.toHaveBeenCalled();
  });

  it('returns 400 when date params missing', async () => {
    authAs(MANAGER_PAYLOAD);

    const res = await request(app)
      .get('/api/org/saving-analysis/dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
  });
});

describe('Date filtering', () => {
  it('passes startDate and endDate to saving endpoint', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getSavingByQuotation.mockResolvedValue({
      totalSaving: '0.00',
      quotationCount: 0,
      avgSavingPercent: '0.00',
      savings: [],
    });

    await request(app)
      .get('/api/org/saving-analysis/saving?startDate=2026-01-01&endDate=2026-03-31')
      .set('Authorization', 'Bearer token');

    expect(mockedService.getSavingByQuotation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ startDate: '2026-01-01', endDate: '2026-03-31' }),
    );
  });

  it('passes supplierId filter when provided', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getSavingByQuotation.mockResolvedValue({
      totalSaving: '0.00',
      quotationCount: 0,
      avgSavingPercent: '0.00',
      savings: [],
    });

    await request(app)
      .get(
        '/api/org/saving-analysis/saving?startDate=2026-01-01&endDate=2026-12-31&supplierId=sup-1',
      )
      .set('Authorization', 'Bearer token');

    expect(mockedService.getSavingByQuotation).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ supplierId: 'sup-1' }),
    );
  });
});
