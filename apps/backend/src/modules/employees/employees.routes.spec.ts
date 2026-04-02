import request from 'supertest';
import { app } from '../../app';
import * as employeesService from './employees.service';
import * as employeesBulkImportService from './employee-bulk-import.service';
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
  assignFunction: jest.fn(),
  removeFunction: jest.fn(),
  listEmployeesByFunction: jest.fn(),
}));

jest.mock('./employee-bulk-import.service', () => ({
  uploadAndParse: jest.fn(),
  previewBulkImport: jest.fn(),
  confirmBulkImport: jest.fn(),
  generateTemplate: jest.fn(),
  isValidCPF: jest.fn(),
  isValidPIS: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(employeesService);
const mockedBulkService = jest.mocked(employeesBulkImportService);
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
      new EmployeeError(
        'Transição inválida: DESLIGADO → ATIVO. Transições permitidas: nenhuma (estado terminal)',
        400,
      ),
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
      new EmployeeError(
        'CPF é obrigatório para dependentes marcados para IRRF ou salário família',
        400,
      ),
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
      .attach('file', Buffer.from('mock pdf content'), {
        filename: 'rg.pdf',
        contentType: 'application/pdf',
      });

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

// ─── GET /org/:orgId/employees/bulk/template ─────────────────────────

describe('GET /org/:orgId/employees/bulk/template', () => {
  it('should return 200 with xlsx content-type', async () => {
    authAs(MANAGER_PAYLOAD);
    // Return a minimal XLSX-like buffer
    mockedBulkService.generateTemplate.mockResolvedValue(Buffer.from('PK\x03\x04xlsx mock'));

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/employees/bulk/template`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(mockedBulkService.generateTemplate).toHaveBeenCalledTimes(1);
  });
});

// ─── POST /org/:orgId/employees/bulk/upload ───────────────────────────

describe('POST /org/:orgId/employees/bulk/upload', () => {
  it('should parse CSV file and return column headers and rows', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedBulkService.uploadAndParse.mockResolvedValue({
      columnHeaders: ['nome', 'cpf', 'data_nascimento', 'data_admissao'],
      sampleRows: [
        {
          nome: 'João Silva',
          cpf: '529.982.247-25',
          data_nascimento: '1990-01-01',
          data_admissao: '2025-01-01',
        },
      ],
      totalRows: 1,
    });

    const csvContent =
      'nome,cpf,data_nascimento,data_admissao\nJoão Silva,529.982.247-25,1990-01-01,2025-01-01';

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/bulk/upload`)
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(csvContent), { filename: 'test.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('columnHeaders');
    expect(res.body).toHaveProperty('totalRows', 1);
    expect(mockedBulkService.uploadAndParse).toHaveBeenCalledTimes(1);
  });

  it('should return 400 when no file is uploaded', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/bulk/upload`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Nenhum arquivo enviado');
  });
});

// ─── POST /org/:orgId/employees/bulk/preview ──────────────────────────

describe('POST /org/:orgId/employees/bulk/preview', () => {
  it('should validate rows and return error/warning/valid counts', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedBulkService.previewBulkImport.mockResolvedValue({
      validRows: [
        { rowNumber: 2, status: 'valid', messages: [], data: { name: 'João', cpf: '52998224725' } },
      ],
      errorRows: [{ rowNumber: 3, status: 'error', messages: ['CPF inválido'], data: {} }],
      warningRows: [
        {
          rowNumber: 4,
          status: 'warning',
          messages: ['PIS/PASEP parece inválido'],
          data: { name: 'Maria' },
        },
      ],
      totalRows: 3,
    });

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/bulk/preview`)
      .set('Authorization', 'Bearer token')
      .send({
        rows: [
          { nome: 'João', cpf: '529.982.247-25' },
          { nome: 'Inválido', cpf: '111.111.111-11' },
          { nome: 'Maria', cpf: '529.982.247-25' },
        ],
        columnMapping: { nome: 'name', cpf: 'cpf' },
      });

    expect(res.status).toBe(200);
    expect(res.body.validRows).toHaveLength(1);
    expect(res.body.errorRows).toHaveLength(1);
    expect(res.body.warningRows).toHaveLength(1);
    expect(res.body.totalRows).toBe(3);
  });

  it('should mark row as error when CPF is invalid', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedBulkService.previewBulkImport.mockResolvedValue({
      validRows: [],
      errorRows: [{ rowNumber: 2, status: 'error', messages: ['CPF inválido'], data: {} }],
      warningRows: [],
      totalRows: 1,
    });

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/bulk/preview`)
      .set('Authorization', 'Bearer token')
      .send({
        rows: [{ nome: 'Inválido', cpf: '111.111.111-11' }],
        columnMapping: { nome: 'name', cpf: 'cpf' },
      });

    expect(res.status).toBe(200);
    expect(res.body.errorRows[0].messages).toContain('CPF inválido');
    expect(res.body.validRows).toHaveLength(0);
  });

  it('should mark row as warning (not error) when PIS is invalid', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedBulkService.previewBulkImport.mockResolvedValue({
      validRows: [],
      errorRows: [],
      warningRows: [
        {
          rowNumber: 2,
          status: 'warning',
          messages: ['PIS/PASEP parece inválido'],
          data: { name: 'João', cpf: '52998224725' },
        },
      ],
      totalRows: 1,
    });

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/bulk/preview`)
      .set('Authorization', 'Bearer token')
      .send({
        rows: [{ nome: 'João', cpf: '529.982.247-25', pis_pasep: '00000000000' }],
        columnMapping: { nome: 'name', cpf: 'cpf', pis_pasep: 'pis_pasep' },
      });

    expect(res.status).toBe(200);
    expect(res.body.errorRows).toHaveLength(0);
    expect(res.body.warningRows[0].messages).toContain('PIS/PASEP parece inválido');
  });
});

