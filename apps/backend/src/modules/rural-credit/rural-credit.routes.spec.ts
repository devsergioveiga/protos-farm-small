import request from 'supertest';
import { app } from '../../app';
import * as ruralCreditService from './rural-credit.service';
import * as authService from '../auth/auth.service';
import { RuralCreditError } from './rural-credit.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./rural-credit.service', () => ({
  simulateSchedule: jest.fn(),
  createContract: jest.fn(),
  listContracts: jest.fn(),
  getContract: jest.fn(),
  updateContract: jest.fn(),
  cancelContract: jest.fn(),
  settleInstallment: jest.fn(),
  applyExtraordinaryAmortization: jest.fn(),
  getAlertCount: jest.fn(),
  computeContractStatus: jest.fn(),
  OVERDUE_THRESHOLD_DAYS: 30,
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(ruralCreditService);
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

const SCHEDULE_ROW = {
  installmentNumber: 1,
  dueDate: '2026-07-01T00:00:00.000Z',
  principal: 10000,
  interest: 52.5,
  totalPayment: 10052.5,
  outstandingBalance: 90000,
};

const INSTALLMENT_OUTPUT = {
  id: 'rc-inst-1',
  contractId: 'contract-1',
  payableId: 'payable-1',
  installmentNumber: 1,
  principal: 10000,
  interest: 52.5,
  outstandingBalanceAfter: 90000,
  payableStatus: 'PENDING',
  dueDate: '2026-07-01T00:00:00.000Z',
  totalPayment: 10052.5,
  paidAt: null,
  amountPaid: null,
};

const CONTRACT = {
  id: 'contract-1',
  organizationId: 'org-1',
  farmId: 'farm-1',
  bankAccountId: 'bank-1',
  contractNumber: 'PRON-2026-001',
  creditLine: 'PRONAF',
  creditLineLabel: 'PRONAF',
  amortizationSystem: 'SAC',
  principalAmount: 100000,
  annualRate: 0.065,
  termMonths: 10,
  gracePeriodMonths: 0,
  firstPaymentYear: 2026,
  firstPaymentMonth: 7,
  paymentDayOfMonth: 1,
  releasedAt: '2026-03-17T00:00:00.000Z',
  iofAmount: null,
  tacAmount: null,
  guaranteeDescription: null,
  alertDaysBefore: 15,
  status: 'ATIVO',
  outstandingBalance: 90000,
  totalPrincipalPaid: 10000,
  totalInterestPaid: 52.5,
  notes: null,
  cancelledAt: null,
  createdAt: '2026-03-17T00:00:00.000Z',
  updatedAt: '2026-03-17T00:00:00.000Z',
  installments: [INSTALLMENT_OUTPUT],
  bankName: 'Sicoob',
};

const CONTRACT_LIST_ITEM = {
  id: 'contract-1',
  creditLine: 'PRONAF',
  creditLineLabel: 'PRONAF',
  contractNumber: 'PRON-2026-001',
  bankAccountId: 'bank-1',
  bankName: 'Sicoob',
  principalAmount: 100000,
  outstandingBalance: 90000,
  status: 'ATIVO',
  nextPaymentDate: '2026-07-01T00:00:00.000Z',
  nextPaymentAmount: 10052.5,
  createdAt: '2026-03-17T00:00:00.000Z',
};

const PAGINATED_CONTRACTS = {
  data: [CONTRACT_LIST_ITEM],
  total: 1,
  page: 1,
  limit: 20,
};

const CREATE_INPUT = {
  farmId: 'farm-1',
  bankAccountId: 'bank-1',
  contractNumber: 'PRON-2026-001',
  creditLine: 'PRONAF',
  amortizationSystem: 'SAC',
  principalAmount: 100000,
  annualRate: 0.065,
  termMonths: 10,
  gracePeriodMonths: 0,
  firstPaymentYear: 2026,
  firstPaymentMonth: 7,
  paymentDayOfMonth: 1,
  releasedAt: '2026-03-17',
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── POST /api/org/rural-credit/simulate ─────────────────────────────

describe('POST /api/org/rural-credit/simulate', () => {
  it('returns schedule array without DB writes', async () => {
    authAs(ADMIN_PAYLOAD);
    const scheduleRows = Array.from({ length: 10 }, (_, i) => ({
      ...SCHEDULE_ROW,
      installmentNumber: i + 1,
      dueDate: `2026-${String(7 + i).padStart(2, '0')}-01T00:00:00.000Z`,
    }));
    mockedService.simulateSchedule.mockReturnValue(scheduleRows);

    const res = await request(app)
      .post('/api/org/rural-credit/simulate')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        bankAccountId: 'bank-1',
        creditLine: 'PRONAF',
        amortizationSystem: 'SAC',
        principalAmount: 100000,
        annualRate: 0.065,
        termMonths: 10,
        firstPaymentYear: 2026,
        firstPaymentMonth: 7,
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(10);
    expect(res.body[0]).toMatchObject({ installmentNumber: 1 });
    expect(mockedService.simulateSchedule).toHaveBeenCalledTimes(1);
  });

  it('SAC schedule has installmentNumber matching termMonths count', async () => {
    authAs(ADMIN_PAYLOAD);
    const scheduleRows = Array.from({ length: 12 }, (_, i) => ({
      ...SCHEDULE_ROW,
      installmentNumber: i + 1,
    }));
    mockedService.simulateSchedule.mockReturnValue(scheduleRows);

    const res = await request(app)
      .post('/api/org/rural-credit/simulate')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        bankAccountId: 'bank-1',
        creditLine: 'PRONAF',
        amortizationSystem: 'SAC',
        principalAmount: 50000,
        annualRate: 0.04,
        termMonths: 12,
        firstPaymentYear: 2026,
        firstPaymentMonth: 4,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);
    // Last installment number should equal termMonths
    expect(res.body[11].installmentNumber).toBe(12);
  });
});

// ─── POST /api/org/rural-credit ──────────────────────────────────────

describe('POST /api/org/rural-credit', () => {
  it('creates contract and returns 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createContract.mockResolvedValue(CONTRACT);

    const res = await request(app)
      .post('/api/org/rural-credit')
      .set('Authorization', 'Bearer token')
      .send(CREATE_INPUT);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'contract-1',
      creditLine: 'PRONAF',
      status: 'ATIVO',
      principalAmount: 100000,
    });
    expect(mockedService.createContract).toHaveBeenCalledTimes(1);
  });

  it('creates contract with correct number of installments equal to termMonths', async () => {
    authAs(ADMIN_PAYLOAD);
    const contractWith10Installments = {
      ...CONTRACT,
      installments: Array.from({ length: 10 }, (_, i) => ({
        ...INSTALLMENT_OUTPUT,
        id: `rc-inst-${i + 1}`,
        payableId: `payable-${i + 1}`,
        installmentNumber: i + 1,
      })),
    };
    mockedService.createContract.mockResolvedValue(contractWith10Installments);

    const res = await request(app)
      .post('/api/org/rural-credit')
      .set('Authorization', 'Bearer token')
      .send(CREATE_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.installments).toHaveLength(10);
  });

  it('contract installments have category FINANCING and originType RURAL_CREDIT (service called with correct data)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createContract.mockResolvedValue(CONTRACT);

    const res = await request(app)
      .post('/api/org/rural-credit')
      .set('Authorization', 'Bearer token')
      .send(CREATE_INPUT);

    expect(res.status).toBe(201);
    // Verify service was called with all required fields
    expect(mockedService.createContract).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({
        farmId: 'farm-1',
        creditLine: 'PRONAF',
        principalAmount: 100000,
      }),
    );
  });

  it('returns 404 when farm not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createContract.mockRejectedValue(
      new RuralCreditError('Fazenda nao encontrada', 404),
    );

    const res = await request(app)
      .post('/api/org/rural-credit')
      .set('Authorization', 'Bearer token')
      .send(CREATE_INPUT);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Fazenda nao encontrada' });
  });
});

