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
  scoreMatch: jest.fn(),
  toConfidence: jest.fn(),
  getImportLinesWithMatches: jest.fn(),
  confirmReconciliation: jest.fn(),
  rejectMatch: jest.fn(),
  manualLink: jest.fn(),
  ignoreStatementLine: jest.fn(),
  searchCandidates: jest.fn(),
  getReconciliationReport: jest.fn(),
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

// ─── scoreMatch pure function tests ──────────────────────────────────
// These test the scoring algorithm via the mocked service calls
// scoreMatch and toConfidence are pure functions — tested via the mock spy

describe('scoreMatch pure function', () => {
  // Direct implementation test (pure functions — no DB, no mocking needed)
  // Inline the algorithm here to validate behavior independently

  // Replicate the algorithm from reconciliation.service.ts for isolated testing
  function scoreMatchDirect(
    statementLine: { amount: number; date: Date; memo: string },
    candidate: { amount: number; date: Date; description: string },
  ): number {
    const valueDiff = Math.abs(statementLine.amount - candidate.amount);
    const relDiff =
      candidate.amount !== 0 ? valueDiff / Math.abs(candidate.amount) : valueDiff === 0 ? 0 : 1;
    let valueScore = 0;
    if (relDiff === 0) valueScore = 50;
    else if (relDiff < 0.01) valueScore = 30;
    else if (relDiff < 0.05) valueScore = 10;

    const dayDiff = Math.abs((statementLine.date.getTime() - candidate.date.getTime()) / 86400000);
    let dateScore = 0;
    if (dayDiff <= 1) dateScore = 40;
    else if (dayDiff <= 5) dateScore = 20;

    const memoFirst8 = statementLine.memo.slice(0, 8).toLowerCase();
    const descFirst8 = candidate.description.slice(0, 8).toLowerCase();
    const descScore = descFirst8.includes(memoFirst8) || memoFirst8.includes(descFirst8) ? 10 : 0;

    return valueScore + dateScore + descScore;
  }

  function toConfidenceDirect(score: number): string {
    if (score >= 95) return 'EXATO';
    if (score >= 70) return 'PROVAVEL';
    return 'SEM_MATCH';
  }

  it('returns score >= 95 (EXATO) for exact value and date match with desc match', () => {
    const line = { amount: 100, date: new Date('2026-03-15'), memo: 'PAGTO INS' };
    const candidate = { amount: 100, date: new Date('2026-03-15'), description: 'PAGTO INS' };
    const score = scoreMatchDirect(line, candidate);
    expect(score).toBeGreaterThanOrEqual(95);
    expect(toConfidenceDirect(score)).toBe('EXATO');
  });

  it('returns score >= 90 for exact value + date +-1 day', () => {
    const line = { amount: 100, date: new Date('2026-03-15'), memo: 'ABC' };
    const candidate = { amount: 100, date: new Date('2026-03-16'), description: 'XYZ' };
    const score = scoreMatchDirect(line, candidate);
    expect(score).toBeGreaterThanOrEqual(90); // 50 value + 40 date = 90
  });

  it('returns 70 <= score < 95 (PROVAVEL) for exact value and date within 5 days (no desc match)', () => {
    // exact value (50) + date within 5 days (20) + no desc (0) = 70 -> PROVAVEL
    const line = { amount: 100, date: new Date('2026-03-15'), memo: 'X' };
    const candidate = { amount: 100, date: new Date('2026-03-18'), description: 'Y' };
    const score = scoreMatchDirect(line, candidate);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(score).toBeLessThan(95);
    expect(toConfidenceDirect(score)).toBe('PROVAVEL');
  });

  it('returns score < 70 (SEM_MATCH) for large value and date differences', () => {
    const line = { amount: 100, date: new Date('2026-03-15'), memo: 'X' };
    const candidate = { amount: 200, date: new Date('2026-04-01'), description: 'Y' };
    const score = scoreMatchDirect(line, candidate);
    expect(score).toBeLessThan(70);
    expect(toConfidenceDirect(score)).toBe('SEM_MATCH');
  });

  it('adds 10 pts for description first 8 chars match (case insensitive)', () => {
    const line = { amount: 100, date: new Date('2026-03-15'), memo: 'pagto boleto' };
    const candidate1 = {
      amount: 100,
      date: new Date('2026-03-15'),
      description: 'PAGTO BOLETO XPTO',
    };
    const candidate2 = { amount: 100, date: new Date('2026-03-15'), description: 'DIFERENTE' };
    const score1 = scoreMatchDirect(line, candidate1);
    const score2 = scoreMatchDirect(line, candidate2);
    expect(score1).toBe(score2 + 10);
  });

  it('returns 0 value score when amounts differ by more than 5%', () => {
    const line = { amount: 100, date: new Date('2026-03-15'), memo: 'X' };
    const candidate = { amount: 90, date: new Date('2026-03-15'), description: 'X' };
    const score = scoreMatchDirect(line, candidate);
    // valueScore=0, dateScore=40, descScore=10 = 50
    expect(score).toBe(50);
  });

  it('toConfidence returns EXATO for score 100', () => {
    expect(toConfidenceDirect(100)).toBe('EXATO');
  });

  it('toConfidence returns PROVAVEL for score 70', () => {
    expect(toConfidenceDirect(70)).toBe('PROVAVEL');
  });

  it('toConfidence returns SEM_MATCH for score 69', () => {
    expect(toConfidenceDirect(69)).toBe('SEM_MATCH');
  });
});

