import request from 'supertest';
import { app } from '../../app';
import * as receivablesService from './receivables.service';
import * as authService from '../auth/auth.service';
import {
  ReceivableError,
  type ReceivableOutput,
  type ReceivableInstallmentOutput,
  type ReceivableCostCenterItemOutput,
  type AgingResponse,
} from './receivables.types';

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

jest.mock('./receivables.service', () => ({
  createReceivable: jest.fn(),
  listReceivables: jest.fn(),
  getReceivable: jest.fn(),
  updateReceivable: jest.fn(),
  deleteReceivable: jest.fn(),
  settleReceivable: jest.fn(),
  reverseReceivable: jest.fn(),
  renegotiateReceivable: jest.fn(),
  getReceivablesAging: jest.fn(),
  getReceivablesByBucket: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(receivablesService);
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

const COST_CENTER_ITEM: ReceivableCostCenterItemOutput = {
  id: 'cc-item-1',
  costCenterId: 'cc-1',
  farmId: 'farm-1',
  allocMode: 'PERCENTAGE',
  percentage: 100,
  fixedAmount: null,
};

const INSTALLMENT_1: ReceivableInstallmentOutput = {
  id: 'inst-1',
  number: 1,
  amount: 150, // residual first installment for 3x of 1000: 334
  dueDate: '2026-04-01T00:00:00.000Z',
  status: 'PENDING',
  receivedAt: null,
  amountReceived: null,
};

const INSTALLMENT_2: ReceivableInstallmentOutput = {
  id: 'inst-2',
  number: 2,
  amount: 333,
  dueDate: '2026-05-01T00:00:00.000Z',
  status: 'PENDING',
  receivedAt: null,
  amountReceived: null,
};

const INSTALLMENT_3: ReceivableInstallmentOutput = {
  id: 'inst-3',
  number: 3,
  amount: 333,
  dueDate: '2026-06-01T00:00:00.000Z',
  status: 'PENDING',
  receivedAt: null,
  amountReceived: null,
};

const RECEIVABLE: ReceivableOutput = {
  id: 'receivable-1',
  organizationId: 'org-1',
  farmId: 'farm-1',
  producerId: null,
  clientName: 'Cooperativa COOP',
  category: 'GRAIN_SALE',
  description: 'Venda de soja safra 2026',
  totalAmount: 10000,
  dueDate: '2026-04-01T00:00:00.000Z',
  status: 'PENDING',
  documentNumber: 'NF-001',
  nfeKey: null,
  funruralRate: null,
  funruralAmount: null,
  installmentCount: 1,
  receivedAt: null,
  amountReceived: null,
  bankAccountId: null,
  interestAmount: null,
  fineAmount: null,
  discountAmount: null,
  notes: null,
  createdAt: '2026-03-16T00:00:00.000Z',
  updatedAt: '2026-03-16T00:00:00.000Z',
  installments: [INSTALLMENT_1],
  costCenterItems: [COST_CENTER_ITEM],
};

const RECEIVED_RECEIVABLE: ReceivableOutput = {
  ...RECEIVABLE,
  status: 'RECEIVED',
  receivedAt: '2026-04-01T00:00:00.000Z',
  amountReceived: 10100, // 10000 + 50 juros + 100 multa - 50 glosa
  bankAccountId: 'account-1',
  interestAmount: 50,
  fineAmount: 100,
  discountAmount: 50,
};

const RECEIVABLE_WITH_FUNRURAL: ReceivableOutput = {
  ...RECEIVABLE,
  funruralRate: 0.015,
  funruralAmount: 150, // 10000 * 0.015 = 150
};

const RECEIVABLE_WITH_NFE: ReceivableOutput = {
  ...RECEIVABLE,
  nfeKey: '12345678901234567890123456789012345678901234', // 44 chars
};

const RECEIVABLE_3_INSTALLMENTS: ReceivableOutput = {
  ...RECEIVABLE,
  installmentCount: 3,
  installments: [
    { ...INSTALLMENT_1, amount: 334 }, // residual
    { ...INSTALLMENT_2, amount: 333 },
    { ...INSTALLMENT_3, amount: 333 },
  ],
};

const PAGINATED_LIST = {
  data: [RECEIVABLE],
  total: 1,
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── POST /api/org/receivables — FUNRURAL ────────────────────────────

describe('POST /api/org/receivables — FUNRURAL 1.5%', () => {
  it('creates CR com FUNRURAL e verifica funruralAmount = totalAmount * 0.015', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createReceivable.mockResolvedValue(RECEIVABLE_WITH_FUNRURAL);

    const res = await request(app)
      .post('/api/org/receivables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        clientName: 'Cooperativa COOP',
        category: 'GRAIN_SALE',
        description: 'Venda de soja',
        totalAmount: 10000,
        dueDate: '2026-04-01',
        funruralRate: 0.015,
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'PERCENTAGE', percentage: 100 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      funruralRate: 0.015,
      funruralAmount: 150, // 10000 * 0.015 = 150
    });
    expect(mockedService.createReceivable).toHaveBeenCalledTimes(1);
  });

  it('creates CR sem FUNRURAL (funruralRate = null)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createReceivable.mockResolvedValue(RECEIVABLE);

    const res = await request(app)
      .post('/api/org/receivables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        clientName: 'Cooperativa COOP',
        category: 'GRAIN_SALE',
        description: 'Venda de soja',
        totalAmount: 10000,
        dueDate: '2026-04-01',
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'PERCENTAGE', percentage: 100 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.funruralRate).toBeNull();
    expect(res.body.funruralAmount).toBeNull();
  });
});

// ─── POST /api/org/receivables — nfeKey validation ───────────────────

describe('POST /api/org/receivables — Chave NF-e', () => {
  it('creates CR with valid 44-char nfeKey', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createReceivable.mockResolvedValue(RECEIVABLE_WITH_NFE);

    const res = await request(app)
      .post('/api/org/receivables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        clientName: 'Cooperativa COOP',
        category: 'GRAIN_SALE',
        description: 'Venda de soja',
        totalAmount: 10000,
        dueDate: '2026-04-01',
        nfeKey: '12345678901234567890123456789012345678901234', // 44 chars
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'PERCENTAGE', percentage: 100 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.nfeKey).toHaveLength(44);
  });

  it('returns 400 when nfeKey has wrong length', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createReceivable.mockRejectedValue(
      new ReceivableError('Chave NF-e deve ter exatamente 44 caracteres', 400),
    );

    const res = await request(app)
      .post('/api/org/receivables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        clientName: 'Cooperativa COOP',
        category: 'GRAIN_SALE',
        description: 'Venda de soja',
        totalAmount: 10000,
        dueDate: '2026-04-01',
        nfeKey: '123', // invalid length
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'PERCENTAGE', percentage: 100 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Chave NF-e deve ter exatamente 44 caracteres' });
  });
});

