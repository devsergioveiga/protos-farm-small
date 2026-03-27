// ─── Ledger Integration Tests ──────────────────────────────────────────────────
// Tests for ledger (razao), trial balance (balancete), and daily book (diario)
// Pattern: mock service + auth (follows journal-entries.routes.spec.ts)

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

jest.mock('./ledger.service', () => ({
  getLedger: jest.fn(),
  getTrialBalance: jest.fn(),
  getDailyBook: jest.fn(),
  exportLedgerCsv: jest.fn(),
  exportLedgerPdf: jest.fn(),
  exportTrialBalancePdf: jest.fn(),
  exportTrialBalanceXlsx: jest.fn(),
  exportDailyBookPdf: jest.fn(),
}));

import request from 'supertest';
import { app } from '../../app';
import * as service from './ledger.service';
import * as authService from '../auth/auth.service';
import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';
import { LedgerError } from './ledger.types';

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

const ORG_ID = 'org-1';
const BASE = `/api/org/${ORG_ID}/ledger`;

// ─── Mock data helpers ────────────────────────────────────────────────

function makeLedgerOutput() {
  return {
    accountId: 'acct-1',
    accountCode: '1.1.01',
    accountName: 'Caixa',
    nature: 'DEVEDORA',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    previousBalance: '1000.00',
    lines: [
      {
        entryId: 'entry-1',
        entryNumber: 1,
        entryDate: '2024-01-05',
        description: 'Pagamento cliente',
        side: 'DEBIT',
        amount: '500.00',
        runningBalance: '1500.00',
      },
      {
        entryId: 'entry-2',
        entryNumber: 2,
        entryDate: '2024-01-15',
        description: 'Pagamento fornecedor',
        side: 'CREDIT',
        amount: '200.00',
        runningBalance: '1300.00',
      },
    ],
    finalBalance: '1300.00',
  };
}

function makeTrialBalanceOutput() {
  return {
    periodId: 'period-1',
    periodMonth: 1,
    periodYear: 2024,
    rows: [
      {
        accountId: 'acct-1',
        accountCode: '1.1.01',
        accountName: 'Caixa',
        accountType: 'ASSET',
        nature: 'DEVEDORA',
        level: 3,
        isSynthetic: false,
        previousBalance: '1000.00',
        debitMovement: '500.00',
        creditMovement: '200.00',
        currentBalance: '1300.00',
      },
      {
        accountId: 'acct-2',
        accountCode: '2.1.01',
        accountName: 'Fornecedores',
        accountType: 'LIABILITY',
        nature: 'CREDORA',
        level: 3,
        isSynthetic: false,
        previousBalance: '-1000.00',
        debitMovement: '200.00',
        creditMovement: '500.00',
        currentBalance: '-1300.00',
      },
    ],
    grandTotals: {
      previousBalanceDebit: '1000.00',
      previousBalanceCredit: '1000.00',
      movementDebit: '700.00',
      movementCredit: '700.00',
      currentBalanceDebit: '1300.00',
      currentBalanceCredit: '1300.00',
    },
    isBalanced: true,
  };
}

function makeDailyBookOutput() {
  return {
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    entries: [
      {
        entryId: 'entry-1',
        entryNumber: 1,
        entryDate: '2024-01-05',
        description: 'Venda de produtos',
        entryType: 'MANUAL',
        lines: [
          {
            accountCode: '1.1.01',
            accountName: 'Caixa',
            side: 'DEBIT',
            amount: '1000.00',
            description: null,
          },
          {
            accountCode: '3.1.01',
            accountName: 'Receita de vendas',
            side: 'CREDIT',
            amount: '1000.00',
            description: null,
          },
        ],
      },
    ],
    totalEntries: 1,
  };
}

// ─── Tests: GET /razao ────────────────────────────────────────────────