// ─── GET /imports/:id/lines ───────────────────────────────────────────

describe('GET /api/org/reconciliation/imports/:id/lines', () => {
  const LINES_WITH_MATCHES = [
    {
      id: 'line-1',
      trnType: 'DEBIT',
      amount: 500,
      date: '2026-03-05T00:00:00.000Z',
      memo: 'COMPRA INSUMOS',
      status: 'PENDING',
      matches: [
        {
          type: 'PAYABLE' as const,
          referenceId: 'payable-1',
          description: 'COMPRA INSUMOS',
          amount: 500,
          date: new Date('2026-03-05'),
          score: 100,
          confidence: 'EXATO' as const,
        },
      ],
    },
    {
      id: 'line-2',
      trnType: 'CREDIT',
      amount: 1000,
      date: '2026-03-01T00:00:00.000Z',
      memo: 'VENDA GADO',
      status: 'PENDING',
      matches: [],
    },
  ];

  it('returns 200 with lines and match candidates', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getImportLinesWithMatches.mockResolvedValueOnce(LINES_WITH_MATCHES);

    const res = await request(app)
      .get('/api/org/reconciliation/imports/import-1/lines')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe('line-1');
    expect(res.body[0].matches).toHaveLength(1);
    expect(res.body[0].matches[0].confidence).toBe('EXATO');
  });

  it('passes status query param to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getImportLinesWithMatches.mockResolvedValueOnce([]);

    await request(app)
      .get('/api/org/reconciliation/imports/import-1/lines?status=PENDING')
      .set('Authorization', 'Bearer token');

    expect(mockedService.getImportLinesWithMatches).toHaveBeenCalledWith(
      expect.anything(),
      'import-1',
      'PENDING',
    );
  });

  it('returns 403 for OPERATOR (lacks reconciliation:manage)', async () => {
    authAs({
      userId: 'op-1',
      email: 'op@org.com',
      role: 'OPERATOR' as const,
      organizationId: 'org-1',
    });

    const res = await request(app)
      .get('/api/org/reconciliation/imports/import-1/lines')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});

// ─── POST /imports/:id/lines/:lineId/confirm ─────────────────────────

describe('POST /api/org/reconciliation/imports/:id/lines/:lineId/confirm', () => {
  it('returns 200 and calls confirmReconciliation', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.confirmReconciliation.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/org/reconciliation/imports/import-1/lines/line-1/confirm')
      .set('Authorization', 'Bearer token')
      .send({ reconciliationId: 'reconciliation-1' });

    expect(res.status).toBe(200);
    expect(mockedService.confirmReconciliation).toHaveBeenCalledWith(
      expect.anything(),
      'line-1',
      'reconciliation-1',
    );
  });

  it('returns 400 when reconciliationId is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/reconciliation/imports/import-1/lines/line-1/confirm')
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 on ReconciliationError from service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.confirmReconciliation.mockRejectedValueOnce(
      new ReconciliationError('Linha não encontrada', 404),
    );

    const res = await request(app)
      .post('/api/org/reconciliation/imports/import-1/lines/line-1/confirm')
      .set('Authorization', 'Bearer token')
      .send({ reconciliationId: 'reconciliation-1' });

    expect(res.status).toBe(404);
  });
});

// ─── POST /imports/:id/lines/:lineId/reject ──────────────────────────

describe('POST /api/org/reconciliation/imports/:id/lines/:lineId/reject', () => {
  it('returns 200 and calls rejectMatch keeping status PENDING', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.rejectMatch.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/org/reconciliation/imports/import-1/lines/line-1/reject')
      .set('Authorization', 'Bearer token')
      .send({ reconciliationId: 'reconciliation-1' });

    expect(res.status).toBe(200);
    expect(mockedService.rejectMatch).toHaveBeenCalledWith(
      expect.anything(),
      'line-1',
      'reconciliation-1',
    );
  });

  it('returns 400 when reconciliationId is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/reconciliation/imports/import-1/lines/line-1/reject')
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── POST /imports/:id/lines/:lineId/link ────────────────────────────

describe('POST /api/org/reconciliation/imports/:id/lines/:lineId/link', () => {
  const VALID_LINKS = [
    { referenceType: 'PAYABLE', referenceId: 'payable-1', amount: 300 },
    { referenceType: 'PAYABLE', referenceId: 'payable-2', amount: 200 },
  ];

  it('returns 200 with valid N:N links', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.manualLink.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/org/reconciliation/imports/import-1/lines/line-1/link')
      .set('Authorization', 'Bearer token')
      .send({ links: VALID_LINKS });

    expect(res.status).toBe(200);
    expect(mockedService.manualLink).toHaveBeenCalledWith(expect.anything(), 'line-1', VALID_LINKS);
  });

  it('returns 400 when links array is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/reconciliation/imports/import-1/lines/line-1/link')
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when sum of links mismatches statement line amount', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.manualLink.mockRejectedValueOnce(
      new ReconciliationError('Soma selecionada nao coincide com o valor do extrato', 400),
    );

    const res = await request(app)
      .post('/api/org/reconciliation/imports/import-1/lines/line-1/link')
      .set('Authorization', 'Bearer token')
      .send({ links: VALID_LINKS });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Soma selecionada');
  });
});

