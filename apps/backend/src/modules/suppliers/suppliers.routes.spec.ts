import request from 'supertest';
import { app } from '../../app';
import * as suppliersService from './suppliers.service';
import * as authService from '../auth/auth.service';
import { SupplierError } from './suppliers.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./suppliers.service', () => ({
  createSupplier: jest.fn(),
  getSupplierById: jest.fn(),
  listSuppliers: jest.fn(),
  updateSupplier: jest.fn(),
  deleteSupplier: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(suppliersService);
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

const VALID_SUPPLIER = {
  id: 'sup-1',
  organizationId: 'org-1',
  type: 'PJ',
  name: 'Agro Insumos Ltda',
  tradeName: 'AgroInsumos',
  document: '11222333000181',
  stateRegistration: null,
  address: 'Rua das Flores, 100',
  city: 'Campinas',
  state: 'SP',
  zipCode: '13000-000',
  contactName: 'João Souza',
  contactPhone: '19999999999',
  contactEmail: 'contato@agroinsumos.com.br',
  paymentTerms: '30 dias',
  freightType: 'CIF',
  notes: null,
  status: 'ACTIVE',
  categories: ['INSUMO_AGRICOLA'],
  createdBy: 'admin-1',
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('Suppliers endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/org/suppliers');
      expect(response.status).toBe(401);
    });

    it('should return 403 for OPERATOR trying to create supplier', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .post('/api/org/suppliers')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', type: 'PJ', document: '11222333000181', categories: ['SERVICOS'] });

      expect(response.status).toBe(403);
    });

    it('should return 403 for OPERATOR trying to delete supplier', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .delete('/api/org/suppliers/sup-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });
  });

  // ─── POST /api/org/suppliers ──────────────────────────────────────

  describe('POST /api/org/suppliers', () => {
    const validBody = {
      type: 'PJ',
      name: 'Agro Insumos Ltda',
      document: '11.222.333/0001-81',
      categories: ['INSUMO_AGRICOLA'],
    };

    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should create supplier with valid CNPJ and return 201', async () => {
      mockedService.createSupplier.mockResolvedValue(VALID_SUPPLIER as never);

      const response = await request(app)
        .post('/api/org/suppliers')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('sup-1');
      expect(mockedService.createSupplier).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ name: 'Agro Insumos Ltda', type: 'PJ' }),
        'admin-1',
      );
    });

    it('should return 409 on duplicate document', async () => {
      mockedService.createSupplier.mockRejectedValue(
        new SupplierError('Fornecedor já cadastrado: Agro Insumos Ltda', 409, {
          existingId: 'sup-1',
        }),
      );

      const response = await request(app)
        .post('/api/org/suppliers')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('já cadastrado');
      expect(response.body.existingId).toBe('sup-1');
    });

    it('should return 400 on invalid CNPJ', async () => {
      mockedService.createSupplier.mockRejectedValue(
        new SupplierError('CNPJ inválido. Verifique o número e tente novamente.', 400),
      );

      const response = await request(app)
        .post('/api/org/suppliers')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validBody, document: '00.000.000/0000-00' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('CNPJ inválido');
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/org/suppliers')
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'PJ', document: '11.222.333/0001-81', categories: ['SERVICOS'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Nome');
    });

    it('should return 400 when categories is empty', async () => {
      const response = await request(app)
        .post('/api/org/suppliers')
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'PJ', name: 'Test', document: '11.222.333/0001-81', categories: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('categoria');
    });
  });

  // ─── GET /api/org/suppliers ───────────────────────────────────────

  describe('GET /api/org/suppliers', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return paginated list', async () => {
      mockedService.listSuppliers.mockResolvedValue({
        data: [VALID_SUPPLIER],
        total: 1,
        page: 1,
        limit: 20,
      } as never);

      const response = await request(app)
        .get('/api/org/suppliers')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(mockedService.listSuppliers).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.any(Object),
      );
    });

    it('should filter by search term', async () => {
      mockedService.listSuppliers.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      } as never);

      const response = await request(app)
        .get('/api/org/suppliers?search=agro')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockedService.listSuppliers).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ search: 'agro' }),
      );
    });

    it('should filter by status', async () => {
      mockedService.listSuppliers.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      } as never);

      const response = await request(app)
        .get('/api/org/suppliers?status=ACTIVE')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockedService.listSuppliers).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ status: 'ACTIVE' }),
      );
    });

    it('should filter by category', async () => {
      mockedService.listSuppliers.mockResolvedValue({
        data: [VALID_SUPPLIER],
        total: 1,
        page: 1,
        limit: 20,
      } as never);

      const response = await request(app)
        .get('/api/org/suppliers?category=INSUMO_AGRICOLA')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mockedService.listSuppliers).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ category: 'INSUMO_AGRICOLA' }),
      );
    });

    it('should allow MANAGER to read suppliers', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.listSuppliers.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      } as never);

      const response = await request(app)
        .get('/api/org/suppliers')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });
  });

  // ─── GET /api/org/suppliers/:id ──────────────────────────────────

  describe('GET /api/org/suppliers/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return single supplier with ratings', async () => {
      const supplierWithRatings = {
        ...VALID_SUPPLIER,
        documents: [],
        ratings: [
          {
            id: 'rat-1',
            supplierId: 'sup-1',
            organizationId: 'org-1',
            deadline: 5,
            quality: 4,
            price: 4,
            service: 5,
            comment: 'Ótimo fornecedor',
            ratedBy: 'admin-1',
            createdAt: new Date('2026-01-15'),
          },
        ],
        averageRating: 4.5,
        ratingCount: 1,
      };
      mockedService.getSupplierById.mockResolvedValue(supplierWithRatings as never);

      const response = await request(app)
        .get('/api/org/suppliers/sup-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('sup-1');
      expect(response.body.ratings).toHaveLength(1);
      expect(mockedService.getSupplierById).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'sup-1',
      );
    });

    it('should return 404 for nonexistent supplier', async () => {
      mockedService.getSupplierById.mockRejectedValue(
        new SupplierError('Fornecedor não encontrado', 404),
      );

      const response = await request(app)
        .get('/api/org/suppliers/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('não encontrado');
    });
  });

  // ─── PATCH /api/org/suppliers/:id ────────────────────────────────

  describe('PATCH /api/org/suppliers/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should update supplier fields', async () => {
      const updated = { ...VALID_SUPPLIER, status: 'INACTIVE', city: 'São Paulo' };
      mockedService.updateSupplier.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/suppliers/sup-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'INACTIVE', city: 'São Paulo' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('INACTIVE');
      expect(mockedService.updateSupplier).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'sup-1',
        expect.objectContaining({ status: 'INACTIVE', city: 'São Paulo' }),
      );
    });

    it('should return 404 if supplier not found', async () => {
      mockedService.updateSupplier.mockRejectedValue(
        new SupplierError('Fornecedor não encontrado', 404),
      );

      const response = await request(app)
        .patch('/api/org/suppliers/nonexistent')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
    });

    it('should return 400 when OPERATOR tries to update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .patch('/api/org/suppliers/sup-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(403);
    });
  });

  // ─── DELETE /api/org/suppliers/:id ───────────────────────────────

  describe('DELETE /api/org/suppliers/:id', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should soft-delete supplier (return 204)', async () => {
      mockedService.deleteSupplier.mockResolvedValue({ success: true } as never);

      const response = await request(app)
        .delete('/api/org/suppliers/sup-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
      expect(mockedService.deleteSupplier).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'sup-1',
      );
    });

    it('should return 404 if supplier not found on delete', async () => {
      mockedService.deleteSupplier.mockRejectedValue(
        new SupplierError('Fornecedor não encontrado', 404),
      );

      const response = await request(app)
        .delete('/api/org/suppliers/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('não encontrado');
    });
  });
});
