import request from 'supertest';
import { app } from '../../app';
import * as bankAccountsService from './bank-accounts.service';
import * as authService from '../auth/auth.service';
import { BankAccountError } from './bank-accounts.types';

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

jest.mock('./bank-accounts.service', () => ({
  createBankAccount: jest.fn(),
  listBankAccounts: jest.fn(),
  getBankAccount: jest.fn(),
  updateBankAccount: jest.fn(),
  deleteBankAccount: jest.fn(),
  getStatement: jest.fn(),
  exportStatement: jest.fn(),
  getDashboard: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(bankAccountsService);
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

// ─── Fixtures ───────────────────────────────────────────────────────

const BANK_ACCOUNT = {
  id: 'account-1',
  organizationId: 'org-1',
  name: 'Conta Corrente Bradesco',
  type: 'CHECKING',
  bankCode: '237',
  bankName: 'Bradesco',
  agency: '1234',
  agencyDigit: '5',
  accountNumber: '123456',
  accountDigit: '7',
  producerId: null,
  notes: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  balance: {
    initialBalance: 1000,
    currentBalance: 1500,
  },
  farms: [{ id: 'farm-1', name: 'Fazenda São João' }],
  producer: null,
};

const TRANSACTION = {
  id: 'tx-1',
  bankAccountId: 'account-1',
  type: 'CREDIT',
  amount: 500,
  description: 'Saldo inicial',
  referenceType: 'OPENING_BALANCE',
  referenceId: null,
  transactionDate: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const DASHBOARD_OUTPUT = {
  totalBalance: 5000,
  accountCount: 3,
  byType: [
    { type: 'CHECKING', typeLabel: 'Conta Corrente', totalBalance: 3000, count: 2 },
    { type: 'SAVINGS', typeLabel: 'Poupança', totalBalance: 2000, count: 1 },
  ],
};

// ─── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/org/bank-accounts', () => {
  it('creates account and returns 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createBankAccount.mockResolvedValue(BANK_ACCOUNT);

    const res = await request(app)
      .post('/api/org/bank-accounts')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Conta Corrente Bradesco',
        type: 'CHECKING',
        bankCode: '237',
        agency: '1234',
        agencyDigit: '5',
        accountNumber: '123456',
        accountDigit: '7',
        initialBalance: 1000,
        farmIds: ['farm-1'],
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'account-1', name: 'Conta Corrente Bradesco' });
    expect(mockedService.createBankAccount).toHaveBeenCalledTimes(1);
  });

  it('creates account with producerId=null (org-level account)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createBankAccount.mockResolvedValue({ ...BANK_ACCOUNT, producerId: null });

    const res = await request(app)
      .post('/api/org/bank-accounts')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Conta Org',
        type: 'CHECKING',
        bankCode: '237',
        agency: '1234',
        accountNumber: '123456',
        initialBalance: 0,
        producerId: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.producerId).toBeNull();
  });

  it('returns 400 on service error with statusCode 400', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createBankAccount.mockRejectedValue(
      new BankAccountError('Código bancário inválido', 400),
    );

    const res = await request(app)
      .post('/api/org/bank-accounts')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'X',
        type: 'CHECKING',
        bankCode: '999',
        agency: '1',
        accountNumber: '1',
        initialBalance: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Código bancário inválido' });
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/org/bank-accounts').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/org/bank-accounts', () => {
  it('returns list with balance', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listBankAccounts.mockResolvedValue([BANK_ACCOUNT]);

    const res = await request(app)
      .get('/api/org/bank-accounts')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 'account-1', balance: { currentBalance: 1500 } });
  });

  it('passes farmId filter to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listBankAccounts.mockResolvedValue([BANK_ACCOUNT]);

    const res = await request(app)
      .get('/api/org/bank-accounts?farmId=farm-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listBankAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ farmId: 'farm-1' }),
    );
  });

  it('passes type filter to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listBankAccounts.mockResolvedValue([BANK_ACCOUNT]);

    const res = await request(app)
      .get('/api/org/bank-accounts?type=CHECKING')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listBankAccounts).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ type: 'CHECKING' }),
    );
  });
});

describe('GET /api/org/bank-accounts/dashboard', () => {
  it('returns dashboard totals grouped by account type', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getDashboard.mockResolvedValue(DASHBOARD_OUTPUT);

    const res = await request(app)
      .get('/api/org/bank-accounts/dashboard')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalBalance: 5000,
      accountCount: 3,
      byType: expect.arrayContaining([
        expect.objectContaining({ type: 'CHECKING', totalBalance: 3000 }),
      ]),
    });
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/org/bank-accounts/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/org/bank-accounts/:id', () => {
  it('returns account with balance, farms, producer', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getBankAccount.mockResolvedValue(BANK_ACCOUNT);

    const res = await request(app)
      .get('/api/org/bank-accounts/account-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'account-1',
      balance: { currentBalance: 1500 },
      farms: [{ id: 'farm-1' }],
    });
  });

  it('returns 404 for non-existent account', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getBankAccount.mockRejectedValue(
      new BankAccountError('Conta bancária não encontrada', 404),
    );

    const res = await request(app)
      .get('/api/org/bank-accounts/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Conta bancária não encontrada' });
  });
});

describe('PATCH /api/org/bank-accounts/:id', () => {
  it('updates account and returns updated data', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateBankAccount.mockResolvedValue({
      ...BANK_ACCOUNT,
      name: 'Conta Atualizada',
    });

    const res = await request(app)
      .patch('/api/org/bank-accounts/account-1')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Conta Atualizada' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Conta Atualizada');
  });
});

describe('DELETE /api/org/bank-accounts/:id', () => {
  it('soft-deletes and returns 204', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteBankAccount.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/org/bank-accounts/account-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(mockedService.deleteBankAccount).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'account-1',
    );
  });
});

describe('GET /api/org/bank-accounts/:id/statement', () => {
  it('returns transactions filtered by period', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getStatement.mockResolvedValue([TRANSACTION]);

    const res = await request(app)
      .get('/api/org/bank-accounts/account-1/statement?from=2026-01-01&to=2026-01-31')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 'tx-1', type: 'CREDIT' });
    expect(mockedService.getStatement).toHaveBeenCalledWith(
      expect.any(Object),
      'account-1',
      expect.objectContaining({ from: '2026-01-01', to: '2026-01-31' }),
    );
  });

  it('passes type filter (CREDIT/DEBIT) to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getStatement.mockResolvedValue([TRANSACTION]);

    const res = await request(app)
      .get('/api/org/bank-accounts/account-1/statement?type=CREDIT')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.getStatement).toHaveBeenCalledWith(
      expect.any(Object),
      'account-1',
      expect.objectContaining({ type: 'CREDIT' }),
    );
  });
});

describe('GET /api/org/bank-accounts/:id/statement/export', () => {
  it('returns PDF with correct content-type', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.exportStatement.mockResolvedValue(Buffer.from('%PDF-1.4'));

    const res = await request(app)
      .get('/api/org/bank-accounts/account-1/statement/export?format=pdf')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('returns xlsx with correct content-type', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.exportStatement.mockResolvedValue(Buffer.from('xlsx-data'));

    const res = await request(app)
      .get('/api/org/bank-accounts/account-1/statement/export?format=xlsx')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('returns csv with correct content-type', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.exportStatement.mockResolvedValue(Buffer.from('\uFEFFData;Desc'));

    const res = await request(app)
      .get('/api/org/bank-accounts/account-1/statement/export?format=csv')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('returns 400 for invalid format', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .get('/api/org/bank-accounts/account-1/statement/export?format=docx')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Formato') });
  });
});
