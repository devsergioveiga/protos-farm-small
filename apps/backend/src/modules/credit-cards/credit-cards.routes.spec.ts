/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import { app } from '../../app';
import * as creditCardsService from './credit-cards.service';
import * as authService from '../auth/auth.service';
import { CreditCardError } from './credit-cards.types';

jest.mock('../../shared/audit/audit.service', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

jest.mock('../../database/rls', () => ({
  withRlsContext: jest.fn((_ctx: unknown, fn: () => unknown) => fn()),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./credit-cards.service', () => ({
  createCreditCard: jest.fn(),
  listCreditCards: jest.fn(),
  getCreditCard: jest.fn(),
  updateCreditCard: jest.fn(),
  deleteCreditCard: jest.fn(),
  addExpense: jest.fn(),
  listBills: jest.fn(),
  closeBill: jest.fn(),
  getOpenBillsCount: jest.fn(),
  getBillPeriod: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(creditCardsService);
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

const EXPENSE_1 = {
  id: 'exp-1',
  description: 'Combustível',
  amount: 400,
  expenseDate: '2026-03-01T00:00:00.000Z',
  installmentNumber: 1,
  totalInstallments: 3,
  category: null,
  notes: null,
};

const EXPENSE_2 = {
  id: 'exp-2',
  description: 'Combustível',
  amount: 400,
  expenseDate: '2026-03-01T00:00:00.000Z',
  installmentNumber: 2,
  totalInstallments: 3,
  category: null,
  notes: null,
};

const EXPENSE_3 = {
  id: 'exp-3',
  description: 'Combustível',
  amount: 400,
  expenseDate: '2026-03-01T00:00:00.000Z',
  installmentNumber: 3,
  totalInstallments: 3,
  category: null,
  notes: null,
};

const BILL = {
  id: 'bill-1',
  periodStart: '2026-02-15T00:00:00.000Z',
  periodEnd: '2026-03-14T23:59:59.999Z',
  dueDate: '2026-03-20T00:00:00.000Z',
  totalAmount: 400,
  status: 'OPEN',
  payableId: null,
  expenses: [EXPENSE_1],
  closedAt: null,
};

const CARD = {
  id: 'card-1',
  name: 'Cartão Corporativo Visa',
  brand: 'VISA',
  lastFourDigits: '1234',
  creditLimit: 5000,
  closingDay: 15,
  dueDay: 20,
  debitAccountId: 'account-1',
  debitAccountName: 'Conta Corrente',
  farmId: 'farm-1',
  farmName: 'Fazenda São João',
  holder: 'João Silva',
  isActive: true,
  notes: null,
  currentBill: BILL,
  createdAt: '2026-03-01T00:00:00.000Z',
};

const PAYABLE = {
  id: 'payable-1',
  organizationId: 'org-1',
  farmId: 'farm-1',
  producerId: null,
  supplierName: 'Cartão Corporativo Visa',
  category: 'CARTAO_CREDITO',
  categoryLabel: 'Cartão de Crédito',
  description: 'Fatura Cartão Corporativo Visa — venc. 2026-03-20',
  totalAmount: 400,
  dueDate: '2026-03-20T00:00:00.000Z',
  status: 'PENDING',
  documentNumber: null,
  installmentCount: 1,
  paidAt: null,
  amountPaid: null,
  bankAccountId: 'account-1',
  interestAmount: null,
  fineAmount: null,
  discountAmount: null,
  recurrenceFrequency: null,
  recurrenceEndDate: null,
  recurrenceParentId: null,
  notes: null,
  createdAt: '2026-03-16T00:00:00.000Z',
  updatedAt: '2026-03-16T00:00:00.000Z',
  installments: [],
  costCenterItems: [],
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── GET /api/org/credit-cards/open-bills-count ───────────────────────

describe('GET /api/org/credit-cards/open-bills-count', () => {
  it('returns count of open bills', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getOpenBillsCount.mockResolvedValue({ count: 3 });

    const res = await request(app)
      .get('/api/org/credit-cards/open-bills-count')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: 3 });
    expect(mockedService.getOpenBillsCount).toHaveBeenCalledTimes(1);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/org/credit-cards/open-bills-count');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/org/credit-cards ────────────────────────────────────────

describe('GET /api/org/credit-cards', () => {
  it('returns array of cards with currentBill', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listCreditCards.mockResolvedValue([CARD]);

    const res = await request(app)
      .get('/api/org/credit-cards')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: 'card-1',
      name: 'Cartão Corporativo Visa',
      currentBill: expect.objectContaining({ status: 'OPEN' }),
    });
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/org/credit-cards');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/org/credit-cards ───────────────────────────────────────

describe('POST /api/org/credit-cards', () => {
  it('creates card and returns 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createCreditCard.mockResolvedValue(CARD);

    const res = await request(app)
      .post('/api/org/credit-cards')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Cartão Corporativo Visa',
        brand: 'VISA',
        lastFourDigits: '1234',
        creditLimit: 5000,
        closingDay: 15,
        dueDay: 20,
        debitAccountId: 'account-1',
        farmId: 'farm-1',
        holder: 'João Silva',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'card-1', name: 'Cartão Corporativo Visa' });
    expect(mockedService.createCreditCard).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when closingDay is 30', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/credit-cards')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Test Card',
        brand: 'VISA',
        creditLimit: 1000,
        closingDay: 30,
        dueDay: 10,
        debitAccountId: 'account-1',
        farmId: 'farm-1',
        holder: 'Test',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('dia de fechamento') });
    expect(mockedService.createCreditCard).not.toHaveBeenCalled();
  });

  it('returns 400 when closingDay is 0', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/credit-cards')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Test Card',
        brand: 'VISA',
        creditLimit: 1000,
        closingDay: 0,
        dueDay: 10,
        debitAccountId: 'account-1',
        farmId: 'farm-1',
        holder: 'Test',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when closingDay is 29', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/credit-cards')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Test Card',
        brand: 'VISA',
        creditLimit: 1000,
        closingDay: 29,
        dueDay: 10,
        debitAccountId: 'account-1',
        farmId: 'farm-1',
        holder: 'Test',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when closingDay is 31', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/credit-cards')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Test Card',
        brand: 'VISA',
        creditLimit: 1000,
        closingDay: 31,
        dueDay: 10,
        debitAccountId: 'account-1',
        farmId: 'farm-1',
        holder: 'Test',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when dueDay is out of range', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/credit-cards')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Test Card',
        brand: 'VISA',
        creditLimit: 1000,
        closingDay: 15,
        dueDay: 29,
        debitAccountId: 'account-1',
        farmId: 'farm-1',
        holder: 'Test',
      });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/org/credit-cards/:id ───────────────────────────────────

