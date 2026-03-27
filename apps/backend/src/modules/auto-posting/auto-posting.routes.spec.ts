// ─── Auto-Posting Routes Tests ────────────────────────────────────────────────
// Integration tests for all 8 auto-posting REST endpoints.
// Pattern: mock service + auth, use supertest against Express app.

// ─── Setup mocks before imports ──────────────────────────────────────

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

jest.mock('./auto-posting.service', () => ({
  listRules: jest.fn(),
  getRule: jest.fn(),
  updateRule: jest.fn(),
  previewRule: jest.fn(),
  listPending: jest.fn(),
  getPendingCounts: jest.fn(),
  retry: jest.fn(),
  retryBatch: jest.fn(),
  AutoPostingError: class AutoPostingError extends Error {
    constructor(message: string, public code: string, public statusCode = 400) {
      super(message);
      this.name = 'AutoPostingError';
    }
  },
}));

import request from 'supertest';
import { app } from '../../app';
import * as service from './auto-posting.service';
import * as authService from '../auth/auth.service';
import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockedService = jest.mocked(service);
const mockedAuth = jest.mocked(authService);
const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

// ─── Auth helpers ──────────────────────────────────────────────────────

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
const BASE = `/api/org/${ORG_ID}/auto-posting`;

// ─── Mock data helpers ────────────────────────────────────────────────

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    sourceType: 'PAYROLL_RUN_CLOSE' as const,
    isActive: true,
    historyTemplate: 'Folha {{referenceMonth}}',
    requireCostCenter: false,
    lines: [
      {
        id: 'line-1',
        lineOrder: 1,
        side: 'DEBIT' as const,
        accountId: 'account-1',
        accountCode: '6.1.01',
        accountName: 'Despesa Salarios',
        description: 'Salarios',
      },
    ],
    ...overrides,
  };
}

