import request from 'supertest';
import { app } from '../../app';
import * as conversionHistoryService from './conversion-history.service';
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

jest.mock('./conversion-history.service', () => ({
  listConversionHistory: jest.fn(),
  exportConversionHistoryCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(conversionHistoryService);
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

const SAMPLE_ITEM = {
  id: 'pest-app-1',
  operationType: 'PESTICIDE' as const,
  operationLabel: 'Aplicação de defensivo',
  farmId: 'farm-1',
  farmName: 'Fazenda São José',
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão A1',
  productName: 'Roundup Original',
  productId: 'prod-1',
  appliedAt: '2026-03-10T14:00:00.000Z',
  dose: 2.5,
  doseUnit: 'L_HA',
  doseUnitLabel: 'L/ha',
  areaHa: 50,
  totalQuantityUsed: 125,
  baseUnit: 'L',
  conversionFormula: '2.5 L/ha × 50 ha = 125.00 L',
  stockOutputId: 'so-1',
  recordedBy: 'user-1',
  recorderName: 'João Silva',
  createdAt: '2026-03-10T14:00:00.000Z',
};

const LIST_RESPONSE = {
  data: [SAMPLE_ITEM],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

// ─── Tests ───────────────────────────────────────────────────────────

describe('Conversion History Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ── GET /org/conversion-history ──

  describe('GET /api/org/conversion-history', () => {
    it('should return conversion history list', async () => {
      mockedService.listConversionHistory.mockResolvedValueOnce(LIST_RESPONSE);

      const res = await request(app)
        .get('/api/org/conversion-history')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].productName).toBe('Roundup Original');
      expect(res.body.data[0].conversionFormula).toBe('2.5 L/ha × 50 ha = 125.00 L');
      expect(res.body.meta.total).toBe(1);
    });

    it('should pass filters to service', async () => {
      mockedService.listConversionHistory.mockResolvedValueOnce({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get('/api/org/conversion-history')
        .query({
          farmId: 'farm-1',
          operationType: 'PESTICIDE',
          productName: 'Roundup',
          dateFrom: '2026-03-01',
          dateTo: '2026-03-31',
          page: 2,
          limit: 10,
        })
        .set('Authorization', 'Bearer token');

      expect(mockedService.listConversionHistory).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({
          farmId: 'farm-1',
          operationType: 'PESTICIDE',
          productName: 'Roundup',
          dateFrom: '2026-03-01',
          dateTo: '2026-03-31',
          page: 2,
          limit: 10,
        }),
      );
    });

    it('should return 401 without auth', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('invalid');
      });

      const res = await request(app).get('/api/org/conversion-history');
      expect(res.status).toBe(401);
    });

    it('should return 500 on service error', async () => {
      mockedService.listConversionHistory.mockRejectedValueOnce(new Error('db error'));

      const res = await request(app)
        .get('/api/org/conversion-history')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Erro interno');
    });
  });

  // ── GET /org/conversion-history/export ──

  describe('GET /api/org/conversion-history/export', () => {
    it('should return CSV file', async () => {
      const csvContent = 'Data,Tipo de Operação\n10/03/2026,Aplicação de defensivo';
      mockedService.exportConversionHistoryCsv.mockResolvedValueOnce(csvContent);

      const res = await request(app)
        .get('/api/org/conversion-history/export')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('historico-conversoes');
      expect(res.text).toContain('Aplicação de defensivo');
    });

    it('should pass filters to export', async () => {
      mockedService.exportConversionHistoryCsv.mockResolvedValueOnce('header\n');

      await request(app)
        .get('/api/org/conversion-history/export')
        .query({
          farmId: 'farm-1',
          operationType: 'FERTILIZER',
          dateFrom: '2026-01-01',
        })
        .set('Authorization', 'Bearer token');

      expect(mockedService.exportConversionHistoryCsv).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({
          farmId: 'farm-1',
          operationType: 'FERTILIZER',
          dateFrom: '2026-01-01',
        }),
      );
    });

    it('should return 500 on export error', async () => {
      mockedService.exportConversionHistoryCsv.mockRejectedValueOnce(new Error('export failed'));

      const res = await request(app)
        .get('/api/org/conversion-history/export')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(500);
    });
  });
});