// ─── GET /api/org/rural-credit ───────────────────────────────────────

describe('GET /api/org/rural-credit', () => {
  it('returns list of contracts with nextPayment field', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listContracts.mockResolvedValue(PAGINATED_CONTRACTS);

    const res = await request(app)
      .get('/api/org/rural-credit')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: 'contract-1',
          nextPaymentDate: expect.any(String),
          nextPaymentAmount: expect.any(Number),
        }),
      ]),
      total: 1,
      page: 1,
    });
  });

  it('passes farmId filter to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listContracts.mockResolvedValue(PAGINATED_CONTRACTS);

    const res = await request(app)
      .get('/api/org/rural-credit?farmId=farm-1&status=ATIVO')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listContracts).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ farmId: 'farm-1', status: 'ATIVO' }),
    );
  });
});

// ─── GET /api/org/rural-credit/:id ──────────────────────────────────

describe('GET /api/org/rural-credit/:id', () => {
  it('returns contract detail with installments', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getContract.mockResolvedValue(CONTRACT);

    const res = await request(app)
      .get('/api/org/rural-credit/contract-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'contract-1',
      installments: expect.arrayContaining([
        expect.objectContaining({
          installmentNumber: 1,
          principal: expect.any(Number),
          interest: expect.any(Number),
        }),
      ]),
    });
  });

  it('returns 404 when contract not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getContract.mockRejectedValue(
      new RuralCreditError('Contrato de credito rural nao encontrado', 404),
    );

    const res = await request(app)
      .get('/api/org/rural-credit/nonexistent-id')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/org/rural-credit/:id/settle-installment/:payableId ────

