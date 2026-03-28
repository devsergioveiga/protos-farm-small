import request from 'supertest';
import { app } from '../../app';
import * as timeEntriesService from './time-entries.service';
import * as overtimeBankService from '../overtime-bank/overtime-bank.service';
import * as authService from '../auth/auth.service';
import { TimeEntryError } from './time-entries.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./time-entries.service', () => ({
  createTimeEntry: jest.fn(),
  listTimeEntries: jest.fn(),
  getTimeEntry: jest.fn(),
  updateTimeEntry: jest.fn(),
  addActivity: jest.fn(),
  addTeamActivity: jest.fn(),
}));

jest.mock('../overtime-bank/overtime-bank.service', () => ({
  getOvertimeBankSummary: jest.fn(),
  listOvertimeBankEntries: jest.fn(),
  createOvertimeBankEntry: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(timeEntriesService);
const mockedOvertimeService = jest.mocked(overtimeBankService);
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
const EMP_ID = 'emp-1';
const ENTRY_ID = 'entry-1';
const TEAM_ID = 'team-1';

const SAMPLE_ENTRY = {
  id: ENTRY_ID,
  employeeId: EMP_ID,
  employeeName: 'João Silva',
  farmId: 'farm-1',
  farmName: 'Fazenda Boa Vista',
  date: '2026-03-01',
  clockIn: '2026-03-01T07:00:00.000Z',
  breakStart: null,
  breakEnd: null,
  clockOut: '2026-03-01T17:00:00.000Z',
  workedMinutes: 600,
  nightMinutes: 0,
  outOfRange: false,
  noBoundary: false,
  latitude: null,
  longitude: null,
  source: 'MOBILE' as const,
  managerNote: null,
  timesheetId: null,
  payrollRunId: null,
  activities: [],
  createdBy: 'manager-1',
  createdAt: '2026-03-01T07:00:00.000Z',
};

// Test 1: POST /org/:orgId/employees/:empId/time-entries returns 201
describe('POST /org/:orgId/employees/:empId/time-entries', () => {
  it('creates a time entry and returns 201 with TimeEntryOutput', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTimeEntry.mockResolvedValue(SAMPLE_ENTRY);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/${EMP_ID}/time-entries`)
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        date: '2026-03-01',
        clockIn: '2026-03-01T07:00:00.000Z',
        clockOut: '2026-03-01T17:00:00.000Z',
        source: 'MOBILE',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', ENTRY_ID);
    expect(res.body).toHaveProperty('employeeName', 'João Silva');
    expect(mockedService.createTimeEntry).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      ORG_ID,
      EMP_ID,
      expect.any(Object),
    );
  });
});

// Test 2: POST with MANAGER source without managerNote returns 400
describe('POST /org/:orgId/employees/:empId/time-entries - MANAGER source validation', () => {
  it('returns 400 when source is MANAGER but managerNote is missing', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTimeEntry.mockRejectedValue(
      new TimeEntryError(
        'managerNote obrigatório para lançamentos manuais (mínimo 10 caracteres)',
        400,
      ),
    );

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/${EMP_ID}/time-entries`)
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        date: '2026-03-01',
        clockIn: '2026-03-01T07:00:00.000Z',
        source: 'MANAGER',
      });

    expect(res.status).toBe(400);
  });
});

// Test 3: POST returns 409 when month is LOCKED
describe('POST /org/:orgId/employees/:empId/time-entries - locked month', () => {
  it('returns 409 when timesheet month is LOCKED', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTimeEntry.mockRejectedValue(
      new TimeEntryError('Folha de ponto fechada para folha de pagamento — edição bloqueada', 409),
    );

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/employees/${EMP_ID}/time-entries`)
      .set('Authorization', 'Bearer token')
      .send({
        farmId: 'farm-1',
        date: '2026-01-01',
        clockIn: '2026-01-01T07:00:00.000Z',
        source: 'MOBILE',
      });

    expect(res.status).toBe(409);
  });
});

// Test 4: GET /org/:orgId/time-entries returns paginated list
describe('GET /org/:orgId/time-entries', () => {
  it('returns paginated list filtered by date range', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listTimeEntries.mockResolvedValue({
      data: [SAMPLE_ENTRY],
      total: 1,
      page: 1,
      limit: 50,
    });

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/time-entries`)
      .set('Authorization', 'Bearer token')
      .query({ dateFrom: '2026-03-01', dateTo: '2026-03-31' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('id', ENTRY_ID);
  });
});

// Test 5: POST /time-entries/:id/activities creates activity
describe('POST /org/:orgId/time-entries/:id/activities', () => {
  it('creates activity link with costAmount calculated', async () => {
    authAs(MANAGER_PAYLOAD);
    const activityOutput = {
      id: 'act-1',
      timeEntryId: ENTRY_ID,
      operationType: 'PLANTIO',
      fieldOperationId: null,
      fieldPlotId: 'plot-1',
      farmLocationId: null,
      costCenterId: null,
      minutes: 120,
      hourlyRate: '15.5000',
      costAmount: '31.00',
      notes: null,
    };
    mockedService.addActivity.mockResolvedValue(activityOutput);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/time-entries/${ENTRY_ID}/activities`)
      .set('Authorization', 'Bearer token')
      .send({
        timeEntryId: ENTRY_ID,
        operationType: 'PLANTIO',
        fieldPlotId: 'plot-1',
        minutes: 120,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('costAmount', '31.00');
    expect(res.body).toHaveProperty('hourlyRate', '15.5000');
  });
});

// Test 6: GET /org/:orgId/overtime-bank/summary/:employeeId returns OvertimeBankSummary
describe('GET /org/:orgId/overtime-bank/summary/:employeeId', () => {
  it('returns OvertimeBankSummary with expiry alerts', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedOvertimeService.getOvertimeBankSummary.mockResolvedValue({
      employeeId: EMP_ID,
      employeeName: 'João Silva',
      totalCredits: 480,
      totalCompensations: 120,
      totalExpirations: 0,
      currentBalance: 360,
      expiringIn30Days: 120,
      expiringIn7Days: 0,
      entries: [],
    });

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/overtime-bank/summary/${EMP_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currentBalance', 360);
    expect(res.body).toHaveProperty('expiringIn30Days', 120);
  });
});

// Test 7: POST /org/:orgId/time-entries/team/:teamId/activities bulk creates activities
describe('POST /org/:orgId/time-entries/team/:teamId/activities', () => {
  it('creates activities for all active team members in one call', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.addTeamActivity.mockResolvedValue({
      created: 3,
      skipped: 1,
      details: [
        { employeeId: 'emp-1', employeeName: 'João', status: 'created' as const },
        { employeeId: 'emp-2', employeeName: 'Maria', status: 'created' as const },
        { employeeId: 'emp-3', employeeName: 'Pedro', status: 'created' as const },
        { employeeId: 'emp-4', employeeName: 'Ana', status: 'skipped_no_entry' as const },
      ],
    });

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/time-entries/team/${TEAM_ID}/activities`)
      .set('Authorization', 'Bearer token')
      .send({
        date: '2026-03-01',
        operationType: 'COLHEITA',
        minutes: 240,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('created', 3);
    expect(res.body).toHaveProperty('skipped', 1);
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});
