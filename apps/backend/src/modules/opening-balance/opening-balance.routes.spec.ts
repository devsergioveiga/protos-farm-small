import request from 'supertest';
import { app } from '../../app';
import * as openingBalanceService from './opening-balance.service';
import * as authService from '../auth/auth.service';
import { OpeningBalanceError } from './opening-balance.types';

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

jest.mock('./opening-balance.service', () => ({
  getOpeningBalancePreview: jest.fn(),
  postOpeningBalance: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(openingBalanceService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'user-1',
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

const PREVIEW_LINES = [
  {
    accountId: 'acc-bank-1',
    accountCode: '1.1.01',
    accountName: 'Caixa e Equivalentes',
    side: 'DEBIT' as const,
    amount: '5000.00',
    source: 'BANK_BALANCE' as const,
    description: 'Saldo bancario — Banco do Brasil',
  },
  {
    accountId: 'acc-payable-1',
    accountCode: '2.1.01',
    accountName: 'Fornecedores',
    side: 'CREDIT' as const,
    amount: '2000.00',
    source: 'PAYABLE' as const,
    description: 'Contas a pagar em aberto',
  },
  {
    accountId: 'acc-recv-1',
    accountCode: '1.1.03',
    accountName: 'Clientes',
    side: 'DEBIT' as const,
    amount: '1500.00',
    source: 'RECEIVABLE' as const,
    description: 'Contas a receber em aberto',
  },
];

const POSTED_ENTRY = {
  id: 'je-1',
  organizationId: 'org-1',
  entryNumber: 1,
  entryDate: '2026-01-01T00:00:00.000Z',
  periodId: 'period-1',
  description: 'Saldo de Abertura — Exercicio 2026',
  entryType: 'OPENING_BALANCE',
  status: 'POSTED',
  lines: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ─── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// GET /preview/:fiscalYearId

describe('GET /api/org/:orgId/opening-balance/preview/:fiscalYearId', () => {
  it('returns 200 with preview lines for a fiscal year', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getOpeningBalancePreview.mockResolvedValue(PREVIEW_LINES);

    const res = await request(app)
      .get('/api/org/org-1/opening-balance/preview/fy-2026')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(PREVIEW_LINES);
    expect(mockedService.getOpeningBalancePreview).toHaveBeenCalledWith('org-1', 'fy-2026');
  });

  it('returns 200 with empty array when no data exists', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getOpeningBalancePreview.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/org/org-1/opening-balance/preview/fy-2026')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app).get('/api/org/org-1/opening-balance/preview/fy-2026');

    expect(res.status).toBe(401);
  });

  it('returns 500 on unexpected service error', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getOpeningBalancePreview.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/org/org-1/opening-balance/preview/fy-2026')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
  });
});

// POST /

describe('POST /api/org/:orgId/opening-balance', () => {
  const POST_BODY = {
    fiscalYearId: 'fy-2026',
    periodId: 'period-1',
    lines: [
      { accountId: 'acc-bank-1', side: 'DEBIT', amount: '5000.00', description: 'Caixa' },
      { accountId: 'acc-payable-1', side: 'CREDIT', amount: '2000.00', description: 'Fornecedores' },
      {
        accountId: 'acc-pl-1',
        side: 'CREDIT',
        amount: '3000.00',
        description: 'Lucros e Prejuizos Acumulados',
      },
    ],
  };

  it('creates and posts opening balance entry, returns 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.postOpeningBalance.mockResolvedValue(POSTED_ENTRY);

    const res = await request(app)
      .post('/api/org/org-1/opening-balance')
      .set('Authorization', 'Bearer token')
      .send(POST_BODY);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'je-1',
      entryType: 'OPENING_BALANCE',
      status: 'POSTED',
    });
    expect(mockedService.postOpeningBalance).toHaveBeenCalledWith(
      'org-1',
      POST_BODY,
      'user-1',
    );
  });

  it('returns 409 when opening balance already exists for this fiscal year', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.postOpeningBalance.mockRejectedValue(
      new OpeningBalanceError(
        'Ja existe saldo de abertura para este exercicio fiscal',
        'ALREADY_EXISTS',
        409,
      ),
    );

    const res = await request(app)
      .post('/api/org/org-1/opening-balance')
      .set('Authorization', 'Bearer token')
      .send(POST_BODY);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/saldo de abertura/i);
  });

  it('returns 422 on unbalanced entry', async () => {
    authAs(ADMIN_PAYLOAD);
    // Simulate UnbalancedEntryError from journal-entries service
    const err = new Error('Lançamento desbalanceado');
    (err as unknown as Record<string, unknown>).code = 'UNBALANCED';
    (err as unknown as Record<string, unknown>).statusCode = 422;
    Object.setPrototypeOf(err, Object.assign(Object.create(Error.prototype), { name: 'UnbalancedEntryError' }));
    mockedService.postOpeningBalance.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/org/org-1/opening-balance')
      .set('Authorization', 'Bearer token')
      .send(POST_BODY);

    expect(res.status).toBe(422);
  });

  it('returns 422 on period not open', async () => {
    authAs(ADMIN_PAYLOAD);
    const err = new Error('Periodo nao esta aberto');
    (err as unknown as Record<string, unknown>).code = 'PERIOD_NOT_OPEN';
    (err as unknown as Record<string, unknown>).statusCode = 422;
    mockedService.postOpeningBalance.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/org/org-1/opening-balance')
      .set('Authorization', 'Bearer token')
      .send(POST_BODY);

    expect(res.status).toBe(422);
  });

  it('returns 401 when unauthenticated', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app)
      .post('/api/org/org-1/opening-balance')
      .send(POST_BODY);

    expect(res.status).toBe(401);
  });

  it('returns 500 on unexpected error', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.postOpeningBalance.mockRejectedValue(new Error('Unexpected DB error'));

    const res = await request(app)
      .post('/api/org/org-1/opening-balance')
      .set('Authorization', 'Bearer token')
      .send(POST_BODY);

    expect(res.status).toBe(500);
  });
});

// ─── Service unit-level tests (service behaviour validation) ─────────

describe('OpeningBalanceError', () => {
  it('has correct properties when constructed', () => {
    const err = new OpeningBalanceError('Test error', 'TEST_CODE', 409);
    expect(err.message).toBe('Test error');
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(409);
    expect(err instanceof OpeningBalanceError).toBe(true);
  });

  it('defaults statusCode to 422', () => {
    const err = new OpeningBalanceError('Test', 'CODE');
    expect(err.statusCode).toBe(422);
  });
});