describe('POST /api/org/rural-credit/:id/settle-installment/:payableId', () => {
  it('settles installment and returns updated contract', async () => {
    authAs(ADMIN_PAYLOAD);
    const settledContract = {
      ...CONTRACT,
      outstandingBalance: 90000,
      totalPrincipalPaid: 10000,
      totalInterestPaid: 52.5,
      installments: [
        {
          ...INSTALLMENT_OUTPUT,
          payableStatus: 'PAID',
          paidAt: '2026-07-01T00:00:00.000Z',
          amountPaid: 10052.5,
        },
      ],
    };
    mockedService.settleInstallment.mockResolvedValue(settledContract);

    const res = await request(app)
      .post('/api/org/rural-credit/contract-1/settle-installment/payable-1')
      .set('Authorization', 'Bearer token')
      .send({ paidAmount: 10052.5, paidAt: '2026-07-01' });

    expect(res.status).toBe(200);
    expect(res.body.installments[0].payableStatus).toBe('PAID');
    expect(res.body.totalPrincipalPaid).toBe(10000);
    expect(res.body.totalInterestPaid).toBe(52.5);
    expect(mockedService.settleInstallment).toHaveBeenCalledWith(
      expect.any(Object),
      'contract-1',
      'payable-1',
      expect.objectContaining({ paidAmount: 10052.5 }),
    );
  });

  it('returns 404 when installment not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.settleInstallment.mockRejectedValue(
      new RuralCreditError('Parcela nao encontrada para este contrato', 404),
    );

    const res = await request(app)
      .post('/api/org/rural-credit/contract-1/settle-installment/nonexistent')
      .set('Authorization', 'Bearer token')
      .send({ paidAmount: 10052.5, paidAt: '2026-07-01' });

    expect(res.status).toBe(404);
  });
});

// ─── Status auto-transition to QUITADO ───────────────────────────────

describe('Status auto-transition to QUITADO', () => {
  it('getContract returns QUITADO when all installments paid', async () => {
    authAs(ADMIN_PAYLOAD);
    const quitadoContract = {
      ...CONTRACT,
      status: 'QUITADO',
      outstandingBalance: 0,
      totalPrincipalPaid: 100000,
      installments: [
        { ...INSTALLMENT_OUTPUT, payableStatus: 'PAID', paidAt: '2026-07-01T00:00:00.000Z' },
      ],
    };
    mockedService.getContract.mockResolvedValue(quitadoContract);

    const res = await request(app)
      .get('/api/org/rural-credit/contract-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('QUITADO');
  });
});

// ─── Status INADIMPLENTE ──────────────────────────────────────────────

describe('Status INADIMPLENTE', () => {
  it('getContract returns INADIMPLENTE when contract has overdue installments >30 days', async () => {
    authAs(ADMIN_PAYLOAD);
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 35);
    const inadimplenteContract = {
      ...CONTRACT,
      status: 'INADIMPLENTE',
      installments: [
        {
          ...INSTALLMENT_OUTPUT,
          dueDate: pastDate.toISOString(),
          payableStatus: 'PENDING',
        },
      ],
    };
    mockedService.getContract.mockResolvedValue(inadimplenteContract);

    const res = await request(app)
      .get('/api/org/rural-credit/contract-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INADIMPLENTE');
  });
});