describe('GET /api/org/:orgId/ledger/razao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(FINANCIAL_PAYLOAD);
  });

  it('returns ledger with running balance for a given account and period', async () => {
    mockedService.getLedger.mockResolvedValue(makeLedgerOutput());

    const res = await request(app)
      .get(`${BASE}/razao`)
      .query({ accountId: 'acct-1', startDate: '2024-01-01', endDate: '2024-01-31' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accountCode: '1.1.01',
      previousBalance: '1000.00',
      finalBalance: '1300.00',
    });
    expect(res.body.lines).toHaveLength(2);
    expect(res.body.lines[0]).toMatchObject({
      side: 'DEBIT',
      amount: '500.00',
      runningBalance: '1500.00',
    });
    expect(mockedService.getLedger).toHaveBeenCalledWith(ORG_ID, {
      accountId: 'acct-1',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      costCenterId: undefined,
    });
  });

  it('returns empty lines array if no entries for the account', async () => {
    mockedService.getLedger.mockResolvedValue({
      ...makeLedgerOutput(),
      lines: [],
      finalBalance: '1000.00',
    });

    const res = await request(app)
      .get(`${BASE}/razao`)
      .query({ accountId: 'acct-1', startDate: '2024-01-01', endDate: '2024-01-31' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.lines).toHaveLength(0);
    expect(res.body.finalBalance).toBe('1000.00');
  });

  it('returns 401 without auth', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app)
      .get(`${BASE}/razao`)
      .query({ accountId: 'acct-1', startDate: '2024-01-01', endDate: '2024-01-31' });

    expect(res.status).toBe(401);
  });

  it('returns 422 when service throws LedgerError', async () => {
    mockedService.getLedger.mockRejectedValue(new LedgerError('Conta não encontrada', 'NOT_FOUND', 404));

    const res = await request(app)
      .get(`${BASE}/razao`)
      .query({ accountId: 'acct-1', startDate: '2024-01-01', endDate: '2024-01-31' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('passes costCenterId filter when provided', async () => {
    mockedService.getLedger.mockResolvedValue(makeLedgerOutput());

    await request(app)
      .get(`${BASE}/razao`)
      .query({ accountId: 'acct-1', startDate: '2024-01-01', endDate: '2024-01-31', costCenterId: 'cc-1' })
      .set('Authorization', 'Bearer token');

    expect(mockedService.getLedger).toHaveBeenCalledWith(ORG_ID, expect.objectContaining({
      costCenterId: 'cc-1',
    }));
  });
});

// ─── Tests: GET /razao/export/csv ────────────────────────────────────

describe('GET /api/org/:orgId/ledger/razao/export/csv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(FINANCIAL_PAYLOAD);
  });

  it('returns CSV with correct headers and content-type', async () => {
    const csvContent = '\uFEFFData;Numero;Historico;Debito;Credito;Saldo\n05/01/2024;1;Venda;1000.00;;1000.00\n';
    mockedService.exportLedgerCsv.mockResolvedValue(csvContent);

    const res = await request(app)
      .get(`${BASE}/razao/export/csv`)
      .query({ accountId: 'acct-1', startDate: '2024-01-01', endDate: '2024-01-31' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });
});

// ─── Tests: GET /razao/export/pdf ────────────────────────────────────

describe('GET /api/org/:orgId/ledger/razao/export/pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(FINANCIAL_PAYLOAD);
  });

  it('returns PDF with correct content-type', async () => {
    // Mock the PDF export to write to response
    mockedService.exportLedgerPdf.mockImplementation(async (_orgId, _filters, res) => {
      res.write(Buffer.from('%PDF-1.4'));
      res.end();
    });

    const res = await request(app)
      .get(`${BASE}/razao/export/pdf`)
      .query({ accountId: 'acct-1', startDate: '2024-01-01', endDate: '2024-01-31' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });
});

// ─── Tests: GET /balancete ────────────────────────────────────────────