// ─── POST /api/org/receivables — Parcelamento ─────────────────────────

describe('POST /api/org/receivables — Parcelamento', () => {
  it('creates CR com 3 parcelas — residual na primeira', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createReceivable.mockResolvedValue(RECEIVABLE_3_INSTALLMENTS);

    const res = await request(app)
      .post('/api/org/receivables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        clientName: 'Cooperativa COOP',
        category: 'GRAIN_SALE',
        description: 'Venda de soja',
        totalAmount: 1000,
        dueDate: '2026-04-01',
        installmentCount: 3,
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'PERCENTAGE', percentage: 100 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.installments).toHaveLength(3);
    expect(res.body.installments).toMatchObject(
      expect.arrayContaining([
        expect.objectContaining({ number: 1, amount: 334 }), // residual first
        expect.objectContaining({ number: 2, amount: 333 }),
        expect.objectContaining({ number: 3, amount: 333 }),
      ]),
    );
  });
});

// ─── POST /api/org/receivables — Rateio ──────────────────────────────

describe('POST /api/org/receivables — Rateio', () => {
  it('creates CR com rateio por percentual', async () => {
    authAs(ADMIN_PAYLOAD);
    const receivableWithPercentageRateio: ReceivableOutput = {
      ...RECEIVABLE,
      costCenterItems: [
        { ...COST_CENTER_ITEM, allocMode: 'PERCENTAGE', percentage: 60, fixedAmount: null },
        {
          ...COST_CENTER_ITEM,
          id: 'cc-item-2',
          costCenterId: 'cc-2',
          allocMode: 'PERCENTAGE',
          percentage: 40,
          fixedAmount: null,
        },
      ],
    };
    mockedService.createReceivable.mockResolvedValue(receivableWithPercentageRateio);

    const res = await request(app)
      .post('/api/org/receivables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        clientName: 'Cooperativa COOP',
        category: 'GRAIN_SALE',
        description: 'Venda de soja',
        totalAmount: 10000,
        dueDate: '2026-04-01',
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'PERCENTAGE', percentage: 60 },
          { costCenterId: 'cc-2', farmId: 'farm-1', allocMode: 'PERCENTAGE', percentage: 40 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.costCenterItems).toHaveLength(2);
    expect(res.body.costCenterItems[0]).toMatchObject({ allocMode: 'PERCENTAGE', percentage: 60 });
  });

  it('creates CR com rateio por valor fixo', async () => {
    authAs(ADMIN_PAYLOAD);
    const receivableWithFixedRateio: ReceivableOutput = {
      ...RECEIVABLE,
      costCenterItems: [
        { ...COST_CENTER_ITEM, allocMode: 'FIXED_VALUE', percentage: null, fixedAmount: 6000 },
        {
          ...COST_CENTER_ITEM,
          id: 'cc-item-2',
          costCenterId: 'cc-2',
          allocMode: 'FIXED_VALUE',
          percentage: null,
          fixedAmount: 4000,
        },
      ],
    };
    mockedService.createReceivable.mockResolvedValue(receivableWithFixedRateio);

    const res = await request(app)
      .post('/api/org/receivables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        clientName: 'Cooperativa COOP',
        category: 'GRAIN_SALE',
        description: 'Venda de soja',
        totalAmount: 10000,
        dueDate: '2026-04-01',
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'FIXED_VALUE', fixedAmount: 6000 },
          { costCenterId: 'cc-2', farmId: 'farm-1', allocMode: 'FIXED_VALUE', fixedAmount: 4000 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.costCenterItems).toHaveLength(2);
    expect(res.body.costCenterItems[1]).toMatchObject({
      allocMode: 'FIXED_VALUE',
      fixedAmount: 4000,
    });
  });

  it('returns 400 when rateio percentual nao soma 100%', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createReceivable.mockRejectedValue(
      new ReceivableError('Rateio percentual deve somar 100%', 400),
    );

    const res = await request(app)
      .post('/api/org/receivables')
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        clientName: 'X',
        category: 'GRAIN_SALE',
        description: 'Y',
        totalAmount: 1000,
        dueDate: '2026-04-01',
        costCenterItems: [
          { costCenterId: 'cc-1', farmId: 'farm-1', allocMode: 'PERCENTAGE', percentage: 60 },
        ], // only 60%, not 100%
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Rateio percentual deve somar 100%' });
  });
});

