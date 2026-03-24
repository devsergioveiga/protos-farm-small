import request from 'supertest';
import { app } from '../../app';
import * as payrollRubricasService from './payroll-rubricas.service';
import * as authService from '../auth/auth.service';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./payroll-rubricas.service', () => ({
  payrollRubricasService: {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    seedSystemRubricas: jest.fn(),
    hasRubricas: jest.fn(),
  },
  PayrollRubricaError: class PayrollRubricaError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.name = 'PayrollRubricaError';
      this.statusCode = statusCode;
    }
  },
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(payrollRubricasService.payrollRubricasService);
const mockedAuth = jest.mocked(authService);

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: 'org-1',
};

const FINANCIAL_PAYLOAD = {
  userId: 'financial-1',
  email: 'financial@org.com',
  role: 'FINANCIAL' as const,
  organizationId: 'org-1',
};

function authAs(payload: typeof MANAGER_PAYLOAD | typeof FINANCIAL_PAYLOAD): void {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

const ORG_ID = 'org-1';
const RUBRICA_ID = 'rubrica-1';

const mockRubrica = {
  id: RUBRICA_ID,
  organizationId: ORG_ID,
  code: 'SALARIO_BASE',
  name: 'Salário Base',
  rubricaType: 'PROVENTO' as const,
  calculationType: 'FIXED_VALUE' as const,
  formulaType: null,
  baseFormula: null,
  rate: null,
  fixedValue: null,
  incideINSS: true,
  incideFGTS: true,
  incideIRRF: true,
  isSystem: true,
  isActive: true,
  eSocialCode: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockCustomRubrica = {
  ...mockRubrica,
  id: 'rubrica-custom-1',
  code: 'BONUS',
  name: 'Bônus',
  isSystem: false,
};

// ─── GET /org/:orgId/payroll-rubricas ────────────────────────────────

describe('GET /org/:orgId/payroll-rubricas', () => {
  it('should return 200 with auto-seeded system rubricas on first access', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.hasRubricas.mockResolvedValue(false);
    mockedService.seedSystemRubricas.mockResolvedValue(undefined);
    mockedService.list.mockResolvedValue({ items: [mockRubrica], total: 1 });

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-rubricas`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.seedSystemRubricas).toHaveBeenCalledWith(ORG_ID, MANAGER_PAYLOAD.userId);
    expect(res.body.items).toHaveLength(1);
  });

  it('should not seed again when rubricas already exist', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.hasRubricas.mockResolvedValue(true);
    mockedService.list.mockResolvedValue({ items: [mockRubrica], total: 1 });

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-rubricas`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.seedSystemRubricas).not.toHaveBeenCalled();
  });

  it('should filter by rubricaType', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.hasRubricas.mockResolvedValue(true);
    mockedService.list.mockResolvedValue({ items: [mockRubrica], total: 1 });

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-rubricas?rubricaType=PROVENTO`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.list).toHaveBeenCalledWith(ORG_ID, expect.objectContaining({ rubricaType: 'PROVENTO' }));
  });

  it('should return 403 when FINANCIAL user tries to write (read is allowed)', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.hasRubricas.mockResolvedValue(true);
    mockedService.list.mockResolvedValue({ items: [], total: 0 });

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-rubricas`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
  });
});

// ─── GET /org/:orgId/payroll-rubricas/:id ────────────────────────────