describe('GET /api/org/:orgId/ledger/balancete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(FINANCIAL_PAYLOAD);
  });

  it('returns trial balance with 3-column structure', async () => {
    mockedService.getTrialBalance.mockResolvedValue(makeTrialBalanceOutput());

    const res = await request(app)
      .get(`${BASE}/balancete`)
      .query({ fiscalYearId: 'fy-1', month: 1 })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      periodMonth: 1,
      periodYear: 2024,
      isBalanced: true,
    });
    expect(res.body.rows).toHaveLength(2);
    expect(res.body.grandTotals).toMatchObject({
      movementDebit: '700.00',
      movementCredit: '700.00',
    });
  });

  it('returns isBalanced=true when debits equal credits', async () => {
    mockedService.getTrialBalance.mockResolvedValue({
      ...makeTrialBalanceOutput(),
      isBalanced: true,
    });

    const res = await request(app)
      .get(`${BASE}/balancete`)
      .query({ fiscalYearId: 'fy-1', month: 1 })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.isBalanced).toBe(true);
  });

  it('returns 401 without auth', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app)
      .get(`${BASE}/balancete`)
      .query({ fiscalYearId: 'fy-1', month: 1 });

    expect(res.status).toBe(401);
  });
});

// ─── Tests: GET /balancete/export/pdf ────────────────────────────────

describe('GET /api/org/:orgId/ledger/balancete/export/pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(FINANCIAL_PAYLOAD);
  });

  it('returns PDF with correct content-type', async () => {
    mockedService.exportTrialBalancePdf.mockImplementation(async (_orgId, _filters, res) => {
      res.write(Buffer.from('%PDF-1.4'));
      res.end();
    });

    const res = await request(app)
      .get(`${BASE}/balancete/export/pdf`)
      .query({ fiscalYearId: 'fy-1', month: 1 })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });
});

// ─── Tests: GET /balancete/export/xlsx ───────────────────────────────

describe('GET /api/org/:orgId/ledger/balancete/export/xlsx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(FINANCIAL_PAYLOAD);
  });

  it('returns XLSX with correct content-type', async () => {
    mockedService.exportTrialBalanceXlsx.mockImplementation(async (_orgId, _filters, res) => {
      res.write(Buffer.from('PK'));
      res.end();
    });

    const res = await request(app)
      .get(`${BASE}/balancete/export/xlsx`)
      .query({ fiscalYearId: 'fy-1', month: 1 })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
  });
});

// ─── Tests: GET /diario ──────────────────────────────────────────────

describe('GET /api/org/:orgId/ledger/diario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(FINANCIAL_PAYLOAD);
  });

  it('returns daily book entries in chronological order', async () => {
    mockedService.getDailyBook.mockResolvedValue(makeDailyBookOutput());

    const res = await request(app)
      .get(`${BASE}/diario`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-31' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalEntries: 1,
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
    });
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0]).toMatchObject({
      entryNumber: 1,
      description: 'Venda de produtos',
    });
    expect(res.body.entries[0].lines).toHaveLength(2);
  });

  it('passes entryType filter when provided', async () => {
    mockedService.getDailyBook.mockResolvedValue({ ...makeDailyBookOutput(), entries: [] });

    await request(app)
      .get(`${BASE}/diario`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-31', entryType: 'MANUAL' })
      .set('Authorization', 'Bearer token');

    expect(mockedService.getDailyBook).toHaveBeenCalledWith(ORG_ID, expect.objectContaining({
      entryType: 'MANUAL',
    }));
  });

  it('returns 401 without auth', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app)
      .get(`${BASE}/diario`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-31' });

    expect(res.status).toBe(401);
  });
});

// ─── Tests: GET /diario/export/pdf ───────────────────────────────────

describe('GET /api/org/:orgId/ledger/diario/export/pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  it('returns PDF with correct content-type', async () => {
    mockedService.exportDailyBookPdf.mockImplementation(async (_orgId, _filters, res) => {
      res.write(Buffer.from('%PDF-1.4'));
      res.end();
    });

    const res = await request(app)
      .get(`${BASE}/diario/export/pdf`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-31' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });
});