describe('GET /api/org/credit-cards/:id', () => {
  it('returns card with bills and expenses', async () => {
    authAs(ADMIN_PAYLOAD);
    const cardWithBills = { ...CARD, bills: [BILL] };
    mockedService.getCreditCard.mockResolvedValue(cardWithBills as any);

    const res = await request(app)
      .get('/api/org/credit-cards/card-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'card-1', bills: expect.any(Array) });
  });

  it('returns 404 when card not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getCreditCard.mockRejectedValue(
      new CreditCardError('Cartão não encontrado', 404),
    );

    const res = await request(app)
      .get('/api/org/credit-cards/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/org/credit-cards/:id ───────────────────────────────────

describe('PUT /api/org/credit-cards/:id', () => {
  it('updates card fields and returns 200', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...CARD, name: 'Cartão Atualizado' };
    mockedService.updateCreditCard.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/org/credit-cards/card-1')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Cartão Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Cartão Atualizado' });
    expect(mockedService.updateCreditCard).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when closingDay is invalid in update', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .put('/api/org/credit-cards/card-1')
      .set('Authorization', 'Bearer token')
      .send({ closingDay: 30 });

    expect(res.status).toBe(400);
    expect(mockedService.updateCreditCard).not.toHaveBeenCalled();
  });
});

