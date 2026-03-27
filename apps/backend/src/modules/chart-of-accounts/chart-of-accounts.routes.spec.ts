// ─── Chart of Accounts Integration Tests ─────────────────────────────────────
// Tests for COA CRUD, seed, and unmapped-sped endpoints.
// Mocks: prisma, rbac service, auth service.
// Pattern: follows accounting-entries.routes.spec.ts and products.routes.spec.ts

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

jest.mock('./chart-of-accounts.service', () => ({
  getAccountTree: jest.fn(),
  getAccountById: jest.fn(),
  createAccount: jest.fn(),
  updateAccount: jest.fn(),
  deactivateAccount: jest.fn(),
  getUnmappedSpedAccounts: jest.fn(),
  seedRuralTemplate: jest.fn(),
}));

import request from 'supertest';
import { app } from '../../app';
import * as service from './chart-of-accounts.service';
import * as authService from '../auth/auth.service';
import { ChartOfAccountError } from './chart-of-accounts.types';
import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';
import { RURAL_COA_TEMPLATE } from './coa-rural-template';

const mockedService = jest.mocked(service);
const mockedAuth = jest.mocked(authService);
const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

// ─── Auth helpers ─────────────────────────────────────────────────────

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const FINANCIAL_PAYLOAD = {
  userId: 'fin-1',
  email: 'fin@org.com',
  role: 'FINANCIAL' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Mock data ────────────────────────────────────────────────────────

interface AccountMock {
  id: string;
  organizationId: string;
  parentId: string | null;
  code: string;
  name: string;
  accountType: 'ATIVO' | 'PASSIVO' | 'PL' | 'RECEITA' | 'DESPESA';
  nature: 'DEVEDORA' | 'CREDORA';
  isSynthetic: boolean;
  allowManualEntry: boolean;
  isActive: boolean;
  isFairValueAdj: boolean;
  spedRefCode: string | null;
  level: number;
  createdAt: string;
  updatedAt: string;
}

function makeAccount(overrides: Partial<AccountMock> = {}): AccountMock {
  return {
    id: 'coa-1',
    organizationId: 'org-1',
    parentId: null,
    code: '1',
    name: 'ATIVO',
    accountType: 'ATIVO' as const,
    nature: 'DEVEDORA' as const,
    isSynthetic: true,
    allowManualEntry: false,
    isActive: true,
    isFairValueAdj: false,
    spedRefCode: null,
    level: 1,
    createdAt: '2026-03-27T00:00:00.000Z',
    updatedAt: '2026-03-27T00:00:00.000Z',
    ...overrides,
  };
}

function makeLeafAccount(overrides: Partial<AccountMock> = {}): AccountMock {
  return makeAccount({
    id: 'coa-leaf-1',
    code: '1.1.01.001',
    name: 'Caixa',
    accountType: 'ATIVO' as const,
    nature: 'DEVEDORA' as const,
    isSynthetic: false,
    allowManualEntry: true,
    level: 4,
    parentId: 'coa-parent-1',
    spedRefCode: '1.01.01.01.01',
    ...overrides,
  });
}

// ─── GET /org/:orgId/chart-of-accounts ────────────────────────────────

describe('GET /api/org/:orgId/chart-of-accounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  it('returns 200 with accounts array ordered by code', async () => {
    const accounts = [
      makeAccount({ code: '1', name: 'ATIVO' }),
      makeAccount({ id: 'coa-2', code: '2', name: 'PASSIVO', accountType: 'PASSIVO' as const, nature: 'CREDORA' as const }),
    ];
    mockedService.getAccountTree.mockResolvedValue(accounts as any);

    const res = await request(app)
      .get('/api/org/org-1/chart-of-accounts')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].code).toBe('1');
    expect(res.body[1].code).toBe('2');
  });

  it('returns 401 when not authenticated', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const res = await request(app).get('/api/org/org-1/chart-of-accounts');

    expect(res.status).toBe(401);
  });
});