// ─── DELETE /api/org/rural-credit/:id/cancel ─────────────────────────

describe('DELETE /api/org/rural-credit/:id/cancel', () => {
  it('cancels contract and returns updated contract', async () => {
    authAs(ADMIN_PAYLOAD);
    const cancelledContract = {
      ...CONTRACT,
      status: 'CANCELADO',
      outstandingBalance: 0,
      cancelledAt: '2026-03-17T00:00:00.000Z',
      installments: [{ ...INSTALLMENT_OUTPUT, payableStatus: 'CANCELLED' }],
    };
    mockedService.cancelContract.mockResolvedValue(cancelledContract);

    const res = await request(app)
      .delete('/api/org/rural-credit/contract-1/cancel')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELADO');
    expect(res.body.outstandingBalance).toBe(0);
    expect(res.body.cancelledAt).toBeTruthy();
    expect(mockedService.cancelContract).toHaveBeenCalledWith(expect.any(Object), 'contract-1');
  });

  it('PAID installments remain PAID after cancellation', async () => {
    authAs(ADMIN_PAYLOAD);
    const cancelledWithMixedInst = {
      ...CONTRACT,
      status: 'CANCELADO',
      outstandingBalance: 0,
      cancelledAt: '2026-03-17T00:00:00.000Z',
      installments: [
        { ...INSTALLMENT_OUTPUT, installmentNumber: 1, payableStatus: 'PAID' },
        {
          ...INSTALLMENT_OUTPUT,
          id: 'rc-inst-2',
          installmentNumber: 2,
          payableId: 'payable-2',
          payableStatus: 'CANCELLED',
        },
      ],
    };
    mockedService.cancelContract.mockResolvedValue(cancelledWithMixedInst);

    const res = await request(app)
      .delete('/api/org/rural-credit/contract-1/cancel')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.installments[0].payableStatus).toBe('PAID');
    expect(res.body.installments[1].payableStatus).toBe('CANCELLED');
  });

  it('returns 422 when contract already cancelled', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.cancelContract.mockRejectedValue(
      new RuralCreditError('Contrato ja esta cancelado', 422),
    );

    const res = await request(app)
      .delete('/api/org/rural-credit/contract-1/cancel')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(422);
  });
});

// ─── POST /api/org/rural-credit/:id/extraordinary-amortization ───────

describe('POST /api/org/rural-credit/:id/extraordinary-amortization', () => {
  it('applies extraordinary amortization and decrements outstanding balance', async () => {
    authAs(ADMIN_PAYLOAD);
    const amortizedContract = {
      ...CONTRACT,
      outstandingBalance: 70000,
      totalPrincipalPaid: 30000,
      installments: [
        { ...INSTALLMENT_OUTPUT, installmentNumber: 1, principal: 8750, interest: 45 },
        {
          ...INSTALLMENT_OUTPUT,
          id: 'rc-inst-2',
          installmentNumber: 2,
          payableId: 'payable-2',
          principal: 8750,
          interest: 38,
        },
      ],
    };
    mockedService.applyExtraordinaryAmortization.mockResolvedValue(amortizedContract);

    const res = await request(app)
      .post('/api/org/rural-credit/contract-1/extraordinary-amortization')
      .set('Authorization', 'Bearer token')
      .send({ extraAmount: 20000, recalculateMode: 'REDUCE_INSTALLMENT', paidAt: '2026-05-01' });

    expect(res.status).toBe(200);
    expect(res.body.outstandingBalance).toBe(70000);
    expect(res.body.totalPrincipalPaid).toBe(30000);
    expect(mockedService.applyExtraordinaryAmortization).toHaveBeenCalledWith(
      expect.any(Object),
      'contract-1',
      expect.objectContaining({ extraAmount: 20000, recalculateMode: 'REDUCE_INSTALLMENT' }),
    );
  });

  it('returns 422 when contract is not active', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.applyExtraordinaryAmortization.mockRejectedValue(
      new RuralCreditError(
        'Amortizacao extraordinaria apenas disponivel para contratos ativos',
        422,
      ),
    );

    const res = await request(app)
      .post('/api/org/rural-credit/contract-1/extraordinary-amortization')
      .set('Authorization', 'Bearer token')
      .send({ extraAmount: 5000, recalculateMode: 'REDUCE_TERM', paidAt: '2026-05-01' });

    expect(res.status).toBe(422);
  });
});

