import request from 'supertest';
import { app } from '../../app';
import * as transfersService from './transfers.service';
import * as authService from '../auth/auth.service';
import { TransferError } from './transfers.types';

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

jest.mock('./transfers.service', () => ({
  createTransfer: jest.fn(),
  listTransfers: jest.fn(),
  getTransfer: jest.fn(),
  deleteTransfer: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(transfersService);
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

// ─── Fixtures ────────────────────────────────────────────────────────

const TRANSFER = {
  id: 'transfer-1',
  organizationId: 'org-1',
  fromAccountId: 'account-1',
  toAccountId: 'account-2',
  fromAccountName: 'Conta Corrente BB',
  toAccountName: 'Conta Poupança',
  type: 'INTERNA',
  amount: 1000,
  feeAmount: null,
  description: 'Transferência entre contas',
  transferDate: '2026-03-16T00:00:00.000Z',
  notes: null,
  createdAt: '2026-03-16T00:00:00.000Z',
};

const TRANSFER_WITH_FEE = {
  ...TRANSFER,
  id: 'transfer-2',
  feeAmount: 10,
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── POST /api/org/transfers ─────────────────────────────────────────

describe('POST /api/org/transfers', () => {
  it('creates transfer and returns 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createTransfer.mockResolvedValue(TRANSFER);

    const res = await request(app)
      .post('/api/org/transfers')
      .set('Authorization', 'Bearer token')
      .send({
        fromAccountId: 'account-1',
        toAccountId: 'account-2',
        type: 'INTERNA',
        amount: 1000,
        description: 'Transferência entre contas',
        transferDate: '2026-03-16',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'transfer-1',
      fromAccountId: 'account-1',
      toAccountId: 'account-2',
      type: 'INTERNA',
      amount: 1000,
    });
    expect(mockedService.createTransfer).toHaveBeenCalledTimes(1);
  });

  it('creates transfer with fee and returns 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createTransfer.mockResolvedValue(TRANSFER_WITH_FEE);

    const res = await request(app)
      .post('/api/org/transfers')
      .set('Authorization', 'Bearer token')
      .send({
        fromAccountId: 'account-1',
        toAccountId: 'account-2',
        type: 'TED',
        amount: 1000,
        feeAmount: 10,
        description: 'TED com tarifa',
        transferDate: '2026-03-16',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      feeAmount: 10,
    });
  });

  it('returns 400 when fromAccountId equals toAccountId', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createTransfer.mockRejectedValue(
      new TransferError('Conta de origem e destino devem ser diferentes', 400),
    );

    const res = await request(app)
      .post('/api/org/transfers')
      .set('Authorization', 'Bearer token')
      .send({
        fromAccountId: 'account-1',
        toAccountId: 'account-1',
        type: 'INTERNA',
        amount: 500,
        description: 'Transferência inválida',
        transferDate: '2026-03-16',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'Conta de origem e destino devem ser diferentes',
    });
  });

  it('returns 404 when account not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createTransfer.mockRejectedValue(new TransferError('Conta não encontrada', 404));

    const res = await request(app)
      .post('/api/org/transfers')
      .set('Authorization', 'Bearer token')
      .send({
        fromAccountId: 'nonexistent',
        toAccountId: 'account-2',
        type: 'INTERNA',
        amount: 500,
        description: 'Transferência',
        transferDate: '2026-03-16',
      });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/org/transfers').send({
      fromAccountId: 'account-1',
      toAccountId: 'account-2',
      type: 'INTERNA',
      amount: 500,
      description: 'Transferência',
      transferDate: '2026-03-16',
    });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/org/transfers ──────────────────────────────────────────

describe('GET /api/org/transfers', () => {
  it('returns list of transfers with 200', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listTransfers.mockResolvedValue([TRANSFER]);

    const res = await request(app).get('/api/org/transfers').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([TRANSFER]);
    expect(mockedService.listTransfers).toHaveBeenCalledTimes(1);
  });

  it('passes query params to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listTransfers.mockResolvedValue([TRANSFER]);

    const res = await request(app)
      .get('/api/org/transfers')
      .set('Authorization', 'Bearer token')
      .query({
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        type: 'INTERNA',
        accountId: 'account-1',
      });

    expect(res.status).toBe(200);
    expect(mockedService.listTransfers).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        type: 'INTERNA',
        accountId: 'account-1',
      }),
    );
  });
});

// ─── GET /api/org/transfers/:id ──────────────────────────────────────

describe('GET /api/org/transfers/:id', () => {
  it('returns single transfer with 200', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getTransfer.mockResolvedValue(TRANSFER);

    const res = await request(app)
      .get('/api/org/transfers/transfer-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'transfer-1' });
    expect(mockedService.getTransfer).toHaveBeenCalledWith(expect.any(Object), 'transfer-1');
  });

  it('returns 404 when transfer not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getTransfer.mockRejectedValue(
      new TransferError('Transferência não encontrada', 404),
    );

    const res = await request(app)
      .get('/api/org/transfers/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Transferência não encontrada' });
  });
});

// ─── DELETE /api/org/transfers/:id ───────────────────────────────────

describe('DELETE /api/org/transfers/:id', () => {
  it('deletes transfer and returns 204', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteTransfer.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/org/transfers/transfer-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(mockedService.deleteTransfer).toHaveBeenCalledWith(expect.any(Object), 'transfer-1');
  });

  it('returns 404 when deleting nonexistent transfer', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteTransfer.mockRejectedValue(
      new TransferError('Transferência não encontrada', 404),
    );

    const res = await request(app)
      .delete('/api/org/transfers/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});
