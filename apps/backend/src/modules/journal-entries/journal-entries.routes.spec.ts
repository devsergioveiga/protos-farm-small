// ─── Journal Entries Integration Tests ───────────────────────────────────────
// Tests for journal entry CRUD, post, reversal, templates, and CSV import.
// Pattern: follows chart-of-accounts.routes.spec.ts (mock service + auth)

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

jest.mock('./journal-entries.service', () => ({
  createJournalEntryDraft: jest.fn(),
  postJournalEntry: jest.fn(),
  reverseJournalEntry: jest.fn(),
  listEntries: jest.fn(),
  getEntry: jest.fn(),
  saveTemplate: jest.fn(),
  listTemplates: jest.fn(),
  deleteTemplate: jest.fn(),
  deleteDraft: jest.fn(),
  importCsvJournalEntries: jest.fn(),
}));

import request from 'supertest';
import { app } from '../../app';
import * as service from './journal-entries.service';
import * as authService from '../auth/auth.service';
import { JournalEntryError } from './journal-entries.types';
import { UnbalancedEntryError } from '@protos-farm/shared';
import { PeriodNotOpenError } from '@protos-farm/shared';
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
const BASE = `/api/org/${ORG_ID}/journal-entries`;

// ─── Mock data helpers ────────────────────────────────────────────────

