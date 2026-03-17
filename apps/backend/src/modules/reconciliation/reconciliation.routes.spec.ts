import request from 'supertest';
import { app } from '../../app';
import * as reconciliationService from './reconciliation.service';
import * as authService from '../auth/auth.service';
import { ReconciliationError } from './reconciliation.types';

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

jest.mock('./reconciliation.service', () => ({
  previewFile: jest.fn(),
  confirmImport: jest.fn(),
  listImports: jest.fn(),
  getImportDetail: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(reconciliationService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'user-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Fixtures ────────────────────────────────────────────────────────

const SAMPLE_OFX_1X = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001</TRNUID>
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>001</BANKID>
<ACCTID>12345-6</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260301120000</DTSTART>
<DTEND>20260315120000</DTEND>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260301120000</DTPOSTED>
<TRNAMT>1000.00</TRNAMT>
<FITID>FIT001</FITID>
<MEMO>VENDA GADO</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260305120000</DTPOSTED>
<TRNAMT>-500.00</TRNAMT>
<FITID>FIT002</FITID>
<MEMO>COMPRA INSUMOS</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260310120000</DTPOSTED>
<TRNAMT>750.50</TRNAMT>
<FITID>FIT003</FITID>
<MEMO>PAGAMENTO LEITE</MEMO>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const SAMPLE_CSV = `Data;Valor;Descricao;Tipo
01/03/2026;1.000,00;VENDA GADO;CREDITO
05/03/2026;-500,00;COMPRA INSUMOS;DEBITO
10/03/2026;750,50;PAGAMENTO LEITE;CREDITO`;

const IMPORT_OUTPUT = {
  id: 'import-1',
  bankAccountId: 'account-1',
  bankAccountName: 'Conta Corrente BB',
  fileName: 'extrato.ofx',
  fileType: 'OFX',
  importedBy: 'user-1',
  importedByName: 'Admin User',
  totalLines: 3,
  importedLines: 3,
  skippedLines: 0,
  pendingLines: 3,
  reconciledLines: 0,
  createdAt: '2026-03-15T10:00:00.000Z',
};

const PREVIEW_RESPONSE = {
  fileType: 'OFX' as const,
  bankAccountId: 'account-1',
  bankAccountName: 'Conta Corrente BB',
  lines: [
    {
      trnType: 'CREDIT' as const,
      amount: 1000,
      date: new Date('2026-03-01'),
      memo: 'VENDA GADO',
      fitId: 'FIT001',
    },
    {
      trnType: 'DEBIT' as const,
      amount: 500,
      date: new Date('2026-03-05'),
      memo: 'COMPRA INSUMOS',
      fitId: 'FIT002',
    },
    {
      trnType: 'CREDIT' as const,
      amount: 750.5,
      date: new Date('2026-03-10'),
      memo: 'PAGAMENTO LEITE',
      fitId: 'FIT003',
    },
  ],
  totalLines: 3,
};

const CSV_PREVIEW_RESPONSE = {
  fileType: 'CSV' as const,
  detectedColumns: {
    headers: ['Data', 'Valor', 'Descricao', 'Tipo'],
    suggestedMapping: { date: 0, amount: 1, description: 2, type: 3 },
    previewRows: [
      ['01/03/2026', '1.000,00', 'VENDA GADO', 'CREDITO'],
      ['05/03/2026', '-500,00', 'COMPRA INSUMOS', 'DEBITO'],
    ],
  },
  lines: [
    { trnType: 'CREDIT' as const, amount: 1000, date: new Date('2026-03-01'), memo: 'VENDA GADO' },
    {
      trnType: 'DEBIT' as const,
      amount: 500,
      date: new Date('2026-03-05'),
      memo: 'COMPRA INSUMOS',
    },
    {
      trnType: 'CREDIT' as const,
      amount: 750.5,
      date: new Date('2026-03-10'),
      memo: 'PAGAMENTO LEITE',
    },
  ],
  totalLines: 3,
};

const IMPORT_RESULT = {
  importId: 'import-1',
  totalLines: 3,
  importedLines: 3,
  skippedLines: 0,
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('POST /api/org/reconciliation/preview', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/org/reconciliation/preview')
      .attach('file', Buffer.from(SAMPLE_OFX_1X), 'extrato.ofx');
    expect(res.status).toBe(401);
  });

  it('returns 200 with OFX file and parsed lines', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.previewFile.mockResolvedValueOnce(PREVIEW_RESPONSE);

    const res = await request(app)
      .post('/api/org/reconciliation/preview')
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(SAMPLE_OFX_1X), 'extrato.ofx');

    expect(res.status).toBe(200);
    expect(res.body.fileType).toBe('OFX');
    expect(res.body.totalLines).toBe(3);
    expect(res.body.lines).toHaveLength(3);
  });

  it('returns 200 with CSV file and detected columns', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.previewFile.mockResolvedValueOnce(CSV_PREVIEW_RESPONSE);

    const res = await request(app)
      .post('/api/org/reconciliation/preview')
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(SAMPLE_CSV), 'extrato.csv');

    expect(res.status).toBe(200);
    expect(res.body.fileType).toBe('CSV');
    expect(res.body.detectedColumns).toBeDefined();
    expect(res.body.detectedColumns.headers).toEqual(['Data', 'Valor', 'Descricao', 'Tipo']);
  });

  it('returns 403 when user lacks reconciliation:manage permission', async () => {
    authAs({
      userId: 'op-1',
      email: 'op@org.com',
      role: 'OPERATOR' as const,
      organizationId: 'org-1',
    });

    const res = await request(app)
      .post('/api/org/reconciliation/preview')
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(SAMPLE_OFX_1X), 'extrato.ofx');

    expect(res.status).toBe(403);
  });

  it('returns 400 when no file is attached', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/reconciliation/preview')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
  });

  it('returns 400 on ReconciliationError from service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.previewFile.mockRejectedValueOnce(
      new ReconciliationError('Arquivo muito grande', 400),
    );

    const res = await request(app)
      .post('/api/org/reconciliation/preview')
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(SAMPLE_OFX_1X), 'extrato.ofx');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Arquivo muito grande');
  });
});

