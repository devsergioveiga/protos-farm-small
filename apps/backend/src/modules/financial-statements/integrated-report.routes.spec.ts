// ─── Integrated Report Routes Tests ──────────────────────────────────────────
// Route integration tests for GET /download, PATCH /notes, GET /notes.
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

jest.mock('./integrated-report.service', () => ({
  generateIntegratedReport: jest.fn(),
  saveNotes: jest.fn(),
  getNotes: jest.fn(),
  formatBrl: jest.fn((v: number) => `R$ ${v.toFixed(2)}`),
}));

import request from 'supertest';
import { app } from '../../app';
import * as service from './integrated-report.service';
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
const BASE = `/api/org/${ORG_ID}/integrated-report`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Integrated Report Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── GET /download ────────────────────────────────────────────────────────

  describe('GET /download', () => {
    it('returns 200 with Content-Type application/pdf for valid request', async () => {
      const fakePdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
      (mockedService.generateIntegratedReport as jest.Mock).mockResolvedValue({
        buffer: fakePdfBuffer,
        filename: 'Relatorio_Integrado_2025.pdf',
      });

      const res = await request(app)
        .get(`${BASE}/download`)
        .query({ fiscalYearId: FY_ID })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
    });

    it('returns Content-Disposition header with PDF filename', async () => {
      const fakePdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
      (mockedService.generateIntegratedReport as jest.Mock).mockResolvedValue({
        buffer: fakePdfBuffer,
        filename: 'Relatorio_Integrado_2025.pdf',
      });

      const res = await request(app)
        .get(`${BASE}/download`)
        .query({ fiscalYearId: FY_ID })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('Relatorio_Integrado_2025.pdf');
    });

    it('returns 400 when fiscalYearId is missing', async () => {
      const res = await request(app).get(`${BASE}/download`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_FISCAL_YEAR_ID');
    });

    it('calls generateIntegratedReport with correct orgId and fiscalYearId', async () => {
      const fakePdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
      (mockedService.generateIntegratedReport as jest.Mock).mockResolvedValue({
        buffer: fakePdfBuffer,
        filename: 'Relatorio_Integrado_2025.pdf',
      });

      await request(app)
        .get(`${BASE}/download`)
        .query({ fiscalYearId: FY_ID })
        .set('Authorization', 'Bearer token');

      expect(mockedService.generateIntegratedReport).toHaveBeenCalledWith(ORG_ID, FY_ID, undefined);
    });

    it('passes costCenterId when provided', async () => {
      const fakePdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
      (mockedService.generateIntegratedReport as jest.Mock).mockResolvedValue({
        buffer: fakePdfBuffer,
        filename: 'Relatorio_Integrado_2025.pdf',
      });

      await request(app)
        .get(`${BASE}/download`)
        .query({ fiscalYearId: FY_ID, costCenterId: 'cc-1' })
        .set('Authorization', 'Bearer token');

      expect(mockedService.generateIntegratedReport).toHaveBeenCalledWith(ORG_ID, FY_ID, 'cc-1');
    });
  });

  // ─── PATCH /notes ─────────────────────────────────────────────────────────

  describe('PATCH /notes', () => {
    it('returns 200 { ok: true } when notesText is a string', async () => {
      (mockedService.saveNotes as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app)
        .patch(`${BASE}/notes`)
        .set('Authorization', 'Bearer token')
        .send({ notesText: 'Informacoes adicionais sobre o exercicio.' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('calls saveNotes with correct orgId and notesText', async () => {
      (mockedService.saveNotes as jest.Mock).mockResolvedValue(undefined);

      await request(app)
        .patch(`${BASE}/notes`)
        .set('Authorization', 'Bearer token')
        .send({ notesText: 'test notes' });

      expect(mockedService.saveNotes).toHaveBeenCalledWith(ORG_ID, 'test notes');
    });

    it('returns 400 when notesText is missing or not a string', async () => {
      const res = await request(app)
        .patch(`${BASE}/notes`)
        .set('Authorization', 'Bearer token')
        .send({ notesText: 123 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_NOTES_TEXT');
    });

    it('accepts empty string as valid notesText', async () => {
      (mockedService.saveNotes as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app)
        .patch(`${BASE}/notes`)
        .set('Authorization', 'Bearer token')
        .send({ notesText: '' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  // ─── GET /notes ───────────────────────────────────────────────────────────

  describe('GET /notes', () => {
    it('returns { notesText: null } for org without notes', async () => {
      (mockedService.getNotes as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get(`${BASE}/notes`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ notesText: null });
    });

    it('returns { notesText: string } when org has notes', async () => {
      (mockedService.getNotes as jest.Mock).mockResolvedValue('Notas sobre o exercicio 2025.');

      const res = await request(app).get(`${BASE}/notes`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ notesText: 'Notas sobre o exercicio 2025.' });
    });

    it('calls getNotes with correct orgId', async () => {
      (mockedService.getNotes as jest.Mock).mockResolvedValue(null);

      await request(app).get(`${BASE}/notes`).set('Authorization', 'Bearer token');

      expect(mockedService.getNotes).toHaveBeenCalledWith(ORG_ID);
    });
  });
});
