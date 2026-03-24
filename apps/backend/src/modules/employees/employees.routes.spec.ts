import request from 'supertest';
import { app } from '../../app';
import * as employeesService from './employees.service';
import * as authService from '../auth/auth.service';
import { EmployeeError } from './employees.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./employees.service', () => ({
  createEmployee: jest.fn(),
  listEmployees: jest.fn(),
  getEmployee: jest.fn(),
  updateEmployee: jest.fn(),
  transitionEmployeeStatus: jest.fn(),
  addDependent: jest.fn(),
  removeDependent: jest.fn(),
  addFarmAssociation: jest.fn(),
  removeFarmAssociation: jest.fn(),
  uploadDocument: jest.fn(),
  deleteDocument: jest.fn(),
  getSalaryHistory: jest.fn(),
  createSalaryMovement: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(employeesService);
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

function authAs(payload: typeof ADMIN_PAYLOAD | typeof MANAGER_PAYLOAD): void {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

const ORG_ID = 'org-1';
const EMPLOYEE_ID = 'emp-1';
const FARM_ID = 'farm-1';

const mockEmployee = {
  id: EMPLOYEE_ID,
  organizationId: ORG_ID,
  name: 'João Silva',
  cpf: '52998224725',
  status: 'ATIVO',
  admissionDate: new Date('2025-01-01').toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── POST /org/:orgId/employees ──────────────────────────────────────

describe('POST /org/:orgId/employees', () => {
  it('should create employee with valid CPF and return 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createEmployee.mockResolvedValue({
      employee: mockEmployee,
      warnings: [],
    });

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees`)
      .set('Authorization', 'Bearer token')
      .send({
        name: 'João Silva',
        cpf: '529.982.247-25',
        birthDate: '1990-01-01',
        admissionDate: '2025-01-01',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('employee');
    expect(res.body.warnings).toEqual([]);
    expect(mockedService.createEmployee).toHaveBeenCalledTimes(1);
  });

  it('should return 400 when CPF is invalid', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createEmployee.mockRejectedValue(new EmployeeError('CPF inválido', 400));

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees`)
      .set('Authorization', 'Bearer token')
      .send({
        name: 'João Silva',
        cpf: '111.111.111-11',
        birthDate: '1990-01-01',
        admissionDate: '2025-01-01',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'CPF inválido');
  });

  it('should return 201 with warnings when PIS is invalid', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createEmployee.mockResolvedValue({
      employee: mockEmployee,
      warnings: ['PIS/PASEP com formato inválido — salvo mesmo assim, corrija depois'],
    });

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees`)
      .set('Authorization', 'Bearer token')
      .send({
        name: 'João Silva',
        cpf: '529.982.247-25',
        pisPassep: '00000000000',
        birthDate: '1990-01-01',
        admissionDate: '2025-01-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.warnings).toHaveLength(1);
    expect(res.body.warnings[0]).toContain('PIS/PASEP');
  });

  it('should return 409 when CPF already exists in org', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createEmployee.mockRejectedValue(
      new EmployeeError('Já existe um colaborador com este CPF nesta organização', 409),
    );

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees`)
      .set('Authorization', 'Bearer token')
      .send({
        name: 'João Silva',
        cpf: '529.982.247-25',
        birthDate: '1990-01-01',
        admissionDate: '2025-01-01',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('CPF');
  });
});

// ─── GET /org/:orgId/employees ───────────────────────────────────────

describe('GET /org/:orgId/employees', () => {
  it('should list employees with status filter', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listEmployees.mockResolvedValue({
      data: [mockEmployee],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/employees?status=ATIVO`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(mockedService.listEmployees).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      expect.objectContaining({ status: 'ATIVO' }),
    );
  });

  it('should list employees with name search', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listEmployees.mockResolvedValue({
      data: [mockEmployee],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/employees?search=João`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listEmployees).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: 'João' }),
    );
  });
});

// ─── GET /org/:orgId/employees/:id ───────────────────────────────────

describe('GET /org/:orgId/employees/:id', () => {
  it('should return employee detail with dependents, farms, documents', async () => {
    authAs(MANAGER_PAYLOAD);
    const fullEmployee = {
      ...mockEmployee,
      dependents: [{ id: 'dep-1', name: 'Maria Silva' }],
      farms: [{ id: 'ef-1', farm: { id: FARM_ID, name: 'Fazenda Verde' } }],
      documents: [{ id: 'doc-1', documentType: 'RG', fileName: 'rg.pdf' }],
      contracts: [],
      statusHistory: [],
      salaryHistory: [],
    };
    mockedService.getEmployee.mockResolvedValue(fullEmployee);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dependents');
    expect(res.body).toHaveProperty('farms');
    expect(res.body).toHaveProperty('documents');
  });
});

