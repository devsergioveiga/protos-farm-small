import request from 'supertest';
import { app } from '../../app';
import * as payablesService from './payables.service';
import * as authService from '../auth/auth.service';
import { PayableError } from './payables.types';

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

jest.mock('./payables.service', () => ({
  createPayable: jest.fn(),
  listPayables: jest.fn(),
  getPayable: jest.fn(),
  updatePayable: jest.fn(),
  deletePayable: jest.fn(),
  settlePayment: jest.fn(),
  batchSettlePayments: jest.fn(),
  reversePayment: jest.fn(),
  generateRecurrence: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(payablesService);
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

const COST_CENTER_ITEM = {
  id: 'cc-item-1',
  costCenterId: 'cc-1',
  farmId: 'farm-1',
  allocMode: 'PERCENTAGE',
  percentage: 100,
  fixedAmount: null,
};

const INSTALLMENT_1 = {
  id: 'inst-1',
  number: 1,
  amount: 334,
  dueDate: '2026-04-01T00:00:00.000Z',
  status: 'PENDING',
  paidAt: null,
  amountPaid: null,
};

const INSTALLMENT_2 = {
  id: 'inst-2',
  number: 2,
  amount: 333,
  dueDate: '2026-05-01T00:00:00.000Z',
  status: 'PENDING',
  paidAt: null,
  amountPaid: null,
};

const INSTALLMENT_3 = {
  id: 'inst-3',
  number: 3,
  amount: 333,
  dueDate: '2026-06-01T00:00:00.000Z',
  status: 'PENDING',
  paidAt: null,
  amountPaid: null,
};

const PAYABLE = {
  id: 'payable-1',
  organizationId: 'org-1',
  farmId: 'farm-1',
  producerId: null,
  supplierName: 'Fornecedor Agro',
  category: 'INPUTS',
  categoryLabel: 'Insumos',
  description: 'Compra de sementes',
  totalAmount: 1000,
  dueDate: '2026-04-01T00:00:00.000Z',
  status: 'PENDING',
  documentNumber: 'NF-001',
  installmentCount: 3,
  paidAt: null,
  amountPaid: null,
  bankAccountId: null,
  interestAmount: null,
  fineAmount: null,
  discountAmount: null,
  recurrenceFrequency: null,
  recurrenceEndDate: null,
  recurrenceParentId: null,
  notes: null,
  createdAt: '2026-03-16T00:00:00.000Z',
  updatedAt: '2026-03-16T00:00:00.000Z',
  installments: [INSTALLMENT_1, INSTALLMENT_2, INSTALLMENT_3],
  costCenterItems: [COST_CENTER_ITEM],
};

const PAID_PAYABLE = {
  ...PAYABLE,
  status: 'PAID',
  paidAt: '2026-04-01T00:00:00.000Z',
  amountPaid: 1000,
  bankAccountId: 'account-1',
  interestAmount: 10,
  fineAmount: 5,
  discountAmount: 0,
};

const PAGINATED_LIST = {
  data: [PAYABLE],
  total: 1,
  page: 1,
  limit: 20,
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── POST /api/org/payables ──────────────────────────────────────────

describe('POST /api/org/payables', () => {
  it('creates payable with installments and returns 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPayable.mockResolvedValue(PAYABLE);

    const res = await request(app)
      .post('/api/org/payables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        supplierName: 'Fornecedor Agro',
        category: 'INPUTS',
        description: 'Compra de sementes',
        totalAmount: 1000,
        dueDate: '2026-04-01',
        installmentCount: 3,
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'PERCENTAGE', percentage: 100 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'payable-1',
      supplierName: 'Fornecedor Agro',
      installmentCount: 3,
      installments: expect.arrayContaining([
        expect.objectContaining({ number: 1, amount: 334 }), // residual on first
        expect.objectContaining({ number: 2, amount: 333 }),
        expect.objectContaining({ number: 3, amount: 333 }),
      ]),
    });
    expect(mockedService.createPayable).toHaveBeenCalledTimes(1);
  });

  it('creates payable with fixed-value cost center rateio', async () => {
    authAs(ADMIN_PAYLOAD);
    const payableWithFixedRateio = {
      ...PAYABLE,
      costCenterItems: [
        { ...COST_CENTER_ITEM, allocMode: 'FIXED_VALUE', percentage: null, fixedAmount: 600 },
        {
          ...COST_CENTER_ITEM,
          id: 'cc-item-2',
          costCenterId: 'cc-2',
          allocMode: 'FIXED_VALUE',
          percentage: null,
          fixedAmount: 400,
        },
      ],
    };
    mockedService.createPayable.mockResolvedValue(payableWithFixedRateio);

    const res = await request(app)
      .post('/api/org/payables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        supplierName: 'Fornecedor Agro',
        category: 'INPUTS',
        description: 'Compra de sementes',
        totalAmount: 1000,
        dueDate: '2026-04-01',
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'FIXED_VALUE', fixedAmount: 600 },
          { costCenterId: 'cc-2', farmId: 'farm-1', allocMode: 'FIXED_VALUE', fixedAmount: 400 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.costCenterItems).toHaveLength(2);
  });

  it('creates payable with recurrence template', async () => {
    authAs(ADMIN_PAYLOAD);
    const recurringPayable = { ...PAYABLE, recurrenceFrequency: 'MONTHLY' };
    mockedService.createPayable.mockResolvedValue(recurringPayable);

    const res = await request(app)
      .post('/api/org/payables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        supplierName: 'Arrendamento Mensal',
        category: 'RENT',
        description: 'Arrendamento de terra',
        totalAmount: 500,
        dueDate: '2026-04-01',
        recurrenceFrequency: 'MONTHLY',
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'PERCENTAGE', percentage: 100 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.recurrenceFrequency).toBe('MONTHLY');
  });

  it('returns 400 when service throws PayableError', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPayable.mockRejectedValue(
      new PayableError('Rateio percentual deve somar 100%', 400),
    );

    const res = await request(app)
      .post('/api/org/payables')
      .set('Authorization', 'Bearer token')
      .send({ farmId: 'farm-1', supplierName: 'X', category: 'INPUTS', description: 'Y' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Rateio percentual deve somar 100%' });
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/org/payables').send({});
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/org/payables ───────────────────────────────────────────

describe('GET /api/org/payables', () => {
  it('returns paginated list', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listPayables.mockResolvedValue(PAGINATED_LIST);

    const res = await request(app).get('/api/org/payables').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, data: expect.any(Array) });
    expect(res.body.data[0]).toMatchObject({ id: 'payable-1' });
  });

  it('passes filters to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listPayables.mockResolvedValue(PAGINATED_LIST);

    const res = await request(app)
      .get('/api/org/payables?status=PENDING&farmId=farm-1&search=semente')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listPayables).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ status: 'PENDING', farmId: 'farm-1', search: 'semente' }),
    );
  });

  it('passes date range filters to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listPayables.mockResolvedValue(PAGINATED_LIST);

    const res = await request(app)
      .get('/api/org/payables?startDate=2026-04-01&endDate=2026-04-30')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listPayables).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ startDate: '2026-04-01', endDate: '2026-04-30' }),
    );
  });
});

