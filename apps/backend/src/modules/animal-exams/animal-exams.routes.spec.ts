import request from 'supertest';
import { app } from '../../app';
import * as animalExamsService from './animal-exams.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  AnimalExamError,
  type ExamTypeItem,
  type AnimalExamItem,
  type BulkExamResult,
  type ExamIndicators,
} from './animal-exams.types';

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

jest.mock('./animal-exams.service', () => ({
  createExamType: jest.fn(),
  listExamTypes: jest.fn(),
  getExamType: jest.fn(),
  updateExamType: jest.fn(),
  deleteExamType: jest.fn(),
  createAnimalExam: jest.fn(),
  bulkExam: jest.fn(),
  listAnimalExams: jest.fn(),
  getAnimalExam: jest.fn(),
  updateAnimalExam: jest.fn(),
  deleteAnimalExam: jest.fn(),
  recordResults: jest.fn(),
  getExamIndicators: jest.fn(),
  exportExamsCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(animalExamsService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'op-1',
  email: 'op@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const SAMPLE_EXAM_TYPE: ExamTypeItem = {
  id: 'et-1',
  organizationId: 'org-1',
  name: 'Sorologia Brucelose',
  category: 'MANDATORY',
  categoryLabel: 'Obrigatório/Regulatório',
  method: 'LABORATORY',
  methodLabel: 'Laboratorial',
  material: 'BLOOD',
  materialLabel: 'Sangue',
  defaultLab: 'Lab Central',
  isRegulatory: true,
  validityDays: 365,
  notes: null,
  referenceParams: [
    {
      id: 'p-1',
      paramName: 'Resultado',
      unit: null,
      minReference: null,
      maxReference: null,
      isBooleanResult: true,
      sortOrder: 0,
    },
  ],
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_EXAM: AnimalExamItem = {
  id: 'exam-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  examTypeId: 'et-1',
  examTypeName: 'Sorologia Brucelose',
  examTypeCategory: 'MANDATORY',
  examTypeCategoryLabel: 'Obrigatório/Regulatório',
  collectionDate: '2026-03-10',
  sendDate: '2026-03-11',
  laboratory: 'Lab Central',
  protocolNumber: 'PROT-001',
  status: 'PENDING',
  statusLabel: 'Pendente',
  resultDate: null,
  responsibleName: 'João Silva',
  veterinaryName: 'Dr. Carlos',
  veterinaryCrmv: 'CRMV-SP 12345',
  certificateNumber: null,
  certificateValidity: null,
  animalLotId: null,
  campaignId: null,
  linkedTreatmentId: null,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  results: [],
  createdAt: '2026-03-14T10:00:00.000Z',
};

const SAMPLE_BULK_RESULT: BulkExamResult = {
  campaignId: 'camp-1',
  created: 10,
  animalCount: 10,
};

const SAMPLE_INDICATORS: ExamIndicators = {
  pendingResults: 5,
  expiredRegulatory: 2,
  positivityRates: [{ examTypeName: 'Sorologia Brucelose', total: 20, positive: 1, rate: 5 }],
};

describe('Animal exams routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ═══════════════════════════════════════════════════════════════
  // EXAM TYPES
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/org/exam-types', () => {
    const validInput = {
      name: 'Sorologia Brucelose',
      category: 'MANDATORY',
      method: 'LABORATORY',
      material: 'BLOOD',
      isRegulatory: true,
      validityDays: 365,
      referenceParams: [{ paramName: 'Resultado', isBooleanResult: true }],
    };

    it('should create exam type and return 201', async () => {
      mockedService.createExamType.mockResolvedValue(SAMPLE_EXAM_TYPE);

      const res = await request(app)
        .post('/api/org/exam-types')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('et-1');
      expect(res.body.name).toBe('Sorologia Brucelose');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing name', async () => {
      mockedService.createExamType.mockRejectedValue(
        new AnimalExamError('Nome do tipo de exame é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/exam-types')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 409 for duplicate name', async () => {
      mockedService.createExamType.mockRejectedValue(
        new AnimalExamError('Já existe um tipo de exame com este nome', 409),
      );

      const res = await request(app)
        .post('/api/org/exam-types')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/org/exam-types', () => {
    it('should list exam types', async () => {
      mockedService.listExamTypes.mockResolvedValue({
        data: [SAMPLE_EXAM_TYPE],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app).get('/api/org/exam-types').set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Sorologia Brucelose');
    });

    it('should filter by category', async () => {
      mockedService.listExamTypes.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const res = await request(app)
        .get('/api/org/exam-types?category=MANDATORY')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(mockedService.listExamTypes).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ category: 'MANDATORY' }),
      );
    });
  });

  describe('GET /api/org/exam-types/:examTypeId', () => {
    it('should return exam type', async () => {
      mockedService.getExamType.mockResolvedValue(SAMPLE_EXAM_TYPE);

      const res = await request(app)
        .get('/api/org/exam-types/et-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('et-1');
      expect(res.body.referenceParams).toHaveLength(1);
    });

    it('should return 404 when not found', async () => {
      mockedService.getExamType.mockRejectedValue(
        new AnimalExamError('Tipo de exame não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/exam-types/nonexistent')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/org/exam-types/:examTypeId', () => {
    it('should update exam type', async () => {
      const updated = { ...SAMPLE_EXAM_TYPE, name: 'Brucelose Rosa Bengala' };
      mockedService.updateExamType.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/exam-types/et-1')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Brucelose Rosa Bengala' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Brucelose Rosa Bengala');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/org/exam-types/:examTypeId', () => {
    it('should soft delete exam type', async () => {
      mockedService.deleteExamType.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/exam-types/et-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Tipo de exame excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ANIMAL EXAMS
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/org/farms/:farmId/animal-exams', () => {
    const validInput = {
      animalId: 'animal-1',
      examTypeId: 'et-1',
      collectionDate: '2026-03-10',
      responsibleName: 'João Silva',
      veterinaryName: 'Dr. Carlos',
      veterinaryCrmv: 'CRMV-SP 12345',
    };

    it('should create exam and return 201', async () => {
      mockedService.createAnimalExam.mockResolvedValue(SAMPLE_EXAM);

      const res = await request(app)
        .post('/api/org/farms/farm-1/animal-exams')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('exam-1');
      expect(res.body.examTypeName).toBe('Sorologia Brucelose');
      expect(mockedService.createAnimalExam).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when animal not found', async () => {
      mockedService.createAnimalExam.mockRejectedValue(
        new AnimalExamError('Animal não encontrado nesta fazenda', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/animal-exams')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
    });

    it('should return 400 for missing required fields', async () => {
      mockedService.createAnimalExam.mockRejectedValue(
        new AnimalExamError('Animal é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/animal-exams')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/org/farms/:farmId/animal-exams/bulk', () => {
    it('should bulk create exams and return 201', async () => {
      mockedService.bulkExam.mockResolvedValue(SAMPLE_BULK_RESULT);

      const res = await request(app)
        .post('/api/org/farms/farm-1/animal-exams/bulk')
        .set('Authorization', 'Bearer tok')
        .send({
          animalLotId: 'lot-1',
          examTypeId: 'et-1',
          collectionDate: '2026-03-10',
          responsibleName: 'João Silva',
        });

      expect(res.status).toBe(201);
      expect(res.body.campaignId).toBe('camp-1');
      expect(res.body.animalCount).toBe(10);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });

  describe('GET /api/org/farms/:farmId/animal-exams', () => {
    it('should list exams with pagination', async () => {
      mockedService.listAnimalExams.mockResolvedValue({
        data: [SAMPLE_EXAM],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/animal-exams')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should pass filters to service', async () => {
      mockedService.listAnimalExams.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get('/api/org/farms/farm-1/animal-exams?status=PENDING&animalId=a-1')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listAnimalExams).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ status: 'PENDING', animalId: 'a-1' }),
      );
    });
  });

  describe('GET /api/org/farms/:farmId/animal-exams/:examId', () => {
    it('should return exam with results', async () => {
      const examWithResults = {
        ...SAMPLE_EXAM,
        status: 'COMPLETED' as const,
        statusLabel: 'Concluído',
        resultDate: '2026-03-12',
        results: [
          {
            id: 'r-1',
            paramName: 'Resultado',
            numericValue: null,
            booleanValue: false,
            textValue: null,
            unit: null,
            minReference: null,
            maxReference: null,
            indicator: 'NEGATIVE' as const,
            indicatorLabel: 'Negativo',
          },
        ],
      };
      mockedService.getAnimalExam.mockResolvedValue(examWithResults);

      const res = await request(app)
        .get('/api/org/farms/farm-1/animal-exams/exam-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].indicator).toBe('NEGATIVE');
    });
  });

  describe('PATCH /api/org/farms/:farmId/animal-exams/:examId', () => {
    it('should update exam', async () => {
      const updated = { ...SAMPLE_EXAM, laboratory: 'Lab Norte' };
      mockedService.updateAnimalExam.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/animal-exams/exam-1')
        .set('Authorization', 'Bearer tok')
        .send({ laboratory: 'Lab Norte' });

      expect(res.status).toBe(200);
      expect(res.body.laboratory).toBe('Lab Norte');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });

  describe('POST /api/org/farms/:farmId/animal-exams/:examId/results', () => {
    it('should record results and update status', async () => {
      const withResults = {
        ...SAMPLE_EXAM,
        status: 'COMPLETED' as const,
        statusLabel: 'Concluído',
        resultDate: '2026-03-12',
        results: [
          {
            id: 'r-1',
            paramName: 'Resultado',
            numericValue: null,
            booleanValue: false,
            textValue: null,
            unit: null,
            minReference: null,
            maxReference: null,
            indicator: 'NEGATIVE' as const,
            indicatorLabel: 'Negativo',
          },
        ],
      };
      mockedService.recordResults.mockResolvedValue(withResults);

      const res = await request(app)
        .post('/api/org/farms/farm-1/animal-exams/exam-1/results')
        .set('Authorization', 'Bearer tok')
        .send({
          resultDate: '2026-03-12',
          results: [{ paramName: 'Resultado', booleanValue: false }],
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.results[0].indicator).toBe('NEGATIVE');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 for missing result date', async () => {
      mockedService.recordResults.mockRejectedValue(
        new AnimalExamError('Data do resultado é obrigatória', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/animal-exams/exam-1/results')
        .set('Authorization', 'Bearer tok')
        .send({ results: [{ paramName: 'X', numericValue: 1 }] });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/org/farms/:farmId/animal-exams/:examId', () => {
    it('should delete exam', async () => {
      mockedService.deleteAnimalExam.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/animal-exams/exam-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Exame excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });
  });

  describe('GET /api/org/farms/:farmId/animal-exams/indicators', () => {
    it('should return indicators', async () => {
      mockedService.getExamIndicators.mockResolvedValue(SAMPLE_INDICATORS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/animal-exams/indicators')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.pendingResults).toBe(5);
      expect(res.body.expiredRegulatory).toBe(2);
      expect(res.body.positivityRates).toHaveLength(1);
    });
  });

  describe('GET /api/org/farms/:farmId/animal-exams/export', () => {
    it('should export CSV', async () => {
      mockedService.exportExamsCsv.mockResolvedValue('\uFEFFBrinco;Tipo\n"001";"Brucelose"');

      const res = await request(app)
        .get('/api/org/farms/farm-1/animal-exams/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  // ─── AUTH / PERMISSIONS ──────────────────────────────────────────

  describe('Permission checks', () => {
    it('should deny OPERATOR from creating exam', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/animal-exams')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(403);
    });

    it('should allow OPERATOR to list exam types (org-scoped, no farm access check)', async () => {
      authAs(OPERATOR_PAYLOAD);
      mockedService.listExamTypes.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const res = await request(app).get('/api/org/exam-types').set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
    });
  });
});
