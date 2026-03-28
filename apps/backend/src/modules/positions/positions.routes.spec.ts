import request from 'supertest';
import { app } from '../../app';
import * as positionsService from './positions.service';
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

jest.mock('./positions.service', () => ({
  createPosition: jest.fn(),
  listPositions: jest.fn(),
  getPosition: jest.fn(),
  updatePosition: jest.fn(),
  setSalaryBands: jest.fn(),
  getStaffingView: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(positionsService);
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

const SAMPLE_POSITION = {
  id: 'position-1',
  organizationId: 'org-1',
  name: 'Auxiliar de Produção',
  cbo: '612710',
  description: null,
  additionalTypes: [],
  isActive: true,
  salaryBandsCount: 0,
  employeeCount: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  authAs(MANAGER_PAYLOAD);
});

describe('POST /org/:orgId/positions', () => {
  it('creates position with valid CBO — returns 201', async () => {
    mockedService.createPosition.mockResolvedValue(SAMPLE_POSITION);

    const res = await request(app)
      .post('/api/org/org-1/positions')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Auxiliar de Produção', cbo: '612710' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Auxiliar de Produção');
    expect(res.body.cbo).toBe('612710');
  });

  it('creates position with invalid CBO (5 digits) — returns 400', async () => {
    const { PositionError } = jest.requireActual('./positions.types') as {
      PositionError: new (msg: string, code: number) => Error & { statusCode: number };
    };
    mockedService.createPosition.mockRejectedValue(
      new PositionError('CBO deve ter exatamente 6 dígitos numéricos', 400),
    );

    const res = await request(app)
      .post('/api/org/org-1/positions')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Auxiliar de Produção', cbo: '61271' }); // 5 digits

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('6 dígitos');
  });

  it('creates duplicate name in same org — returns 409', async () => {
    const { PositionError } = jest.requireActual('./positions.types') as {
      PositionError: new (msg: string, code: number) => Error & { statusCode: number };
    };
    mockedService.createPosition.mockRejectedValue(
      new PositionError('Já existe um cargo com esse nome nesta organização', 409),
    );

    const res = await request(app)
      .post('/api/org/org-1/positions')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Auxiliar de Produção' });

    expect(res.status).toBe(409);
  });
});

describe('PUT /org/:orgId/positions/:id/salary-bands', () => {
  it('sets JUNIOR/PLENO/SENIOR salary bands', async () => {
    const bands: import('./positions.types').SalaryBandOutput[] = [
      { id: 'band-1', positionId: 'position-1', level: 'JUNIOR', minSalary: 2000, maxSalary: 3000 },
      { id: 'band-2', positionId: 'position-1', level: 'PLENO', minSalary: 3000, maxSalary: 4500 },
      { id: 'band-3', positionId: 'position-1', level: 'SENIOR', minSalary: 4500, maxSalary: 7000 },
    ];
    mockedService.setSalaryBands.mockResolvedValue(bands);

    const res = await request(app)
      .put('/api/org/org-1/positions/position-1/salary-bands')
      .set('Authorization', 'Bearer token')
      .send([
        { level: 'JUNIOR', minSalary: 2000, maxSalary: 3000 },
        { level: 'PLENO', minSalary: 3000, maxSalary: 4500 },
        { level: 'SENIOR', minSalary: 4500, maxSalary: 7000 },
      ]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].level).toBe('JUNIOR');
  });

  it('returns 400 when body is not an array', async () => {
    const res = await request(app)
      .put('/api/org/org-1/positions/position-1/salary-bands')
      .set('Authorization', 'Bearer token')
      .send({ level: 'JUNIOR', minSalary: 2000, maxSalary: 3000 });

    expect(res.status).toBe(400);
  });
});

describe('GET /org/:orgId/positions/staffing-view', () => {
  it('returns aggregated counts by position and farm', async () => {
    const staffingView = [
      {
        positionId: 'position-1',
        positionName: 'Auxiliar de Produção',
        cbo: '612710',
        totalEmployees: 5,
        byFarm: [
          { farmId: 'farm-1', farmName: 'Fazenda São João', count: 3 },
          { farmId: 'farm-2', farmName: 'Fazenda Santa Maria', count: 2 },
        ],
      },
    ];
    mockedService.getStaffingView.mockResolvedValue(staffingView);

    const res = await request(app)
      .get('/api/org/org-1/positions/staffing-view')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].totalEmployees).toBe(5);
    expect(res.body[0].byFarm).toHaveLength(2);
  });
});

describe('GET /org/:orgId/positions', () => {
  it('lists positions with search filter', async () => {
    const result = {
      data: [SAMPLE_POSITION],
      total: 1,
      page: 1,
      limit: 20,
    };
    mockedService.listPositions.mockResolvedValue(result);

    const res = await request(app)
      .get('/api/org/org-1/positions?search=Auxiliar')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockedService.listPositions).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ search: 'Auxiliar' }),
    );
  });
});