// ─── GET /api/org/receivables ─────────────────────────────────────────

describe('GET /api/org/receivables', () => {
  it('returns paginated list', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listReceivables.mockResolvedValue(PAGINATED_LIST);

    const res = await request(app).get('/api/org/receivables').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, data: expect.any(Array) });
    expect(res.body.data[0]).toMatchObject({ id: 'receivable-1' });
  });

  it('passes filters to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listReceivables.mockResolvedValue(PAGINATED_LIST);

    const res = await request(app)
      .get('/api/org/receivables?status=PENDING&farmId=farm-1&category=GRAIN_SALE')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listReceivables).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ status: 'PENDING', farmId: 'farm-1', category: 'GRAIN_SALE' }),
    );
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/org/receivables').send({});
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/org/receivables/:id ────────────────────────────────────

describe('GET /api/org/receivables/:id', () => {
  it('returns single receivable with installments', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getReceivable.mockResolvedValue(RECEIVABLE);

    const res = await request(app)
      .get('/api/org/receivables/receivable-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'receivable-1',
      installments: expect.arrayContaining([expect.objectContaining({ number: 1 })]),
    });
  });

  it('returns 404 when not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getReceivable.mockRejectedValue(
      new ReceivableError('Conta a receber não encontrada', 404),
    );

    const res = await request(app)
      .get('/api/org/receivables/non-existent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Conta a receber não encontrada' });
  });
});

// ─── POST /api/org/receivables/:id/settle — CREDIT bank ──────────────

