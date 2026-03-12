import request from 'supertest';
import { app } from '../../app';
import * as stockAlertsService from './stock-alerts.service';
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

jest.mock('./stock-alerts.service', () => ({
  getStockLevelDashboard: jest.fn(),
  listStockLevelAlerts: jest.fn(),
  listExpiryAlerts: jest.fn(),
  getExpiryReportCSV: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(stockAlertsService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const VIEWER_PAYLOAD = {
  userId: 'viewer-1',
  email: 'viewer@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Fixtures ───────────────────────────────────────────────────────

const DASHBOARD_RESPONSE = {
  summary: {
    totalProducts: 10,
    criticalCount: 2,
    warningCount: 3,
    okCount: 4,
    noThresholdCount: 1,
    expiredCount: 1,
    expiringCount: 5,
    totalStockValue: 50000,
  },
  alerts: [
    {
      productId: 'prod-1',
      productName: 'Roundup Original',
      productType: 'defensivo_herbicida',
      measurementUnit: 'L',
      currentQuantity: 5,
      reorderPoint: 10,
      safetyStock: 20,
      averageCost: 51,
      totalValue: 255,
      level: 'CRITICAL' as const,
    },
    {
      productId: 'prod-2',
      productName: 'Ureia Granulada',
      productType: 'fertilizante',
      measurementUnit: 'kg',
      currentQuantity: 150,
      reorderPoint: 50,
      safetyStock: 200,
      averageCost: 2.5,
      totalValue: 375,
      level: 'WARNING' as const,
    },
  ],
};

const LEVEL_ALERTS_RESULT = {
  data: DASHBOARD_RESPONSE.alerts,
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 1,
};

const EXPIRY_ALERTS_RESULT = {
  data: [
    {
      productId: 'prod-1',
      productName: 'Roundup Original',
      productType: 'defensivo_herbicida',
      measurementUnit: 'L',
      batchNumber: 'LOT-2025-001',
      expirationDate: '2026-04-15T00:00:00.000Z',
      daysUntilExpiry: 34,
      quantity: 20,
      unitCost: 51,
      totalCost: 1020,
      isExpired: false,
      isPesticide: true,
      inpevRequired: false,
    },
    {
      productId: 'prod-3',
      productName: 'Karate Zeon 50CS',
      productType: 'defensivo_inseticida',
      measurementUnit: 'L',
      batchNumber: 'LOT-2024-099',
      expirationDate: '2026-01-01T00:00:00.000Z',
      daysUntilExpiry: -70,
      quantity: 5,
      unitCost: 120,
      totalCost: 600,
      isExpired: true,
      isPesticide: true,
      inpevRequired: true,
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 1,
};

// ─── Tests ──────────────────────────────────────────────────────────

describe('Stock Alerts Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── CA5: Dashboard ─────────────────────────────────────────────

  describe('GET /api/org/stock-alerts/dashboard', () => {
    it('should return stock level dashboard (CA5)', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getStockLevelDashboard.mockResolvedValue(DASHBOARD_RESPONSE);

      const res = await request(app)
        .get('/api/org/stock-alerts/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.summary.totalProducts).toBe(10);
      expect(res.body.summary.criticalCount).toBe(2);
      expect(res.body.summary.warningCount).toBe(3);
      expect(res.body.summary.okCount).toBe(4);
      expect(res.body.summary.expiredCount).toBe(1);
      expect(res.body.summary.expiringCount).toBe(5);
      expect(res.body.alerts).toHaveLength(2);
      expect(res.body.alerts[0].level).toBe('CRITICAL');
      expect(res.body.alerts[1].level).toBe('WARNING');
    });

    it('should return 401 without auth', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('invalid');
      });

      const res = await request(app).get('/api/org/stock-alerts/dashboard');

      expect(res.status).toBe(401);
    });

    it('should allow CONSULTANT role (read permission)', async () => {
      authAs(VIEWER_PAYLOAD);
      mockedService.getStockLevelDashboard.mockResolvedValue(DASHBOARD_RESPONSE);

      const res = await request(app)
        .get('/api/org/stock-alerts/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
    });
  });

  // ─── CA3: Stock Level Alerts ────────────────────────────────────

  describe('GET /api/org/stock-alerts/levels', () => {
    it('should list stock level alerts', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listStockLevelAlerts.mockResolvedValue(LEVEL_ALERTS_RESULT);

      const res = await request(app)
        .get('/api/org/stock-alerts/levels')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should filter by level=CRITICAL', async () => {
      authAs(ADMIN_PAYLOAD);
      const filtered = {
        ...LEVEL_ALERTS_RESULT,
        data: [LEVEL_ALERTS_RESULT.data[0]],
        total: 1,
      };
      mockedService.listStockLevelAlerts.mockResolvedValue(filtered);

      const res = await request(app)
        .get('/api/org/stock-alerts/levels?level=CRITICAL')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockedService.listStockLevelAlerts).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ level: 'CRITICAL' }),
      );
    });

    it('should pass search and productType params', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listStockLevelAlerts.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await request(app)
        .get('/api/org/stock-alerts/levels?search=round&productType=defensivo_herbicida')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listStockLevelAlerts).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({
          search: 'round',
          productType: 'defensivo_herbicida',
        }),
      );
    });

    it('should pass pagination params', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listStockLevelAlerts.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
      });

      await request(app)
        .get('/api/org/stock-alerts/levels?page=2&limit=10')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listStockLevelAlerts).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });
  });

  // ─── CA4 + CA6: Expiry Alerts ──────────────────────────────────

  describe('GET /api/org/stock-alerts/expiry', () => {
    it('should list expiry alerts (CA4)', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listExpiryAlerts.mockResolvedValue(EXPIRY_ALERTS_RESULT);

      const res = await request(app)
        .get('/api/org/stock-alerts/expiry')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].isPesticide).toBe(true);
      expect(res.body.data[0].inpevRequired).toBe(false);
    });

    it('should show InpEV flag for expired pesticides (CA6)', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listExpiryAlerts.mockResolvedValue(EXPIRY_ALERTS_RESULT);

      const res = await request(app)
        .get('/api/org/stock-alerts/expiry')
        .set('Authorization', 'Bearer valid-token');

      const expired = res.body.data.find((d: Record<string, unknown>) => d.isExpired);
      expect(expired.isPesticide).toBe(true);
      expect(expired.inpevRequired).toBe(true);
    });

    it('should pass daysAhead parameter', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listExpiryAlerts.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await request(app)
        .get('/api/org/stock-alerts/expiry?daysAhead=60')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listExpiryAlerts).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ daysAhead: 60 }),
      );
    });

    it('should pass isPesticide=true filter (CA6)', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listExpiryAlerts.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await request(app)
        .get('/api/org/stock-alerts/expiry?isPesticide=true')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listExpiryAlerts).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ isPesticide: true }),
      );
    });

    it('should pass includeExpired=false', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listExpiryAlerts.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await request(app)
        .get('/api/org/stock-alerts/expiry?includeExpired=false')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listExpiryAlerts).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ includeExpired: false }),
      );
    });

    it('should pass search and pagination', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listExpiryAlerts.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 5,
        totalPages: 0,
      });

      await request(app)
        .get('/api/org/stock-alerts/expiry?search=karate&page=2&limit=5')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listExpiryAlerts).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ search: 'karate', page: 2, limit: 5 }),
      );
    });
  });

  // ─── CA7: Expiry Report CSV ────────────────────────────────────

  describe('GET /api/org/stock-alerts/expiry/export', () => {
    it('should export CSV report (CA7)', async () => {
      authAs(ADMIN_PAYLOAD);
      const csvContent =
        'Produto;Tipo;Lote;Validade;Dias até Vencimento;Quantidade;Unidade;Custo Unit.;Custo Total;Vencido;Defensivo;InpEV Obrigatório\n"Roundup";defensivo_herbicida;LOT-001;2026-04-15;34;20;L;51.0000;1020.00;Não;Sim;Não';
      mockedService.getExpiryReportCSV.mockResolvedValue(csvContent);

      const res = await request(app)
        .get('/api/org/stock-alerts/expiry/export')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('relatorio-validade');
      expect(res.text).toContain('Produto;Tipo;Lote');
      expect(res.text).toContain('Roundup');
    });

    it('should pass query params to service', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getExpiryReportCSV.mockResolvedValue('header\nrow');

      await request(app)
        .get('/api/org/stock-alerts/expiry/export?daysAhead=30&productType=fertilizante')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.getExpiryReportCSV).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        30,
        true,
        'fertilizante',
      );
    });

    it('should pass includeExpired=false to service', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getExpiryReportCSV.mockResolvedValue('header');

      await request(app)
        .get('/api/org/stock-alerts/expiry/export?includeExpired=false')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.getExpiryReportCSV).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        undefined,
        false,
        undefined,
      );
    });

    it('should return 401 without auth', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('invalid');
      });

      const res = await request(app).get('/api/org/stock-alerts/expiry/export');

      expect(res.status).toBe(401);
    });
  });

  // ─── Error handling ────────────────────────────────────────────

  describe('Error handling', () => {
    it('should handle StockAlertError', async () => {
      authAs(ADMIN_PAYLOAD);
      const { StockAlertError } = jest.requireActual('./stock-alerts.types');
      mockedService.getStockLevelDashboard.mockRejectedValue(
        new StockAlertError('Erro de teste', 400),
      );

      const res = await request(app)
        .get('/api/org/stock-alerts/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Erro de teste');
    });

    it('should handle unexpected errors with 500', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getStockLevelDashboard.mockRejectedValue(new Error('unexpected'));

      const res = await request(app)
        .get('/api/org/stock-alerts/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });
  });
});
