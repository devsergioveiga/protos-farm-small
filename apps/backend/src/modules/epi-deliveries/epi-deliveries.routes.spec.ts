import request from 'supertest';
import { app } from '../../app';
import * as epiDeliveriesService from './epi-deliveries.service';
import { EpiDeliveryError } from './epi-deliveries.types';
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

jest.mock('./epi-deliveries.service', () => ({
  createEpiDelivery: jest.fn(),
  deleteEpiDelivery: jest.fn(),
  listEpiDeliveries: jest.fn(),
  getEpiDelivery: jest.fn(),
  listEmployeeDeliveries: jest.fn(),
  generateEpiFichaPdf: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(epiDeliveriesService);
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

const DELIVERY_RESPONSE = {
  id: 'del-1',
  employeeId: 'emp-1',
  employeeName: 'João Silva',
  epiProductId: 'epi-1',
  epiProductName: 'Capacete de Segurança',
  caNumber: 'CA12345',
  date: '2026-03-26T00:00:00.000Z',
  quantity: 1,
  reason: 'NOVO' as const,
  signatureUrl: null,
  observations: null,
  stockOutputId: 'so-1',
  createdAt: '2026-03-26T00:00:00.000Z',
};

const VALID_CREATE_INPUT = {
  employeeId: 'emp-1',
  epiProductId: 'epi-1',
  date: '2026-03-26',
  quantity: 1,
  reason: 'NOVO',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── CP1: POST /epi-deliveries (create + stock deduction) ───────────

describe('POST /api/epi-deliveries', () => {
  it('should create an EPI delivery and return 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createEpiDelivery.mockResolvedValue(DELIVERY_RESPONSE);

    const res = await request(app)
      .post('/api/epi-deliveries')
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('del-1');
    expect(res.body.employeeName).toBe('João Silva');
    expect(res.body.caNumber).toBe('CA12345');
    expect(res.body.stockOutputId).toBe('so-1');
    expect(mockedService.createEpiDelivery).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      VALID_CREATE_INPUT,
    );
  });

  it('should return 400 when stock is insufficient (INSUFFICIENT_STOCK)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createEpiDelivery.mockRejectedValue(
      new EpiDeliveryError('Saldo insuficiente. Disponível: 0, solicitado: 1', 'INSUFFICIENT_STOCK'),
    );

    const res = await request(app)
      .post('/api/epi-deliveries')
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error).toContain('Saldo insuficiente');
  });

  it('should return 400 when EPI product not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createEpiDelivery.mockRejectedValue(
      new EpiDeliveryError('EPI não encontrado', 'EPI_NOT_FOUND'),
    );

    const res = await request(app)
      .post('/api/epi-deliveries')
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EPI_NOT_FOUND');
  });

  it('should return 403 for CONSULTANT role', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .post('/api/epi-deliveries')
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).post('/api/epi-deliveries').send(VALID_CREATE_INPUT);
    expect(res.status).toBe(401);
  });
});

// ─── CP2: DELETE /epi-deliveries/:id (stock restoration) ────────────

describe('DELETE /api/epi-deliveries/:id', () => {
  it('should delete delivery and restore stock (204)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteEpiDelivery.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/epi-deliveries/del-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
    expect(mockedService.deleteEpiDelivery).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      'del-1',
    );
  });

  it('should return 404 when delivery not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteEpiDelivery.mockRejectedValue(
      new EpiDeliveryError('Entrega não encontrada', 'NOT_FOUND'),
    );

    const res = await request(app)
      .delete('/api/epi-deliveries/nonexistent')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ─── GET /epi-deliveries ─────────────────────────────────────────────

describe('GET /api/epi-deliveries', () => {
  it('should list EPI deliveries with pagination', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listEpiDeliveries.mockResolvedValue({
      data: [DELIVERY_RESPONSE],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await request(app)
      .get('/api/epi-deliveries')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('should filter by employeeId, epiType, date range', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listEpiDeliveries.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    await request(app)
      .get('/api/epi-deliveries?employeeId=emp-1&epiType=CAPACETE&dateFrom=2026-01-01&dateTo=2026-12-31')
      .set('Authorization', 'Bearer tok');

    expect(mockedService.listEpiDeliveries).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({
        employeeId: 'emp-1',
        epiType: 'CAPACETE',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      }),
    );
  });

  it('should allow CONSULTANT role to read', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listEpiDeliveries.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const res = await request(app)
      .get('/api/epi-deliveries')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
  });
});

// ─── GET /epi-deliveries/:id ─────────────────────────────────────────

describe('GET /api/epi-deliveries/:id', () => {
  it('should return a single EPI delivery', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getEpiDelivery.mockResolvedValue(DELIVERY_RESPONSE);

    const res = await request(app)
      .get('/api/epi-deliveries/del-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('del-1');
    expect(res.body.reason).toBe('NOVO');
  });
});

// ─── GET /epi-deliveries/employees/:employeeId ───────────────────────

describe('GET /api/epi-deliveries/employees/:employeeId', () => {
  it('should list all deliveries for a specific employee', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listEmployeeDeliveries.mockResolvedValue([DELIVERY_RESPONSE]);

    const res = await request(app)
      .get('/api/epi-deliveries/employees/emp-1')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe('emp-1');
    expect(mockedService.listEmployeeDeliveries).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      'emp-1',
    );
  });
});

// ─── GET /epi-deliveries/employees/:employeeId/pdf ───────────────────

describe('GET /api/epi-deliveries/employees/:employeeId/pdf', () => {
  it('should return PDF buffer with correct content-type', async () => {
    authAs(ADMIN_PAYLOAD);
    const fakeBuffer = Buffer.from('%PDF-1.4 fake content');
    mockedService.generateEpiFichaPdf.mockResolvedValue(fakeBuffer);

    const res = await request(app)
      .get('/api/epi-deliveries/employees/emp-1/pdf')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toContain('ficha-epi-emp-1.pdf');
    expect(mockedService.generateEpiFichaPdf).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      'emp-1',
    );
  });

  it('should return 404 when employee not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.generateEpiFichaPdf.mockRejectedValue(
      new EpiDeliveryError('Colaborador não encontrado', 'EMPLOYEE_NOT_FOUND'),
    );

    const res = await request(app)
      .get('/api/epi-deliveries/employees/nonexistent/pdf')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMPLOYEE_NOT_FOUND');
  });
});
