import request from 'supertest';
import { app } from '../../app';
import * as movementsService from './employee-movements.service';
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

jest.mock('./employee-movements.service', () => ({
  createMovement: jest.fn(),
  listMovements: jest.fn(),
  getTimeline: jest.fn(),
  bulkSalaryAdjustment: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(movementsService);
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

const SAMPLE_MOVEMENT = {
  id: 'movement-1',
  employeeId: 'employee-1',
  employeeName: 'João Silva',
  movementType: 'SALARY_ADJUSTMENT' as const,
  effectiveAt: '2024-06-01T00:00:00.000Z',
  fromValue: '3000',
  toValue: '3300',
  reason: 'Reajuste por mérito',
  approvedBy: null,
  createdBy: 'user-1',
  createdAt: '2024-06-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  authAs(MANAGER_PAYLOAD);
});

describe('POST /org/:orgId/employee-movements', () => {
  it('creates SALARY_ADJUSTMENT movement — returns 201 with both EmployeeMovement and EmployeeSalaryHistory', async () => {
    mockedService.createMovement.mockResolvedValue(SAMPLE_MOVEMENT);

    const res = await request(app)
      .post('/api/org/org-1/employee-movements')
      .set('Authorization', 'Bearer token')
      .send({
        employeeId: 'employee-1',
        movementType: 'SALARY_ADJUSTMENT',
        effectiveAt: '2024-06-01',
        fromValue: '3000',
        toValue: '3300',
        reason: 'Reajuste por mérito',
      });

    expect(res.status).toBe(201);
    expect(res.body.movementType).toBe('SALARY_ADJUSTMENT');
    expect(mockedService.createMovement).toHaveBeenCalledTimes(1);
  });

  it('creates PROMOTION movement — returns 201', async () => {
    const promotionMovement = {
      ...SAMPLE_MOVEMENT,
      id: 'movement-2',
      movementType: 'PROMOTION' as const,
      reason: 'Promoção para coordenador',
    };
    mockedService.createMovement.mockResolvedValue(promotionMovement);

    const res = await request(app)
      .post('/api/org/org-1/employee-movements')
      .set('Authorization', 'Bearer token')
      .send({
        employeeId: 'employee-1',
        movementType: 'PROMOTION',
        effectiveAt: '2024-06-01',
        reason: 'Promoção para coordenador',
      });

    expect(res.status).toBe(201);
    expect(res.body.movementType).toBe('PROMOTION');
  });
});

describe('GET /org/:orgId/employee-movements/timeline/:employeeId', () => {
  it('returns merged movements + status history sorted by date', async () => {
    const timeline = [
      {
        type: 'movement',
        date: '2024-06-01T00:00:00.000Z',
        movementType: 'SALARY_ADJUSTMENT',
        reason: 'Reajuste',
        fromValue: '3000',
        toValue: '3300',
      },
      {
        type: 'status',
        date: '2024-03-01T00:00:00.000Z',
        fromStatus: 'ATIVO',
        toStatus: 'AFASTADO',
        reason: 'Atestado médico',
      },
      {
        type: 'status',
        date: '2024-04-01T00:00:00.000Z',
        fromStatus: 'AFASTADO',
        toStatus: 'ATIVO',
        reason: 'Retorno',
      },
    ];
    mockedService.getTimeline.mockResolvedValue(timeline);

    const res = await request(app)
      .get('/api/org/org-1/employee-movements/timeline/employee-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    // First entry should be most recent (June)
    expect(res.body[0].date).toBe('2024-06-01T00:00:00.000Z');
  });
});

describe('POST /org/:orgId/employees/bulk-salary-adjustment', () => {
  it('bulk salary adjustment with 5% percentage — updates all matching employees atomically', async () => {
    mockedService.bulkSalaryAdjustment.mockResolvedValue({ updated: 5, errors: [] });

    const res = await request(app)
      .post('/api/org/org-1/employees/bulk-salary-adjustment')
      .set('Authorization', 'Bearer token')
      .send({
        percentage: 5,
        reason: 'Reajuste coletivo 2024',
        effectiveAt: '2024-01-01',
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(5);
    expect(res.body.errors).toHaveLength(0);
  });

  it('bulk salary adjustment with fixedAmount 200 — updates correctly', async () => {
    mockedService.bulkSalaryAdjustment.mockResolvedValue({ updated: 3, errors: [] });

    const res = await request(app)
      .post('/api/org/org-1/employees/bulk-salary-adjustment')
      .set('Authorization', 'Bearer token')
      .send({
        fixedAmount: 200,
        reason: 'Piso mínimo regional',
        effectiveAt: '2024-01-01',
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(3);
  });

  it('bulk salary adjustment with no matching employees — returns updated: 0', async () => {
    mockedService.bulkSalaryAdjustment.mockResolvedValue({ updated: 0, errors: [] });

    const res = await request(app)
      .post('/api/org/org-1/employees/bulk-salary-adjustment')
      .set('Authorization', 'Bearer token')
      .send({
        positionId: 'nonexistent-position',
        percentage: 5,
        reason: 'Sem colaboradores nesta função',
        effectiveAt: '2024-01-01',
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(0);
  });
});