describe('POST /api/org/receivables/:id/settle', () => {
  it('recebe pagamento e CREDITA conta bancária (oposto do CP)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.settleReceivable.mockResolvedValue(RECEIVED_RECEIVABLE);

    const res = await request(app)
      .post('/api/org/receivables/receivable-1/settle')
      .set('Authorization', 'Bearer token')
      .send({
        receivedAt: '2026-04-01T10:00:00.000Z',
        amount: 10000,
        bankAccountId: 'account-1',
        interestAmount: 50,
        fineAmount: 100,
        discountAmount: 50,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'RECEIVED',
      amountReceived: 10100, // 10000 + 50 + 100 - 50
      bankAccountId: 'account-1',
      interestAmount: 50,
      fineAmount: 100,
      discountAmount: 50,
    });
    expect(mockedService.settleReceivable).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'receivable-1',
      expect.objectContaining({
        amount: 10000,
        bankAccountId: 'account-1',
        interestAmount: 50,
        fineAmount: 100,
        discountAmount: 50,
      }),
    );
  });

  it('returns 400 when already received', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.settleReceivable.mockRejectedValue(
      new ReceivableError('Esta conta a receber já foi liquidada', 400),
    );

    const res = await request(app)
      .post('/api/org/receivables/receivable-1/settle')
      .set('Authorization', 'Bearer token')
      .send({ receivedAt: '2026-04-01', amount: 10000, bankAccountId: 'account-1' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Esta conta a receber já foi liquidada' });
  });

  it('returns 400 when cancelled', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.settleReceivable.mockRejectedValue(
      new ReceivableError('Conta a receber cancelada não pode ser liquidada', 400),
    );

    const res = await request(app)
      .post('/api/org/receivables/receivable-1/settle')
      .set('Authorization', 'Bearer token')
      .send({ receivedAt: '2026-04-01', amount: 10000, bankAccountId: 'account-1' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/org/receivables/:id/reverse ────────────────────────────

describe('POST /api/org/receivables/:id/reverse', () => {
  it('estorna recebimento e DEBITA conta bancária de volta', async () => {
    authAs(ADMIN_PAYLOAD);
    const reversedReceivable: ReceivableOutput = {
      ...RECEIVABLE,
      status: 'PENDING',
      receivedAt: null,
      amountReceived: null,
      interestAmount: null,
      fineAmount: null,
      discountAmount: null,
    };
    mockedService.reverseReceivable.mockResolvedValue(reversedReceivable);

    const res = await request(app)
      .post('/api/org/receivables/receivable-1/reverse')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      receivedAt: null,
      amountReceived: null,
    });
    expect(mockedService.reverseReceivable).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'receivable-1',
    );
  });

  it('returns 400 when not in RECEIVED status', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.reverseReceivable.mockRejectedValue(
      new ReceivableError('Apenas contas liquidadas podem ser estornadas', 400),
    );

    const res = await request(app)
      .post('/api/org/receivables/receivable-1/reverse')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Apenas contas liquidadas podem ser estornadas' });
  });
});

// ─── POST /api/org/receivables/:id/renegotiate ───────────────────────

describe('POST /api/org/receivables/:id/renegotiate', () => {
  it('marca original como RENEGOTIATED e cria novo CR', async () => {
    authAs(ADMIN_PAYLOAD);
    const newReceivable: ReceivableOutput = {
      ...RECEIVABLE,
      id: 'receivable-2',
      dueDate: '2026-07-01T00:00:00.000Z',
      notes: 'Renegociação de #receivabl',
    };
    mockedService.renegotiateReceivable.mockResolvedValue(newReceivable);

    const res = await request(app)
      .post('/api/org/receivables/receivable-1/renegotiate')
      .set('Authorization', 'Bearer token')
      .send({
        newDueDate: '2026-07-01',
        notes: 'Cliente solicitou prazo adicional',
      });

    expect(res.status).toBe(200);
    // Returns the new CR (not the original)
    expect(res.body).toMatchObject({
      id: 'receivable-2',
      dueDate: '2026-07-01T00:00:00.000Z',
    });
    expect(mockedService.renegotiateReceivable).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'receivable-1',
      expect.objectContaining({ newDueDate: '2026-07-01' }),
    );
  });

  it('renegotiates with new amount', async () => {
    authAs(ADMIN_PAYLOAD);
    const newReceivable: ReceivableOutput = {
      ...RECEIVABLE,
      id: 'receivable-3',
      totalAmount: 9000,
      dueDate: '2026-07-01T00:00:00.000Z',
    };
    mockedService.renegotiateReceivable.mockResolvedValue(newReceivable);

    const res = await request(app)
      .post('/api/org/receivables/receivable-1/renegotiate')
      .set('Authorization', 'Bearer token')
      .send({
        newDueDate: '2026-07-01',
        newAmount: 9000,
        notes: 'Desconto negociado',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalAmount: 9000 });
  });

  it('returns 400 when CR is not PENDING or OVERDUE', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.renegotiateReceivable.mockRejectedValue(
      new ReceivableError('Apenas contas PENDING ou OVERDUE podem ser renegociadas', 400),
    );

    const res = await request(app)
      .post('/api/org/receivables/receivable-1/renegotiate')
      .set('Authorization', 'Bearer token')
      .send({ newDueDate: '2026-07-01' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'Apenas contas PENDING ou OVERDUE podem ser renegociadas',
    });
  });
});

