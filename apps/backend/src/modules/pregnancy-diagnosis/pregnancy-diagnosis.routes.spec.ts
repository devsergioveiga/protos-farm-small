import request from 'supertest';
import { app } from '../../app';
import * as pregnancyDiagnosisService from './pregnancy-diagnosis.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  PregnancyDiagnosisError,
  type DiagnosisItem,
  type CalvingCalendarItem,
  type DgIndicators,
  type EmptyFemaleItem,
} from './pregnancy-diagnosis.types';

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

jest.mock('./pregnancy-diagnosis.service', () => ({
  createDiagnosis: jest.fn(),
  listDiagnoses: jest.fn(),
  getDiagnosis: jest.fn(),
  updateDiagnosis: jest.fn(),
  deleteDiagnosis: jest.fn(),
  confirmPregnancy: jest.fn(),
  recordLoss: jest.fn(),
  getCalvingCalendar: jest.fn(),
  getEmptyFemales: jest.fn(),
  getDgIndicators: jest.fn(),
  referToIatf: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(pregnancyDiagnosisService);
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

const SAMPLE_DIAGNOSIS: DiagnosisItem = {
  id: 'dg-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  diagnosisDate: '2026-03-10',
  result: 'PREGNANT',
  resultLabel: 'Gestante',
  method: 'ULTRASOUND',
  methodLabel: 'Ultrassonografia',
  gestationDays: 60,
  fetalSex: 'FEMALE',
  fetalSexLabel: 'Fêmea',
  cyclicityStatus: null,
  cyclicityStatusLabel: null,
  expectedCalvingDate: '2026-10-22',
  uterineCondition: 'NONE',
  uterineConditionLabel: 'Nenhuma',
  placentaRetentionHours: null,
  reproductiveRestriction: false,
  restrictionEndDate: null,
  inseminationId: null,
  naturalMatingId: null,
  linkedTreatmentId: null,
  bullId: 'bull-1',
  bullName: null,
  bullBreedName: null,
  isConfirmed: false,
  confirmationDate: null,
  lossDate: null,
  lossReason: null,
  referredToIatf: false,
  referredProtocolId: null,
  veterinaryName: 'Dr. Silva',
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-10T10:00:00.000Z',
};

const SAMPLE_EMPTY_DG: DiagnosisItem = {
  ...SAMPLE_DIAGNOSIS,
  id: 'dg-2',
  animalId: 'animal-2',
  animalEarTag: '002',
  animalName: 'Estrela',
  result: 'EMPTY',
  resultLabel: 'Vazia',
  gestationDays: null,
  fetalSex: null,
  fetalSexLabel: null,
  expectedCalvingDate: null,
  cyclicityStatus: 'ANESTRUS',
  cyclicityStatusLabel: 'Anestro',
  bullId: null,
};

const SAMPLE_METRITIS_DG: DiagnosisItem = {
  ...SAMPLE_DIAGNOSIS,
  id: 'dg-3',
  uterineCondition: 'METRITIS_GRADE_2',
  uterineConditionLabel: 'Metrite grau 2',
  reproductiveRestriction: true,
  restrictionEndDate: '2026-04-09',
};

const SAMPLE_CALVING_CALENDAR: CalvingCalendarItem[] = [
  {
    month: '2026-10',
    monthLabel: 'Outubro 2026',
    expectedCalvings: [
      {
        diagnosisId: 'dg-1',
        animalId: 'animal-1',
        animalEarTag: '001',
        animalName: 'Mimosa',
        expectedCalvingDate: '2026-10-22',
        gestationDays: 60,
        isConfirmed: false,
        bullId: 'bull-1',
        bullName: null,
        bullBreedName: null,
      },
    ],
    count: 1,
  },
];

const SAMPLE_INDICATORS: DgIndicators = {
  totalDiagnoses: 20,
  pregnantCount: 14,
  emptyCount: 4,
  lossCount: 1,
  cyclingCount: 1,
  pregnancyRate: 73.7,
  lossRate: 6.7,
  conceptionRatePerBull: [
    {
      bullId: 'bull-1',
      bullName: null,
      bullBreedName: null,
      pregnantCount: 8,
      totalCount: 10,
      rate: 80.0,
    },
  ],
  periodStart: '2025-03-15',
  periodEnd: '2026-03-15',
};

const SAMPLE_EMPTY_FEMALES: EmptyFemaleItem[] = [
  {
    animalId: 'animal-2',
    animalEarTag: '002',
    animalName: 'Estrela',
    diagnosisId: 'dg-2',
    diagnosisDate: '2026-03-10',
    cyclicityStatus: 'ANESTRUS',
    cyclicityStatusLabel: 'Anestro',
    referredToIatf: false,
    referredProtocolId: null,
    daysSinceDiagnosis: 5,
  },
];

describe('PregnancyDiagnosis routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE (CA1-CA7) ─────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/pregnancy-diagnoses', () => {
    const validInput = {
      animalId: 'animal-1',
      diagnosisDate: '2026-03-10',
      result: 'PREGNANT',
      method: 'ULTRASOUND',
      gestationDays: 60,
      fetalSex: 'FEMALE',
      bullId: 'bull-1',
      veterinaryName: 'Dr. Silva',
    };

    it('deve criar diagnóstico de gestação e retornar 201', async () => {
      mockedService.createDiagnosis.mockResolvedValue(SAMPLE_DIAGNOSIS);

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('dg-1');
      expect(res.body.result).toBe('PREGNANT');
      expect(res.body.resultLabel).toBe('Gestante');
      expect(res.body.expectedCalvingDate).toBe('2026-10-22');
      expect(res.body.method).toBe('ULTRASOUND');
      expect(mockedService.createDiagnosis).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve criar diagnóstico vazio com ciclicidade (CA1)', async () => {
      const emptyInput = {
        animalId: 'animal-2',
        diagnosisDate: '2026-03-10',
        result: 'EMPTY',
        method: 'PALPATION',
        cyclicityStatus: 'ANESTRUS',
        veterinaryName: 'Dr. Silva',
      };

      mockedService.createDiagnosis.mockResolvedValue(SAMPLE_EMPTY_DG);

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses')
        .set('Authorization', 'Bearer tok')
        .send(emptyInput);

      expect(res.status).toBe(201);
      expect(res.body.result).toBe('EMPTY');
      expect(res.body.cyclicityStatus).toBe('ANESTRUS');
      expect(res.body.cyclicityStatusLabel).toBe('Anestro');
    });

    it('deve criar diagnóstico com condição uterina e restrição reprodutiva (CA2, CA4)', async () => {
      const metritisInput = {
        ...validInput,
        uterineCondition: 'METRITIS_GRADE_2',
      };

      mockedService.createDiagnosis.mockResolvedValue(SAMPLE_METRITIS_DG);

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses')
        .set('Authorization', 'Bearer tok')
        .send(metritisInput);

      expect(res.status).toBe(201);
      expect(res.body.uterineCondition).toBe('METRITIS_GRADE_2');
      expect(res.body.reproductiveRestriction).toBe(true);
      expect(res.body.restrictionEndDate).toBe('2026-04-09');
    });

    it('deve retornar 404 quando animal não encontrado', async () => {
      mockedService.createDiagnosis.mockRejectedValue(
        new PregnancyDiagnosisError('Animal não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Animal não encontrado');
    });

    it('deve retornar 400 para animal macho', async () => {
      mockedService.createDiagnosis.mockRejectedValue(
        new PregnancyDiagnosisError(
          'Animal 001 não é fêmea. Diagnóstico de gestação é apenas para fêmeas',
          400,
        ),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('não é fêmea');
    });

    it('deve retornar 400 para resultado inválido', async () => {
      mockedService.createDiagnosis.mockRejectedValue(
        new PregnancyDiagnosisError('Resultado do diagnóstico inválido', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses')
        .set('Authorization', 'Bearer tok')
        .send({ ...validInput, result: 'INVALID' });

      expect(res.status).toBe(400);
    });

    it('deve negar acesso ao OPERATOR sem animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/pregnancy-diagnoses', () => {
    it('deve listar diagnósticos com paginação', async () => {
      mockedService.listDiagnoses.mockResolvedValue({
        data: [SAMPLE_DIAGNOSIS],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/pregnancy-diagnoses')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('deve filtrar por resultado', async () => {
      mockedService.listDiagnoses.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/pregnancy-diagnoses?result=PREGNANT')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listDiagnoses).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ result: 'PREGNANT' }),
      );
    });

    it('deve filtrar por intervalo de datas e animalId', async () => {
      mockedService.listDiagnoses.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get(
          '/api/org/farms/farm-1/pregnancy-diagnoses?dateFrom=2026-01-01&dateTo=2026-03-31&animalId=animal-1',
        )
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listDiagnoses).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({
          dateFrom: '2026-01-01',
          dateTo: '2026-03-31',
          animalId: 'animal-1',
        }),
      );
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId', () => {
    it('deve retornar detalhe do diagnóstico', async () => {
      mockedService.getDiagnosis.mockResolvedValue(SAMPLE_DIAGNOSIS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/pregnancy-diagnoses/dg-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('dg-1');
      expect(res.body.animalEarTag).toBe('001');
      expect(res.body.gestationDays).toBe(60);
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.getDiagnosis.mockRejectedValue(
        new PregnancyDiagnosisError('Diagnóstico de gestação não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/pregnancy-diagnoses/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId', () => {
    it('deve atualizar diagnóstico', async () => {
      const updated = { ...SAMPLE_DIAGNOSIS, gestationDays: 90 };
      mockedService.updateDiagnosis.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/pregnancy-diagnoses/dg-1')
        .set('Authorization', 'Bearer tok')
        .send({ gestationDays: 90 });

      expect(res.status).toBe(200);
      expect(res.body.gestationDays).toBe(90);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.updateDiagnosis.mockRejectedValue(
        new PregnancyDiagnosisError('Diagnóstico de gestação não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/pregnancy-diagnoses/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ gestationDays: 90 });

      expect(res.status).toBe(404);
    });
  });

  // ─── CONFIRM PREGNANCY (CA12) ────────────────────────────────────

  describe('POST /api/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId/confirm', () => {
    it('deve confirmar gestação', async () => {
      const confirmed = {
        ...SAMPLE_DIAGNOSIS,
        isConfirmed: true,
        confirmationDate: '2026-04-10',
      };
      mockedService.confirmPregnancy.mockResolvedValue(confirmed);

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses/dg-1/confirm')
        .set('Authorization', 'Bearer tok')
        .send({ confirmationDate: '2026-04-10' });

      expect(res.status).toBe(200);
      expect(res.body.isConfirmed).toBe(true);
      expect(res.body.confirmationDate).toBe('2026-04-10');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 400 para diagnóstico não gestante', async () => {
      mockedService.confirmPregnancy.mockRejectedValue(
        new PregnancyDiagnosisError(
          'Somente diagnósticos com resultado "Gestante" podem ser confirmados',
          400,
        ),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses/dg-2/confirm')
        .set('Authorization', 'Bearer tok')
        .send({ confirmationDate: '2026-04-10' });

      expect(res.status).toBe(400);
    });

    it('deve retornar 400 para diagnóstico já confirmado', async () => {
      mockedService.confirmPregnancy.mockRejectedValue(
        new PregnancyDiagnosisError('Diagnóstico já confirmado', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses/dg-1/confirm')
        .set('Authorization', 'Bearer tok')
        .send({ confirmationDate: '2026-04-10' });

      expect(res.status).toBe(400);
    });
  });

  // ─── RECORD LOSS (CA12) ──────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId/loss', () => {
    it('deve registrar perda gestacional', async () => {
      const withLoss = {
        ...SAMPLE_DIAGNOSIS,
        result: 'LOSS' as const,
        resultLabel: 'Perda gestacional',
        lossDate: '2026-04-15',
        lossReason: 'Aborto espontâneo',
        expectedCalvingDate: null,
      };
      mockedService.recordLoss.mockResolvedValue(withLoss);

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses/dg-1/loss')
        .set('Authorization', 'Bearer tok')
        .send({ lossDate: '2026-04-15', lossReason: 'Aborto espontâneo' });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('LOSS');
      expect(res.body.lossDate).toBe('2026-04-15');
      expect(res.body.lossReason).toBe('Aborto espontâneo');
      expect(res.body.expectedCalvingDate).toBeNull();
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 400 para diagnóstico não gestante', async () => {
      mockedService.recordLoss.mockRejectedValue(
        new PregnancyDiagnosisError(
          'Somente diagnósticos com resultado "Gestante" podem registrar perda',
          400,
        ),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses/dg-2/loss')
        .set('Authorization', 'Bearer tok')
        .send({ lossDate: '2026-04-15', lossReason: 'Aborto' });

      expect(res.status).toBe(400);
    });
  });

  // ─── CALVING CALENDAR (CA8) ──────────────────────────────────────

  describe('GET /api/org/farms/:farmId/pregnancy-diagnoses/calving-calendar', () => {
    it('deve retornar calendário de partos esperados', async () => {
      mockedService.getCalvingCalendar.mockResolvedValue(SAMPLE_CALVING_CALENDAR);

      const res = await request(app)
        .get('/api/org/farms/farm-1/pregnancy-diagnoses/calving-calendar')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].month).toBe('2026-10');
      expect(res.body[0].monthLabel).toBe('Outubro 2026');
      expect(res.body[0].expectedCalvings).toHaveLength(1);
      expect(res.body[0].count).toBe(1);
    });

    it('deve aceitar parâmetro monthsAhead', async () => {
      mockedService.getCalvingCalendar.mockResolvedValue([]);

      await request(app)
        .get('/api/org/farms/farm-1/pregnancy-diagnoses/calving-calendar?monthsAhead=12')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getCalvingCalendar).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        12,
      );
    });
  });

  // ─── EMPTY FEMALES (CA10) ────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/pregnancy-diagnoses/empty-females', () => {
    it('deve retornar fêmeas vazias aguardando decisão', async () => {
      mockedService.getEmptyFemales.mockResolvedValue(SAMPLE_EMPTY_FEMALES);

      const res = await request(app)
        .get('/api/org/farms/farm-1/pregnancy-diagnoses/empty-females')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].animalEarTag).toBe('002');
      expect(res.body[0].cyclicityStatus).toBe('ANESTRUS');
      expect(res.body[0].daysSinceDiagnosis).toBe(5);
    });
  });

  // ─── INDICATORS (CA9, CA12) ──────────────────────────────────────

  describe('GET /api/org/farms/:farmId/pregnancy-diagnoses/indicators', () => {
    it('deve retornar indicadores de diagnóstico de gestação', async () => {
      mockedService.getDgIndicators.mockResolvedValue(SAMPLE_INDICATORS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/pregnancy-diagnoses/indicators')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.totalDiagnoses).toBe(20);
      expect(res.body.pregnantCount).toBe(14);
      expect(res.body.emptyCount).toBe(4);
      expect(res.body.pregnancyRate).toBe(73.7);
      expect(res.body.lossRate).toBe(6.7);
      expect(res.body.conceptionRatePerBull).toHaveLength(1);
      expect(res.body.conceptionRatePerBull[0].rate).toBe(80.0);
    });
  });

  // ─── REFER TO IATF (CA11) ────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId/refer-iatf', () => {
    it('deve encaminhar fêmea vazia para IATF', async () => {
      const referred = {
        ...SAMPLE_EMPTY_DG,
        referredToIatf: true,
        referredProtocolId: 'protocol-1',
      };
      mockedService.referToIatf.mockResolvedValue(referred);

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses/dg-2/refer-iatf')
        .set('Authorization', 'Bearer tok')
        .send({ referredProtocolId: 'protocol-1' });

      expect(res.status).toBe(200);
      expect(res.body.referredToIatf).toBe(true);
      expect(res.body.referredProtocolId).toBe('protocol-1');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 400 para diagnóstico gestante', async () => {
      mockedService.referToIatf.mockRejectedValue(
        new PregnancyDiagnosisError(
          'Encaminhamento para IATF é apenas para fêmeas vazias ou ciclando',
          400,
        ),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/pregnancy-diagnoses/dg-1/refer-iatf')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/pregnancy-diagnoses/:diagnosisId', () => {
    it('deve excluir diagnóstico de gestação', async () => {
      mockedService.deleteDiagnosis.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/pregnancy-diagnoses/dg-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Diagnóstico de gestação excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.deleteDiagnosis.mockRejectedValue(
        new PregnancyDiagnosisError('Diagnóstico de gestação não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/pregnancy-diagnoses/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('deve negar OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/pregnancy-diagnoses/dg-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });
});