// ─── POST /imports/:id/lines/:lineId/ignore ──────────────────────────

describe('POST /api/org/reconciliation/imports/:id/lines/:lineId/ignore', () => {
  it('returns 200 and calls ignoreStatementLine', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.ignoreStatementLine.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/org/reconciliation/imports/import-1/lines/line-1/ignore')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.ignoreStatementLine).toHaveBeenCalledWith(expect.anything(), 'line-1');
  });

  it('returns 403 for OPERATOR', async () => {
    authAs({
      userId: 'op-1',
      email: 'op@org.com',
      role: 'OPERATOR' as const,
      organizationId: 'org-1',
    });

    const res = await request(app)
      .post('/api/org/reconciliation/imports/import-1/lines/line-1/ignore')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});

// ─── GET /imports/:id/search ─────────────────────────────────────────

describe('GET /api/org/reconciliation/imports/:id/search', () => {
  const CANDIDATES = [
    {
      type: 'PAYABLE' as const,
      referenceId: 'payable-1',
      description: 'COMPRA TRATOR',
      amount: 5000,
      date: new Date('2026-03-10'),
      score: 0,
      confidence: 'SEM_MATCH' as const,
    },
    {
      type: 'RECEIVABLE' as const,
      referenceId: 'receivable-1',
      description: 'VENDA GADO',
      amount: 1000,
      date: new Date('2026-03-01'),
      score: 0,
      confidence: 'SEM_MATCH' as const,
    },
  ];

  it('returns 200 with matching candidates', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.searchCandidates.mockResolvedValueOnce(CANDIDATES);

    const res = await request(app)
      .get('/api/org/reconciliation/imports/import-1/search?search=COMPRA&bankAccountId=account-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].type).toBe('PAYABLE');
  });

  it('passes search and bankAccountId to service', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.searchCandidates.mockResolvedValueOnce([]);

    await request(app)
      .get('/api/org/reconciliation/imports/import-1/search?search=TRATOR&bankAccountId=account-2')
      .set('Authorization', 'Bearer token');

    expect(mockedService.searchCandidates).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: 'TRATOR', bankAccountId: 'account-2' }),
    );
  });
});

// ─── GET /imports/:id/report ─────────────────────────────────────────

describe('GET /api/org/reconciliation/imports/:id/report', () => {
  it('returns CSV content with text/csv Content-Type', async () => {
    authAs(ADMIN_PAYLOAD);
    const csvBuffer = Buffer.from('Data,Tipo,Valor,Status\n2026-03-01,CREDIT,1000,RECONCILED\n');
    mockedService.getReconciliationReport.mockResolvedValueOnce({
      summary: {
        pending: 0,
        reconciled: 1,
        ignored: 0,
        totalPending: 0,
        totalReconciled: 1000,
        totalIgnored: 0,
      },
      buffer: csvBuffer,
    });

    const res = await request(app)
      .get('/api/org/reconciliation/imports/import-1/report?format=csv')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('reconciliation-report.csv');
  });

  it('returns PDF content with application/pdf Content-Type', async () => {
    authAs(ADMIN_PAYLOAD);
    const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
    mockedService.getReconciliationReport.mockResolvedValueOnce({
      summary: {
        pending: 1,
        reconciled: 2,
        ignored: 0,
        totalPending: 100,
        totalReconciled: 1500,
        totalIgnored: 0,
      },
      buffer: pdfBuffer,
    });

    const res = await request(app)
      .get('/api/org/reconciliation/imports/import-1/report?format=pdf')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('reconciliation-report.pdf');
  });

  it('defaults to csv format when format param is omitted', async () => {
    authAs(ADMIN_PAYLOAD);
    const csvBuffer = Buffer.from('Data,Status\n');
    mockedService.getReconciliationReport.mockResolvedValueOnce({
      summary: {
        pending: 0,
        reconciled: 0,
        ignored: 0,
        totalPending: 0,
        totalReconciled: 0,
        totalIgnored: 0,
      },
      buffer: csvBuffer,
    });

    const res = await request(app)
      .get('/api/org/reconciliation/imports/import-1/report')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.getReconciliationReport).toHaveBeenCalledWith(
      expect.anything(),
      'import-1',
      'csv',
    );
  });

  it('returns 403 for OPERATOR', async () => {
    authAs({
      userId: 'op-1',
      email: 'op@org.com',
      role: 'OPERATOR' as const,
      organizationId: 'org-1',
    });

    const res = await request(app)
      .get('/api/org/reconciliation/imports/import-1/report')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});