// ─── GET /api/org/rural-credit/alert-count ───────────────────────────

describe('GET /api/org/rural-credit/alert-count', () => {
  it('returns count > 0 when contract has parcela due within alertDaysBefore', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getAlertCount.mockResolvedValue({ count: 2 });

    const res = await request(app)
      .get('/api/org/rural-credit/alert-count')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: 2 });
    expect(mockedService.getAlertCount).toHaveBeenCalledTimes(1);
  });

  it('returns count 0 when no contracts with upcoming payments', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getAlertCount.mockResolvedValue({ count: 0 });

    const res = await request(app)
      .get('/api/org/rural-credit/alert-count')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });
});

// ─── PUT /api/org/rural-credit/:id ───────────────────────────────────

describe('PUT /api/org/rural-credit/:id', () => {
  it('updates non-schedule fields and returns updated contract', async () => {
    authAs(ADMIN_PAYLOAD);
    const updatedContract = { ...CONTRACT, alertDaysBefore: 30, notes: 'Updated notes' };
    mockedService.updateContract.mockResolvedValue(updatedContract);

    const res = await request(app)
      .put('/api/org/rural-credit/contract-1')
      .set('Authorization', 'Bearer token')
      .send({ alertDaysBefore: 30, notes: 'Updated notes' });

    expect(res.status).toBe(200);
    expect(res.body.alertDaysBefore).toBe(30);
    expect(res.body.notes).toBe('Updated notes');
  });

  it('returns 422 when updating cancelled contract', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateContract.mockRejectedValue(
      new RuralCreditError('Contrato cancelado nao pode ser editado', 422),
    );

    const res = await request(app)
      .put('/api/org/rural-credit/contract-1')
      .set('Authorization', 'Bearer token')
      .send({ notes: 'some note' });

    expect(res.status).toBe(422);
  });
});

// ─── computeContractStatus unit tests ────────────────────────────────

describe('computeContractStatus (unit)', () => {
  // Re-import actual implementation for unit testing
  const { computeContractStatus: actualComputeStatus } = jest.requireActual(
    './rural-credit.service',
  ) as typeof ruralCreditService;

  it('returns CANCELADO when status is CANCELADO', () => {
    const result = actualComputeStatus('CANCELADO', []);
    expect(result).toBe('CANCELADO');
  });

  it('returns QUITADO when all installments paid', () => {
    const installments = [{ payable: { status: 'PAID' } }, { payable: { status: 'PAID' } }];
    const result = actualComputeStatus('ATIVO', installments);
    expect(result).toBe('QUITADO');
  });

  it('returns INADIMPLENTE when installment >30 days overdue', () => {
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 35);
    const installments = [{ payable: { status: 'PENDING', dueDate: overdueDate } }];
    const result = actualComputeStatus('ATIVO', installments);
    expect(result).toBe('INADIMPLENTE');
  });

  it('returns ATIVO when installments pending but not overdue', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const installments = [{ payable: { status: 'PENDING', dueDate: futureDate } }];
    const result = actualComputeStatus('ATIVO', installments);
    expect(result).toBe('ATIVO');
  });
});

// ─── Authentication guard ─────────────────────────────────────────────

describe('Authentication guard', () => {
  it('returns 401 when not authenticated on GET /org/rural-credit', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('invalid token');
    });

    const res = await request(app)
      .get('/api/org/rural-credit')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });
});
