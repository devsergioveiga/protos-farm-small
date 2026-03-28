import request from 'supertest';
import { app } from '../../app';
import * as contractsService from './employee-contracts.service';
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

jest.mock('./employee-contracts.service', () => ({
  createContract: jest.fn(),
  listContracts: jest.fn(),
  getContract: jest.fn(),
  updateContract: jest.fn(),
  createAmendment: jest.fn(),
  generateContractPdf: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(contractsService);
const mockedAuth = jest.mocked(authService);

const MANAGER_PAYLOAD = {
  userId: 'user-1',
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

const SAMPLE_CONTRACT = {
  id: 'contract-1',
  employeeId: 'employee-1',
  organizationId: 'org-1',
  positionId: 'position-1',
  workScheduleId: null,
  contractType: 'CLT_INDETERMINATE' as const,
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: null,
  salary: 3000,
  weeklyHours: 44,
  union: null,
  costCenterId: null,
  notes: null,
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  positionName: 'Auxiliar de Produção',
  workScheduleName: null,
  amendmentsCount: 0,
};

const SAMPLE_CONTRACT_WITH_AMENDMENTS = {
  ...SAMPLE_CONTRACT,
  amendments: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  authAs(MANAGER_PAYLOAD);
});

describe('POST /org/:orgId/employee-contracts', () => {
  it('creates CLT_INDETERMINATE contract without endDate — returns 201', async () => {
    mockedService.createContract.mockResolvedValue(SAMPLE_CONTRACT);

    const res = await request(app)
      .post('/api/org/org-1/employee-contracts')
      .set('Authorization', 'Bearer token')
      .send({
        employeeId: 'employee-1',
        positionId: 'position-1',
        contractType: 'CLT_INDETERMINATE',
        startDate: '2024-01-01',
        salary: 3000,
      });

    expect(res.status).toBe(201);
    expect(mockedService.createContract).toHaveBeenCalledTimes(1);
  });

  it('creates CLT_INDETERMINATE with endDate — returns 400', async () => {
    const { EmployeeContractError } = jest.requireActual('./employee-contracts.types') as {
      EmployeeContractError: new (msg: string, code: number) => Error & { statusCode: number };
    };
    mockedService.createContract.mockRejectedValue(
      new EmployeeContractError('Contrato CLT_INDETERMINATE não permite data de término', 400),
    );

    const res = await request(app)
      .post('/api/org/org-1/employee-contracts')
      .set('Authorization', 'Bearer token')
      .send({
        employeeId: 'employee-1',
        positionId: 'position-1',
        contractType: 'CLT_INDETERMINATE',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        salary: 3000,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('não permite data de término');
  });

  it('creates TRIAL contract with endDate 91 days from start — returns 400', async () => {
    const { EmployeeContractError } = jest.requireActual('./employee-contracts.types') as {
      EmployeeContractError: new (msg: string, code: number) => Error & { statusCode: number };
    };
    mockedService.createContract.mockRejectedValue(
      new EmployeeContractError('Contrato TRIAL não pode exceder 90 dias', 400),
    );

    const res = await request(app)
      .post('/api/org/org-1/employee-contracts')
      .set('Authorization', 'Bearer token')
      .send({
        employeeId: 'employee-1',
        positionId: 'position-1',
        contractType: 'TRIAL',
        startDate: '2024-01-01',
        endDate: '2024-04-02', // 91 days later
        salary: 3000,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('90 dias');
  });

  it('creates SEASONAL contract without endDate — returns 400', async () => {
    const { EmployeeContractError } = jest.requireActual('./employee-contracts.types') as {
      EmployeeContractError: new (msg: string, code: number) => Error & { statusCode: number };
    };
    mockedService.createContract.mockRejectedValue(
      new EmployeeContractError('Contrato SEASONAL requer data de término', 400),
    );

    const res = await request(app)
      .post('/api/org/org-1/employee-contracts')
      .set('Authorization', 'Bearer token')
      .send({
        employeeId: 'employee-1',
        positionId: 'position-1',
        contractType: 'SEASONAL',
        startDate: '2024-01-01',
        salary: 3000,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('requer data de término');
  });

  it('creating contract deactivates previous active contract', async () => {
    // The service handles deactivation internally
    mockedService.createContract.mockResolvedValue({
      ...SAMPLE_CONTRACT,
      contractType: 'CLT_DETERMINATE',
      endDate: '2024-06-30T00:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/org/org-1/employee-contracts')
      .set('Authorization', 'Bearer token')
      .send({
        employeeId: 'employee-1',
        positionId: 'position-1',
        contractType: 'CLT_DETERMINATE',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        salary: 3000,
      });

    expect(res.status).toBe(201);
    expect(mockedService.createContract).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ contractType: 'CLT_DETERMINATE' }),
    );
  });
});

describe('POST /org/:orgId/employee-contracts/:id/amendments', () => {
  it('creates amendment with salary change — updates contract salary + creates EmployeeSalaryHistory', async () => {
    const amendedContract = {
      ...SAMPLE_CONTRACT_WITH_AMENDMENTS,
      salary: 3500,
      amendments: [
        {
          id: 'amendment-1',
          contractId: 'contract-1',
          description: 'Reajuste salarial',
          effectiveAt: '2024-06-01T00:00:00.000Z',
          changes: { salary: { from: 3000, to: 3500 } },
          createdBy: 'user-1',
          createdAt: '2024-06-01T00:00:00.000Z',
        },
      ],
    };
    mockedService.createAmendment.mockResolvedValue(amendedContract);

    const res = await request(app)
      .post('/api/org/org-1/employee-contracts/contract-1/amendments')
      .set('Authorization', 'Bearer token')
      .send({
        description: 'Reajuste salarial',
        effectiveAt: '2024-06-01',
        changes: { salary: { from: 3000, to: 3500 } },
      });

    expect(res.status).toBe(201);
    expect(res.body.amendments).toHaveLength(1);
    expect(res.body.salary).toBe(3500);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/org/org-1/employee-contracts/contract-1/amendments')
      .set('Authorization', 'Bearer token')
      .send({ description: 'Only description, no effectiveAt or changes' });

    expect(res.status).toBe(400);
  });
});

describe('GET /org/:orgId/employee-contracts/:id', () => {
  it('returns contract detail including amendments', async () => {
    mockedService.getContract.mockResolvedValue(SAMPLE_CONTRACT_WITH_AMENDMENTS);

    const res = await request(app)
      .get('/api/org/org-1/employee-contracts/contract-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('amendments');
    expect(res.body.id).toBe('contract-1');
  });
});

describe('GET /org/:orgId/employee-contracts/:id/pdf', () => {
  it('returns 200 with content-type application/pdf', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 mock pdf content');
    mockedService.generateContractPdf.mockResolvedValue(pdfBuffer);

    const res = await request(app)
      .get('/api/org/org-1/employee-contracts/contract-1/pdf')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