// ─── GET /api/org/payables/:id ───────────────────────────────────────

describe('GET /api/org/payables/:id', () => {
  it('returns single payable with installments', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getPayable.mockResolvedValue(PAYABLE);

    const res = await request(app)
      .get('/api/org/payables/payable-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'payable-1',
      installments: expect.arrayContaining([expect.objectContaining({ number: 1 })]),
    });
  });

  it('returns 404 when not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getPayable.mockRejectedValue(
      new PayableError('Conta a pagar não encontrada', 404),
    );

    const res = await request(app)
      .get('/api/org/payables/non-existent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Conta a pagar não encontrada' });
  });
});

// ─── PUT /api/org/payables/:id ───────────────────────────────────────

describe('PUT /api/org/payables/:id', () => {
  it('updates payable and returns updated', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updatePayable.mockResolvedValue({ ...PAYABLE, supplierName: 'Novo Fornecedor' });

    const res = await request(app)
      .put('/api/org/payables/payable-1')
      .set('Authorization', 'Bearer token')
      .send({ supplierName: 'Novo Fornecedor' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ supplierName: 'Novo Fornecedor' });
  });

  it('returns 422 when payable is not PENDING', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updatePayable.mockRejectedValue(
      new PayableError('Apenas contas a pagar com status PENDING podem ser editadas', 422),
    );

    const res = await request(app)
      .put('/api/org/payables/payable-1')
      .set('Authorization', 'Bearer token')
      .send({ supplierName: 'X' });

    expect(res.status).toBe(422);
  });
});

// ─── DELETE /api/org/payables/:id ───────────────────────────────────

describe('DELETE /api/org/payables/:id', () => {
  it('cancels payable and returns 204', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deletePayable.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/org/payables/payable-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
  });

  it('returns 422 when payable is not PENDING', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deletePayable.mockRejectedValue(
      new PayableError('Apenas contas a pagar com status PENDING podem ser canceladas', 422),
    );

    const res = await request(app)
      .delete('/api/org/payables/payable-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(422);
  });
});

// ─── POST /api/org/payables/:id/settle ───────────────────────────────

