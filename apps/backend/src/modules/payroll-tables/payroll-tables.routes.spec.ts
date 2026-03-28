import request from 'supertest';
import { app } from '../../app';
import * as payrollTablesService from './payroll-tables.service';
import * as authService from '../auth/auth.service';
import type { LegalTableOutput } from './payroll-tables.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./payroll-tables.service', () => ({
  payrollTablesService: {
    list: jest.fn(),
    getEffective: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
  },
  PayrollTableError: class PayrollTableError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.name = 'PayrollTableError';
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

const mockedService = jest.mocked(payrollTablesService.payrollTablesService);
const mockedAuth = jest.mocked(authService);

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: 'org-1',
};

function authAs(payload: typeof MANAGER_PAYLOAD): void {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

const ORG_ID = 'org-1';
const TABLE_ID = 'table-1';

const mockBracket = {
  id: 'bracket-1',
  fromValue: '0.00',
  upTo: '2259.20',
  rate: '0.075',
  deduction: null,
  order: 1,
};

const mockScalar = {
  id: 'scalar-1',
  key: 'CEILING',
  value: '8475.55',
};

const mockTable = {
  id: TABLE_ID,
  organizationId: null,
  tableType: 'INSS' as const,
  stateCode: null,
  effectiveFrom: new Date('2026-01-01'),
  notes: null,
  createdBy: 'seed',
  createdAt: new Date(),
  brackets: [mockBracket],
  scalarValues: [mockScalar],
} as unknown as LegalTableOutput;

// ─── GET /org/:orgId/payroll-tables ──────────────────────────────────

describe('GET /org/:orgId/payroll-tables', () => {
  it('should return list including global seed tables', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.list.mockResolvedValue([mockTable]);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-tables`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tableType).toBe('INSS');
  });

  it('should filter by tableType=INSS', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.list.mockResolvedValue([mockTable]);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-tables?tableType=INSS`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.list).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ tableType: 'INSS' }),
    );
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app).get(`/api/org/${ORG_ID}/payroll-tables`);
    expect(res.status).toBe(401);
  });
});

// ─── GET /org/:orgId/payroll-tables/effective ─────────────────────────

describe('GET /org/:orgId/payroll-tables/effective', () => {
  it('should return 2026 INSS table for competenceDate=2026-03-01', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getEffective.mockResolvedValue(mockTable);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-tables/effective?tableType=INSS&competenceDate=2026-03-01`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.tableType).toBe('INSS');
    expect(mockedService.getEffective).toHaveBeenCalledWith(ORG_ID, 'INSS', expect.any(Date));
  });

  it('should return most recent applicable table for future date', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getEffective.mockResolvedValue(mockTable);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-tables/effective?tableType=INSS&competenceDate=2027-06-01`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
  });

  it('should return 400 when tableType is missing', async () => {
    authAs(MANAGER_PAYLOAD);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-tables/effective?competenceDate=2026-03-01`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tableType/);
  });

  it('should return 400 when competenceDate is missing', async () => {
    authAs(MANAGER_PAYLOAD);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-tables/effective?tableType=INSS`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/competenceDate/);
  });

  it('should return 404 when no table found for date', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getEffective.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-tables/effective?tableType=INSS&competenceDate=2000-01-01`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── GET /org/:orgId/payroll-tables/:id ──────────────────────────────

describe('GET /org/:orgId/payroll-tables/:id', () => {
  it('should return table with brackets and scalarValues', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getById.mockResolvedValue(mockTable);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-tables/${TABLE_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.brackets).toHaveLength(1);
    expect(res.body.scalarValues).toHaveLength(1);
  });

  it('should return 404 when table not found', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PayrollTableError } = jest.requireMock('./payroll-tables.service');
    mockedService.getById.mockRejectedValue(new PayrollTableError('Tabela não encontrada', 404));

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/payroll-tables/nonexistent`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── POST /org/:orgId/payroll-tables ─────────────────────────────────

describe('POST /org/:orgId/payroll-tables', () => {
  it('should create org-specific table version with brackets and scalars, return 201', async () => {
    authAs(MANAGER_PAYLOAD);
    const orgTable = { ...mockTable, organizationId: ORG_ID };
    mockedService.create.mockResolvedValue(orgTable);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/payroll-tables`)
      .set('Authorization', 'Bearer token')
      .send({
        tableType: 'INSS',
        effectiveFrom: '2026-01-01',
        brackets: [{ fromValue: 0, upTo: 2259.2, rate: 0.075, order: 1 }],
        scalarValues: [{ key: 'CEILING', value: 8475.55 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.tableType).toBe('INSS');
  });

  it('should return 400 when effectiveFrom is not first day of month', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PayrollTableError } = jest.requireMock('./payroll-tables.service');
    mockedService.create.mockRejectedValue(
      new PayrollTableError('A data de vigência deve ser o primeiro dia do mês', 400),
    );

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/payroll-tables`)
      .set('Authorization', 'Bearer token')
      .send({ tableType: 'INSS', effectiveFrom: '2026-01-15' });

    expect(res.status).toBe(400);
  });

  it('should return 409 when duplicate tableType+effectiveFrom for same org', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PayrollTableError } = jest.requireMock('./payroll-tables.service');
    mockedService.create.mockRejectedValue(
      new PayrollTableError('Já existe uma tabela do tipo INSS com vigência em 2026-01-01', 409),
    );

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/payroll-tables`)
      .set('Authorization', 'Bearer token')
      .send({ tableType: 'INSS', effectiveFrom: '2026-01-01' });

    expect(res.status).toBe(409);
  });
});