// ─── POST /org/:orgId/employees/bulk/confirm ──────────────────────────

describe('POST /org/:orgId/employees/bulk/confirm', () => {
  it('should create employees in batch and return created count', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedBulkService.confirmBulkImport.mockResolvedValue({
      created: 2,
      errors: [],
    });

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/bulk/confirm`)
      .set('Authorization', 'Bearer token')
      .send({
        rows: [
          {
            rowNumber: 2,
            name: 'João Silva',
            cpf: '52998224725',
            birthDate: '1990-01-01',
            admissionDate: '2025-01-01',
          },
          {
            rowNumber: 3,
            name: 'Maria Santos',
            cpf: '11144477735',
            birthDate: '1992-05-10',
            admissionDate: '2025-02-01',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.errors).toHaveLength(0);
    expect(mockedBulkService.confirmBulkImport).toHaveBeenCalledTimes(1);
  });
});

// ─── Employee Functions ──────────────────────────────────────────────

describe('POST /api/org/:orgId/employees/:id/functions', () => {
  it('should assign a function and return 201', async () => {
    authAs(ADMIN_PAYLOAD);
    const assignment = {
      id: 'fa-1',
      function: 'INSEMINATOR' as const,
      assignedAt: '2026-04-01T00:00:00.000Z',
    };
    mockedService.assignFunction.mockResolvedValue(assignment);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/functions`)
      .set('Authorization', 'Bearer tok')
      .send({ function: 'INSEMINATOR' });

    expect(res.status).toBe(201);
    expect(res.body.function).toBe('INSEMINATOR');
    expect(mockedService.assignFunction).toHaveBeenCalledWith(
      { organizationId: ORG_ID, userId: 'admin-1' },
      EMPLOYEE_ID,
      { function: 'INSEMINATOR' },
    );
  });

  it('should return 409 when function already assigned', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.assignFunction.mockRejectedValue(
      new EmployeeError('Colaborador já possui esta função atribuída', 409),
    );

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/functions`)
      .set('Authorization', 'Bearer tok')
      .send({ function: 'INSEMINATOR' });

    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/org/:orgId/employees/:id/functions/:function', () => {
  it('should remove a function and return 204', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.removeFunction.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/functions/INSEMINATOR`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
    expect(mockedService.removeFunction).toHaveBeenCalledWith(
      { organizationId: ORG_ID, userId: 'admin-1' },
      EMPLOYEE_ID,
      'INSEMINATOR',
    );
  });

  it('should return 404 when function not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.removeFunction.mockRejectedValue(
      new EmployeeError('Função não encontrada para este colaborador', 404),
    );

    const res = await request(app)
      .delete(`/api/org/${ORG_ID}/employees/${EMPLOYEE_ID}/functions/TRACTOR_DRIVER`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });
});

describe('GET /api/org/:orgId/employees/by-function/:function', () => {
  it('should list employees by function', async () => {
    authAs(ADMIN_PAYLOAD);
    const employees = [
      { id: 'emp-1', name: 'João Inseminador' },
      { id: 'emp-2', name: 'Maria Inseminadora' },
    ];
    mockedService.listEmployeesByFunction.mockResolvedValue(employees);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/employees/by-function/INSEMINATOR?farmId=${FARM_ID}`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('João Inseminador');
    expect(mockedService.listEmployeesByFunction).toHaveBeenCalledWith(
      { organizationId: ORG_ID, userId: 'admin-1' },
      'INSEMINATOR',
      FARM_ID,
    );
  });

  it('should return 400 for invalid function', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listEmployeesByFunction.mockRejectedValue(
      new EmployeeError('Função inválida: INVALID', 400),
    );

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/employees/by-function/INVALID`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(400);
  });
});