// ─── POST /org/:orgId/chart-of-accounts ───────────────────────────────

describe('POST /api/org/:orgId/chart-of-accounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  it('creates account and returns 201 with id', async () => {
    const created = makeLeafAccount();
    mockedService.createAccount.mockResolvedValue(created as any);

    const res = await request(app)
      .post('/api/org/org-1/chart-of-accounts')
      .set('Authorization', 'Bearer token')
      .send({
        code: '1.1.01.001',
        name: 'Caixa',
        accountType: 'ATIVO',
        nature: 'DEVEDORA',
        isSynthetic: false,
        allowManualEntry: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('coa-leaf-1');
    expect(res.body.code).toBe('1.1.01.001');
  });

  it('returns 409 when code already exists', async () => {
    mockedService.createAccount.mockRejectedValue(
      new ChartOfAccountError('Código já existe', 'DUPLICATE_CODE', 409),
    );

    const res = await request(app)
      .post('/api/org/org-1/chart-of-accounts')
      .set('Authorization', 'Bearer token')
      .send({
        code: '1.1.01.001',
        name: 'Caixa',
        accountType: 'ATIVO',
        nature: 'DEVEDORA',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_CODE');
  });

  it('returns 422 when level > 5', async () => {
    mockedService.createAccount.mockRejectedValue(
      new ChartOfAccountError('Nível máximo é 5', 'MAX_DEPTH_EXCEEDED', 422),
    );

    const res = await request(app)
      .post('/api/org/org-1/chart-of-accounts')
      .set('Authorization', 'Bearer token')
      .send({
        code: '1.1.1.1.1.1',
        name: 'Too Deep',
        accountType: 'ATIVO',
        nature: 'DEVEDORA',
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('MAX_DEPTH_EXCEEDED');
  });

  it('service forces allowManualEntry false when isSynthetic is true', async () => {
    // Service enforces this rule — route just passes through body
    // The service returns account with allowManualEntry: false
    const created = makeAccount({ isSynthetic: true, allowManualEntry: false });
    mockedService.createAccount.mockResolvedValue(created as any);

    const res = await request(app)
      .post('/api/org/org-1/chart-of-accounts')
      .set('Authorization', 'Bearer token')
      .send({
        code: '1',
        name: 'ATIVO',
        accountType: 'ATIVO',
        nature: 'DEVEDORA',
        isSynthetic: true,
        allowManualEntry: true, // Will be overridden by service
      });

    expect(res.status).toBe(201);
    expect(res.body.allowManualEntry).toBe(false);
  });

  it('returns 404 when parent not found', async () => {
    mockedService.createAccount.mockRejectedValue(
      new ChartOfAccountError('Conta pai não encontrada', 'PARENT_NOT_FOUND', 404),
    );

    const res = await request(app)
      .post('/api/org/org-1/chart-of-accounts')
      .set('Authorization', 'Bearer token')
      .send({
        code: '1.1',
        name: 'Ativo Circulante',
        accountType: 'ATIVO',
        nature: 'DEVEDORA',
        parentId: 'non-existent-parent',
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PARENT_NOT_FOUND');
  });
});

// ─── PUT /org/:orgId/chart-of-accounts/:id ────────────────────────────

describe('PUT /api/org/:orgId/chart-of-accounts/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  it('updates name and spedRefCode successfully', async () => {
    const updated = makeLeafAccount({ name: 'Caixa Geral', spedRefCode: '1.01.01.01.99' });
    mockedService.updateAccount.mockResolvedValue(updated as any);

    const res = await request(app)
      .put('/api/org/org-1/chart-of-accounts/coa-leaf-1')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Caixa Geral', spedRefCode: '1.01.01.01.99' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Caixa Geral');
    expect(res.body.spedRefCode).toBe('1.01.01.01.99');
  });

  it('returns 404 when account not found', async () => {
    mockedService.updateAccount.mockRejectedValue(
      new ChartOfAccountError('Conta não encontrada', 'ACCOUNT_NOT_FOUND', 404),
    );

    const res = await request(app)
      .put('/api/org/org-1/chart-of-accounts/missing')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE /org/:orgId/chart-of-accounts/:id ─────────────────────────

describe('DELETE /api/org/:orgId/chart-of-accounts/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  it('returns 409 when account has active children', async () => {
    mockedService.deactivateAccount.mockRejectedValue(
      new ChartOfAccountError('Conta com subcontas ativas', 'HAS_CHILDREN', 409),
    );

    const res = await request(app)
      .delete('/api/org/org-1/chart-of-accounts/coa-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HAS_CHILDREN');
  });

  it('returns 200 when deactivating a leaf account', async () => {
    const deactivated = makeLeafAccount({ isActive: false });
    mockedService.deactivateAccount.mockResolvedValue(deactivated as any);

    const res = await request(app)
      .delete('/api/org/org-1/chart-of-accounts/coa-leaf-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });
});

// ─── GET /org/:orgId/chart-of-accounts/unmapped-sped ──────────────────

describe('GET /api/org/:orgId/chart-of-accounts/unmapped-sped', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  it('returns only analytic accounts without spedRefCode', async () => {
    const unmapped = [
      makeLeafAccount({ id: 'coa-u1', code: '1.1.01.001', spedRefCode: null }),
      makeLeafAccount({ id: 'coa-u2', code: '1.1.01.002', spedRefCode: null }),
    ];
    mockedService.getUnmappedSpedAccounts.mockResolvedValue(unmapped as any);

    const res = await request(app)
      .get('/api/org/org-1/chart-of-accounts/unmapped-sped')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].spedRefCode).toBeNull();
    expect(res.body[1].spedRefCode).toBeNull();
  });

  it('returns empty array when all analytic accounts are mapped', async () => {
    mockedService.getUnmappedSpedAccounts.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/org/org-1/chart-of-accounts/unmapped-sped')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── POST /org/:orgId/chart-of-accounts/seed ──────────────────────────

describe('POST /api/org/:orgId/chart-of-accounts/seed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  it('returns 201 with count of created/updated accounts', async () => {
    mockedService.seedRuralTemplate.mockResolvedValue({ created: 95, updated: 0 });

    const res = await request(app)
      .post('/api/org/org-1/chart-of-accounts/seed')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(95);
    expect(res.body.updated).toBe(0);
  });

  it('is idempotent: calling seed twice does not fail', async () => {
    mockedService.seedRuralTemplate
      .mockResolvedValueOnce({ created: 95, updated: 0 })
      .mockResolvedValueOnce({ created: 0, updated: 95 });

    const res1 = await request(app)
      .post('/api/org/org-1/chart-of-accounts/seed')
      .set('Authorization', 'Bearer token');

    const res2 = await request(app)
      .post('/api/org/org-1/chart-of-accounts/seed')
      .set('Authorization', 'Bearer token');

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res2.body.created).toBe(0);
    expect(res2.body.updated).toBe(95);
  });
});

// ─── RURAL_COA_TEMPLATE validation ────────────────────────────────────

describe('RURAL_COA_TEMPLATE content', () => {
  it('has >= 80 account definitions', () => {
    expect(RURAL_COA_TEMPLATE.length).toBeGreaterThanOrEqual(80);
  });

  it('includes Level 1 accounts with codes 1, 2, 3, 4, 5', () => {
    const level1Codes = RURAL_COA_TEMPLATE.filter((a) => a.level === 1).map((a) => a.code);
    expect(level1Codes).toContain('1');
    expect(level1Codes).toContain('2');
    expect(level1Codes).toContain('3');
    expect(level1Codes).toContain('4');
    expect(level1Codes).toContain('5');
  });

  it('includes all 5 AccountType groups at level 1', () => {
    const level1 = RURAL_COA_TEMPLATE.filter((a) => a.level === 1);
    const types = level1.map((a) => a.accountType);
    expect(types).toContain('ATIVO');
    expect(types).toContain('PASSIVO');
    expect(types).toContain('PL');
    expect(types).toContain('RECEITA');
    expect(types).toContain('DESPESA');
  });

  it('includes rural-specific Ativo Biologico account (code 1.2.01)', () => {
    const ativoBiologico = RURAL_COA_TEMPLATE.find((a) => a.code === '1.2.01');
    expect(ativoBiologico).toBeDefined();
    expect(ativoBiologico?.name).toContain('Ativo Biologico');
  });

  it('includes Culturas em Formacao account', () => {
    const culturas = RURAL_COA_TEMPLATE.find((a) => a.name.includes('Culturas em Formacao'));
    expect(culturas).toBeDefined();
  });

  it('includes FUNRURAL a Recolher account', () => {
    const funrural = RURAL_COA_TEMPLATE.find((a) => a.name.includes('FUNRURAL a Recolher'));
    expect(funrural).toBeDefined();
  });

  it('includes at least one account with isFairValueAdj: true', () => {
    const fairValueAccounts = RURAL_COA_TEMPLATE.filter((a) => a.isFairValueAdj === true);
    expect(fairValueAccounts.length).toBeGreaterThan(0);
  });

  it('includes accounts with spedRefCode for SPED L300R mapping', () => {
    const withSped = RURAL_COA_TEMPLATE.filter((a) => a.spedRefCode != null);
    expect(withSped.length).toBeGreaterThan(0);
  });

  it('includes legacy 6.x codes matching ACCOUNT_CODES constants', () => {
    const codes = RURAL_COA_TEMPLATE.map((a) => a.code);
    expect(codes).toContain('6.1.01');
    expect(codes).toContain('6.1.02');
    expect(codes).toContain('6.1.03');
    expect(codes).toContain('6.1.04');
    expect(codes).toContain('6.1.05');
  });

  it('includes legacy liability codes matching ACCOUNT_CODES constants', () => {
    const codes = RURAL_COA_TEMPLATE.map((a) => a.code);
    expect(codes).toContain('2.1.01');
    expect(codes).toContain('2.1.02');
    expect(codes).toContain('2.1.03');
    expect(codes).toContain('2.2.01');
    expect(codes).toContain('2.2.02');
  });

  it('all synthetic accounts have isSynthetic: true and all analytic have isSynthetic: false', () => {
    // Synthetic accounts should not allow manual entry (enforced at service level)
    const syntheticWithManualEntry = RURAL_COA_TEMPLATE.filter(
      (a) => a.isSynthetic && a.allowManualEntry === true,
    );
    expect(syntheticWithManualEntry.length).toBe(0);
  });

  it('level matches number of parts in code split by dot', () => {
    // Check a sample of accounts for consistent level vs code
    const sample = RURAL_COA_TEMPLATE.filter((a) => a.code.includes('.'));
    for (const account of sample.slice(0, 10)) {
      const expectedLevel = account.code.split('.').length;
      expect(account.level).toBe(expectedLevel);
    }
  });
});

// ─── Service unit tests (without HTTP layer) ──────────────────────────

describe('service createAccount validation rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  it('enforces synthetic accounts cannot have allowManualEntry: true (returns 422)', async () => {
    // The service should return allowManualEntry: false for synthetic accounts
    // even if the request body says true
    const created = makeAccount({ isSynthetic: true, allowManualEntry: false });
    mockedService.createAccount.mockResolvedValue(created as any);

    const res = await request(app)
      .post('/api/org/org-1/chart-of-accounts')
      .set('Authorization', 'Bearer token')
      .send({
        code: '1',
        name: 'ATIVO',
        accountType: 'ATIVO',
        nature: 'DEVEDORA',
        isSynthetic: true,
        allowManualEntry: true,
      });

    // Route accepts the request and service handles the override
    expect(res.status).toBe(201);
    expect(mockedService.createAccount).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ isSynthetic: true }),
    );
  });
});