// ─── DELETE /api/org/credit-cards/:id ────────────────────────────────

describe('DELETE /api/org/credit-cards/:id', () => {
  it('soft-deletes card and returns 204', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteCreditCard.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/org/credit-cards/card-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(mockedService.deleteCreditCard).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'card-1',
    );
  });
});

// ─── POST /api/org/credit-cards/:id/expenses ─────────────────────────

describe('POST /api/org/credit-cards/:id/expenses', () => {
  it('adds expense with 3 installments and returns 201 with 3 expense records', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.addExpense.mockResolvedValue([EXPENSE_1, EXPENSE_2, EXPENSE_3]);

    const res = await request(app)
      .post('/api/org/credit-cards/card-1/expenses')
      .set('Authorization', 'Bearer token')
      .send({
        description: 'Combustível',
        amount: 1200,
        totalInstallments: 3,
        expenseDate: '2026-03-01',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toMatchObject({ installmentNumber: 1 });
    expect(res.body[1]).toMatchObject({ installmentNumber: 2 });
    expect(res.body[2]).toMatchObject({ installmentNumber: 3 });
    expect(mockedService.addExpense).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'card-1',
      expect.objectContaining({ totalInstallments: 3, amount: 1200 }),
    );
  });

  it('returns 400 when totalInstallments is out of range', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/credit-cards/card-1/expenses')
      .set('Authorization', 'Bearer token')
      .send({
        description: 'Test',
        amount: 100,
        totalInstallments: 25,
        expenseDate: '2026-03-01',
      });

    expect(res.status).toBe(400);
    expect(mockedService.addExpense).not.toHaveBeenCalled();
  });

  it('returns 400 when amount is zero', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/credit-cards/card-1/expenses')
      .set('Authorization', 'Bearer token')
      .send({
        description: 'Test',
        amount: 0,
        totalInstallments: 1,
        expenseDate: '2026-03-01',
      });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/org/credit-cards/:id/bills ─────────────────────────────

describe('GET /api/org/credit-cards/:id/bills', () => {
  it('returns bills for card', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listBills.mockResolvedValue([BILL]);

    const res = await request(app)
      .get('/api/org/credit-cards/card-1/bills')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 'bill-1', status: 'OPEN' });
    expect(mockedService.listBills).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'card-1',
      3,
    );
  });
});

// ─── POST /api/org/credit-cards/bills/:billId/close ───────────────────

describe('POST /api/org/credit-cards/bills/:billId/close', () => {
  it('closes bill and returns generated CP with CARTAO_CREDITO category', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.closeBill.mockResolvedValue(PAYABLE as any);

    const res = await request(app)
      .post('/api/org/credit-cards/bills/bill-1/close')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'payable-1',
      category: 'CARTAO_CREDITO',
    });
    expect(mockedService.closeBill).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'bill-1',
    );
  });

  it('returns 422 when bill is empty (no expenses)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.closeBill.mockRejectedValue(
      new CreditCardError('Adicione ao menos um gasto antes de fechar a fatura.', 422),
    );

    const res = await request(app)
      .post('/api/org/credit-cards/bills/bill-empty/close')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: expect.stringContaining('gasto') });
  });

  it('returns 422 when bill is already closed', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.closeBill.mockRejectedValue(
      new CreditCardError('Esta fatura já foi fechada', 422),
    );

    const res = await request(app)
      .post('/api/org/credit-cards/bills/bill-closed/close')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: expect.stringContaining('fechada') });
  });

  it('returns 404 when bill not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.closeBill.mockRejectedValue(new CreditCardError('Fatura não encontrada', 404));

    const res = await request(app)
      .post('/api/org/credit-cards/bills/nonexistent/close')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});