// ─── GET /api/org/receivables/aging ──────────────────────────────────

describe('GET /api/org/receivables/aging', () => {
  const AGING_RESPONSE: AgingResponse = {
    buckets: [
      { bucket: 'overdue', label: 'Vencidas', count: 3, total: 30000 },
      { bucket: 'due_7d', label: 'Vencem em 7 dias', count: 2, total: 20000 },
      { bucket: 'due_15d', label: 'Vencem em 15 dias', count: 1, total: 10000 },
      { bucket: 'due_30d', label: 'Vencem em 30 dias', count: 0, total: 0 },
      { bucket: 'due_60d', label: 'Vencem em 60 dias', count: 0, total: 0 },
      { bucket: 'due_90d', label: 'Vencem em 90 dias', count: 0, total: 0 },
      { bucket: 'due_over_90d', label: 'Mais de 90 dias', count: 1, total: 5000 },
    ],
    grandTotal: 65000,
    overdueCount: 3,
  };

  it('retorna 7 faixas de aging com contagens e totais', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getReceivablesAging.mockResolvedValue(AGING_RESPONSE);

    const res = await request(app)
      .get('/api/org/receivables/aging')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.buckets).toHaveLength(7);
    expect(res.body).toMatchObject({
      grandTotal: 65000,
      overdueCount: 3,
    });
    expect(res.body.buckets[0]).toMatchObject({ bucket: 'overdue', count: 3 });
    expect(res.body.buckets[6]).toMatchObject({ bucket: 'due_over_90d' });
  });

  it('passes farmId filter to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getReceivablesAging.mockResolvedValue(AGING_RESPONSE);

    const res = await request(app)
      .get('/api/org/receivables/aging?farmId=farm-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.getReceivablesAging).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'farm-1',
    );
  });

  it('verifica que aging retorna overdueCount correto', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getReceivablesAging.mockResolvedValue(AGING_RESPONSE);

    const res = await request(app)
      .get('/api/org/receivables/aging')
      .set('Authorization', 'Bearer token');

    expect(res.body.overdueCount).toBe(3);
    expect(
      (res.body.buckets as { bucket: string; count: number }[]).find((b) => b.bucket === 'overdue')
        ?.count,
    ).toBe(3);
  });
});

// ─── GET /api/org/receivables/aging/:bucket ──────────────────────────

describe('GET /api/org/receivables/aging/:bucket', () => {
  it('retorna CRs da faixa overdue para drill-down', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getReceivablesByBucket.mockResolvedValue([
      { ...RECEIVABLE, status: 'OVERDUE' } as ReceivableOutput,
      { ...RECEIVABLE, id: 'receivable-2', status: 'OVERDUE' } as ReceivableOutput,
    ]);

    const res = await request(app)
      .get('/api/org/receivables/aging/overdue')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockedService.getReceivablesByBucket).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'overdue',
      undefined,
    );
  });

  it('returns 400 for invalid bucket name', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getReceivablesByBucket.mockRejectedValue(
      new ReceivableError('Faixa de aging inválida: invalid_bucket', 400),
    );

    const res = await request(app)
      .get('/api/org/receivables/aging/invalid_bucket')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Faixa de aging inválida');
  });
});

// ─── PUT /api/org/receivables/:id ────────────────────────────────────

describe('PUT /api/org/receivables/:id', () => {
  it('updates receivable description', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateReceivable.mockResolvedValue({
      ...RECEIVABLE,
      description: 'Nova descrição',
    } as ReceivableOutput);

    const res = await request(app)
      .put('/api/org/receivables/receivable-1')
      .set('Authorization', 'Bearer token')
      .send({ description: 'Nova descrição' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ description: 'Nova descrição' });
  });

  it('returns 400 when not PENDING', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateReceivable.mockRejectedValue(
      new ReceivableError('Apenas contas com status PENDING podem ser editadas', 400),
    );

    const res = await request(app)
      .put('/api/org/receivables/receivable-1')
      .set('Authorization', 'Bearer token')
      .send({ description: 'X' });

    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/org/receivables/:id ─────────────────────────────────

describe('DELETE /api/org/receivables/:id', () => {
  it('cancels receivable and returns 204', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteReceivable.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/org/receivables/receivable-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
  });

  it('returns 400 when not PENDING', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteReceivable.mockRejectedValue(
      new ReceivableError('Apenas contas com status PENDING podem ser canceladas', 400),
    );

    const res = await request(app)
      .delete('/api/org/receivables/receivable-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
  });
});
