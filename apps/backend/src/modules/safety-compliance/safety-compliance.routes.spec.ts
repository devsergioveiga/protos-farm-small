import request from 'supertest';
import { app } from '../../app';
import * as safetyService from './safety-compliance.service';
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

jest.mock('./safety-compliance.service', () => ({
  getComplianceSummary: jest.fn(),
  listNonCompliantEmployees: jest.fn(),
  getEmployeeCompliance: jest.fn(),
  generateComplianceReportCsv: jest.fn(),
  generateComplianceReportPdf: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(safetyService);
const mockedAuth = jest.mocked(authService);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

const SAMPLE_SUMMARY = {
  totalEmployees: 10,
  compliantCount: 7,
  compliantPercent: 70,
  pendingCount: 3,
  expiringIn30Days: 2,
};

const SAMPLE_EMPLOYEE_COMPLIANCE = {
  employeeId: 'emp-1',
  employeeName: 'João Silva',
  positionName: 'Operador de Máquinas',
  epiCompliance: {
    total: 3,
    compliant: 2,
    pending: [
      {
        epiProductName: 'Protetor Auricular',
        epiType: 'PROTETOR_AURICULAR',
        required: 1,
        delivered: 0,
      },
    ],
  },
  trainingCompliance: {
    total: 2,
    compliant: 1,
    expired: [
      {
        trainingTypeName: 'Agrotóxicos (NR-31.8)',
        nrReference: 'NR-31.8',
        expiresAt: '2025-12-01',
        status: 'EXPIRED' as const,
      },
    ],
  },
  asoCompliance: {
    latestResult: 'APTO',
    nextExamDate: '2026-04-15',
    expiryStatus: 'YELLOW' as const,
  },
  overallStatus: 'EXPIRED' as const,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Safety Compliance routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CP7: Compliance summary ────────────────────────────────────────────────

  describe('GET /api/org/safety-compliance/summary — CP7: merge EPI + training + ASO', () => {
    it('should return compliance summary with correct totals', async () => {
      mockedService.getComplianceSummary.mockResolvedValue(SAMPLE_SUMMARY);

      const res = await request(app)
        .get('/api/org/safety-compliance/summary')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.totalEmployees).toBe(10);
      expect(res.body.compliantCount).toBe(7);
      expect(res.body.compliantPercent).toBe(70);
      expect(res.body.pendingCount).toBe(3);
      expect(res.body.expiringIn30Days).toBe(2);
      expect(mockedService.getComplianceSummary).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        undefined,
      );
    });

    it('should pass farmId filter to service', async () => {
      mockedService.getComplianceSummary.mockResolvedValue({ ...SAMPLE_SUMMARY, totalEmployees: 5 });

      const res = await request(app)
        .get('/api/org/safety-compliance/summary?farmId=farm-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockedService.getComplianceSummary).toHaveBeenCalledWith(
        expect.any(Object),
        'farm-1',
      );
    });
  });

  // ─── Non-compliant employees list ───────────────────────────────────────────

  describe('GET /api/org/safety-compliance/employees', () => {
    it('should list non-compliant employees', async () => {
      mockedService.listNonCompliantEmployees.mockResolvedValue({
        data: [SAMPLE_EMPLOYEE_COMPLIANCE],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/org/safety-compliance/employees')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].overallStatus).toBe('EXPIRED');
    });

    it('should filter by pendingType EPI', async () => {
      mockedService.listNonCompliantEmployees.mockResolvedValue({
        data: [SAMPLE_EMPLOYEE_COMPLIANCE],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/org/safety-compliance/employees?pendingType=EPI')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockedService.listNonCompliantEmployees).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ pendingType: 'EPI' }),
      );
    });

    it('should filter by pendingType TRAINING', async () => {
      mockedService.listNonCompliantEmployees.mockResolvedValue({
        data: [SAMPLE_EMPLOYEE_COMPLIANCE],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/org/safety-compliance/employees?pendingType=TRAINING')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockedService.listNonCompliantEmployees).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ pendingType: 'TRAINING' }),
      );
    });
  });

  // ─── Employee detail compliance ────────────────────────────────────────────

  describe('GET /api/org/safety-compliance/employees/:employeeId', () => {
    it('should return full compliance detail for specific employee', async () => {
      mockedService.getEmployeeCompliance.mockResolvedValue(SAMPLE_EMPLOYEE_COMPLIANCE);

      const res = await request(app)
        .get('/api/org/safety-compliance/employees/emp-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.employeeId).toBe('emp-1');
      expect(res.body.epiCompliance.pending).toHaveLength(1);
      expect(res.body.trainingCompliance.expired).toHaveLength(1);
      expect(res.body.asoCompliance.expiryStatus).toBe('YELLOW');
    });
  });

  // ─── CSV Export ─────────────────────────────────────────────────────────────

  describe('GET /api/org/safety-compliance/report/csv', () => {
    it('should return CSV with correct content-type', async () => {
      const csvContent = 'Nome;Cargo;Tipo Pendência;Detalhe;Vencimento\n"João Silva";"Operador";"ASO";"Último resultado: APTO";"2026-04-15"';
      mockedService.generateComplianceReportCsv.mockResolvedValue(csvContent);

      const res = await request(app)
        .get('/api/org/safety-compliance/report/csv')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toContain('conformidade-nr31.csv');
    });
  });

  // ─── PDF Export ─────────────────────────────────────────────────────────────

  describe('GET /api/org/safety-compliance/report/pdf', () => {
    it('should return PDF with correct content-type', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 test pdf content');
      mockedService.generateComplianceReportPdf.mockResolvedValue(pdfBuffer);

      const res = await request(app)
        .get('/api/org/safety-compliance/report/pdf')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toContain('conformidade-nr31.pdf');
    });
  });

  // ─── Authentication ──────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await request(app).get('/api/org/safety-compliance/summary');
      expect(res.status).toBe(401);
    });
  });

  // ─── Edge: summary with farmId filter ────────────────────────────────────────

  describe('Edge: ASO pending filter', () => {
    it('should filter by pendingType ASO and return employees with ASO issues', async () => {
      const asoEmployee = {
        ...SAMPLE_EMPLOYEE_COMPLIANCE,
        epiCompliance: { total: 3, compliant: 3, pending: [] },
        trainingCompliance: { total: 2, compliant: 2, expired: [] },
        asoCompliance: {
          latestResult: null,
          nextExamDate: null,
          expiryStatus: 'EXPIRED' as const,
        },
        overallStatus: 'EXPIRED' as const,
      };
      mockedService.listNonCompliantEmployees.mockResolvedValue({
        data: [asoEmployee],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get('/api/org/safety-compliance/employees?pendingType=ASO')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data[0].asoCompliance.expiryStatus).toBe('EXPIRED');
    });
  });
});
