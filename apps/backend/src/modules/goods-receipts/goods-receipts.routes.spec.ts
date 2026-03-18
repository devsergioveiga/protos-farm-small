import request from 'supertest';
import { app } from '../../app';
import * as goodsReceiptsService from './goods-receipts.service';
import * as authService from '../auth/auth.service';
import { GoodsReceiptError } from './goods-receipts.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./goods-receipts.service', () => ({
  createGoodsReceipt: jest.fn(),
  listGoodsReceipts: jest.fn(),
  getGoodsReceiptById: jest.fn(),
  transitionGoodsReceipt: jest.fn(),
  listPendingDeliveries: jest.fn(),
  updateGoodsReceiptDivergencePhoto: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(goodsReceiptsService);
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

const VALID_GR = {
  id: 'gr-1',
  sequentialNumber: 'REC-2026/0001',
  status: 'PENDENTE',
  statusLabel: 'Pendente',
  receivingType: 'STANDARD',
  receivingTypeLabel: 'NF + Mercadoria',
  purchaseOrderId: 'po-1',
  purchaseOrder: { sequentialNumber: 'OC-2026/0001', status: 'CONFIRMADA' },
  supplierId: 'supplier-1',
  supplier: { id: 'supplier-1', name: 'Fornecedor ABC', tradeName: null },
  invoiceNumber: '000123',
  invoiceSerie: '1',
  invoiceCfop: '1102',
  invoiceDate: new Date('2026-03-01').toISOString(),
  invoiceTotal: 550,
  invoiceKey: null,
  isProvisional: false,
  stockEntryId: null,
  payableId: null,
  storageFarmId: null,
  notes: null,
  emergencyJustification: null,
  receivedAt: null,
  conferredAt: null,
  confirmedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  createdBy: 'admin-1',
  creator: { id: 'admin-1', name: 'Admin User' },
  items: [
    {
      id: 'item-1',
      purchaseOrderItemId: 'poi-1',
      productId: null,
      productName: 'Fertilizante NPK',
      unitName: 'kg',
      orderedQty: 100,
      invoiceQty: 100,
      receivedQty: 100,
      unitPrice: 5.5,
      totalPrice: 550,
      qualityVisualOk: true,
      batchNumber: null,
      expirationDate: null,
      qualityNotes: null,
      hasDivergence: false,
      divergencePct: 0,
    },
  ],
  divergences: [],
  createdAt: new Date('2026-03-01').toISOString(),
  updatedAt: new Date('2026-03-01').toISOString(),
};

const VALID_CREATE_BODY = {
  supplierId: 'supplier-1',
  receivingType: 'STANDARD',
  purchaseOrderId: 'po-1',
  invoiceNumber: '000123',
  items: [
    {
      purchaseOrderItemId: 'poi-1',
      productName: 'Fertilizante NPK',
      unitName: 'kg',
      orderedQty: 100,
      receivedQty: 100,
      unitPrice: 5.5,
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('GoodsReceipts endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── POST /api/org/goods-receipts ─────────────────────────────────

  describe('POST /api/org/goods-receipts', () => {
    it('should create STANDARD receipt with PO and return 201 with sequentialNumber', async () => {
      mockedService.createGoodsReceipt.mockResolvedValue(VALID_GR as never);

      const response = await request(app)
        .post('/api/org/goods-receipts')
        .set('Authorization', 'Bearer valid-token')
        .send(VALID_CREATE_BODY);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('gr-1');
      expect(response.body.sequentialNumber).toMatch(/^REC-\d{4}\/\d{4}$/);
      expect(mockedService.createGoodsReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', userId: 'admin-1' }),
        expect.objectContaining({ supplierId: 'supplier-1', purchaseOrderId: 'po-1' }),
      );
    });

    it('should create EMERGENCIAL receipt without PO and return 201', async () => {
      const emergencialGR = {
        ...VALID_GR,
        receivingType: 'EMERGENCIAL',
        receivingTypeLabel: 'Emergencial (sem pedido)',
        purchaseOrderId: null,
        purchaseOrder: null,
        emergencyJustification: 'Necessidade urgente de insumos',
      };
      mockedService.createGoodsReceipt.mockResolvedValue(emergencialGR as never);

      const response = await request(app)
        .post('/api/org/goods-receipts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          supplierId: 'supplier-1',
          receivingType: 'EMERGENCIAL',
          emergencyJustification: 'Necessidade urgente de insumos',
          items: [
            {
              productName: 'Herbicida',
              unitName: 'L',
              orderedQty: 10,
              receivedQty: 10,
              unitPrice: 50,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.receivingType).toBe('EMERGENCIAL');
    });

    it('should return 400 when EMERGENCIAL without justification', async () => {
      mockedService.createGoodsReceipt.mockRejectedValue(
        new GoodsReceiptError('Justificativa e obrigatoria para recebimento emergencial', 400),
      );

      const response = await request(app)
        .post('/api/org/goods-receipts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          supplierId: 'supplier-1',
          receivingType: 'EMERGENCIAL',
          items: [
            {
              productName: 'Herbicida',
              unitName: 'L',
              orderedQty: 10,
              receivedQty: 10,
              unitPrice: 50,
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Justificativa');
    });

    it('should return 404 when PO not found', async () => {
      mockedService.createGoodsReceipt.mockRejectedValue(
        new GoodsReceiptError('Pedido de compra nao encontrado', 404),
      );

      const response = await request(app)
        .post('/api/org/goods-receipts')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...VALID_CREATE_BODY, purchaseOrderId: 'nonexistent' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('nao encontrado');
    });

    it('should create receipt with item divergence >5% and set hasDivergence=true', async () => {
      const grWithDivergence = {
        ...VALID_GR,
        items: [
          {
            ...VALID_GR.items[0],
            orderedQty: 100,
            receivedQty: 94,
            hasDivergence: true,
            divergencePct: 0.06,
          },
        ],
      };
      mockedService.createGoodsReceipt.mockResolvedValue(grWithDivergence as never);

      const response = await request(app)
        .post('/api/org/goods-receipts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          ...VALID_CREATE_BODY,
          items: [{ ...VALID_CREATE_BODY.items[0], orderedQty: 100, receivedQty: 94 }],
        });

      expect(response.status).toBe(201);
      expect(response.body.items[0].hasDivergence).toBe(true);
      expect(response.body.items[0].divergencePct).toBe(0.06);
    });

    it('should create receipt with item divergence <5% and set hasDivergence=false', async () => {
      const grNoDivergence = {
        ...VALID_GR,
        items: [
          {
            ...VALID_GR.items[0],
            orderedQty: 100,
            receivedQty: 97,
            hasDivergence: false,
            divergencePct: 0.03,
          },
        ],
      };
      mockedService.createGoodsReceipt.mockResolvedValue(grNoDivergence as never);

      const response = await request(app)
        .post('/api/org/goods-receipts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          ...VALID_CREATE_BODY,
          items: [{ ...VALID_CREATE_BODY.items[0], orderedQty: 100, receivedQty: 97 }],
        });

      expect(response.status).toBe(201);
      expect(response.body.items[0].hasDivergence).toBe(false);
    });

    it('should create NF_ANTECIPADA and set isProvisional=true', async () => {
      const provisionalGR = { ...VALID_GR, receivingType: 'NF_ANTECIPADA', isProvisional: true };
      mockedService.createGoodsReceipt.mockResolvedValue(provisionalGR as never);

      const response = await request(app)
        .post('/api/org/goods-receipts')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...VALID_CREATE_BODY, receivingType: 'NF_ANTECIPADA' });

      expect(response.status).toBe(201);
      expect(response.body.isProvisional).toBe(true);
    });

    it('should accept PARCIAL receivingType', async () => {
      const parcialGR = {
        ...VALID_GR,
        receivingType: 'PARCIAL',
        receivingTypeLabel: 'Recebimento Parcial',
      };
      mockedService.createGoodsReceipt.mockResolvedValue(parcialGR as never);

      const response = await request(app)
        .post('/api/org/goods-receipts')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...VALID_CREATE_BODY, receivingType: 'PARCIAL' });

      expect(response.status).toBe(201);
      expect(response.body.receivingType).toBe('PARCIAL');
    });
  });

  // ─── GET /api/org/goods-receipts ──────────────────────────────────

  describe('GET /api/org/goods-receipts', () => {
    it('should return paginated list with total, page, limit', async () => {
      mockedService.listGoodsReceipts.mockResolvedValue({
        data: [VALID_GR as never],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const response = await request(app)
        .get('/api/org/goods-receipts')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
    });

    it('should filter by status=PENDENTE', async () => {
      mockedService.listGoodsReceipts.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const response = await request(app)
        .get('/api/org/goods-receipts?status=PENDENTE')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockedService.listGoodsReceipts).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.objectContaining({ status: 'PENDENTE' }),
      );
    });
  });

  // ─── GET /api/org/goods-receipts/:id ──────────────────────────────

  describe('GET /api/org/goods-receipts/:id', () => {
    it('should return full GR detail with items and divergences', async () => {
      mockedService.getGoodsReceiptById.mockResolvedValue(VALID_GR as never);

      const response = await request(app)
        .get('/api/org/goods-receipts/gr-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('gr-1');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.divergences).toHaveLength(0);
    });

    it('should return 404 for unknown GR', async () => {
      mockedService.getGoodsReceiptById.mockRejectedValue(
        new GoodsReceiptError('Recebimento nao encontrado', 404),
      );

      const response = await request(app)
        .get('/api/org/goods-receipts/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('nao encontrado');
    });
  });

  // ─── PUT /api/org/goods-receipts/:id/transition ───────────────────

  describe('PUT /api/org/goods-receipts/:id/transition', () => {
    it('should transition PENDENTE->EM_CONFERENCIA and set receivedAt', async () => {
      const emConferencia = {
        ...VALID_GR,
        status: 'EM_CONFERENCIA',
        statusLabel: 'Em Conferencia',
        receivedAt: new Date().toISOString(),
      };
      mockedService.transitionGoodsReceipt.mockResolvedValue(emConferencia as never);

      const response = await request(app)
        .put('/api/org/goods-receipts/gr-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'EM_CONFERENCIA' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('EM_CONFERENCIA');
      expect(response.body.receivedAt).toBeTruthy();
    });

    it('should return 400 for invalid transition PENDENTE->CONFERIDO', async () => {
      mockedService.transitionGoodsReceipt.mockRejectedValue(
        new GoodsReceiptError('Transicao invalida: PENDENTE -> CONFERIDO', 400),
      );

      const response = await request(app)
        .put('/api/org/goods-receipts/gr-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'CONFERIDO' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('invalida');
    });

    it('should return 400 when transitioning to REJEITADO without reason', async () => {
      mockedService.transitionGoodsReceipt.mockRejectedValue(
        new GoodsReceiptError('Motivo de rejeicao e obrigatorio', 400),
      );

      const response = await request(app)
        .put('/api/org/goods-receipts/gr-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'REJEITADO' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rejeicao');
    });

    it('should transition to REJEITADO with reason and return 200', async () => {
      const rejected = {
        ...VALID_GR,
        status: 'REJEITADO',
        statusLabel: 'Rejeitado',
        rejectionReason: 'Mercadoria avariada',
        rejectedAt: new Date().toISOString(),
      };
      mockedService.transitionGoodsReceipt.mockResolvedValue(rejected as never);

      const response = await request(app)
        .put('/api/org/goods-receipts/gr-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'REJEITADO', rejectionReason: 'Mercadoria avariada' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJEITADO');
      expect(response.body.rejectionReason).toBe('Mercadoria avariada');
    });
  });

  // ─── GET /api/org/goods-receipts/pending ──────────────────────────

  describe('GET /api/org/goods-receipts/pending', () => {
    it('should return POs awaiting delivery', async () => {
      const pending = [
        {
          purchaseOrderId: 'po-1',
          sequentialNumber: 'OC-2026/0001',
          supplier: { id: 'supplier-1', name: 'Fornecedor ABC' },
          expectedDeliveryDate: new Date('2026-03-20').toISOString(),
          isOverdue: false,
          itemCount: 3,
          totalPendingItems: 2,
        },
      ];
      mockedService.listPendingDeliveries.mockResolvedValue(pending);

      const response = await request(app)
        .get('/api/org/goods-receipts/pending')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].purchaseOrderId).toBe('po-1');
      expect(response.body[0].totalPendingItems).toBe(2);
    });
  });

  // ─── Auth guard ────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should return 401 without auth token on POST', async () => {
      jest.resetAllMocks();
      const response = await request(app).post('/api/org/goods-receipts').send(VALID_CREATE_BODY);
      expect(response.status).toBe(401);
    });

    it('should return 401 without auth token on GET', async () => {
      jest.resetAllMocks();
      const response = await request(app).get('/api/org/goods-receipts');
      expect(response.status).toBe(401);
    });
  });
});
