import request from 'supertest';
import { app } from '../../app';
import * as quotationsService from './quotations.service';
import * as authService from '../auth/auth.service';
import { QuotationError } from './quotations.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./quotations.service', () => ({
  createQuotation: jest.fn(),
  listQuotations: jest.fn(),
  getQuotationById: jest.fn(),
  getComparativeMap: jest.fn(),
  registerProposal: jest.fn(),
  approveQuotation: jest.fn(),
  transitionQuotation: jest.fn(),
  deleteQuotation: jest.fn(),
  createNotification: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(quotationsService);
const mockedAuth = jest.mocked(authService);

// ─── Test fixtures ────────────────────────────────────────────────────

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

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const VALID_SC = {
  id: 'sc-1',
  organizationId: 'org-1',
  purchaseRequestId: 'rc-1',
  sequentialNumber: 'SC-2026/0001',
  status: 'AGUARDANDO_PROPOSTA',
  responseDeadline: null,
  notes: null,
  approvedBy: null,
  approvalJustification: null,
  approvedAt: null,
  createdBy: 'admin-1',
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  suppliers: [
    {
      id: 'qs-1',
      quotationId: 'sc-1',
      supplierId: 'sup-1',
      isSelected: false,
      createdAt: new Date('2026-01-01'),
      supplier: { id: 'sup-1', name: 'Fornecedor A', status: 'ACTIVE' },
      proposal: null,
    },
  ],
  purchaseRequest: {
    id: 'rc-1',
    sequentialNumber: 'RC-2026/0001',
    requestType: 'INSUMO_AGRICOLA',
    urgency: 'NORMAL',
  },
};

const VALID_COMPARATIVE_MAP = {
  items: [
    {
      purchaseRequestItemId: 'item-1',
      productName: 'Fertilizante NPK',
      unitName: 'kg',
      quantity: 100,
      lastPricePaid: null,
    },
  ],
  suppliers: [
    {
      supplierId: 'sup-1',
      supplierName: 'Fornecedor A',
      rating: null,
      quotationSupplierId: 'qs-1',
      proposalId: 'prop-1',
      freightTotal: null,
      taxTotal: null,
      deliveryDays: 7,
      paymentTerms: '30 dias',
      validUntil: null,
      proposalItems: [
        {
          purchaseRequestItemId: 'item-1',
          unitPrice: 15.5,
          quantity: 100,
          totalPrice: 1550,
          notes: null,
        },
      ],
    },
  ],
  perItemMinPrice: { 'item-1': 15.5 },
  perItemMaxPrice: { 'item-1': 15.5 },
};

const VALID_APPROVAL_RESULT = {
  quotation: { ...VALID_SC, status: 'FECHADA' },
  purchaseOrders: [
    {
      id: 'po-1',
      organizationId: 'org-1',
      quotationId: 'sc-1',
      supplierId: 'sup-1',
      sequentialNumber: 'OC-2026/0001',
      status: 'EMITIDA',
      issuedAt: new Date('2026-01-01'),
      createdBy: 'manager-1',
      items: [],
      supplier: { id: 'sup-1', name: 'Fornecedor A' },
    },
  ],
};

// ─── Test suite ───────────────────────────────────────────────────────

describe('Quotations endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── POST /api/org/quotations ──────────────────────────────────────

  describe('POST /api/org/quotations', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should create SC from approved RC and return 201 with sequential number', async () => {
      mockedService.createQuotation.mockResolvedValue(VALID_SC as never);

      const response = await request(app)
        .post('/api/org/quotations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          purchaseRequestId: 'rc-1',
          supplierIds: ['sup-1'],
        });

      expect(response.status).toBe(201);
      expect(response.body.sequentialNumber).toMatch(/^SC-\d{4}\/\d{4}$/);
      expect(mockedService.createQuotation).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', userId: 'admin-1' }),
        expect.objectContaining({ purchaseRequestId: 'rc-1', supplierIds: ['sup-1'] }),
      );
    });

    it('should return 400 when RC is not APROVADA', async () => {
      mockedService.createQuotation.mockRejectedValue(
        new QuotationError(
          'Somente RC com status APROVADA pode gerar cotacao. Status atual: RASCUNHO',
          400,
        ),
      );

      const response = await request(app)
        .post('/api/org/quotations')
        .set('Authorization', 'Bearer valid-token')
        .send({ purchaseRequestId: 'rc-1', supplierIds: ['sup-1'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('APROVADA');
    });

    it('should return 400 when supplierIds is empty', async () => {
      mockedService.createQuotation.mockRejectedValue(
        new QuotationError('Informe pelo menos um fornecedor para a cotacao.', 400),
      );

      const response = await request(app)
        .post('/api/org/quotations')
        .set('Authorization', 'Bearer valid-token')
        .send({ purchaseRequestId: 'rc-1', supplierIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('fornecedor');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/org/quotations')
        .send({ purchaseRequestId: 'rc-1', supplierIds: ['sup-1'] });

      expect(response.status).toBe(401);
    });
  });

  // ─── GET /api/org/quotations ───────────────────────────────────────

  describe('GET /api/org/quotations', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should list SCs with pagination and return 200', async () => {
      const mockResult = {
        data: [VALID_SC],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockedService.listQuotations.mockResolvedValue(mockResult as never);

      const response = await request(app)
        .get('/api/org/quotations')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
    });

    it('should filter by status when query param provided', async () => {
      const mockResult = { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      mockedService.listQuotations.mockResolvedValue(mockResult as never);

      const response = await request(app)
        .get('/api/org/quotations?status=AGUARDANDO_PROPOSTA')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockedService.listQuotations).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.objectContaining({ status: 'AGUARDANDO_PROPOSTA' }),
      );
    });
  });

  // ─── GET /api/org/quotations/:id ──────────────────────────────────

  describe('GET /api/org/quotations/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return SC with details and return 200', async () => {
      mockedService.getQuotationById.mockResolvedValue(VALID_SC as never);

      const response = await request(app)
        .get('/api/org/quotations/sc-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('sc-1');
      expect(response.body.sequentialNumber).toBe('SC-2026/0001');
    });

    it('should return 404 for unknown SC ID', async () => {
      mockedService.getQuotationById.mockRejectedValue(
        new QuotationError('Cotacao nao encontrada.', 404),
      );

      const response = await request(app)
        .get('/api/org/quotations/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('nao encontrada');
    });
  });

  // ─── GET /api/org/quotations/:id/comparative ──────────────────────

  describe('GET /api/org/quotations/:id/comparative', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return comparative map data with per-item prices and return 200', async () => {
      mockedService.getComparativeMap.mockResolvedValue(VALID_COMPARATIVE_MAP as never);

      const response = await request(app)
        .get('/api/org/quotations/sc-1/comparative')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.suppliers).toHaveLength(1);
      expect(response.body.perItemMinPrice).toBeDefined();
      expect(response.body.perItemMaxPrice).toBeDefined();
    });
  });

  // ─── POST /api/org/quotations/:id/suppliers/:qsId/proposal ────────

  describe('POST /api/org/quotations/:id/suppliers/:qsId/proposal', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should register proposal and return 200', async () => {
      const updatedSC = {
        ...VALID_SC,
        suppliers: [
          {
            ...VALID_SC.suppliers[0],
            proposal: {
              id: 'prop-1',
              quotationSupplierId: 'qs-1',
              items: [
                {
                  purchaseRequestItemId: 'item-1',
                  unitPrice: 15.5,
                  quantity: 100,
                  totalPrice: 1550,
                  notes: null,
                },
              ],
            },
          },
        ],
      };
      mockedService.registerProposal.mockResolvedValue(updatedSC as never);

      const response = await request(app)
        .post('/api/org/quotations/sc-1/suppliers/qs-1/proposal')
        .set('Authorization', 'Bearer valid-token')
        .send({
          items: [{ purchaseRequestItemId: 'item-1', unitPrice: 15.5, quantity: 100 }],
          deliveryDays: 7,
          paymentTerms: '30 dias',
        });

      expect(response.status).toBe(200);
      expect(mockedService.registerProposal).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'sc-1',
        'qs-1',
        expect.objectContaining({ items: expect.any(Array) }),
        undefined,
      );
    });

    it('should return 400 when SC is not in AGUARDANDO_PROPOSTA or EM_ANALISE', async () => {
      mockedService.registerProposal.mockRejectedValue(
        new QuotationError('Proposta nao pode ser registrada no status: FECHADA', 400),
      );

      const response = await request(app)
        .post('/api/org/quotations/sc-1/suppliers/qs-1/proposal')
        .set('Authorization', 'Bearer valid-token')
        .send({
          items: [{ purchaseRequestItemId: 'item-1', unitPrice: 15.5, quantity: 100 }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('status');
    });
  });

  // ─── PATCH /api/org/quotations/:id/approve ────────────────────────

  describe('PATCH /api/org/quotations/:id/approve', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should approve SC and generate OCs, return 200', async () => {
      mockedService.approveQuotation.mockResolvedValue(VALID_APPROVAL_RESULT as never);

      const response = await request(app)
        .patch('/api/org/quotations/sc-1/approve')
        .set('Authorization', 'Bearer valid-token')
        .send({
          selectedItems: [{ purchaseRequestItemId: 'item-1', quotationSupplierId: 'qs-1' }],
        });

      expect(response.status).toBe(200);
      expect(response.body.purchaseOrders).toHaveLength(1);
      expect(response.body.purchaseOrders[0].sequentialNumber).toMatch(/^OC-\d{4}\/\d{4}$/);
    });

    it('should return 400 when justification is required but missing (non-lowest price)', async () => {
      mockedService.approveQuotation.mockRejectedValue(
        new QuotationError(
          'Justificativa obrigatoria quando nao e escolhido o menor preco em algum item.',
          400,
        ),
      );

      const response = await request(app)
        .patch('/api/org/quotations/sc-1/approve')
        .set('Authorization', 'Bearer valid-token')
        .send({
          selectedItems: [{ purchaseRequestItemId: 'item-1', quotationSupplierId: 'qs-2' }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Justificativa');
    });

    it('should return 400 when SC is not in EM_ANALISE', async () => {
      mockedService.approveQuotation.mockRejectedValue(
        new QuotationError(
          'Cotacao deve estar em EM_ANALISE para ser aprovada. Status atual: RASCUNHO',
          400,
        ),
      );

      const response = await request(app)
        .patch('/api/org/quotations/sc-1/approve')
        .set('Authorization', 'Bearer valid-token')
        .send({
          selectedItems: [{ purchaseRequestItemId: 'item-1', quotationSupplierId: 'qs-1' }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('EM_ANALISE');
    });
  });

  // ─── PATCH /api/org/quotations/:id/transition ─────────────────────

  describe('PATCH /api/org/quotations/:id/transition', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should transition SC status and return 200', async () => {
      const transitioned = { ...VALID_SC, status: 'CANCELADA' };
      mockedService.transitionQuotation.mockResolvedValue(transitioned as never);

      const response = await request(app)
        .patch('/api/org/quotations/sc-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'CANCELADA' });

      expect(response.status).toBe(200);
      expect(mockedService.transitionQuotation).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'sc-1',
        'CANCELADA',
      );
    });

    it('should return 400 when status field is missing', async () => {
      const response = await request(app)
        .patch('/api/org/quotations/sc-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('status');
    });

    it('should return 400 for invalid transition', async () => {
      mockedService.transitionQuotation.mockRejectedValue(
        new QuotationError('Transicao invalida: FECHADA -> RASCUNHO', 400),
      );

      const response = await request(app)
        .patch('/api/org/quotations/sc-1/transition')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'RASCUNHO' });

      expect(response.status).toBe(400);
    });
  });

  // ─── DELETE /api/org/quotations/:id ───────────────────────────────

  describe('DELETE /api/org/quotations/:id', () => {
    beforeEach(() => authAs(MANAGER_PAYLOAD));

    it('should soft delete a RASCUNHO SC and return 204', async () => {
      mockedService.deleteQuotation.mockResolvedValue({ success: true } as never);

      const response = await request(app)
        .delete('/api/org/quotations/sc-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(mockedService.deleteQuotation).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'sc-1',
      );
    });

    it('should return 400 when trying to delete a non-RASCUNHO SC', async () => {
      mockedService.deleteQuotation.mockRejectedValue(
        new QuotationError('Apenas cotacoes em rascunho podem ser excluidas.', 400),
      );

      const response = await request(app)
        .delete('/api/org/quotations/sc-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rascunho');
    });
  });
});
