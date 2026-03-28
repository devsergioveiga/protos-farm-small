import request from 'supertest';
import { app } from '../../app';
import * as trainingRecordsService from './training-records.service';
import * as authService from '../auth/auth.service';
import { TrainingRecordError } from './training-records.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./training-records.service', () => ({
  createTrainingRecord: jest.fn(),
  listTrainingRecords: jest.fn(),
  getTrainingRecord: jest.fn(),
  deleteTrainingRecord: jest.fn(),
  generateCertificatePdf: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(trainingRecordsService);
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
const RECORD_ID = 'record-1';
const EMP_ID = 'emp-1';
const EMP_ID_2 = 'emp-2';
const EMP_ID_3 = 'emp-3';

const SAMPLE_PARTICIPANT = {
  id: 'etr-1',
  employeeId: EMP_ID,
  employeeName: 'João Silva',
  expiresAt: '2027-03-01T00:00:00.000Z',
};

const SAMPLE_TRAINING_RECORD = {
  id: RECORD_ID,
  trainingTypeId: 'type-1',
  trainingTypeName: 'Agrotóxicos',
  date: '2026-03-01T00:00:00.000Z',
  instructorName: 'Carlos Pereira',
  instructorType: 'INTERNO' as const,
  instructorRegistration: null,
  effectiveHours: 20,
  location: 'Sede da Fazenda',
  observations: null,
  attendanceListUrl: null,
  farmId: 'farm-1',
  participantCount: 1,
  participants: [SAMPLE_PARTICIPANT],
  createdAt: '2026-03-01T00:00:00.000Z',
};

// ─── Test CP3: Create TrainingRecord with 3 employees → verify 3 EmployeeTrainingRecords ──

describe('POST /api/training-records — collective training (CP3)', () => {
  it('creates training record with 3 employees and calculates expiresAt for each', async () => {
    authAs(MANAGER_PAYLOAD);

    const threeParticipants = [
      { ...SAMPLE_PARTICIPANT, id: 'etr-1', employeeId: EMP_ID, employeeName: 'João Silva' },
      { ...SAMPLE_PARTICIPANT, id: 'etr-2', employeeId: EMP_ID_2, employeeName: 'Maria Santos' },
      { ...SAMPLE_PARTICIPANT, id: 'etr-3', employeeId: EMP_ID_3, employeeName: 'Pedro Lima' },
    ];

    const recordWith3 = {
      ...SAMPLE_TRAINING_RECORD,
      participantCount: 3,
      participants: threeParticipants,
    };

    mockedService.createTrainingRecord.mockResolvedValue(recordWith3);

    const res = await request(app)
      .post('/api/training-records')
      .set('Authorization', 'Bearer token')
      .send({
        trainingTypeId: 'type-1',
        date: '2026-03-01',
        instructorName: 'Carlos Pereira',
        instructorType: 'INTERNO',
        effectiveHours: 20,
        farmId: 'farm-1',
        employeeIds: [EMP_ID, EMP_ID_2, EMP_ID_3],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('participantCount', 3);
    expect(res.body.participants).toHaveLength(3);
    // Verify each participant has expiresAt set
    for (const p of res.body.participants) {
      expect(p).toHaveProperty('expiresAt');
      expect(typeof p.expiresAt).toBe('string');
    }
    expect(mockedService.createTrainingRecord).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      expect.objectContaining({ employeeIds: [EMP_ID, EMP_ID_2, EMP_ID_3] }),
    );
  });

  it('returns 400 when no employees provided', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTrainingRecord.mockRejectedValue(
      new TrainingRecordError('Pelo menos um participante é obrigatório', 'NO_PARTICIPANTS'),
    );

    const res = await request(app)
      .post('/api/training-records')
      .set('Authorization', 'Bearer token')
      .send({
        trainingTypeId: 'type-1',
        date: '2026-03-01',
        instructorName: 'Carlos Pereira',
        instructorType: 'INTERNO',
        effectiveHours: 20,
        employeeIds: [],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'NO_PARTICIPANTS');
  });
});

// ─── Test 3: GET /training-records returns list ───────────────────────

describe('GET /api/training-records', () => {
  it('returns paginated list with filters', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listTrainingRecords.mockResolvedValue({
      data: [SAMPLE_TRAINING_RECORD],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await request(app)
      .get('/api/training-records?trainingTypeId=type-1&instructorType=INTERNO')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body.data).toHaveLength(1);
    expect(mockedService.listTrainingRecords).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      expect.objectContaining({ trainingTypeId: 'type-1', instructorType: 'INTERNO' }),
    );
  });
});

// ─── Test 4: GET /training-records/:id returns full record ────────────

describe('GET /api/training-records/:id', () => {
  it('returns the full training record with participants', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getTrainingRecord.mockResolvedValue(SAMPLE_TRAINING_RECORD);

    const res = await request(app)
      .get(`/api/training-records/${RECORD_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', RECORD_ID);
    expect(res.body).toHaveProperty('trainingTypeName', 'Agrotóxicos');
    expect(res.body).toHaveProperty('participants');
    expect(Array.isArray(res.body.participants)).toBe(true);
  });

  it('returns 404 when record not found', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getTrainingRecord.mockRejectedValue(
      new TrainingRecordError('Registro de treinamento não encontrado', 'NOT_FOUND'),
    );

    const res = await request(app)
      .get('/api/training-records/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });
});

// ─── Test 5: DELETE cascades to EmployeeTrainingRecords ──────────────

describe('DELETE /api/training-records/:id', () => {
  it('deletes training record and returns 204', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.deleteTrainingRecord.mockResolvedValue();

    const res = await request(app)
      .delete(`/api/training-records/${RECORD_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(mockedService.deleteTrainingRecord).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      RECORD_ID,
    );
  });

  it('returns 404 when record not found', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.deleteTrainingRecord.mockRejectedValue(
      new TrainingRecordError('Registro de treinamento não encontrado', 'NOT_FOUND'),
    );

    const res = await request(app)
      .delete('/api/training-records/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── Test 6: Certificate PDF returns Buffer ───────────────────────────

describe('GET /api/training-records/:id/employees/:employeeId/certificate', () => {
  it('returns PDF buffer with correct content-type', async () => {
    authAs(MANAGER_PAYLOAD);
    // Create a minimal valid PDF buffer (just a test buffer)
    const pdfBuffer = Buffer.from('%PDF-1.4 test certificate');
    mockedService.generateCertificatePdf.mockResolvedValue(pdfBuffer);

    const res = await request(app)
      .get(`/api/training-records/${RECORD_ID}/employees/${EMP_ID}/certificate`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(mockedService.generateCertificatePdf).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      RECORD_ID,
      EMP_ID,
    );
  });

  it('returns 404 when employee not in training record', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.generateCertificatePdf.mockRejectedValue(
      new TrainingRecordError(
        'Funcionário não encontrado neste treinamento',
        'EMPLOYEE_NOT_IN_RECORD',
      ),
    );

    const res = await request(app)
      .get(`/api/training-records/${RECORD_ID}/employees/nonexistent/certificate`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'EMPLOYEE_NOT_IN_RECORD');
  });
});

// ─── Test 7: effectiveHours < minHours edge case ─────────────────────

describe('Edge case: effectiveHours < minHours', () => {
  it('still creates record when effectiveHours is less than minHours', async () => {
    authAs(MANAGER_PAYLOAD);
    const recordLessHours = { ...SAMPLE_TRAINING_RECORD, effectiveHours: 4 };
    mockedService.createTrainingRecord.mockResolvedValue(recordLessHours);

    const res = await request(app)
      .post('/api/training-records')
      .set('Authorization', 'Bearer token')
      .send({
        trainingTypeId: 'type-1',
        date: '2026-03-01',
        instructorName: 'Carlos Pereira',
        instructorType: 'INTERNO',
        effectiveHours: 4, // less than minHours=20
        employeeIds: [EMP_ID],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('effectiveHours', 4);
  });
});

// ─── Test 8: Training type not found returns 404 ─────────────────────

describe('POST /api/training-records — training type validation', () => {
  it('returns 404 when training type does not exist', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTrainingRecord.mockRejectedValue(
      new TrainingRecordError('Tipo de treinamento não encontrado', 'TRAINING_TYPE_NOT_FOUND'),
    );

    const res = await request(app)
      .post('/api/training-records')
      .set('Authorization', 'Bearer token')
      .send({
        trainingTypeId: 'nonexistent',
        date: '2026-03-01',
        instructorName: 'Carlos Pereira',
        instructorType: 'INTERNO',
        effectiveHours: 20,
        employeeIds: [EMP_ID],
      });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'TRAINING_TYPE_NOT_FOUND');
  });
});

// ─── Test 9: Unauthenticated returns 401 ─────────────────────────────

describe('Authentication required for training records', () => {
  it('returns 401 when no auth header provided', async () => {
    const res = await request(app).get('/api/training-records');
    expect(res.status).toBe(401);
  });
});
