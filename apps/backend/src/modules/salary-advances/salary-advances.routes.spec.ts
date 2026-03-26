import request from 'supertest';
import { app } from '../../app';
import * as service from './salary-advances.service';
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

jest.mock('./salary-advances.service', () => ({
  createAdvance: jest.fn(),
  createBatchAdvances: jest.fn(),
  listAdvances: jest.fn(),
  generateAdvanceReceiptPdf: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = service as jest.Mocked<typeof service>;
const mockedAuth = jest.mocked(authService);

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: 'org-1',
};

function authAs(payload: typeof MANAGER_PAYLOAD): void {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

const ORG_ID = 'org-1';
const ADVANCE_ID = 'advance-1';

const mockAdvance = {
  id: ADVANCE_ID,
  organizationId: ORG_ID,
  employeeId: 'emp-1',
  referenceMonth: new Date('2026-03-01').toISOString(),
  amount: 1000,
  advanceDate: new Date('2026-03-15').toISOString(),
  batchId: null,
  notes: null,
  payableId: 'payable-1',
  deductedInRunId: null,
  createdBy: 'manager-1',
  createdAt: new Date().toISOString(),
};

// ─── POST /org/:orgId/salary-advances ─────────────────────────────────

describe('POST /org/:orgId/salary-advances', () => {
  it('creates an individual advance and returns 201', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createAdvance.mockResolvedValue(mockAdvance as any);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/salary-advances`)
      .set('Authorization', 'Bearer token')
      .send({
        employeeId: 'emp-1',
        referenceMonth: '2026-03',
        amount: 1000,
        advanceDate: '2026-03-15',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: ADVANCE_ID, amount: 1000 });
    expect(mockedService.createAdvance).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      expect.objectContaining({ employeeId: 'emp-1', amount: 1000 }),
    );
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post(`/api/org/${ORG_ID}/salary-advances`)
      .send({ employeeId: 'emp-1', amount: 1000 });

    expect(res.status).toBe(401);
  });
});

// ─── POST /org/:orgId/salary-advances/batch ───────────────────────────

describe('POST /org/:orgId/salary-advances/batch', () => {
  it('creates batch advances and returns 201 with count and batchId', async () => {
    authAs(MANAGER_PAYLOAD);
    const batchResult = {
      batchId: 'batch-123',
      count: 3,
      advances: [mockAdvance, mockAdvance, mockAdvance],
    };
    mockedService.createBatchAdvances.mockResolvedValue(batchResult as any);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/salary-advances/batch`)
      .set('Authorization', 'Bearer token')
      .send({
        referenceMonth: '2026-03',
        advanceDate: '2026-03-15',
        percentOfSalary: 40,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ batchId: 'batch-123', count: 3 });
    expect(mockedService.createBatchAdvances).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      expect.objectContaining({ referenceMonth: '2026-03' }),
    );
  });
});

// ─── GET /org/:orgId/salary-advances ──────────────────────────────────

describe('GET /org/:orgId/salary-advances', () => {
  it('lists advances with filters and returns paginated result', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listAdvances.mockResolvedValue({
      data: [mockAdvance] as any,
      total: 1,
    });

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/salary-advances?referenceMonth=2026-03`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: expect.any(Array), total: 1 });
    expect(mockedService.listAdvances).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      expect.objectContaining({ referenceMonth: '2026-03' }),
    );
  });
});

// ─── GET /org/:orgId/salary-advances/:id/receipt ──────────────────────

describe('GET /org/:orgId/salary-advances/:id/receipt', () => {
  it('returns PDF buffer with correct content-type header', async () => {
    authAs(MANAGER_PAYLOAD);
    const pdfBuffer = Buffer.from('%PDF-1.4 test');
    mockedService.generateAdvanceReceiptPdf.mockResolvedValue(pdfBuffer);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/salary-advances/${ADVANCE_ID}/receipt`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(mockedService.generateAdvanceReceiptPdf).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      ADVANCE_ID,
    );
  });

  it('returns 404 when advance not found', async () => {
    authAs(MANAGER_PAYLOAD);
    const { SalaryAdvanceError } = await import('./salary-advances.types');
    mockedService.generateAdvanceReceiptPdf.mockRejectedValue(
      new SalaryAdvanceError('Adiantamento não encontrado', 'NOT_FOUND', 404),
    );

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/salary-advances/nonexistent/receipt`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