describe('POST /api/org/reconciliation/imports', () => {
  it('returns 201 on successful import with OFX file', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.confirmImport.mockResolvedValueOnce(IMPORT_RESULT);

    const res = await request(app)
      .post('/api/org/reconciliation/imports')
      .set('Authorization', 'Bearer token')
      .field('bankAccountId', 'account-1')
      .attach('file', Buffer.from(SAMPLE_OFX_1X), 'extrato.ofx');

    expect(res.status).toBe(201);
    expect(res.body.importId).toBe('import-1');
    expect(res.body.importedLines).toBe(3);
    expect(res.body.skippedLines).toBe(0);
  });

  it('returns 201 with skippedLines > 0 on duplicate detection', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.confirmImport.mockResolvedValueOnce({
      importId: 'import-2',
      totalLines: 3,
      importedLines: 1,
      skippedLines: 2,
    });

    const res = await request(app)
      .post('/api/org/reconciliation/imports')
      .set('Authorization', 'Bearer token')
      .field('bankAccountId', 'account-1')
      .attach('file', Buffer.from(SAMPLE_OFX_1X), 'extrato.ofx');

    expect(res.status).toBe(201);
    expect(res.body.skippedLines).toBe(2);
    expect(res.body.importedLines).toBe(1);
  });

  it('returns 400 when bankAccountId is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/reconciliation/imports')
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(SAMPLE_OFX_1X), 'extrato.ofx');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/org/reconciliation/imports', () => {
  it('returns 200 with list of imports', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listImports.mockResolvedValueOnce({
      data: [IMPORT_OUTPUT],
      total: 1,
    });

    const res = await request(app)
      .get('/api/org/reconciliation/imports')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe('import-1');
  });

  it('returns 200 with empty list when no imports exist', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listImports.mockResolvedValueOnce({ data: [], total: 0 });

    const res = await request(app)
      .get('/api/org/reconciliation/imports')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('passes bankAccountId query param to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listImports.mockResolvedValueOnce({ data: [], total: 0 });

    await request(app)
      .get('/api/org/reconciliation/imports?bankAccountId=account-1')
      .set('Authorization', 'Bearer token');

    expect(mockedService.listImports).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bankAccountId: 'account-1' }),
    );
  });
});

describe('GET /api/org/reconciliation/imports/:id', () => {
  it('returns 200 with import detail', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getImportDetail.mockResolvedValueOnce(IMPORT_OUTPUT);

    const res = await request(app)
      .get('/api/org/reconciliation/imports/import-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('import-1');
    expect(res.body.fileName).toBe('extrato.ofx');
    expect(res.body.totalLines).toBe(3);
  });

  it('returns 404 when import not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getImportDetail.mockRejectedValueOnce(
      new ReconciliationError('Import não encontrado', 404),
    );

    const res = await request(app)
      .get('/api/org/reconciliation/imports/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Import não encontrado');
  });
});
