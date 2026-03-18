import request from 'supertest';
import { app } from '../../app';
import * as checksService from './checks.service';
import * as authService from '../auth/auth.service';
import { CheckError } from './checks.types';

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

jest.mock('./checks.service', () => ({
  createCheck: jest.fn(),
  listChecks: jest.fn(),
  getCheck: jest.fn(),
  markACompensar: jest.fn(),
  compensateCheck: jest.fn(),
  returnCheck: jest.fn(),
  resubmitCheck: jest.fn(),
  cancelCheck: jest.fn(),
  getAlertCount: jest.fn(),
  getAccountingBalanceData: jest.fn(),
  validateTransition: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(checksService);
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

const CHECK_EMITIDO = {
  id: 'check-1',
  type: 'EMITIDO',
  status: 'EMITIDO',
  checkNumber: '001234',
  amount: 1500.0,
  bankAccountId: 'account-1',
  bankAccountName: 'Conta Principal',
  issueDate: '2026-03-01T00:00:00.000Z',
  deliveryDate: null,
  expectedCompensationDate: '2026-04-01T00:00:00.000Z',
  compensationDate: null,
  payeeName: 'Fornecedor Agro Ltda',
  description: 'Pagamento sementes',
  notes: null,
  createdAt: '2026-03-01T00:00:00.000Z',
};

const CHECK_RECEBIDO = {
  ...CHECK_EMITIDO,
  id: 'check-2',
  type: 'RECEBIDO',
  payeeName: 'Cliente Rural',
};

const CHECK_A_COMPENSAR = {
  ...CHECK_EMITIDO,
  status: 'A_COMPENSAR',
  deliveryDate: '2026-03-05T00:00:00.000Z',
};

const CHECK_COMPENSADO = {
  ...CHECK_A_COMPENSAR,
  status: 'COMPENSADO',
  compensationDate: '2026-04-01T00:00:00.000Z',
};

const CHECK_DEVOLVIDO = {
  ...CHECK_A_COMPENSAR,
  status: 'DEVOLVIDO',
};

// ─── Tests ───────────────────────────────────────────────────────────

describe('Checks Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE ────────────────────────────────────────────────────────

  describe('POST /api/org/checks', () => {
    it('should create EMITIDO check and return 201', async () => {
      mockedService.createCheck.mockResolvedValue(CHECK_EMITIDO);

      const res = await request(app)
        .post('/api/org/checks')
        .set('Authorization', 'Bearer token')
        .send({
          type: 'EMITIDO',
          checkNumber: '001234',
          amount: 1500,
          bankAccountId: 'account-1',
          issueDate: '2026-03-01',
          expectedCompensationDate: '2026-04-01',
          payeeName: 'Fornecedor Agro Ltda',
          description: 'Pagamento sementes',
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('EMITIDO');
      expect(res.body.status).toBe('EMITIDO');
      expect(mockedService.createCheck).toHaveBeenCalledTimes(1);
    });

    it('should create RECEBIDO check and return 201', async () => {
      mockedService.createCheck.mockResolvedValue(CHECK_RECEBIDO);

      const res = await request(app)
        .post('/api/org/checks')
        .set('Authorization', 'Bearer token')
        .send({
          type: 'RECEBIDO',
          checkNumber: '001235',
          amount: 2000,
          bankAccountId: 'account-1',
          issueDate: '2026-03-01',
          payeeName: 'Cliente Rural',
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('RECEBIDO');
    });

    it('should return 400 for invalid type', async () => {
      const res = await request(app)
        .post('/api/org/checks')
        .set('Authorization', 'Bearer token')
        .send({
          type: 'INVALIDO',
          checkNumber: '001234',
          amount: 1500,
          bankAccountId: 'account-1',
          issueDate: '2026-03-01',
          payeeName: 'Fornecedor',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for amount <= 0', async () => {
      const res = await request(app)
        .post('/api/org/checks')
        .set('Authorization', 'Bearer token')
        .send({
          type: 'EMITIDO',
          checkNumber: '001234',
          amount: 0,
          bankAccountId: 'account-1',
          issueDate: '2026-03-01',
          payeeName: 'Fornecedor',
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── LIST ──────────────────────────────────────────────────────────

  describe('GET /api/org/checks', () => {
    it('should return array of checks', async () => {
      mockedService.listChecks.mockResolvedValue([CHECK_EMITIDO, CHECK_RECEBIDO]);

      const res = await request(app).get('/api/org/checks').set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('should support status filter', async () => {
      mockedService.listChecks.mockResolvedValue([CHECK_A_COMPENSAR]);

      const res = await request(app)
        .get('/api/org/checks?status=A_COMPENSAR')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listChecks).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'A_COMPENSAR' }),
      );
    });

    it('should support type filter', async () => {
      mockedService.listChecks.mockResolvedValue([CHECK_EMITIDO]);

      const res = await request(app)
        .get('/api/org/checks?type=EMITIDO')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listChecks).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: 'EMITIDO' }),
      );
    });
  });

  // ─── GET ONE ───────────────────────────────────────────────────────

  describe('GET /api/org/checks/:id', () => {
    it('should return single check', async () => {
      mockedService.getCheck.mockResolvedValue(CHECK_EMITIDO);

      const res = await request(app)
        .get('/api/org/checks/check-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('check-1');
    });

    it('should return 404 when not found', async () => {
      mockedService.getCheck.mockRejectedValue(new CheckError('Cheque não encontrado', 404));

      const res = await request(app)
        .get('/api/org/checks/non-existent')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  // ─── MARK A COMPENSAR ──────────────────────────────────────────────

  describe('POST /api/org/checks/:id/mark-a-compensar', () => {
    it('should transition EMITIDO -> A_COMPENSAR', async () => {
      mockedService.markACompensar.mockResolvedValue(CHECK_A_COMPENSAR);

      const res = await request(app)
        .post('/api/org/checks/check-1/mark-a-compensar')
        .set('Authorization', 'Bearer token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('A_COMPENSAR');
    });
  });

  // ─── COMPENSATE ────────────────────────────────────────────────────

  describe('POST /api/org/checks/:id/compensate', () => {
    it('should compensate A_COMPENSAR EMITIDO check and return COMPENSADO', async () => {
      mockedService.compensateCheck.mockResolvedValue(CHECK_COMPENSADO);

      const res = await request(app)
        .post('/api/org/checks/check-1/compensate')
        .set('Authorization', 'Bearer token')
        .send({ compensationDate: '2026-04-01' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPENSADO');
    });

    it('should compensate A_COMPENSAR RECEBIDO check and return COMPENSADO', async () => {
      const compensadoRecebido = { ...CHECK_COMPENSADO, type: 'RECEBIDO' };
      mockedService.compensateCheck.mockResolvedValue(compensadoRecebido);

      const res = await request(app)
        .post('/api/org/checks/check-2/compensate')
        .set('Authorization', 'Bearer token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPENSADO');
    });

    it('should return 422 when compensating EMITIDO (not A_COMPENSAR) check', async () => {
      mockedService.compensateCheck.mockRejectedValue(
        new CheckError('Transicao de status invalida: EMITIDO -> COMPENSADO', 422),
      );

      const res = await request(app)
        .post('/api/org/checks/check-1/compensate')
        .set('Authorization', 'Bearer token')
        .send({});

      expect(res.status).toBe(422);
    });
  });

  // ─── RETURN ────────────────────────────────────────────────────────

  describe('POST /api/org/checks/:id/return', () => {
    it('should transition A_COMPENSAR -> DEVOLVIDO', async () => {
      mockedService.returnCheck.mockResolvedValue(CHECK_DEVOLVIDO);

      const res = await request(app)
        .post('/api/org/checks/check-1/return')
        .set('Authorization', 'Bearer token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DEVOLVIDO');
    });
  });

  // ─── RESUBMIT ──────────────────────────────────────────────────────

  describe('POST /api/org/checks/:id/resubmit', () => {
    it('should transition DEVOLVIDO -> A_COMPENSAR (re-presentation)', async () => {
      mockedService.resubmitCheck.mockResolvedValue({
        ...CHECK_A_COMPENSAR,
        expectedCompensationDate: '2026-05-01T00:00:00.000Z',
      });

      const res = await request(app)
        .post('/api/org/checks/check-1/resubmit')
        .set('Authorization', 'Bearer token')
        .send({ expectedCompensationDate: '2026-05-01' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('A_COMPENSAR');
    });
  });

  // ─── CANCEL ────────────────────────────────────────────────────────

  describe('POST /api/org/checks/:id/cancel', () => {
    it('should cancel EMITIDO check and return 200', async () => {
      mockedService.cancelCheck.mockResolvedValue({ ...CHECK_EMITIDO, status: 'CANCELADO' });

      const res = await request(app)
        .post('/api/org/checks/check-1/cancel')
        .set('Authorization', 'Bearer token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELADO');
    });

    it('should cancel A_COMPENSAR check and return 200', async () => {
      mockedService.cancelCheck.mockResolvedValue({ ...CHECK_A_COMPENSAR, status: 'CANCELADO' });

      const res = await request(app)
        .post('/api/org/checks/check-1/cancel')
        .set('Authorization', 'Bearer token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELADO');
    });

    it('should return 422 when canceling COMPENSADO check', async () => {
      mockedService.cancelCheck.mockRejectedValue(
        new CheckError('Transicao de status invalida: COMPENSADO -> CANCELADO', 422),
      );

      const res = await request(app)
        .post('/api/org/checks/check-1/cancel')
        .set('Authorization', 'Bearer token')
        .send({});

      expect(res.status).toBe(422);
    });
  });

  // ─── FULL STATE MACHINE PATHS ──────────────────────────────────────

  describe('State machine: full happy path', () => {
    it('EMITIDO -> A_COMPENSAR -> COMPENSADO', async () => {
      mockedService.markACompensar.mockResolvedValue(CHECK_A_COMPENSAR);
      mockedService.compensateCheck.mockResolvedValue(CHECK_COMPENSADO);

      const markRes = await request(app)
        .post('/api/org/checks/check-1/mark-a-compensar')
        .set('Authorization', 'Bearer token')
        .send({});
      expect(markRes.status).toBe(200);
      expect(markRes.body.status).toBe('A_COMPENSAR');

      const compensateRes = await request(app)
        .post('/api/org/checks/check-1/compensate')
        .set('Authorization', 'Bearer token')
        .send({});
      expect(compensateRes.status).toBe(200);
      expect(compensateRes.body.status).toBe('COMPENSADO');
    });

    it('EMITIDO -> A_COMPENSAR -> DEVOLVIDO -> A_COMPENSAR -> COMPENSADO (re-present)', async () => {
      mockedService.markACompensar.mockResolvedValue(CHECK_A_COMPENSAR);
      mockedService.returnCheck.mockResolvedValue(CHECK_DEVOLVIDO);
      mockedService.resubmitCheck.mockResolvedValue(CHECK_A_COMPENSAR);
      mockedService.compensateCheck.mockResolvedValue(CHECK_COMPENSADO);

      const markRes = await request(app)
        .post('/api/org/checks/check-1/mark-a-compensar')
        .set('Authorization', 'Bearer token')
        .send({});
      expect(markRes.body.status).toBe('A_COMPENSAR');

      const returnRes = await request(app)
        .post('/api/org/checks/check-1/return')
        .set('Authorization', 'Bearer token')
        .send({});
      expect(returnRes.body.status).toBe('DEVOLVIDO');

      const resubmitRes = await request(app)
        .post('/api/org/checks/check-1/resubmit')
        .set('Authorization', 'Bearer token')
        .send({ expectedCompensationDate: '2026-05-01' });
      expect(resubmitRes.body.status).toBe('A_COMPENSAR');

      const compensateRes = await request(app)
        .post('/api/org/checks/check-1/compensate')
        .set('Authorization', 'Bearer token')
        .send({});
      expect(compensateRes.body.status).toBe('COMPENSADO');
    });
  });

  // ─── COMPENSATION BALANCE IMPACT ──────────────────────────────────

  describe('Compensation balance impact (service-level)', () => {
    it('compensateCheck for EMITIDO creates DEBIT transaction (via service mock)', async () => {
      // The route delegates to service; we verify the service is called correctly
      mockedService.compensateCheck.mockResolvedValue(CHECK_COMPENSADO);

      await request(app)
        .post('/api/org/checks/check-1/compensate')
        .set('Authorization', 'Bearer token')
        .send({ compensationDate: '2026-04-01' });

      expect(mockedService.compensateCheck).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'check-1',
        '2026-04-01',
      );
    });

    it('compensateCheck for RECEBIDO creates CREDIT transaction (via service mock)', async () => {
      const compensadoRecebido = { ...CHECK_COMPENSADO, type: 'RECEBIDO' };
      mockedService.compensateCheck.mockResolvedValue(compensadoRecebido);

      await request(app)
        .post('/api/org/checks/check-2/compensate')
        .set('Authorization', 'Bearer token')
        .send({});

      expect(mockedService.compensateCheck).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'check-2',
        undefined,
      );
    });
  });

  // ─── ALERT COUNT ───────────────────────────────────────────────────

  describe('GET /api/org/checks/alert-count', () => {
    it('should return count of A_COMPENSAR + DEVOLVIDO checks', async () => {
      mockedService.getAlertCount.mockResolvedValue({ count: 5 });

      const res = await request(app)
        .get('/api/org/checks/alert-count')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(5);
    });

    it('should return 0 when no pending checks', async () => {
      mockedService.getAlertCount.mockResolvedValue({ count: 0 });

      const res = await request(app)
        .get('/api/org/checks/alert-count')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  // ─── ACCOUNTING BALANCE ────────────────────────────────────────────

  describe('GET /api/org/checks/accounting-balance', () => {
    it('should return pendingEmitidos and pendingRecebidos sums', async () => {
      mockedService.getAccountingBalanceData.mockResolvedValue({
        pendingEmitidos: 5000,
        pendingRecebidos: 3000,
      });

      const res = await request(app)
        .get('/api/org/checks/accounting-balance')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.pendingEmitidos).toBe(5000);
      expect(res.body.pendingRecebidos).toBe(3000);
    });
  });
});
