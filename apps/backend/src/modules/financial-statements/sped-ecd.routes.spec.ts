// ─── SPED ECD Routes Tests ────────────────────────────────────────────────────
// Route integration tests for GET /org/:orgId/sped-ecd/validate and /download.
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

jest.mock('./sped-ecd.service', () => ({
  validateSpedEcd: jest.fn(),
  generateSpedEcd: jest.fn(),
  SpedEcdError: class SpedEcdError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode: number = 400,
    ) {
      super(message);
      this.name = 'SpedEcdError';
    }
  },
}));

import request from 'supertest';
import { app } from '../../app';
import * as service from './sped-ecd.service';
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
const FY_ID = 'fy-2025';
const BASE_VALIDATE = `/api/org/${ORG_ID}/sped-ecd/validate`;
const BASE_DOWNLOAD = `/api/org/${ORG_ID}/sped-ecd/download`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SPED ECD Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── /validate endpoint ───────────────────────────────────────────────────

  describe('GET /validate', () => {
    it('returns 200 with { items: [], hasErrors: false } when no issues', async () => {
      (mockedService.validateSpedEcd as jest.Mock).mockResolvedValue({
        items: [],
        hasErrors: false,
      });

      const res = await request(app)
        .get(BASE_VALIDATE)
        .query({ fiscalYearId: FY_ID })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ items: [], hasErrors: false });
    });

    it('returns validation items array when issues found', async () => {
      const mockItems = [
        {
          severity: 'ERROR',
          code: 'UNMAPPED_SPED',
          message: '3 conta(s) sem mapeamento SPED',
          navigateTo: '/chart-of-accounts',
        },
        {
          severity: 'WARNING',
          code: 'NO_MOVEMENT',
          message: '2 conta(s) sem movimento no periodo',
        },
      ];

      (mockedService.validateSpedEcd as jest.Mock).mockResolvedValue({
        items: mockItems,
        hasErrors: true,
      });

      const res = await request(app)
        .get(BASE_VALIDATE)
        .query({ fiscalYearId: FY_ID })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.hasErrors).toBe(true);
      expect(res.body.items[0].severity).toBe('ERROR');
      expect(res.body.items[1].severity).toBe('WARNING');
    });

    it('returns 400 when fiscalYearId is missing', async () => {
      const res = await request(app).get(BASE_VALIDATE).set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_FISCAL_YEAR_ID');
    });

    it('returns 404 when fiscal year not found', async () => {
      // Use the mocked SpedEcdError class so instanceof checks pass in the route handler
      const err = new service.SpedEcdError(
        'Exercicio fiscal nao encontrado',
        'FISCAL_YEAR_NOT_FOUND',
        404,
      );
      (mockedService.validateSpedEcd as jest.Mock).mockRejectedValue(err);

      const res = await request(app)
        .get(BASE_VALIDATE)
        .query({ fiscalYearId: 'nonexistent' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── /download endpoint ───────────────────────────────────────────────────

  describe('GET /download', () => {
    it('returns 200 with text/plain Content-Type for valid request', async () => {
      const mockContent = '|0000|LECD|01012025|31122025|Test Org|12345678000195||\r\n|9999|1|\r\n';
      (mockedService.generateSpedEcd as jest.Mock).mockResolvedValue({
        content: mockContent,
        filename: 'SPED_ECD_12345678000195_2025.txt',
      });

      const res = await request(app)
        .get(BASE_DOWNLOAD)
        .query({ fiscalYearId: FY_ID })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
    });

    it('returns Content-Disposition header with .txt filename', async () => {
      const mockContent = '|0000|LECD||';
      (mockedService.generateSpedEcd as jest.Mock).mockResolvedValue({
        content: mockContent,
        filename: 'SPED_ECD_12345678000195_2025.txt',
      });

      const res = await request(app)
        .get(BASE_DOWNLOAD)
        .query({ fiscalYearId: FY_ID })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('.txt');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    it('returns 400 when fiscalYearId is missing', async () => {
      const res = await request(app).get(BASE_DOWNLOAD).set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_FISCAL_YEAR_ID');
    });

    it('returns 404 when fiscal year not found', async () => {
      const err = new service.SpedEcdError(
        'Exercicio fiscal nao encontrado',
        'FISCAL_YEAR_NOT_FOUND',
        404,
      );
      (mockedService.generateSpedEcd as jest.Mock).mockRejectedValue(err);

      const res = await request(app)
        .get(BASE_DOWNLOAD)
        .query({ fiscalYearId: 'nonexistent' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });

    it('calls generateSpedEcd with correct orgId and fiscalYearId', async () => {
      (mockedService.generateSpedEcd as jest.Mock).mockResolvedValue({
        content: '|0000|LECD||',
        filename: 'SPED_ECD_12345678000195_2025.txt',
      });

      await request(app)
        .get(BASE_DOWNLOAD)
        .query({ fiscalYearId: FY_ID })
        .set('Authorization', 'Bearer token');

      expect(mockedService.generateSpedEcd).toHaveBeenCalledWith(ORG_ID, FY_ID);
    });
  });
});