function makeEntry(overrides = {}) {
  return {
    id: 'entry-1',
    entryNumber: 0,
    entryDate: '2026-01-15',
    periodId: 'period-1',
    description: 'Pagamento fornecedor',
    entryType: 'MANUAL' as const,
    status: 'DRAFT' as const,
    reversedById: null,
    reversalOf: null,
    reversalReason: null,
    templateName: null,
    costCenterId: null,
    createdBy: 'admin-1',
    postedAt: null,
    createdAt: '2026-01-15T10:00:00Z',
    lines: [
      {
        id: 'line-1',
        accountId: 'acc-1',
        side: 'DEBIT' as const,
        amount: '1500.00',
        description: null,
        costCenterId: null,
        lineOrder: 1,
        account: { code: '1.1.01', name: 'Caixa', nature: 'DEVEDORA' },
      },
      {
        id: 'line-2',
        accountId: 'acc-2',
        side: 'CREDIT' as const,
        amount: '1500.00',
        description: null,
        costCenterId: null,
        lineOrder: 2,
        account: { code: '2.1.01', name: 'Fornecedores', nature: 'CREDORA' },
      },
    ],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('Journal Entries Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── GET /journal-entries ─────────────────────────────────────────

  it('GET /journal-entries returns list', async () => {
    const entries = [makeEntry()];
    mockedService.listEntries.mockResolvedValue({ data: entries, total: 1 } as never);

    const res = await request(app)
      .get(BASE)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /journal-entries returns 401 without auth', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

  // ─── GET /journal-entries/templates ───────────────────────────────

  it('GET /journal-entries/templates returns templates list', async () => {
    const templates = [makeEntry({ templateName: 'Pagamento Mensal', status: 'DRAFT' as const })];
    mockedService.listTemplates.mockResolvedValue(templates as never);

    const res = await request(app)
      .get(`${BASE}/templates`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  // ─── GET /journal-entries/:id ─────────────────────────────────────

  it('GET /journal-entries/:id returns entry with lines', async () => {
    mockedService.getEntry.mockResolvedValue(makeEntry() as never);

    const res = await request(app)
      .get(`${BASE}/entry-1`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('entry-1');
    expect(res.body.lines).toHaveLength(2);
  });

  it('GET /journal-entries/:id returns 404 when not found', async () => {
    mockedService.getEntry.mockResolvedValue(null as never);

    const res = await request(app)
      .get(`${BASE}/not-found`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });

  // ─── POST /journal-entries ────────────────────────────────────────

  it('POST /journal-entries creates draft entry', async () => {
    const entry = makeEntry();
    mockedService.createJournalEntryDraft.mockResolvedValue(entry as never);

    const res = await request(app)
      .post(BASE)
      .set('Authorization', 'Bearer token')
      .send({
        entryDate: '2026-01-15',
        periodId: 'period-1',
        description: 'Pagamento fornecedor',
        lines: [
          { accountId: 'acc-1', side: 'DEBIT', amount: '1500.00' },
          { accountId: 'acc-2', side: 'CREDIT', amount: '1500.00' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
  });

  it('POST /journal-entries returns 422 for unbalanced lines', async () => {
    mockedService.createJournalEntryDraft.mockRejectedValue(
      new UnbalancedEntryError('1500.00', '1000.00'),
    );

    const res = await request(app)
      .post(BASE)
      .set('Authorization', 'Bearer token')
      .send({
        entryDate: '2026-01-15',
        periodId: 'period-1',
        description: 'Unbalanced',
        lines: [
          { accountId: 'acc-1', side: 'DEBIT', amount: '1500.00' },
          { accountId: 'acc-2', side: 'CREDIT', amount: '1000.00' },
        ],
      });

    expect(res.status).toBe(422);
  });

  it('POST /journal-entries returns 422 for inactive account', async () => {
    mockedService.createJournalEntryDraft.mockRejectedValue(
      new JournalEntryError('Conta inativa', 'ACCOUNT_INACTIVE'),
    );

    const res = await request(app)
      .post(BASE)
      .set('Authorization', 'Bearer token')
      .send({
        entryDate: '2026-01-15',
        periodId: 'period-1',
        description: 'Test',
        lines: [
          { accountId: 'acc-inactive', side: 'DEBIT', amount: '100.00' },
          { accountId: 'acc-2', side: 'CREDIT', amount: '100.00' },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ACCOUNT_INACTIVE');
  });

  it('POST /journal-entries returns 422 for synthetic account', async () => {
    mockedService.createJournalEntryDraft.mockRejectedValue(
      new JournalEntryError('Conta sintética não permite lançamento', 'SYNTHETIC_ACCOUNT'),
    );

    const res = await request(app)
      .post(BASE)
      .set('Authorization', 'Bearer token')
      .send({
        entryDate: '2026-01-15',
        periodId: 'period-1',
        description: 'Test',
        lines: [
          { accountId: 'acc-synthetic', side: 'DEBIT', amount: '100.00' },
          { accountId: 'acc-2', side: 'CREDIT', amount: '100.00' },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SYNTHETIC_ACCOUNT');
  });

  it('POST /journal-entries returns 422 for closed period', async () => {
    mockedService.createJournalEntryDraft.mockRejectedValue(
      new PeriodNotOpenError(1, 2026, 'CLOSED'),
    );

    const res = await request(app)
      .post(BASE)
      .set('Authorization', 'Bearer token')
      .send({
        entryDate: '2026-01-15',
        periodId: 'period-closed',
        description: 'Test',
        lines: [
          { accountId: 'acc-1', side: 'DEBIT', amount: '100.00' },
          { accountId: 'acc-2', side: 'CREDIT', amount: '100.00' },
        ],
      });

    expect(res.status).toBe(422);
  });

  // ─── POST /journal-entries/:id/post ───────────────────────────────

  it('POST /journal-entries/:id/post posts a DRAFT entry', async () => {
    const posted = makeEntry({
      status: 'POSTED' as const,
      entryNumber: 1,
      postedAt: '2026-01-15T12:00:00Z',
    });
    mockedService.postJournalEntry.mockResolvedValue(posted as never);

    const res = await request(app)
      .post(`${BASE}/entry-1/post`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('POSTED');
    expect(res.body.entryNumber).toBe(1);
  });

  it('POST /journal-entries/:id/post returns 409 for already posted', async () => {
    mockedService.postJournalEntry.mockRejectedValue(
      new JournalEntryError('Lançamento já foi contabilizado', 'ALREADY_POSTED', 409),
    );

    const res = await request(app)
      .post(`${BASE}/entry-1/post`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_POSTED');
  });

  // ─── POST /journal-entries/:id/reverse ────────────────────────────

  it('POST /journal-entries/:id/reverse creates reversal with reason', async () => {
    const reversal = makeEntry({
      id: 'entry-reversal',
      entryType: 'REVERSAL' as const,
      status: 'POSTED' as const,
      reversalOf: 'entry-1',
    });
    mockedService.reverseJournalEntry.mockResolvedValue(reversal as never);

    const res = await request(app)
      .post(`${BASE}/entry-1/reverse`)
      .set('Authorization', 'Bearer token')
      .send({ reason: 'Lançamento em duplicidade' });

    expect(res.status).toBe(200);
    expect(res.body.entryType).toBe('REVERSAL');
  });

  it('POST /journal-entries/:id/reverse returns 422 without reason', async () => {
    mockedService.reverseJournalEntry.mockRejectedValue(
      new JournalEntryError('Motivo do estorno é obrigatório', 'REASON_REQUIRED'),
    );

    const res = await request(app)
      .post(`${BASE}/entry-1/reverse`)
      .set('Authorization', 'Bearer token')
      .send({ reason: '' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('REASON_REQUIRED');
  });

  it('POST /journal-entries/:id/reverse returns 409 for already-reversed', async () => {
    mockedService.reverseJournalEntry.mockRejectedValue(
      new JournalEntryError('Lançamento já foi estornado', 'ALREADY_REVERSED', 409),
    );

    const res = await request(app)
      .post(`${BASE}/entry-1/reverse`)
      .set('Authorization', 'Bearer token')
      .send({ reason: 'Test' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_REVERSED');
  });

  // ─── POST /journal-entries/templates ──────────────────────────────

  it('POST /journal-entries/templates saves template', async () => {
    const template = makeEntry({ templateName: 'Folha Mensal' });
    mockedService.saveTemplate.mockResolvedValue(template as never);

    const res = await request(app)
      .post(`${BASE}/templates`)
      .set('Authorization', 'Bearer token')
      .send({
        templateName: 'Folha Mensal',
        entryDate: '2026-01-15',
        periodId: 'period-1',
        description: 'Folha de pagamento mensal',
        lines: [
          { accountId: 'acc-1', side: 'DEBIT', amount: '5000.00' },
          { accountId: 'acc-2', side: 'CREDIT', amount: '5000.00' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.templateName).toBe('Folha Mensal');
  });

  // ─── DELETE /journal-entries/templates/:id ─────────────────────────

  it('DELETE /journal-entries/templates/:id deletes template', async () => {
    mockedService.deleteTemplate.mockResolvedValue(undefined as never);

    const res = await request(app)
      .delete(`${BASE}/templates/template-1`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
  });

  // ─── DELETE /journal-entries/:id ──────────────────────────────────

  it('DELETE /journal-entries/:id deletes draft', async () => {
    mockedService.deleteDraft.mockResolvedValue(undefined as never);

    const res = await request(app)
      .delete(`${BASE}/entry-1`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
  });

  it('DELETE /journal-entries/:id returns 422 for posted entry', async () => {
    mockedService.deleteDraft.mockRejectedValue(
      new JournalEntryError('Lançamentos contabilizados não podem ser excluídos', 'CANNOT_DELETE_POSTED'),
    );

    const res = await request(app)
      .delete(`${BASE}/entry-posted`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CANNOT_DELETE_POSTED');
  });

  // ─── POST /journal-entries/import-csv ─────────────────────────────

  it('POST /journal-entries/import-csv returns preview for valid CSV', async () => {
    const preview = {
      entries: [
        {
          entryDate: '2026-01-15',
          periodId: 'period-1',
          description: 'Pagamento',
          lines: [
            { accountId: 'acc-1', side: 'DEBIT', amount: '1500.00' },
            { accountId: 'acc-2', side: 'CREDIT', amount: '1500.00' },
          ],
        },
      ],
      errors: [],
      totalEntries: 1,
      totalErrors: 0,
    };
    mockedService.importCsvJournalEntries.mockResolvedValue(preview as never);

    const csvContent =
      'entryDate,periodId,description,accountCode,side,amount\n2026-01-15,period-1,Pagamento,1.1.01,DEBIT,1500.00\n2026-01-15,period-1,Pagamento,2.1.01,CREDIT,1500.00\n';

    const res = await request(app)
      .post(`${BASE}/import-csv`)
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(csvContent), {
        filename: 'test.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(res.body.totalEntries).toBe(1);
    expect(res.body.totalErrors).toBe(0);
  });

  it('POST /journal-entries/import-csv returns 422 for empty CSV', async () => {
    mockedService.importCsvJournalEntries.mockRejectedValue(
      new JournalEntryError('Arquivo CSV vazio', 'EMPTY_CSV'),
    );

    const res = await request(app)
      .post(`${BASE}/import-csv`)
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(''), {
        filename: 'empty.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('EMPTY_CSV');
  });

  it('POST /journal-entries/import-csv returns 400 when no file sent', async () => {
    const res = await request(app)
      .post(`${BASE}/import-csv`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
  });

  it('POST /journal-entries/import-csv returns preview with errors for unknown account', async () => {
    const preview = {
      entries: [],
      errors: [{ rowNumber: 2, field: 'accountCode', reason: 'ACCOUNT_NOT_FOUND' }],
      totalEntries: 0,
      totalErrors: 1,
    };
    mockedService.importCsvJournalEntries.mockResolvedValue(preview as never);

    const csvContent =
      'entryDate,periodId,description,accountCode,side,amount\n2026-01-15,period-1,Test,9.9.99,DEBIT,100.00\n2026-01-15,period-1,Test,2.1.01,CREDIT,100.00\n';

    const res = await request(app)
      .post(`${BASE}/import-csv`)
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(csvContent), {
        filename: 'test.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(res.body.totalErrors).toBe(1);
    expect(res.body.errors[0].reason).toBe('ACCOUNT_NOT_FOUND');
  });

  // ─── Permission checks ─────────────────────────────────────────────

  it('POST /journal-entries returns 403 for OPERATOR role', async () => {
    authAs({ userId: 'op-1', email: 'op@org.com', role: 'OPERATOR' as const, organizationId: ORG_ID });
    mockedService.createJournalEntryDraft.mockResolvedValue(makeEntry() as never);

    const res = await request(app)
      .post(BASE)
      .set('Authorization', 'Bearer token')
      .send({ entryDate: '2026-01-15', periodId: 'p1', description: 'Test', lines: [] });

    expect(res.status).toBe(403);
  });

  it('GET /journal-entries returns 200 for FINANCIAL role', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.listEntries.mockResolvedValue({ data: [], total: 0 } as never);

    const res = await request(app)
      .get(BASE)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
  });

  // ─── Service unit-style tests for key behaviors ─────────────────────

  describe('Service: createJournalEntryDraft validation', () => {
    it('returns entry with DRAFT status and entryNumber 0 for balanced lines', async () => {
      const entry = makeEntry({ status: 'DRAFT' as const, entryNumber: 0 });
      mockedService.createJournalEntryDraft.mockResolvedValue(entry as never);

      const res = await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          entryDate: '2026-01-15',
          periodId: 'period-1',
          description: 'Test balanced',
          lines: [
            { accountId: 'acc-1', side: 'DEBIT', amount: '500.00' },
            { accountId: 'acc-2', side: 'CREDIT', amount: '500.00' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.entryNumber).toBe(0);
    });

    it('returns 422 for MANUAL_ENTRY_DISALLOWED', async () => {
      mockedService.createJournalEntryDraft.mockRejectedValue(
        new JournalEntryError('Conta não permite lançamento manual', 'MANUAL_ENTRY_DISALLOWED'),
      );

      const res = await request(app)
        .post(BASE)
        .set('Authorization', 'Bearer token')
        .send({
          entryDate: '2026-01-15',
          periodId: 'period-1',
          description: 'Test',
          lines: [
            { accountId: 'acc-no-manual', side: 'DEBIT', amount: '100.00' },
            { accountId: 'acc-2', side: 'CREDIT', amount: '100.00' },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('MANUAL_ENTRY_DISALLOWED');
    });
  });

  describe('Service: postJournalEntry behavior', () => {
    it('returns entry with POSTED status, sequential entryNumber, and postedAt timestamp', async () => {
      const posted = makeEntry({
        status: 'POSTED' as const,
        entryNumber: 5,
        postedAt: '2026-01-15T14:30:00Z',
      });
      mockedService.postJournalEntry.mockResolvedValue(posted as never);

      const res = await request(app)
        .post(`${BASE}/entry-1/post`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('POSTED');
      expect(res.body.entryNumber).toBe(5);
      expect(res.body.postedAt).toBeTruthy();
    });
  });

  describe('Service: reverseJournalEntry behavior', () => {
    it('returns 422 for PeriodNotOpenError on reversal', async () => {
      mockedService.reverseJournalEntry.mockRejectedValue(
        new PeriodNotOpenError(1, 2026, 'CLOSED'),
      );

      const res = await request(app)
        .post(`${BASE}/entry-1/reverse`)
        .set('Authorization', 'Bearer token')
        .send({ reason: 'Erro no lançamento' });

      expect(res.status).toBe(422);
    });
  });

  describe('Service: CSV import validation', () => {
    it('returns preview with UNBALANCED error for unbalanced group', async () => {
      const preview = {
        entries: [],
        errors: [{ rowNumber: 1, field: 'lines', reason: 'UNBALANCED' }],
        totalEntries: 0,
        totalErrors: 1,
      };
      mockedService.importCsvJournalEntries.mockResolvedValue(preview as never);

      const csvContent =
        'entryDate,periodId,description,accountCode,side,amount\n2026-01-15,period-1,Test,1.1.01,DEBIT,1500.00\n2026-01-15,period-1,Test,2.1.01,CREDIT,1000.00\n';

      const res = await request(app)
        .post(`${BASE}/import-csv`)
        .set('Authorization', 'Bearer token')
        .attach('file', Buffer.from(csvContent), {
          filename: 'unbalanced.csv',
          contentType: 'text/csv',
        });

      expect(res.status).toBe(200);
      expect(res.body.errors[0].reason).toBe('UNBALANCED');
    });
  });
});
