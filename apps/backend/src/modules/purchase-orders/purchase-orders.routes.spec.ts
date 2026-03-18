import request from 'supertest';
import { app } from '../../app';
import * as purchaseOrdersService from './purchase-orders.service';
import * as authService from '../auth/auth.service';
import { PurchaseOrderError } from './purchase-orders.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./purchase-orders.service', () => ({
  createEmergencyPO: jest.fn(),
  duplicatePO: jest.fn(),
  listPurchaseOrders: jest.fn(),
  getPurchaseOrderById: jest.fn(),
  updatePO: jest.fn(),
  transitionPO: jest.fn(),
  deletePO: jest.fn(),
  generatePurchaseOrderPdf: jest.fn(),
  checkOverduePOs: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(purchaseOrdersService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
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

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const VALID_PO = {
  id: 'po-1',
  organizationId: 'org-1',
  supplierId: 'supplier-1',
  quotationId: null,
  sequentialNumber: 'OC-2026/0001',
  status: 'RASCUNHO',
  isEmergency: true,
  emergencyJustification: 'Urgente para safra',
  notes: null,
  internalReference: null,
  expectedDeliveryDate: null,
  confirmedAt: null,
  issuedAt: null,
  overdueNotifiedAt: null,
  cancelledAt: null,
  createdBy: 'admin-1',
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  supplier: { id: 'supplier-1', name: 'Fornecedor ABC', tradeName: null },
  creator: { id: 'admin-1', name: 'Admin User' },
  quotation: null,
  items: [
    {
      id: 'item-1',
      purchaseOrderId: 'po-1',
      purchaseRequestItemId: null,
      productName: 'Fertilizante NPK',
      unitName: 'kg',
      quantity: 100,
      unitPrice: 5.5,
      totalPrice: 550,
      notes: null,
    },
  ],
};

const VALID_BODY = {
  supplierId: 'supplier-1',
  justification: 'Urgente para safra',
  items: [
    {
      productName: 'Fertilizante NPK',
      unitName: 'kg',
      quantity: 100,
      unitPrice: 5.5,
    },
  ],
};

describe('PurchaseOrders endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── POST /api/org/purchase-orders ────────────────────────────────

  describe('POST /api/org/purchase-orders', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should create emergency OC with justification and return 201', async () => {
      mockedService.createEmergencyPO.mockResolvedValue(VALID_PO as never);

      const response = await request(app)
        .post('/api/org/purchase-orders')
        .set('Authorization', 'Bearer valid-token')
        .send(VALID_BODY);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('po-1');
      expect(response.body.sequentialNumber).toMatch(/^OC-\d{4}\/\d{4}$/);
      expect(response.body.isEmergency).toBe(true);
      expect(mockedService.createEmergencyPO).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', userId: 'admin-1' }),
        expect.objectContaining({ supplierId: 'supplier-1', justification: 'Urgente para safra' }),
      );
    });

    it('should return 400 when justification is missing for emergency PO', async () => {
      mockedService.createEmergencyPO.mockRejectedValue(
        new PurchaseOrderError('Justificativa e obrigatoria para pedidos emergenciais', 400),
      );

      const response = await request(app)
        .post('/api/org/purchase-orders')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...VALID_BODY, justification: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Justificativa');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).post('/api/org/purchase-orders').send(VALID_BODY);

      expect(response.status).toBe(401);
    });
  });

  // ─── POST /api/org/purchase-orders/duplicate ──────────────────────

  describe('POST /api/org/purchase-orders/duplicate', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should duplicate OC and return new RASCUNHO OC with 201', async () => {
      const duplicated = {
        ...VALID_PO,
        id: 'po-2',
        sequentialNumber: 'OC-2026/0002',
        isEmergency: false,
        notes: 'Duplicado de OC-2026/0001',
      };
      mockedService.duplicatePO.mockResolvedValue(duplicated as never);

      const response = await request(app)
        .post('/api/org/purchase-orders/duplicate')
        .set('Authorization', 'Bearer valid-token')
        .send({ sourcePurchaseOrderId: 'po-1' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('po-2');
      expect(response.body.status).toBe('RASCUNHO');
      expect(response.body.isEmergency).toBe(false);
      expect(mockedService.duplicatePO).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.objectContaining({ sourcePurchaseOrderId: 'po-1' }),
      );
    });

    it('should return 404 when source PO not found', async () => {
      mockedService.duplicatePO.mockRejectedValue(
        new PurchaseOrderError('Pedido de compra nao encontrado', 404),
      );

      const response = await request(app)
        .post('/api/org/purchase-orders/duplicate')
        .set('Authorization', 'Bearer valid-token')
        .send({ sourcePurchaseOrderId: 'nonexistent' });

      expect(response.status).toBe(404);
    });
  });

  // ─── GET /api/org/purchase-orders ─────────────────────────────────

  describe('GET /api/org/purchase-orders', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return paginated list with total, page, limit', async () => {
      mockedService.listPurchaseOrders.mockResolvedValue({
        data: [VALID_PO],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const response = await request(app)
        .get('/api/org/purchase-orders')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
    });

    it('should filter by overdue=true flag', async () => {
      const overduePO = {
        ...VALID_PO,
        status: 'EMITIDA',
        issuedAt: new Date('2026-01-01'),
        expectedDeliveryDate: new Date('2026-01-05'),
        isOverdue: true,
      };
      mockedService.listPurchaseOrders.mockResolvedValue({
        data: [overduePO],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const response = await request(app)
        .get('/api/org/purchase-orders?overdue=true')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockedService.listPurchaseOrders).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.objectContaining({ overdue: true }),
      );
    });

    it('should allow MANAGER to list OCs', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.listPurchaseOrders.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      } as never);

      const response = await request(app)
        .get('/api/org/purchase-orders')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });

    it('should return 401 without auth', async () => {
      const response = await request(app).get('/api/org/purchase-orders');

      expect(response.status).toBe(401);
    });
  });

  // ─── GET /api/org/purchase-orders/:id ─────────────────────────────

  describe('GET /api/org/purchase-orders/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return OC with details and 200', async () => {
      mockedService.getPurchaseOrderById.mockResolvedValue(VALID_PO as never);

      const response = await request(app)
        .get('/api/org/purchase-orders/po-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('po-1');
      expect(response.body.supplier.name).toBe('Fornecedor ABC');
      expect(response.body.items).toHaveLength(1);
    });

    it('should return 404 for unknown OC', async () => {
      mockedService.getPurchaseOrderById.mockRejectedValue(
        new PurchaseOrderError('Pedido de compra nao encontrado', 404),
      );

      const response = await request(app)
        .get('/api/org/purchase-orders/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('nao encontrado');
    });
  });

  // ─── GET /api/org/purchase-orders/:id/pdf ─────────────────────────

  describe('GET /api/org/purchase-orders/:id/pdf', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return PDF content type', async () => {
      mockedService.generatePurchaseOrderPdf.mockImplementation(async (_ctx, _id, res) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="OC-OC-2026/0001.pdf"');
        res.status(200).end(Buffer.from('%PDF-1.4 fake'));
      });

      const response = await request(app)
        .get('/api/org/purchase-orders/po-1/pdf')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
    });

    it('should return 404 when OC not found for PDF', async () => {
      mockedService.generatePurchaseOrderPdf.mockRejectedValue(
        new PurchaseOrderError('Pedido de compra nao encontrado', 404),
      );

      const response = await request(app)
        .get('/api/org/purchase-orders/nonexistent/pdf')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  // ─── PATCH /api/org/purchase-orders/:id ───────────────────────────

  describe('PATCH /api/org/purchase-orders/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should update RASCUNHO OC and return 200', async () => {
      const updated = { ...VALID_PO, notes: 'Updated notes' };
      mockedService.updatePO.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/purchase-orders/po-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ notes: 'Updated notes' });

      expect(response.status).toBe(200);
      expect(response.body.notes).toBe('Updated notes');
      expect(mockedService.updatePO).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'po-1',
        expect.objectContaining({ notes: 'Updated notes' }),
      );
    });

    it('should return 400 when trying to update an EMITIDA OC', async () => {
      mockedService.updatePO.mockRejectedValue(
        new PurchaseOrderError('OC emitida nao pode ser editada', 400),
      );

      const response = await request(app)
        .patch('/api/org/purchase-orders/po-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ notes: 'Try edit after issue' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('emitida');
    });

    it('should return 403 for OPERATOR trying to update OC', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .patch('/api/org/purchase-orders/po-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ notes: 'Updated notes' });

      expect(response.status).toBe(403);
    });
  });

  // ─── PATCH /api/org/purchase-orders/:id/transition ────────────────

  describe('PATCH /api/org/purchase-orders/:id/transition', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should transition OC to EMITIDA status and return 200', async () => {
      const emitida = { ...VALID_PO, status: 'EMITIDA', issuedAt: new Date() };
      mockedService.transitionPO.mockResolvedValue(emitida as never);

      const response = await request(app)
        .patch('/api/org/purchase-orders/po-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'EMITIDA' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('EMITIDA');
      expect(mockedService.transitionPO).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'po-1',
        expect.objectContaining({ status: 'EMITIDA' }),
      );
    });

    it('should return 400 for invalid transition', async () => {
      mockedService.transitionPO.mockRejectedValue(
        new PurchaseOrderError('Transicao invalida: ENTREGUE -> EMITIDA', 400),
      );

      const response = await request(app)
        .patch('/api/org/purchase-orders/po-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'EMITIDA' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('invalida');
    });
  });

  // ─── DELETE /api/org/purchase-orders/:id ──────────────────────────

  describe('DELETE /api/org/purchase-orders/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should soft delete RASCUNHO OC and return 204', async () => {
      mockedService.deletePO.mockResolvedValue({ success: true } as never);

      const response = await request(app)
        .delete('/api/org/purchase-orders/po-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(mockedService.deletePO).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'po-1',
      );
    });

    it('should return 400 when deleting non-RASCUNHO OC', async () => {
      mockedService.deletePO.mockRejectedValue(
        new PurchaseOrderError('Apenas pedidos em rascunho podem ser excluidos', 400),
      );

      const response = await request(app)
        .delete('/api/org/purchase-orders/po-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rascunho');
    });

    it('should return 401 without auth', async () => {
      const response = await request(app).delete('/api/org/purchase-orders/po-1');

      expect(response.status).toBe(401);
    });
  });
});