describe('POST /api/org/payables/:id/settle', () => {
  it('settles payment with juros/multa and returns paid payable', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.settlePayment.mockResolvedValue(PAID_PAYABLE);

    const res = await request(app)
      .post('/api/org/payables/payable-1/settle')
      .set('Authorization', 'Bearer token')
      .send({
        paidAt: '2026-04-01T10:00:00.000Z',
        amount: 1000,
        bankAccountId: 'account-1',
        interestAmount: 10,
        fineAmount: 5,
        discountAmount: 0,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'PAID',
      amountPaid: 1000,
      interestAmount: 10,
      fineAmount: 5,
      bankAccountId: 'account-1',
    });
    expect(mockedService.settlePayment).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'payable-1',
      expect.objectContaining({
        amount: 1000,
        bankAccountId: 'account-1',
        interestAmount: 10,
        fineAmount: 5,
      }),
    );
  });

  it('returns 422 when already paid', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.settlePayment.mockRejectedValue(
      new PayableError('Esta conta a pagar já foi paga', 422),
    );

    const res = await request(app)
      .post('/api/org/payables/payable-1/settle')
      .set('Authorization', 'Bearer token')
      .send({ paidAt: '2026-04-01', amount: 1000, bankAccountId: 'account-1' });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: 'Esta conta a pagar já foi paga' });
  });

  it('returns 404 when bank account not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.settlePayment.mockRejectedValue(
      new PayableError('Conta bancária não encontrada ou inativa', 404),
    );

    const res = await request(app)
      .post('/api/org/payables/payable-1/settle')
      .set('Authorization', 'Bearer token')
      .send({ paidAt: '2026-04-01', amount: 1000, bankAccountId: 'bad-account' });

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/org/payables/batch-settle ─────────────────────────────

describe('POST /api/org/payables/batch-settle', () => {
  it('settles multiple payables in one transaction', async () => {
    authAs(ADMIN_PAYLOAD);
    const payable2 = { ...PAID_PAYABLE, id: 'payable-2', supplierName: 'Fornecedor B' };
    mockedService.batchSettlePayments.mockResolvedValue([PAID_PAYABLE, payable2]);

    const res = await request(app)
      .post('/api/org/payables/batch-settle')
      .set('Authorization', 'Bearer token')
      .send({
        bankAccountId: 'account-1',
        paidAt: '2026-04-01T10:00:00.000Z',
        items: [
          { payableId: 'payable-1', amount: 1000 },
          { payableId: 'payable-2', amount: 500, interestAmount: 10 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ status: 'PAID', id: 'payable-1' });
    expect(mockedService.batchSettlePayments).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        bankAccountId: 'account-1',
        items: expect.arrayContaining([
          expect.objectContaining({ payableId: 'payable-1', amount: 1000 }),
        ]),
      }),
    );
  });

  it('returns 422 if any item is already paid (all-or-nothing)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.batchSettlePayments.mockRejectedValue(
      new PayableError('Conta a pagar payable-1 já foi paga. Bordero cancelado.', 422),
    );

    const res = await request(app)
      .post('/api/org/payables/batch-settle')
      .set('Authorization', 'Bearer token')
      .send({
        bankAccountId: 'account-1',
        paidAt: '2026-04-01',
        items: [{ payableId: 'payable-1', amount: 1000 }],
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Bordero cancelado');
  });
});

// ─── POST /api/org/payables/:id/reverse ─────────────────────────────

describe('POST /api/org/payables/:id/reverse', () => {
  it('reverses a paid payable and restores bank balance', async () => {
    authAs(ADMIN_PAYLOAD);
    const reversedPayable = {
      ...PAYABLE,
      status: 'PENDING',
      paidAt: null,
      amountPaid: null,
      interestAmount: null,
      fineAmount: null,
    };
    mockedService.reversePayment.mockResolvedValue(reversedPayable);

    const res = await request(app)
      .post('/api/org/payables/payable-1/reverse')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      paidAt: null,
      amountPaid: null,
    });
    expect(mockedService.reversePayment).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'payable-1',
    );
  });

  it('returns 422 when payable is not PAID', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.reversePayment.mockRejectedValue(
      new PayableError('Apenas pagamentos realizados podem ser estornados', 422),
    );

    const res = await request(app)
      .post('/api/org/payables/payable-1/reverse')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: 'Apenas pagamentos realizados podem ser estornados' });
  });
});

// ─── POST /api/org/payables/generate-recurrence ─────────────────────

describe('POST /api/org/payables/generate-recurrence', () => {
  it('generates child payables from recurrence templates', async () => {
    authAs(ADMIN_PAYLOAD);
    const childPayable = {
      ...PAYABLE,
      id: 'payable-child-1',
      recurrenceParentId: 'payable-1',
      dueDate: '2026-05-01T00:00:00.000Z',
    };
    mockedService.generateRecurrence.mockResolvedValue([childPayable]);

    const res = await request(app)
      .post('/api/org/payables/generate-recurrence')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      recurrenceParentId: 'payable-1',
      dueDate: '2026-05-01T00:00:00.000Z',
    });
  });

  it('returns empty array when no templates need generation', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.generateRecurrence.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/org/payables/generate-recurrence')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(201);
    expect(res.body).toEqual([]);
  });
});
