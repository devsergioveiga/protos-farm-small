import request from 'supertest';
import { app } from '../../app';
import * as calvingEventsService from './calving-events.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  CalvingEventError,
  type CalvingEventItem,
  type CalvingIndicators,
  type UpcomingBirthItem,
} from './calving-events.types';

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

jest.mock('./calving-events.service', () => ({
  createCalvingEvent: jest.fn(),
  listCalvingEvents: jest.fn(),
  getCalvingEvent: jest.fn(),
  updateCalvingEvent: jest.fn(),
  deleteCalvingEvent: jest.fn(),
  getUpcomingBirths: jest.fn(),
  getCalvingIndicators: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(calvingEventsService);
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

const SAMPLE_CALF = {
  id: 'calf-1',
  sex: 'MALE',
  sexLabel: 'Macho',
  birthWeightKg: 35,
  condition: 'ALIVE' as const,
  conditionLabel: 'Vivo',
  stillbornReason: null,
  stillbornReasonLabel: null,
  createdAnimalId: 'animal-new-1',
  earTag: '001-1',
  notes: null,
};

const SAMPLE_BIRTH: CalvingEventItem = {
  id: 'ce-1',
  farmId: 'farm-1',
  motherId: 'animal-1',
  motherEarTag: '001',
  motherName: 'Mimosa',
  fatherId: 'bull-1',
  fatherEarTag: 'TOURO-01',
  fatherBreedName: null,
  eventType: 'BIRTH',
  eventTypeLabel: 'Parto',
  eventDate: '2026-03-10',
  eventTime: '08:30',
  eventPeriod: 'MORNING',
  eventPeriodLabel: 'Manhã',
  birthType: 'NORMAL',
  birthTypeLabel: 'Normal',
  presentation: 'ANTERIOR',
  presentationLabel: 'Anterior',
  abortionGestationDays: null,
  abortionCause: null,
  abortionCauseLabel: null,
  abortionCauseDetail: null,
  fetusFound: null,
  motherWeightKg: 450,
  placentaRetention: false,
  retentionHours: null,
  retentionIntervention: false,
  pregnancyDiagnosisId: null,
  attendantName: 'João',
  notes: null,
  calvesCount: 1,
  calves: [SAMPLE_CALF],
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-10T10:00:00.000Z',
};

const SAMPLE_ABORTION: CalvingEventItem = {
  ...SAMPLE_BIRTH,
  id: 'ce-2',
  eventType: 'ABORTION',
  eventTypeLabel: 'Aborto',
  birthType: null,
  birthTypeLabel: null,
  presentation: null,
  presentationLabel: null,
  abortionGestationDays: 120,
  abortionCause: 'INFECTIOUS',
  abortionCauseLabel: 'Infecciosa',
  abortionCauseDetail: null,
  fetusFound: true,
  calvesCount: 0,
  calves: [],
};

const SAMPLE_INDICATORS: CalvingIndicators = {
  totalEvents: 20,
  birthCount: 17,
  abortionCount: 3,
  totalCalves: 18,
  aliveCalves: 16,
  stillbornCalves: 2,
  stillbornRate: 11.1,
  avgBirthWeightKg: 34.5,
  twinRate: 5.9,
  abortionRate: 15.0,
  periodStart: '2025-03-15',
  periodEnd: '2026-03-15',
};

const SAMPLE_UPCOMING: UpcomingBirthItem[] = [
  {
    diagnosisId: 'dg-1',
    animalId: 'animal-1',
    animalEarTag: '001',
    animalName: 'Mimosa',
    expectedCalvingDate: '2026-03-20',
    gestationDays: 270,
    isConfirmed: true,
    bullId: 'bull-1',
    bullName: null,
    bullBreedName: null,
    daysUntil: 5,
  },
];

describe('CalvingEvents routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE (CA1-CA9) ──────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/calving-events', () => {
    const validBirthInput = {
      motherId: 'animal-1',
      fatherId: 'bull-1',
      eventType: 'BIRTH',
      eventDate: '2026-03-10',
      eventTime: '08:30',
      eventPeriod: 'MORNING',
      birthType: 'NORMAL',
      presentation: 'ANTERIOR',
      motherWeightKg: 450,
      attendantName: 'João',
      calves: [
        {
          sex: 'MALE',
          birthWeightKg: 35,
          condition: 'ALIVE',
          earTag: '001-1',
        },
      ],
    };

    it('deve criar evento de parto e retornar 201', async () => {
      mockedService.createCalvingEvent.mockResolvedValue(SAMPLE_BIRTH);

      const res = await request(app)
        .post('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok')
        .send(validBirthInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('ce-1');
      expect(res.body.eventType).toBe('BIRTH');
      expect(res.body.eventTypeLabel).toBe('Parto');
      expect(res.body.calvesCount).toBe(1);
      expect(res.body.calves).toHaveLength(1);
      expect(res.body.calves[0].sex).toBe('MALE');
      expect(res.body.calves[0].condition).toBe('ALIVE');
      expect(res.body.calves[0].createdAnimalId).toBe('animal-new-1');
      expect(mockedService.createCalvingEvent).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validBirthInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve criar evento de aborto', async () => {
      const abortionInput = {
        motherId: 'animal-1',
        eventType: 'ABORTION',
        eventDate: '2026-03-10',
        abortionGestationDays: 120,
        abortionCause: 'INFECTIOUS',
        fetusFound: true,
        attendantName: 'João',
      };

      mockedService.createCalvingEvent.mockResolvedValue(SAMPLE_ABORTION);

      const res = await request(app)
        .post('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok')
        .send(abortionInput);

      expect(res.status).toBe(201);
      expect(res.body.eventType).toBe('ABORTION');
      expect(res.body.abortionGestationDays).toBe(120);
      expect(res.body.abortionCause).toBe('INFECTIOUS');
      expect(res.body.fetusFound).toBe(true);
      expect(res.body.calvesCount).toBe(0);
    });

    it('deve criar parto com natimorto', async () => {
      const stillbornBirth: CalvingEventItem = {
        ...SAMPLE_BIRTH,
        calves: [
          {
            ...SAMPLE_CALF,
            condition: 'STILLBORN',
            conditionLabel: 'Natimorto',
            stillbornReason: 'DYSTOCIA',
            stillbornReasonLabel: 'Distocia',
            createdAnimalId: null,
          },
        ],
      };

      mockedService.createCalvingEvent.mockResolvedValue(stillbornBirth);

      const res = await request(app)
        .post('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok')
        .send({
          ...validBirthInput,
          calves: [
            { sex: 'MALE', birthWeightKg: 35, condition: 'STILLBORN', stillbornReason: 'DYSTOCIA' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.calves[0].condition).toBe('STILLBORN');
      expect(res.body.calves[0].stillbornReason).toBe('DYSTOCIA');
      expect(res.body.calves[0].createdAnimalId).toBeNull();
    });

    it('deve criar parto com gêmeos', async () => {
      const twinBirth: CalvingEventItem = {
        ...SAMPLE_BIRTH,
        calvesCount: 2,
        calves: [
          SAMPLE_CALF,
          {
            ...SAMPLE_CALF,
            id: 'calf-2',
            sex: 'FEMALE',
            sexLabel: 'Fêmea',
            earTag: '001-2',
            createdAnimalId: 'animal-new-2',
          },
        ],
      };

      mockedService.createCalvingEvent.mockResolvedValue(twinBirth);

      const res = await request(app)
        .post('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok')
        .send({
          ...validBirthInput,
          calves: [
            { sex: 'MALE', birthWeightKg: 35, condition: 'ALIVE', earTag: '001-1' },
            { sex: 'FEMALE', birthWeightKg: 30, condition: 'ALIVE', earTag: '001-2' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.calvesCount).toBe(2);
      expect(res.body.calves).toHaveLength(2);
    });

    it('deve criar parto com retenção de placenta (CA8)', async () => {
      const retentionBirth: CalvingEventItem = {
        ...SAMPLE_BIRTH,
        placentaRetention: true,
        retentionHours: 12,
        retentionIntervention: true,
      };

      mockedService.createCalvingEvent.mockResolvedValue(retentionBirth);

      const res = await request(app)
        .post('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok')
        .send({
          ...validBirthInput,
          placentaRetention: true,
          retentionHours: 12,
          retentionIntervention: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.placentaRetention).toBe(true);
      expect(res.body.retentionHours).toBe(12);
      expect(res.body.retentionIntervention).toBe(true);
    });

    it('deve retornar 404 quando mãe não encontrada', async () => {
      mockedService.createCalvingEvent.mockRejectedValue(
        new CalvingEventError('Mãe não encontrada', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok')
        .send(validBirthInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Mãe não encontrada');
    });

    it('deve retornar 400 para animal macho', async () => {
      mockedService.createCalvingEvent.mockRejectedValue(
        new CalvingEventError(
          'Animal 001 não é fêmea. Registro de parto/aborto é apenas para fêmeas',
          400,
        ),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok')
        .send(validBirthInput);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('não é fêmea');
    });

    it('deve retornar 400 para tipo de evento inválido', async () => {
      mockedService.createCalvingEvent.mockRejectedValue(
        new CalvingEventError('Tipo de evento inválido. Use BIRTH ou ABORTION', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok')
        .send({ ...validBirthInput, eventType: 'INVALID' });

      expect(res.status).toBe(400);
    });

    it('deve retornar 400 para brinco duplicado', async () => {
      mockedService.createCalvingEvent.mockRejectedValue(
        new CalvingEventError('Brinco 001-1 já está em uso na fazenda', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok')
        .send(validBirthInput);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('já está em uso');
    });

    it('deve negar acesso ao OPERATOR sem animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok')
        .send(validBirthInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/calving-events', () => {
    it('deve listar eventos com paginação', async () => {
      mockedService.listCalvingEvents.mockResolvedValue({
        data: [SAMPLE_BIRTH],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/calving-events')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('deve filtrar por tipo de evento', async () => {
      mockedService.listCalvingEvents.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/calving-events?eventType=BIRTH')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listCalvingEvents).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ eventType: 'BIRTH' }),
      );
    });

    it('deve filtrar por intervalo de datas e motherId', async () => {
      mockedService.listCalvingEvents.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get(
          '/api/org/farms/farm-1/calving-events?dateFrom=2026-01-01&dateTo=2026-03-31&motherId=animal-1',
        )
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listCalvingEvents).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({
          dateFrom: '2026-01-01',
          dateTo: '2026-03-31',
          motherId: 'animal-1',
        }),
      );
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/calving-events/:eventId', () => {
    it('deve retornar detalhe do evento com crias', async () => {
      mockedService.getCalvingEvent.mockResolvedValue(SAMPLE_BIRTH);

      const res = await request(app)
        .get('/api/org/farms/farm-1/calving-events/ce-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('ce-1');
      expect(res.body.motherEarTag).toBe('001');
      expect(res.body.calves).toHaveLength(1);
      expect(res.body.calves[0].earTag).toBe('001-1');
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.getCalvingEvent.mockRejectedValue(
        new CalvingEventError('Evento de parto/aborto não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/calving-events/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/calving-events/:eventId', () => {
    it('deve atualizar evento', async () => {
      const updated = { ...SAMPLE_BIRTH, motherWeightKg: 460 };
      mockedService.updateCalvingEvent.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/calving-events/ce-1')
        .set('Authorization', 'Bearer tok')
        .send({ motherWeightKg: 460 });

      expect(res.status).toBe(200);
      expect(res.body.motherWeightKg).toBe(460);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.updateCalvingEvent.mockRejectedValue(
        new CalvingEventError('Evento de parto/aborto não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/calving-events/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ motherWeightKg: 460 });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/calving-events/:eventId', () => {
    it('deve excluir evento de parto/aborto', async () => {
      mockedService.deleteCalvingEvent.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/calving-events/ce-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Evento de parto/aborto excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.deleteCalvingEvent.mockRejectedValue(
        new CalvingEventError('Evento de parto/aborto não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/calving-events/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('deve negar OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/calving-events/ce-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── UPCOMING BIRTHS (CA12) ──────────────────────────────────────

  describe('GET /api/org/farms/:farmId/calving-events/upcoming', () => {
    it('deve retornar partos esperados nos próximos dias', async () => {
      mockedService.getUpcomingBirths.mockResolvedValue(SAMPLE_UPCOMING);

      const res = await request(app)
        .get('/api/org/farms/farm-1/calving-events/upcoming')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].animalEarTag).toBe('001');
      expect(res.body[0].expectedCalvingDate).toBe('2026-03-20');
      expect(res.body[0].daysUntil).toBe(5);
    });

    it('deve aceitar parâmetro daysAhead', async () => {
      mockedService.getUpcomingBirths.mockResolvedValue([]);

      await request(app)
        .get('/api/org/farms/farm-1/calving-events/upcoming?daysAhead=7')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getUpcomingBirths).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        7,
      );
    });
  });

  // ─── INDICATORS ──────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/calving-events/indicators', () => {
    it('deve retornar indicadores de partos/abortos', async () => {
      mockedService.getCalvingIndicators.mockResolvedValue(SAMPLE_INDICATORS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/calving-events/indicators')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.totalEvents).toBe(20);
      expect(res.body.birthCount).toBe(17);
      expect(res.body.abortionCount).toBe(3);
      expect(res.body.totalCalves).toBe(18);
      expect(res.body.aliveCalves).toBe(16);
      expect(res.body.stillbornCalves).toBe(2);
      expect(res.body.stillbornRate).toBe(11.1);
      expect(res.body.avgBirthWeightKg).toBe(34.5);
      expect(res.body.twinRate).toBe(5.9);
      expect(res.body.abortionRate).toBe(15.0);
    });
  });
});