// ─── PATCH /org/:orgId/employees/:id/status ──────────────────────────

describe('PATCH /org/:orgId/employees/:id/status', () => {
  it('should transition ATIVO -> AFASTADO and return 200', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.transitionEmployeeStatus.mockResolvedValue({
      ...mockEmployee,
      status: 'AFASTADO',
    });

    const res = await request(app)
      .patch(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/status`)
      .set('Authorization', 'Bearer token')
      .send({ newStatus: 'AFASTADO', reason: 'Licença médica' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('AFASTADO');
  });

  it('should transition AFASTADO -> ATIVO and return 200', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.transitionEmployeeStatus.mockResolvedValue({
      ...mockEmployee,
      status: 'ATIVO',
    });

    const res = await request(app)
      .patch(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/status`)
      .set('Authorization', 'Bearer token')
      .send({ newStatus: 'ATIVO', reason: 'Retorno de licença' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ATIVO');
  });

  it('should return 400 when transitioning from DESLIGADO (terminal state)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.transitionEmployeeStatus.mockRejectedValue(
      new EmployeeError('Transição inválida: DESLIGADO → ATIVO. Transições permitidas: nenhuma (estado terminal)', 400),
    );

    const res = await request(app)
      .patch(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/status`)
      .set('Authorization', 'Bearer token')
      .send({ newStatus: 'ATIVO', reason: 'Tentativa de reativação' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('DESLIGADO');
  });

  it('should set terminationDate when transitioning ATIVO -> DESLIGADO', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.transitionEmployeeStatus.mockResolvedValue({
      ...mockEmployee,
      status: 'DESLIGADO',
      terminationDate: new Date().toISOString(),
    });

    const res = await request(app)
      .patch(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/status`)
      .set('Authorization', 'Bearer token')
      .send({ newStatus: 'DESLIGADO', reason: 'Pedido de demissão' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DESLIGADO');
    expect(res.body.terminationDate).toBeTruthy();
  });
});

// ─── POST /org/:orgId/employees/:id/dependents ───────────────────────

describe('POST /org/:orgId/employees/:id/dependents', () => {
  it('should return 400 when irrf=true but CPF is missing', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.addDependent.mockRejectedValue(
      new EmployeeError('CPF é obrigatório para dependentes marcados para IRRF ou salário família', 400),
    );

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/dependents`)
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Maria Silva',
        birthDate: '2010-01-01',
        relationship: 'Filha',
        irrf: true,
        // cpf missing
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('CPF');
  });

  it('should return 201 when irrf=true and CPF is provided', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.addDependent.mockResolvedValue({
      id: 'dep-1',
      name: 'Maria Silva',
      cpf: '529.982.247-25',
      irrf: true,
    });

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/dependents`)
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Maria Silva',
        cpf: '529.982.247-25',
        birthDate: '2010-01-01',
        relationship: 'Filha',
        irrf: true,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'dep-1');
  });
});

// ─── POST /org/:orgId/employees/:id/farms ────────────────────────────

describe('POST /org/:orgId/employees/:id/farms', () => {
  it('should add farm association and return 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.addFarmAssociation.mockResolvedValue({
      id: 'ef-1',
      employeeId: EMPLOYEE_ID,
      farmId: FARM_ID,
      startDate: new Date().toISOString(),
    });

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/farms`)
      .set('Authorization', 'Bearer token')
      .send({ farmId: FARM_ID, startDate: '2025-01-01' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('farmId', FARM_ID);
  });
});

// ─── POST /org/:orgId/employees/:id/documents ────────────────────────

describe('POST /org/:orgId/employees/:id/documents', () => {
  it('should return 201 and file saved to disk', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.uploadDocument.mockResolvedValue({
      id: 'doc-1',
      employeeId: EMPLOYEE_ID,
      documentType: 'RG',
      fileName: 'rg.pdf',
      filePath: 'uploads/employees/org-1/emp-1/rg.pdf',
    });

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/documents`)
      .set('Authorization', 'Bearer token')
      .field('documentType', 'RG')
      .attach('file', Buffer.from('mock pdf content'), { filename: 'rg.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('documentType', 'RG');
    expect(mockedService.uploadDocument).toHaveBeenCalledTimes(1);
  });
});

// ─── DELETE /org/:orgId/employees/:id/documents/:docId ───────────────

describe('DELETE /org/:orgId/employees/:id/documents/:docId', () => {
  it('should return 204 when document deleted', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteDocument.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/documents/doc-1`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(mockedService.deleteDocument).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      'doc-1',
    );
  });
});