describe('GET /org/:orgId/payroll-rubricas/:id', () => {
  it('should return single rubrica with all fields', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getById.mockResolvedValue(mockRubrica);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-rubricas/${RUBRICA_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe('SALARIO_BASE');
    expect(res.body.isSystem).toBe(true);
  });

  it('should return 404 when rubrica not found', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PayrollRubricaError } = jest.requireMock('./payroll-rubricas.service');
    mockedService.getById.mockRejectedValue(new PayrollRubricaError('Rubrica não encontrada', 404));

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-rubricas/nonexistent`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── POST /org/:orgId/payroll-rubricas ───────────────────────────────

describe('POST /org/:orgId/payroll-rubricas', () => {
  it('should create custom rubrica and return 201', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.create.mockResolvedValue(mockCustomRubrica);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/payroll-rubricas`)
      .set('Authorization', 'Bearer token')
      .send({
        code: 'BONUS',
        name: 'Bônus',
        rubricaType: 'PROVENTO',
        calculationType: 'FIXED_VALUE',
        incideINSS: true,
        incideFGTS: true,
        incideIRRF: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('BONUS');
  });

  it('should return 409 when code is duplicate', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PayrollRubricaError } = jest.requireMock('./payroll-rubricas.service');
    mockedService.create.mockRejectedValue(
      new PayrollRubricaError('Já existe uma rubrica com o código "BONUS"', 409),
    );

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/payroll-rubricas`)
      .set('Authorization', 'Bearer token')
      .send({ code: 'BONUS', name: 'Bônus', rubricaType: 'PROVENTO', calculationType: 'FIXED_VALUE' });

    expect(res.status).toBe(409);
  });

  it('should return 400 when calculationType is SYSTEM', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PayrollRubricaError } = jest.requireMock('./payroll-rubricas.service');
    mockedService.create.mockRejectedValue(
      new PayrollRubricaError('Não é permitido criar rubricas do tipo SYSTEM manualmente', 400),
    );

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/payroll-rubricas`)
      .set('Authorization', 'Bearer token')
      .send({ code: 'INSS2', name: 'INSS2', rubricaType: 'DESCONTO', calculationType: 'SYSTEM' });

    expect(res.status).toBe(400);
  });

  it('should return 403 when FINANCIAL user tries to create', async () => {
    authAs(FINANCIAL_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/payroll-rubricas`)
      .set('Authorization', 'Bearer token')
      .send({ code: 'BONUS', name: 'Bônus', rubricaType: 'PROVENTO', calculationType: 'FIXED_VALUE' });

    expect(res.status).toBe(403);
  });
});

// ─── PUT /org/:orgId/payroll-rubricas/:id ────────────────────────────

describe('PUT /org/:orgId/payroll-rubricas/:id', () => {
  it('should update custom rubrica and return 200', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.update.mockResolvedValue({ ...mockCustomRubrica, name: 'Bônus Atualizado' });

    const res = await request(app)
      .put(`/api/org/${ORG_ID}/payroll-rubricas/${mockCustomRubrica.id}`)
      .set('Authorization', 'Bearer token')
      .send({ name: 'Bônus Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Bônus Atualizado');
  });

  it('should return 403 when trying to edit system rubrica', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PayrollRubricaError } = jest.requireMock('./payroll-rubricas.service');
    mockedService.update.mockRejectedValue(
      new PayrollRubricaError('Rubrica de sistema não pode ser editada', 403),
    );

    const res = await request(app)
      .put(`/api/org/${ORG_ID}/payroll-rubricas/${RUBRICA_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ name: 'Novo Nome' });

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /org/:orgId/payroll-rubricas/:id/deactivate ───────────────

describe('PATCH /org/:orgId/payroll-rubricas/:id/deactivate', () => {
  it('should deactivate custom rubrica and return 200', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.deactivate.mockResolvedValue({ ...mockCustomRubrica, isActive: false });

    const res = await request(app)
      .patch(`/api/org/${ORG_ID}/payroll-rubricas/${mockCustomRubrica.id}/deactivate`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('should return 403 when trying to deactivate system rubrica', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PayrollRubricaError } = jest.requireMock('./payroll-rubricas.service');
    mockedService.deactivate.mockRejectedValue(
      new PayrollRubricaError('Rubrica de sistema não pode ser desativada', 403),
    );

    const res = await request(app)
      .patch(`/api/org/${ORG_ID}/payroll-rubricas/${RUBRICA_ID}/deactivate`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});
