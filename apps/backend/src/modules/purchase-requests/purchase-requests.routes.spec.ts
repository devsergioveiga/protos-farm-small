import request from 'supertest';
import { app } from '../../app';
import * as purchaseRequestsService from './purchase-requests.service';
import * as authService from '../auth/auth.service';
import { PurchaseRequestError } from './purchase-requests.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./purchase-requests.service', () => ({
  createPurchaseRequest: jest.fn(),
  getPurchaseRequestById: jest.fn(),
  listPurchaseRequests: jest.fn(),
  updatePurchaseRequest: jest.fn(),
  deletePurchaseRequest: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(purchaseRequestsService);
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

const VALID_RC = {
  id: 'rc-1',
  organizationId: 'org-1',
  farmId: 'farm-1',
  sequentialNumber: 'RC-2026/0001',
  requestType: 'INSUMO_AGRICOLA',
  urgency: 'NORMAL',
  status: 'RASCUNHO',
  justification: null,
  costCenterId: null,
  neededBy: null,
  geolat: null,
  geolon: null,
  photoUrl: null,
  createdBy: 'admin-1',
  submittedAt: null,
  slaDeadline: null,
  slaNotifiedAt: null,
  cancelledAt: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  items: [
    {
      id: 'item-1',
      purchaseRequestId: 'rc-1',
      productId: null,
      productName: 'Fertilizante NPK',
      quantity: 100,
      unitId: null,
      unitName: 'kg',
      estimatedUnitPrice: null,
      notes: null,
    },
  ],
  farm: { id: 'farm-1', name: 'Fazenda Boa Vista' },
  creator: { id: 'admin-1', name: 'Admin User' },
};

const VALID_BODY = {
  requestType: 'INSUMO_AGRICOLA',
  farmId: 'farm-1',
  urgency: 'NORMAL',
  items: [
    {
      productName: 'Fertilizante NPK',
      quantity: 100,
      unitName: 'kg',
    },
  ],
};

describe('PurchaseRequests endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── POST /api/org/purchase-requests ──────────────────────────────

  describe('POST /api/org/purchase-requests', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should create RC with items and return 201 with sequential number matching RC-YYYY/NNNN', async () => {
      mockedService.createPurchaseRequest.mockResolvedValue(VALID_RC as never);

      const response = await request(app)
        .post('/api/org/purchase-requests')
        .set('Authorization', 'Bearer valid-token')
        .send(VALID_BODY);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('rc-1');
      expect(response.body.sequentialNumber).toMatch(/^RC-\d{4}\/\d{4}$/);
      expect(mockedService.createPurchaseRequest).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', userId: 'admin-1' }),
        expect.objectContaining({ requestType: 'INSUMO_AGRICOLA', urgency: 'NORMAL' }),
      );
    });

    it('should return 400 when no items provided', async () => {
      mockedService.createPurchaseRequest.mockRejectedValue(
        new PurchaseRequestError('Adicione pelo menos um item a requisicao.', 400),
      );

      const response = await request(app)
        .post('/api/org/purchase-requests')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...VALID_BODY, items: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Adicione pelo menos um item');
    });

    it('should return 400 when EMERGENCIAL urgency without justification', async () => {
      mockedService.createPurchaseRequest.mockRejectedValue(
        new PurchaseRequestError(
          'A justificativa e obrigatoria para requisicoes emergenciais.',
          400,
        ),
      );

      const response = await request(app)
        .post('/api/org/purchase-requests')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...VALID_BODY, urgency: 'EMERGENCIAL' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('justificativa');
    });

    it('should return 400 with invalid requestType', async () => {
      mockedService.createPurchaseRequest.mockRejectedValue(
        new PurchaseRequestError('Tipo de requisição inválido: INVALIDO.', 400),
      );

      const response = await request(app)
        .post('/api/org/purchase-requests')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...VALID_BODY, requestType: 'INVALIDO' });

      expect(response.status).toBe(400);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).post('/api/org/purchase-requests').send(VALID_BODY);

      expect(response.status).toBe(401);
    });

    it('should increment sequential number for second RC', async () => {
      const rc2 = { ...VALID_RC, id: 'rc-2', sequentialNumber: 'RC-2026/0002' };
      mockedService.createPurchaseRequest.mockResolvedValue(rc2 as never);

      const response = await request(app)
        .post('/api/org/purchase-requests')
        .set('Authorization', 'Bearer valid-token')
        .send(VALID_BODY);

      expect(response.status).toBe(201);
      expect(response.body.sequentialNumber).toBe('RC-2026/0002');
    });
  });

  // ─── GET /api/org/purchase-requests ───────────────────────────────

  describe('GET /api/org/purchase-requests', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return paginated list with total, page, limit', async () => {
      mockedService.listPurchaseRequests.mockResolvedValue({
        data: [VALID_RC],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const response = await request(app)
        .get('/api/org/purchase-requests')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
      expect(mockedService.listPurchaseRequests).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.any(Object),
      );
    });

    it('should filter by status=RASCUNHO', async () => {
      mockedService.listPurchaseRequests.mockResolvedValue({
        data: [VALID_RC],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const response = await request(app)
        .get('/api/org/purchase-requests?status=RASCUNHO')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockedService.listPurchaseRequests).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.objectContaining({ status: 'RASCUNHO' }),
      );
    });

    it('should search by number RC-2026', async () => {
      mockedService.listPurchaseRequests.mockResolvedValue({
        data: [VALID_RC],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const response = await request(app)
        .get('/api/org/purchase-requests?search=RC-2026')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockedService.listPurchaseRequests).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.objectContaining({ search: 'RC-2026' }),
      );
    });

    it('should allow MANAGER to list RCs', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.listPurchaseRequests.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      } as never);

      const response = await request(app)
        .get('/api/org/purchase-requests')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });
  });

  // ─── GET /api/org/purchase-requests/:id ───────────────────────────

  describe('GET /api/org/purchase-requests/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return RC with items, farm, creator', async () => {
      const fullRc = {
        ...VALID_RC,
        attachments: [],
        approvalActions: [],
        costCenter: null,
      };
      mockedService.getPurchaseRequestById.mockResolvedValue(fullRc as never);

      const response = await request(app)
        .get('/api/org/purchase-requests/rc-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('rc-1');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.farm.name).toBe('Fazenda Boa Vista');
      expect(response.body.creator.name).toBe('Admin User');
    });

    it('should return 404 for nonexistent RC', async () => {
      mockedService.getPurchaseRequestById.mockRejectedValue(
        new PurchaseRequestError('Requisicao nao encontrada', 404),
      );

      const response = await request(app)
        .get('/api/org/purchase-requests/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('nao encontrada');
    });
  });

  // ─── PUT /api/org/purchase-requests/:id ───────────────────────────

  describe('PUT /api/org/purchase-requests/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should update RC in RASCUNHO status', async () => {
      const updated = { ...VALID_RC, urgency: 'URGENTE' };
      mockedService.updatePurchaseRequest.mockResolvedValue(updated as never);

      const response = await request(app)
        .put('/api/org/purchase-requests/rc-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ urgency: 'URGENTE' });

      expect(response.status).toBe(200);
      expect(response.body.urgency).toBe('URGENTE');
      expect(mockedService.updatePurchaseRequest).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'rc-1',
        expect.objectContaining({ urgency: 'URGENTE' }),
      );
    });

    it('should return 400 when updating non-editable status', async () => {
      mockedService.updatePurchaseRequest.mockRejectedValue(
        new PurchaseRequestError(
          'Requisicao so pode ser editada em status Rascunho ou Devolvida',
          400,
        ),
      );

      const response = await request(app)
        .put('/api/org/purchase-requests/rc-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ urgency: 'URGENTE' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Rascunho ou Devolvida');
    });

    it('should return 403 for OPERATOR trying to update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .put('/api/org/purchase-requests/rc-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ urgency: 'URGENTE' });

      expect(response.status).toBe(403);
    });
  });

  // ─── DELETE /api/org/purchase-requests/:id ────────────────────────

  describe('DELETE /api/org/purchase-requests/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should soft delete RASCUNHO RC and return 204', async () => {
      mockedService.deletePurchaseRequest.mockResolvedValue({ success: true } as never);

      const response = await request(app)
        .delete('/api/org/purchase-requests/rc-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(mockedService.deletePurchaseRequest).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'rc-1',
      );
    });

    it('should return 400 when deleting non-RASCUNHO RC', async () => {
      mockedService.deletePurchaseRequest.mockRejectedValue(
        new PurchaseRequestError('Apenas requisicoes em rascunho podem ser excluidas', 400),
      );

      const response = await request(app)
        .delete('/api/org/purchase-requests/rc-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rascunho');
    });

    it('should return 401 without auth', async () => {
      const response = await request(app).delete('/api/org/purchase-requests/rc-1');

      expect(response.status).toBe(401);
    });
  });
});
