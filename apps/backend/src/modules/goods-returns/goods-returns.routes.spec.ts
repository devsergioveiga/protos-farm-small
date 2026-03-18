import request from 'supertest';
import { app } from '../../app';
import * as goodsReturnsService from './goods-returns.service';
import * as authService from '../auth/auth.service';
import { GoodsReturnError } from './goods-returns.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./goods-returns.service', () => ({
  createGoodsReturn: jest.fn(),
  listGoodsReturns: jest.fn(),
  getGoodsReturn: jest.fn(),
  transitionGoodsReturn: jest.fn(),
  uploadReturnPhoto: jest.fn(),
  deleteGoodsReturn: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(goodsReturnsService);
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

const VALID_RETURN = {
  id: 'dev-1',
  organizationId: 'org-1',
  sequentialNumber: 'DEV-2026/0001',
  goodsReceiptId: 'gr-1',
  supplierId: 'supplier-1',
  supplierName: 'Fornecedor ABC',
  status: 'PENDENTE',
  statusLabel: 'Pendente',
  reason: 'DEFEITO',
  reasonLabel: 'Defeito',
  expectedAction: 'TROCA',
  actionLabel: 'Troca',
  resolutionStatus: 'PENDING',
  resolutionStatusLabel: 'Pendente',
  resolutionDeadline: null,
  returnInvoiceNumber: null,
  returnInvoiceDate: null,
  notes: null,
  stockOutputId: null,
  creditPayableId: null,
  createdBy: 'admin-1',
  createdAt: new Date('2026-03-18').toISOString(),
  updatedAt: new Date('2026-03-18').toISOString(),
  items: [
    {
      id: 'item-1',
      goodsReturnId: 'dev-1',
      productId: 'prod-1',
      productName: 'Fertilizante NPK',
      unitName: 'kg',
      returnQty: '10',
      unitPrice: '5.5',
      totalPrice: '55',
      batchNumber: null,
      photoUrl: null,
      photoFileName: null,
      createdAt: new Date('2026-03-18').toISOString(),
    },
  ],
  goodsReceipt: {
    sequentialNumber: 'REC-2026/0001',
    purchaseOrderId: 'po-1',
  },
};

const VALID_CREATE_BODY = {
  goodsReceiptId: 'gr-1',
  reason: 'DEFEITO',
  expectedAction: 'TROCA',
  items: [
    {
      productId: 'prod-1',
      productName: 'Fertilizante NPK',
      unitName: 'kg',
      returnQty: 10,
      unitPrice: 5.5,
    },
  ],
};

const VALID_LIST_RESULT = {
  data: [
    {
      id: 'dev-1',
      sequentialNumber: 'DEV-2026/0001',
      supplierName: 'Fornecedor ABC',
      status: 'PENDENTE',
      statusLabel: 'Pendente',
      reason: 'DEFEITO',
      reasonLabel: 'Defeito',
      expectedAction: 'TROCA',
      actionLabel: 'Troca',
      totalValue: '55',
      itemCount: 1,
      createdAt: new Date('2026-03-18').toISOString(),
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('GoodsReturns endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── POST /api/org/goods-returns ────────────────────────────────────

  describe('POST /api/org/goods-returns', () => {
    it('should create return linked to confirmed GoodsReceipt with DEV- sequential number', async () => {
      mockedService.createGoodsReturn.mockResolvedValue(VALID_RETURN as never);

      const response = await request(app)
        .post('/api/org/goods-returns')
        .set('Authorization', 'Bearer valid-token')
        .send(VALID_CREATE_BODY);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('dev-1');
      expect(response.body.sequentialNumber).toMatch(/^DEV-\d{4}\/\d{4}$/);
      expect(mockedService.createGoodsReturn).toHaveBeenCalledTimes(1);
    });

    it('should reject if GoodsReceipt is not CONFIRMADO — expect 400', async () => {
      mockedService.createGoodsReturn.mockRejectedValue(
        new GoodsReturnError('Apenas recebimentos confirmados podem ser devolvidos', 400),
      );

      const response = await request(app)
        .post('/api/org/goods-returns')
        .set('Authorization', 'Bearer valid-token')
        .send(VALID_CREATE_BODY);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/recebimentos confirmados/i);
    });

    it('should reject if returnQty exceeds receivedQty — expect 400', async () => {
      mockedService.createGoodsReturn.mockRejectedValue(
        new GoodsReturnError('Quantidade de devolucao excede quantidade recebida', 400),
      );

      const response = await request(app)
        .post('/api/org/goods-returns')
        .set('Authorization', 'Bearer valid-token')
        .send({
          ...VALID_CREATE_BODY,
          items: [{ ...VALID_CREATE_BODY.items[0], returnQty: 9999 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/devolucao excede/i);
    });

    it('should create partial return with 1 item from multi-item receipt — expect 201', async () => {
      const partialReturn = { ...VALID_RETURN, sequentialNumber: 'DEV-2026/0002' };
      mockedService.createGoodsReturn.mockResolvedValue(partialReturn as never);

      const response = await request(app)
        .post('/api/org/goods-returns')
        .set('Authorization', 'Bearer valid-token')
        .send({
          ...VALID_CREATE_BODY,
          items: [VALID_CREATE_BODY.items[0]],
        });

      expect(response.status).toBe(201);
      expect(response.body.sequentialNumber).toMatch(/^DEV-/);
    });
  });

  // ─── GET /api/org/goods-returns ─────────────────────────────────────

  describe('GET /api/org/goods-returns', () => {
    it('should return paginated list with totalValue and itemCount', async () => {
      mockedService.listGoodsReturns.mockResolvedValue(VALID_LIST_RESULT as never);

      const response = await request(app)
        .get('/api/org/goods-returns')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.data[0].totalValue).toBe('55');
      expect(response.body.data[0].itemCount).toBe(1);
    });

    it('should filter by status and return only matching records', async () => {
      mockedService.listGoodsReturns.mockResolvedValue({
        ...VALID_LIST_RESULT,
        total: 0,
        data: [],
      } as never);

      const response = await request(app)
        .get('/api/org/goods-returns?status=APROVADA')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockedService.listGoodsReturns).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.objectContaining({ status: 'APROVADA' }),
      );
    });
  });

  // ─── GET /api/org/goods-returns/:id ─────────────────────────────────

  describe('GET /api/org/goods-returns/:id', () => {
    it('should return full detail with items and goodsReceipt.sequentialNumber', async () => {
      mockedService.getGoodsReturn.mockResolvedValue(VALID_RETURN as never);

      const response = await request(app)
        .get('/api/org/goods-returns/dev-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('dev-1');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.goodsReceipt.sequentialNumber).toBe('REC-2026/0001');
    });

    it('should return 404 when return not found', async () => {
      mockedService.getGoodsReturn.mockRejectedValue(
        new GoodsReturnError('Devolucao nao encontrada', 404),
      );

      const response = await request(app)
        .get('/api/org/goods-returns/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  // ─── PATCH /api/org/goods-returns/:id/transition ────────────────────

  describe('PATCH /api/org/goods-returns/:id/transition', () => {
    it('PENDENTE -> EM_ANALISE: valid transition — expect 200', async () => {
      const inAnalise = { ...VALID_RETURN, status: 'EM_ANALISE', statusLabel: 'Em Analise' };
      mockedService.transitionGoodsReturn.mockResolvedValue(inAnalise as never);

      const response = await request(app)
        .patch('/api/org/goods-returns/dev-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'EM_ANALISE' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('EM_ANALISE');
    });

    it('EM_ANALISE -> APROVADA: valid, verify stockOutputId is set on response (RETURN stock output created)', async () => {
      const approved = {
        ...VALID_RETURN,
        status: 'APROVADA',
        statusLabel: 'Aprovada',
        stockOutputId: 'so-1',
      };
      mockedService.transitionGoodsReturn.mockResolvedValue(approved as never);

      const response = await request(app)
        .patch('/api/org/goods-returns/dev-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'APROVADA' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APROVADA');
      expect(response.body.stockOutputId).toBe('so-1');
    });

    it('APROVADA -> CONCLUIDA: valid, verify resolutionStatus = RESOLVED', async () => {
      const concluded = {
        ...VALID_RETURN,
        status: 'CONCLUIDA',
        statusLabel: 'Concluida',
        stockOutputId: 'so-1',
        resolutionStatus: 'RESOLVED',
        resolutionStatusLabel: 'Resolvido',
      };
      mockedService.transitionGoodsReturn.mockResolvedValue(concluded as never);

      const response = await request(app)
        .patch('/api/org/goods-returns/dev-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'CONCLUIDA' });

      expect(response.status).toBe(200);
      expect(response.body.resolutionStatus).toBe('RESOLVED');
    });

    it('Invalid transition (PENDENTE -> APROVADA): expect 400', async () => {
      mockedService.transitionGoodsReturn.mockRejectedValue(
        new GoodsReturnError('Transicao invalida de PENDENTE para APROVADA', 400),
      );

      const response = await request(app)
        .patch('/api/org/goods-returns/dev-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'APROVADA' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Transicao invalida/i);
    });

    it('CANCELADA is terminal state — further transition returns 400', async () => {
      mockedService.transitionGoodsReturn.mockRejectedValue(
        new GoodsReturnError('Transicao invalida de CANCELADA para EM_ANALISE', 400),
      );

      const response = await request(app)
        .patch('/api/org/goods-returns/dev-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'EM_ANALISE' });

      expect(response.status).toBe(400);
    });
  });

  // ─── APROVADA + CREDITO: verify negative Payable with isCredit=true ─

  describe('APROVADA + CREDITO financial treatment', () => {
    it('APROVADA + CREDITO: verify creditPayableId is returned (negative Payable with isCredit=true)', async () => {
      const creditReturn = {
        ...VALID_RETURN,
        expectedAction: 'CREDITO',
        actionLabel: 'Credito',
        status: 'APROVADA',
        stockOutputId: 'so-1',
        creditPayableId: 'payable-credit-1',
      };
      mockedService.transitionGoodsReturn.mockResolvedValue(creditReturn as never);

      const response = await request(app)
        .patch('/api/org/goods-returns/dev-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'APROVADA' });

      expect(response.status).toBe(200);
      expect(response.body.creditPayableId).toBe('payable-credit-1');
      expect(response.body.expectedAction).toBe('CREDITO');
    });
  });

  // ─── APROVADA + ESTORNO: verify original Payable totalAmount reduced ─

  describe('APROVADA + ESTORNO financial treatment', () => {
    it('APROVADA + ESTORNO: transition succeeds, ESTORNO action applied', async () => {
      const estornoReturn = {
        ...VALID_RETURN,
        expectedAction: 'ESTORNO',
        actionLabel: 'Estorno',
        status: 'APROVADA',
        stockOutputId: 'so-2',
        creditPayableId: null,
      };
      mockedService.transitionGoodsReturn.mockResolvedValue(estornoReturn as never);

      const response = await request(app)
        .patch('/api/org/goods-returns/dev-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'APROVADA' });

      expect(response.status).toBe(200);
      expect(response.body.expectedAction).toBe('ESTORNO');
      expect(response.body.stockOutputId).toBe('so-2');
    });
  });

  // ─── APROVADA + TROCA: no financial side effect ──────────────────────

  describe('APROVADA + TROCA financial treatment', () => {
    it('APROVADA + TROCA: no creditPayableId created, original payable unchanged', async () => {
      const trocaReturn = {
        ...VALID_RETURN,
        expectedAction: 'TROCA',
        actionLabel: 'Troca',
        status: 'APROVADA',
        stockOutputId: 'so-3',
        creditPayableId: null,
      };
      mockedService.transitionGoodsReturn.mockResolvedValue(trocaReturn as never);

      const response = await request(app)
        .patch('/api/org/goods-returns/dev-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'APROVADA' });

      expect(response.status).toBe(200);
      expect(response.body.expectedAction).toBe('TROCA');
      expect(response.body.creditPayableId).toBeNull();
    });
  });

  // ─── DELETE /api/org/goods-returns/:id ──────────────────────────────

  describe('DELETE /api/org/goods-returns/:id', () => {
    it('only PENDENTE status allowed — expect 200', async () => {
      mockedService.deleteGoodsReturn.mockResolvedValue(undefined as never);

      const response = await request(app)
        .delete('/api/org/goods-returns/dev-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockedService.deleteGoodsReturn).toHaveBeenCalledTimes(1);
    });

    it('non-PENDENTE status — expect 400', async () => {
      mockedService.deleteGoodsReturn.mockRejectedValue(
        new GoodsReturnError('Apenas devolu\u00e7oes pendentes podem ser excluidas', 400),
      );

      const response = await request(app)
        .delete('/api/org/goods-returns/dev-approved')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
    });
  });
});
