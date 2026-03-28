import request from 'supertest';
import { app } from '../../app';
import * as workSchedulesService from './work-schedules.service';
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

jest.mock('./work-schedules.service', () => ({
  createWorkSchedule: jest.fn(),
  listWorkSchedules: jest.fn(),
  getWorkSchedule: jest.fn(),
  updateWorkSchedule: jest.fn(),
  deleteWorkSchedule: jest.fn(),
  seedTemplates: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(workSchedulesService);
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

const SAMPLE_SCHEDULE = {
  id: 'schedule-1',
  organizationId: 'org-1',
  name: '5x2 Padrao',
  type: 'FIXED' as const,
  workDays: [1, 2, 3, 4, 5],
  startTime: '07:00',
  endTime: '17:00',
  breakMinutes: 60,
  isTemplate: true,
  notes: null,
  contractsCount: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  authAs(MANAGER_PAYLOAD);
});

describe('POST /org/:orgId/work-schedules', () => {
  it('creates schedule — returns 201', async () => {
    mockedService.createWorkSchedule.mockResolvedValue(SAMPLE_SCHEDULE);

    const res = await request(app)
      .post('/api/org/org-1/work-schedules')
      .set('Authorization', 'Bearer token')
      .send({
        name: '5x2 Padrao',
        type: 'FIXED',
        workDays: [1, 2, 3, 4, 5],
        startTime: '07:00',
        endTime: '17:00',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('5x2 Padrao');
  });

  it('creates schedule with invalid workDays [7] — returns 400', async () => {
    const { WorkScheduleError } = jest.requireActual('./work-schedules.types') as {
      WorkScheduleError: new (msg: string, code: number) => Error & { statusCode: number };
    };
    mockedService.createWorkSchedule.mockRejectedValue(
      new WorkScheduleError(
        'workDays deve conter apenas valores entre 0 (domingo) e 6 (sábado)',
        400,
      ),
    );

    const res = await request(app)
      .post('/api/org/org-1/work-schedules')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Escala Inválida',
        type: 'FIXED',
        workDays: [7],
        startTime: '07:00',
        endTime: '17:00',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('0 (domingo) e 6 (sábado)');
  });

  it('creates schedule with duplicate name — returns 409', async () => {
    const { WorkScheduleError } = jest.requireActual('./work-schedules.types') as {
      WorkScheduleError: new (msg: string, code: number) => Error & { statusCode: number };
    };
    mockedService.createWorkSchedule.mockRejectedValue(
      new WorkScheduleError('Já existe uma escala com esse nome nesta organização', 409),
    );

    const res = await request(app)
      .post('/api/org/org-1/work-schedules')
      .set('Authorization', 'Bearer token')
      .send({
        name: '5x2 Padrao',
        type: 'FIXED',
        workDays: [1, 2, 3, 4, 5],
        startTime: '07:00',
        endTime: '17:00',
      });

    expect(res.status).toBe(409);
  });
});

describe('DELETE /org/:orgId/work-schedules/:id', () => {
  it('returns 400 when schedule is referenced by active contract', async () => {
    const { WorkScheduleError } = jest.requireActual('./work-schedules.types') as {
      WorkScheduleError: new (msg: string, code: number) => Error & { statusCode: number };
    };
    mockedService.deleteWorkSchedule.mockRejectedValue(
      new WorkScheduleError(
        'Esta escala está sendo usada em contratos ativos e não pode ser removida',
        400,
      ),
    );

    const res = await request(app)
      .delete('/api/org/org-1/work-schedules/schedule-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('contratos ativos');
  });
});

describe('POST /org/:orgId/work-schedules/seed-templates', () => {
  it('creates 4 templates', async () => {
    mockedService.seedTemplates.mockResolvedValue({ created: 4, skipped: 0 });

    const res = await request(app)
      .post('/api/org/org-1/work-schedules/seed-templates')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(4);
    expect(res.body.skipped).toBe(0);
  });
});

describe('GET /org/:orgId/work-schedules', () => {
  it('lists schedules with isTemplate filter', async () => {
    const result = {
      data: [SAMPLE_SCHEDULE],
      total: 1,
      page: 1,
      limit: 20,
    };
    mockedService.listWorkSchedules.mockResolvedValue(result);

    const res = await request(app)
      .get('/api/org/org-1/work-schedules?isTemplate=true')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockedService.listWorkSchedules).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ isTemplate: true }),
    );
  });
});
