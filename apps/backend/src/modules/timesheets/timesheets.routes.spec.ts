import request from 'supertest';
import { app } from '../../app';
import * as timesheetsService from './timesheets.service';
import * as authService from '../auth/auth.service';
import { TimesheetError } from './timesheets.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./timesheets.service', () => ({
  createTimesheet: jest.fn(),
  calculateTimesheet: jest.fn(),
  approveTimesheet: jest.fn(),
  correctTimeEntry: jest.fn(),
  getTimesheet: jest.fn(),
  listTimesheets: jest.fn(),
  generateTimesheetPdf: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(timesheetsService);
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
const SHEET_ID = 'sheet-1';

const SAMPLE_TIMESHEET = {
  id: SHEET_ID,
  employeeId: EMP_ID,
  employeeName: 'João Silva',
  referenceMonth: '2026-03-01',
  status: 'DRAFT' as const,
  totalWorked: 0,
  totalOvertime50: 0,
  totalOvertime100: 0,
  totalNightMinutes: 0,
  totalAbsences: 0,
  closingDeadline: null,
  managerApprovedBy: null,
  managerApprovedAt: null,
  rhApprovedBy: null,
  rhApprovedAt: null,
  employeeAcceptedAt: null,
  employeeDisputeNote: null,
  payrollRunId: null,
  notes: null,
  corrections: [],
  inconsistencies: [],
  createdAt: '2026-03-01T00:00:00.000Z',
};

// Test 1: POST /org/:orgId/timesheets creates timesheet in DRAFT status
describe('POST /org/:orgId/timesheets', () => {
  it('creates timesheet in DRAFT status', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTimesheet.mockResolvedValue(SAMPLE_TIMESHEET);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/timesheets`)
      .set('Authorization', 'Bearer token')
      .send({ employeeId: EMP_ID, referenceMonth: '2026-03-01' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', SHEET_ID);
    expect(res.body).toHaveProperty('status', 'DRAFT');
    expect(mockedService.createTimesheet).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      ORG_ID,
      expect.any(Object),
    );
  });
});

// Test 2: POST /timesheets/:id/calculate populates totals
describe('POST /org/:orgId/timesheets/:id/calculate', () => {
  it('populates totals from time entries', async () => {
    authAs(MANAGER_PAYLOAD);
    const calculated = {
      ...SAMPLE_TIMESHEET,
      status: 'PENDING_MANAGER' as const,
      totalWorked: 9600,
      totalOvertime50: 480,
    };
    mockedService.calculateTimesheet.mockResolvedValue(calculated);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/timesheets/${SHEET_ID}/calculate`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalWorked', 9600);
    expect(res.body).toHaveProperty('status', 'PENDING_MANAGER');
  });
});

// Test 3: PATCH /timesheets/:id/approve with APPROVE_MANAGER transitions correctly
describe('PATCH /org/:orgId/timesheets/:id/approve', () => {
  it('transitions PENDING_MANAGER -> MANAGER_APPROVED with APPROVE_MANAGER', async () => {
    authAs(MANAGER_PAYLOAD);
    const approved = { ...SAMPLE_TIMESHEET, status: 'MANAGER_APPROVED' as const };
    mockedService.approveTimesheet.mockResolvedValue(approved);

    const res = await request(app)
      .patch(`/api/org/${ORG_ID}/timesheets/${SHEET_ID}/approve`)
      .set('Authorization', 'Bearer token')
      .send({ action: 'APPROVE_MANAGER' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'MANAGER_APPROVED');
  });
});

// Test 4: PATCH /approve with REJECT requires justification
describe('PATCH /org/:orgId/timesheets/:id/approve - REJECT validation', () => {
  it('returns 400 when REJECT has justification with less than 20 chars', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.approveTimesheet.mockRejectedValue(
      new TimesheetError('Justificativa deve ter pelo menos 20 caracteres', 400),
    );

    const res = await request(app)
      .patch(`/api/org/${ORG_ID}/timesheets/${SHEET_ID}/approve`)
      .set('Authorization', 'Bearer token')
      .send({ action: 'REJECT', justification: 'short' });

    expect(res.status).toBe(400);
  });
});

// Test 5: POST /timesheets/:id/corrections creates correction
describe('POST /org/:orgId/timesheets/:id/corrections', () => {
  it('creates correction with before/after JSON', async () => {
    authAs(MANAGER_PAYLOAD);
    const corrected = {
      ...SAMPLE_TIMESHEET,
      corrections: [
        {
          id: 'corr-1',
          timeEntryId: 'entry-1',
          correctedBy: 'manager-1',
          justification: 'Horário de entrada errado',
          beforeJson: { clockIn: '07:00' },
          afterJson: { clockIn: '06:00' },
          createdAt: '2026-03-15T00:00:00.000Z',
        },
      ],
    };
    mockedService.correctTimeEntry.mockResolvedValue(corrected);

    const res = await request(app)
      .post(`/api/org/${ORG_ID}/timesheets/${SHEET_ID}/corrections`)
      .set('Authorization', 'Bearer token')
      .send({
        timeEntryId: 'entry-1',
        justification: 'Horário de entrada errado',
        corrections: { clockIn: '2026-03-01T06:00:00.000Z' },
      });

    expect(res.status).toBe(201);
    expect(res.body.corrections).toHaveLength(1);
    expect(res.body.corrections[0]).toHaveProperty('justification');
  });
});

// Test 6: GET /timesheets/:id returns full output with corrections and inconsistencies
describe('GET /org/:orgId/timesheets/:id', () => {
  it('returns full output with corrections and inconsistencies', async () => {
    authAs(MANAGER_PAYLOAD);
    const full = {
      ...SAMPLE_TIMESHEET,
      corrections: [],
      inconsistencies: [
        {
          timeEntryId: 'entry-1',
          date: '2026-03-01',
          type: 'MISSING_CLOCK_OUT' as const,
          description: 'Ponto sem saída registrada',
          severity: 'ERROR' as const,
        },
      ],
    };
    mockedService.getTimesheet.mockResolvedValue(full);

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/timesheets/${SHEET_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('inconsistencies');
    expect(res.body.inconsistencies).toHaveLength(1);
    expect(res.body.inconsistencies[0].type).toBe('MISSING_CLOCK_OUT');
  });
});

// Test 7: GET /timesheets/:id/pdf returns application/pdf
describe('GET /org/:orgId/timesheets/:id/pdf', () => {
  it('returns application/pdf content-type', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.generateTimesheetPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 mock pdf content'),
      filename: 'espelho-ponto-joao-2026-03.pdf',
    });

    const res = await request(app)
      .get(`/api/org/${ORG_ID}/timesheets/${SHEET_ID}/pdf`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });
});
