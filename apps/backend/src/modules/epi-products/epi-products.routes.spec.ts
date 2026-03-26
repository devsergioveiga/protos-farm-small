import request from 'supertest';
import { app } from '../../app';
import * as epiProductsService from './epi-products.service';
import { EpiProductError } from './epi-products.types';
import * as authService from '../auth/auth.service';

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

jest.mock('./epi-products.service', () => ({
  createEpiProduct: jest.fn(),
  updateEpiProduct: jest.fn(),
  deleteEpiProduct: jest.fn(),
  listEpiProducts: jest.fn(),
  getEpiProduct: jest.fn(),
  createPositionEpiRequirement: jest.fn(),
  deletePositionEpiRequirement: jest.fn(),
  listPositionEpiRequirements: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(epiProductsService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const VIEWER_PAYLOAD = {
  userId: 'viewer-1',
  email: 'viewer@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Fixtures ───────────────────────────────────────────────────────

const EPI_PRODUCT_RESPONSE = {
  id: 'epi-1',
  productId: 'prod-1',
  productName: 'Capacete de Segurança',
  caNumber: 'CA12345',
  caExpiry: '2027-01-01T00:00:00.000Z',
  epiType: 'CAPACETE' as const,
  currentStock: 10,
  organizationId: 'org-1',
  createdAt: '2026-03-26T00:00:00.000Z',
  updatedAt: '2026-03-26T00:00:00.000Z',
};

const POSITION_REQUIREMENT_RESPONSE = {
  id: 'req-1',
  positionId: 'pos-1',
  positionName: 'Operador de Máquinas',
  epiProductId: 'epi-1',
  epiProductName: 'Capacete de Segurança',
  quantity: 1,
};

const VALID_CREATE_INPUT = {
  productId: 'prod-1',
  caNumber: 'CA12345',
  caExpiry: '2027-01-01',
  epiType: 'CAPACETE',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── POST /epi-products ──────────────────────────────────────────────

describe('POST /api/epi-products', () => {
  it('should create an EPI product (201)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createEpiProduct.mockResolvedValue(EPI_PRODUCT_RESPONSE);

    const res = await request(app)
      .post('/api/epi-products')
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('epi-1');
    expect(res.body.caNumber).toBe('CA12345');
    expect(res.body.epiType).toBe('CAPACETE');
    expect(mockedService.createEpiProduct).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      VALID_CREATE_INPUT,
    );
  });

  it('should return 400 when product already registered as EPI', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createEpiProduct.mockRejectedValue(
      new EpiProductError('Este produto já está cadastrado como EPI', 'ALREADY_EXISTS'),
    );

    const res = await request(app)
      .post('/api/epi-products')
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ALREADY_EXISTS');
  });

  it('should return 403 for CONSULTANT role', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .post('/api/epi-products')
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).post('/api/epi-products').send(VALID_CREATE_INPUT);
    expect(res.status).toBe(401);
  });
});

// ─── GET /epi-products ───────────────────────────────────────────────

describe('GET /api/epi-products', () => {
  it('should list EPI products with pagination', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listEpiProducts.mockResolvedValue({
      data: [EPI_PRODUCT_RESPONSE],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await request(app).get('/api/epi-products').set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].caNumber).toBe('CA12345');
  });

  it('should pass query params to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listEpiProducts.mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 });

    await request(app)
      .get('/api/epi-products?page=2&limit=10&epiType=CAPACETE&search=capacete')
      .set('Authorization', 'Bearer tok');

    expect(mockedService.listEpiProducts).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({ page: 2, limit: 10, epiType: 'CAPACETE', search: 'capacete' }),
    );
  });

  it('should allow CONSULTANT role to read', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listEpiProducts.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const res = await request(app).get('/api/epi-products').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
  });
});

// ─── GET /epi-products/:id ───────────────────────────────────────────

describe('GET /api/epi-products/:id', () => {
  it('should return a single EPI product', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getEpiProduct.mockResolvedValue(EPI_PRODUCT_RESPONSE);

    const res = await request(app)
      .get('/api/epi-products/epi-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('epi-1');
    expect(res.body.productName).toBe('Capacete de Segurança');
  });

  it('should return 404 when not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getEpiProduct.mockRejectedValue(
      new EpiProductError('EPI não encontrado', 'NOT_FOUND'),
    );

    const res = await request(app)
      .get('/api/epi-products/nonexistent')
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(404);
  });
});

// ─── PUT /epi-products/:id ───────────────────────────────────────────

describe('PUT /api/epi-products/:id', () => {
  it('should update an EPI product', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...EPI_PRODUCT_RESPONSE, caNumber: 'CA99999' };
    mockedService.updateEpiProduct.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/epi-products/epi-1')
      .set('Authorization', 'Bearer tok')
      .send({ caNumber: 'CA99999' });

    expect(res.status).toBe(200);
    expect(res.body.caNumber).toBe('CA99999');
  });
});

// ─── DELETE /epi-products/:id ────────────────────────────────────────

describe('DELETE /api/epi-products/:id', () => {
  it('should delete an EPI product (204)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteEpiProduct.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/epi-products/epi-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
  });

  it('should return 409 when EPI has deliveries', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteEpiProduct.mockRejectedValue(
      new EpiProductError('Não é possível excluir um EPI com entregas registradas', 'HAS_DELIVERIES'),
    );

    const res = await request(app)
      .delete('/api/epi-products/epi-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HAS_DELIVERIES');
  });
});

// ─── Position Requirements ───────────────────────────────────────────

describe('GET /api/epi-products/position-requirements', () => {
  it('should list all position requirements', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listPositionEpiRequirements.mockResolvedValue([POSITION_REQUIREMENT_RESPONSE]);

    const res = await request(app)
      .get('/api/epi-products/position-requirements')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].positionName).toBe('Operador de Máquinas');
  });

  it('should filter by positionId', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listPositionEpiRequirements.mockResolvedValue([POSITION_REQUIREMENT_RESPONSE]);

    const res = await request(app)
      .get('/api/epi-products/position-requirements/pos-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listPositionEpiRequirements).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      'pos-1',
    );
  });
});

describe('POST /api/epi-products/position-requirements', () => {
  it('should create a position EPI requirement (201)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPositionEpiRequirement.mockResolvedValue(POSITION_REQUIREMENT_RESPONSE);

    const res = await request(app)
      .post('/api/epi-products/position-requirements')
      .set('Authorization', 'Bearer tok')
      .send({ positionId: 'pos-1', epiProductId: 'epi-1', quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('req-1');
    expect(res.body.positionName).toBe('Operador de Máquinas');
  });

  it('should return 400 when already configured', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPositionEpiRequirement.mockRejectedValue(
      new EpiProductError('Este EPI já está configurado para este cargo', 'ALREADY_EXISTS'),
    );

    const res = await request(app)
      .post('/api/epi-products/position-requirements')
      .set('Authorization', 'Bearer tok')
      .send({ positionId: 'pos-1', epiProductId: 'epi-1' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/epi-products/position-requirements/:id', () => {
  it('should delete a position requirement (204)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deletePositionEpiRequirement.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/epi-products/position-requirements/req-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
  });
});