function makePending(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pending-1',
    sourceType: 'PAYROLL_RUN_CLOSE' as const,
    sourceId: 'payroll-run-1',
    status: 'ERROR' as const,
    accountingRuleId: 'rule-1',
    journalEntryId: null,
    errorMessage: 'Periodo fechado',
    createdAt: '2026-01-01T00:00:00.000Z',
    processedAt: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('Auto-Posting Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── GET /rules ───────────────────────────────────────────────────

  it('GET /rules returns all rules for org', async () => {
    const rules = [makeRule()];
    (mockedService.listRules as jest.Mock).mockResolvedValue(rules);

    const res = await request(app)
      .get(`${BASE}/rules`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('rule-1');
    expect(res.body[0].sourceType).toBe('PAYROLL_RUN_CLOSE');
  });

  it('GET /rules returns 401 without auth', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app).get(`${BASE}/rules`);
    expect(res.status).toBe(401);
  });

  // ─── GET /rules/:ruleId ───────────────────────────────────────────

  it('GET /rules/:ruleId returns single rule with lines', async () => {
    (mockedService.getRule as jest.Mock).mockResolvedValue(makeRule());

    const res = await request(app)
      .get(`${BASE}/rules/rule-1`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('rule-1');
    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0].accountCode).toBe('6.1.01');
  });

  it('GET /rules/:ruleId returns 404 when rule not found', async () => {
    (mockedService.getRule as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get(`${BASE}/rules/nonexistent`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Regra nao encontrada');
  });

  // ─── PATCH /rules/:ruleId ─────────────────────────────────────────

  it('PATCH /rules/:ruleId updates rule isActive, historyTemplate, lines', async () => {
    const updated = makeRule({ isActive: false, historyTemplate: 'Novo template' });
    (mockedService.updateRule as jest.Mock).mockResolvedValue(updated);

    const res = await request(app)
      .patch(`${BASE}/rules/rule-1`)
      .set('Authorization', 'Bearer token')
      .send({ isActive: false, historyTemplate: 'Novo template' });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect(res.body.historyTemplate).toBe('Novo template');
  });

  it('PATCH /rules/:ruleId returns 404 when rule not found', async () => {
    // Use the mocked AutoPostingError so instanceof check in handler works
    const MockedAutoPostingError = service.AutoPostingError as unknown as new (msg: string, code: string, status: number) => Error & { code: string; statusCode: number };
    const err = new MockedAutoPostingError('Regra nao encontrada', 'NOT_FOUND', 404);
    (mockedService.updateRule as jest.Mock).mockRejectedValue(err);

    const res = await request(app)
      .patch(`${BASE}/rules/nonexistent`)
      .set('Authorization', 'Bearer token')
      .send({ isActive: false });

    expect(res.status).toBe(404);
  });

  // ─── GET /rules/:ruleId/preview ───────────────────────────────────

  it('GET /rules/:ruleId/preview returns preview output', async () => {
    const preview = {
      entryDate: '2026-01-01',
      description: 'Folha 2026-01',
      lines: [
        { lineOrder: 1, side: 'DEBIT', accountCode: '6.1.01', accountName: 'Salarios', amount: '5000.00', description: null },
      ],
      costCenterName: null,
    };
    (mockedService.previewRule as jest.Mock).mockResolvedValue(preview);

    const res = await request(app)
      .get(`${BASE}/rules/rule-1/preview`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Folha 2026-01');
    expect(res.body.lines).toHaveLength(1);
  });

  it('GET /rules/:ruleId/preview returns 404 when no data available', async () => {
    (mockedService.previewRule as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get(`${BASE}/rules/rule-1/preview`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Nenhuma operacao encontrada para preview');
  });

  // ─── GET /pending ─────────────────────────────────────────────────

  it('GET /pending returns filtered pending list', async () => {
    const pendings = [makePending()];
    (mockedService.listPending as jest.Mock).mockResolvedValue(pendings);

    const res = await request(app)
      .get(`${BASE}/pending?status=ERROR`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('ERROR');
  });

  it('GET /pending returns empty list when none found', async () => {
    (mockedService.listPending as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get(`${BASE}/pending`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  // ─── GET /pending/counts ──────────────────────────────────────────

  it('GET /pending/counts returns error and pending badge counts', async () => {
    (mockedService.getPendingCounts as jest.Mock).mockResolvedValue({ error: 3, pending: 1 });

    const res = await request(app)
      .get(`${BASE}/pending/counts`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.error).toBe(3);
    expect(res.body.pending).toBe(1);
  });

  // ─── POST /pending/:id/retry ──────────────────────────────────────

  it('POST /pending/:id/retry retries single ERROR posting', async () => {
    const result = makePending({ status: 'COMPLETED', journalEntryId: 'entry-1', errorMessage: null });
    (mockedService.retry as jest.Mock).mockResolvedValue(result);

    const res = await request(app)
      .post(`${BASE}/pending/pending-1/retry`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.journalEntryId).toBe('entry-1');
  });

  it('POST /pending/:id/retry returns 422 when status is not ERROR', async () => {
    // Use the mocked AutoPostingError so instanceof check in handler works
    const MockedAutoPostingError = service.AutoPostingError as unknown as new (msg: string, code: string, status: number) => Error & { code: string; statusCode: number };
    const err = new MockedAutoPostingError('Apenas lancamentos com status ERROR podem ser reprocessados', 'INVALID_STATUS', 422);
    (mockedService.retry as jest.Mock).mockRejectedValue(err);

    const res = await request(app)
      .post(`${BASE}/pending/pending-completed/retry`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_STATUS');
  });

  // ─── POST /pending/retry-batch ────────────────────────────────────

  it('POST /pending/retry-batch retries all ERROR postings matching filters', async () => {
    (mockedService.retryBatch as jest.Mock).mockResolvedValue({ succeeded: 5, failed: 1 });

    const res = await request(app)
      .post(`${BASE}/pending/retry-batch`)
      .set('Authorization', 'Bearer token')
      .send({ sourceType: 'PAYROLL_RUN_CLOSE' });

    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(5);
    expect(res.body.failed).toBe(1);
  });

  it('POST /pending/retry-batch with empty body retries all ERROR postings', async () => {
    (mockedService.retryBatch as jest.Mock).mockResolvedValue({ succeeded: 10, failed: 0 });

    const res = await request(app)
      .post(`${BASE}/pending/retry-batch`)
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(10);
    expect(res.body.failed).toBe(0);
  });
});
