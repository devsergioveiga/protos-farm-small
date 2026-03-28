import request from 'supertest';
import { app } from '../../app';
import * as medicalExamsService from './medical-exams.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';

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

jest.mock('./medical-exams.service', () => ({
  createMedicalExam: jest.fn(),
  listMedicalExams: jest.fn(),
  getMedicalExam: jest.fn(),
  updateMedicalExam: jest.fn(),
  deleteMedicalExam: jest.fn(),
  getEmployeeExams: jest.fn(),
}));

// Mock employees service to prevent it from intercepting /org/medical-exams/employees/:id
// The employees router uses GET /org/:orgId/employees/:id which would match
// /org/medical-exams/employees/:employeeId with orgId=medical-exams when the
// employees router is registered before medicalExamsRouter in app.ts.
jest.mock('../employees/employees.service', () => ({
  getEmployee: jest.fn().mockRejectedValue(new Error('Not found')),
  createEmployee: jest.fn(),
  updateEmployee: jest.fn(),
  deleteEmployee: jest.fn(),
  listEmployees: jest.fn(),
  updateEmployeeStatus: jest.fn(),
  getEmployeeSalaryHistory: jest.fn(),
  bulkImportEmployees: jest.fn(),
  bulkImportPreview: jest.fn(),
  addEmployeeFarm: jest.fn(),
  removeEmployeeFarm: jest.fn(),
  addEmployeeDependents: jest.fn(),
  updateEmployeeDependent: jest.fn(),
  removeEmployeeDependent: jest.fn(),
  addEmployeeDocument: jest.fn(),
  deleteEmployeeDocument: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(medicalExamsService);
const mockedAuth = jest.mocked(authService);
 
const _mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const SAMPLE_EXAM = {
  id: 'exam-1',
  employeeId: 'emp-1',
  employeeName: 'João Silva',
  employeePosition: 'Operador de Máquinas',
  farmId: 'farm-1',
  type: 'PERIODICO' as const,
  date: '2026-01-15',
  doctorName: 'Dr. Roberto Lima',
  doctorCrm: 'CRM/SP 12345',
  result: 'APTO' as const,
  restrictions: null,
  nextExamDate: '2027-01-15',
  expiryStatus: 'OK' as const,
  documentUrl: null,
  observations: null,
  createdAt: '2026-01-15T10:00:00.000Z',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Medical Exams routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CP5: Create ASO with auto-calculated nextExamDate ────────────────────

  describe('POST /api/org/medical-exams — CP5: nextExamDate from Position.asoPeriodicityMonths', () => {
    it('should create ASO and return 201 with nextExamDate auto-calculated', async () => {
      const examWithAutoDate = {
        ...SAMPLE_EXAM,
        nextExamDate: '2027-01-15', // 12 months from 2026-01-15 (position default)
      };
      mockedService.createMedicalExam.mockResolvedValue(examWithAutoDate);

      const res = await request(app)
        .post('/api/org/medical-exams')
        .set('Authorization', 'Bearer tok')
        .send({
          employeeId: 'emp-1',
          farmId: 'farm-1',
          type: 'PERIODICO',
          date: '2026-01-15',
          doctorName: 'Dr. Roberto Lima',
          doctorCrm: 'CRM/SP 12345',
          result: 'APTO',
          // nextExamDate not provided — should be auto-calculated
        });

      expect(res.status).toBe(201);
      expect(res.body.nextExamDate).toBe('2027-01-15');
      expect(mockedService.createMedicalExam).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.objectContaining({ type: 'PERIODICO', date: '2026-01-15' }),
        'admin-1',
      );
    });

    it('should use provided nextExamDate when given explicitly', async () => {
      const examWithExplicitDate = {
        ...SAMPLE_EXAM,
        nextExamDate: '2026-07-15', // 6 months, custom
      };
      mockedService.createMedicalExam.mockResolvedValue(examWithExplicitDate);

      const res = await request(app)
        .post('/api/org/medical-exams')
        .set('Authorization', 'Bearer tok')
        .send({
          employeeId: 'emp-1',
          type: 'PERIODICO',
          date: '2026-01-15',
          doctorName: 'Dr. Lima',
          doctorCrm: 'CRM/SP 12345',
          result: 'APTO',
          nextExamDate: '2026-07-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.nextExamDate).toBe('2026-07-15');
    });
  });

  // ─── CP6: Alert levels ────────────────────────────────────────────────────

  describe('GET /api/org/medical-exams — CP6: expiry alert levels', () => {
    it('should list exams and filter by expiryStatus=YELLOW (30 days)', async () => {
      const yellowExam = { ...SAMPLE_EXAM, expiryStatus: 'YELLOW' as const };
      mockedService.listMedicalExams.mockResolvedValue({
        data: [yellowExam],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/org/medical-exams?expiryStatus=YELLOW')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data[0].expiryStatus).toBe('YELLOW');
      expect(mockedService.listMedicalExams).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiryStatus: 'YELLOW' }),
      );
    });

    it('should return RED status for exams expiring in less than 15 days', async () => {
      const redExam = { ...SAMPLE_EXAM, expiryStatus: 'RED' as const };
      mockedService.listMedicalExams.mockResolvedValue({
        data: [redExam],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/org/medical-exams?expiryStatus=RED')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data[0].expiryStatus).toBe('RED');
    });

    it('should return EXPIRED status for exams past nextExamDate', async () => {
      const expiredExam = {
        ...SAMPLE_EXAM,
        nextExamDate: '2025-01-01',
        expiryStatus: 'EXPIRED' as const,
      };
      mockedService.listMedicalExams.mockResolvedValue({
        data: [expiredExam],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/org/medical-exams?expiryStatus=EXPIRED')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data[0].expiryStatus).toBe('EXPIRED');
    });
  });

  // ─── CRUD operations ─────────────────────────────────────────────────────

  describe('GET /api/org/medical-exams/:id', () => {
    it('should return single exam', async () => {
      mockedService.getMedicalExam.mockResolvedValue(SAMPLE_EXAM);

      const res = await request(app)
        .get('/api/org/medical-exams/exam-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('exam-1');
    });
  });

  describe('GET /api/org/medical-exams/employees/:employeeId', () => {
    it('should return all exams for specific employee', async () => {
      mockedService.getEmployeeExams.mockResolvedValue([SAMPLE_EXAM]);

      const res = await request(app)
        .get('/api/org/medical-exams/employees/emp-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].employeeId).toBe('emp-1');
    });
  });

  describe('PUT /api/org/medical-exams/:id', () => {
    it('should update exam and return 200', async () => {
      const updated = {
        ...SAMPLE_EXAM,
        result: 'APTO_COM_RESTRICAO' as const,
        restrictions: 'Restrição a trabalho em altura',
      };
      mockedService.updateMedicalExam.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/org/medical-exams/exam-1')
        .set('Authorization', 'Bearer tok')
        .send({ result: 'APTO_COM_RESTRICAO', restrictions: 'Restrição a trabalho em altura' });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('APTO_COM_RESTRICAO');
      expect(res.body.restrictions).toBe('Restrição a trabalho em altura');
    });
  });

  describe('DELETE /api/org/medical-exams/:id', () => {
    it('should delete exam and return 204', async () => {
      mockedService.deleteMedicalExam.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/medical-exams/exam-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(204);
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────────

  describe('Edge: APTO_COM_RESTRICAO stores restrictions text', () => {
    it('should store restrictions when result is APTO_COM_RESTRICAO', async () => {
      const examWithRestrictions = {
        ...SAMPLE_EXAM,
        result: 'APTO_COM_RESTRICAO' as const,
        restrictions: 'Proibido trabalho em altura e movimentação de cargas acima de 10kg',
      };
      mockedService.createMedicalExam.mockResolvedValue(examWithRestrictions);

      const res = await request(app)
        .post('/api/org/medical-exams')
        .set('Authorization', 'Bearer tok')
        .send({
          employeeId: 'emp-1',
          type: 'ADMISSIONAL',
          date: '2026-01-15',
          doctorName: 'Dr. Lima',
          doctorCrm: 'CRM/SP 12345',
          result: 'APTO_COM_RESTRICAO',
          restrictions: 'Proibido trabalho em altura e movimentação de cargas acima de 10kg',
        });

      expect(res.status).toBe(201);
      expect(res.body.result).toBe('APTO_COM_RESTRICAO');
      expect(res.body.restrictions).toBe(
        'Proibido trabalho em altura e movimentação de cargas acima de 10kg',
      );
    });
  });

  describe('Edge: Authentication required', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await request(app).get('/api/org/medical-exams');

      expect(res.status).toBe(401);
    });
  });
});
