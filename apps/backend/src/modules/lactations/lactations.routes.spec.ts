import request from 'supertest';
import { app } from '../../app';
import * as lactationService from './lactations.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  LactationError,
  type LactationItem,
  type LactationCurvePoint,
  type LactationIndicators,
  type DryingAlertItem,
  type LactationHistoryItem,
} from './lactations.types';

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

jest.mock('./lactations.service', () => ({
  createLactation: jest.fn(),
  induceLactation: jest.fn(),
  listLactations: jest.fn(),
  getLactation: jest.fn(),
  updateLactation: jest.fn(),
  dryOff: jest.fn(),
  deleteLactation: jest.fn(),
  getLactationCurve: jest.fn(),
  calculateIndicators: jest.fn(),
  getDryingAlerts: jest.fn(),
  getAnimalLactationHistory: jest.fn(),
  getActiveLactations: jest.fn(),
  exportLactationsCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(lactationService);
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

const SAMPLE_LACTATION: LactationItem = {
  id: 'lac-1',
  farmId: 'farm-1',
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  lactationNumber: 1,
  startDate: '2026-01-15',
  endDate: null,
  origin: 'BIRTH',
  originLabel: 'Parto',
  status: 'IN_PROGRESS',
  statusLabel: 'Em lactação',
  del: 59,
  inductionProtocol: null,
  inductionReason: null,
  inductionVet: null,
  firstMilkingDate: null,
  dryingReason: null,
  dryingReasonLabel: null,
  dryingProtocol: null,
  dryingVet: null,
  peakLiters: null,
  peakDel: null,
  accumulated305: null,
  totalAccumulated: null,
  durationDays: null,
  calvingEventId: 'calv-1',
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-01-15T08:00:00.000Z',
};

const DRIED_LACTATION: LactationItem = {
  ...SAMPLE_LACTATION,
  id: 'lac-2',
  status: 'DRIED',
  statusLabel: 'Seca',
  endDate: '2026-03-10',
  dryingReason: 'SCHEDULED',
  dryingReasonLabel: 'Programada',
  dryingProtocol: 'Antibiótico intramamário + selante',
  dryingVet: 'Dr. Silva',
  durationDays: 54,
  del: 54,
};

const SAMPLE_CURVE: LactationCurvePoint[] = [
  { del: 1, liters: 8.5, date: '2026-01-16' },
  { del: 2, liters: 10.0, date: '2026-01-17' },
  { del: 3, liters: 12.5, date: '2026-01-18' },
];

const SAMPLE_INDICATORS: LactationIndicators = {
  lactationId: 'lac-1',
  peakLiters: 25.0,
  peakDel: 45,
  persistency: 8.5,
  accumulated305: 5500.0,
  totalAccumulated: 1200.0,
  durationDays: 59,
  avgDailyLiters: 20.34,
  projectedTotal: 6203.7,
};

const SAMPLE_DRYING_ALERTS: DryingAlertItem[] = [
  {
    animalId: 'animal-2',
    animalEarTag: '002',
    animalName: 'Estrela',
    lactationId: 'lac-3',
    del: 320,
    lastDailyLiters: 3.5,
    gestationDays: null,
    reasons: [
      'DEL acima do limite (320 dias, máximo 305)',
      'Produção abaixo do mínimo (3.5L/dia, mínimo 5L)',
    ],
  },
];

const SAMPLE_HISTORY: LactationHistoryItem[] = [
  {
    id: 'lac-prev-1',
    lactationNumber: 1,
    origin: 'BIRTH',
    originLabel: 'Parto',
    status: 'DRIED',
    statusLabel: 'Seca',
    startDate: '2024-06-01',
    endDate: '2025-04-10',
    durationDays: 313,
    accumulated305: 7200.0,
    totalAccumulated: 7400.0,
    peakLiters: 30.0,
    peakDel: 50,
  },
  {
    id: 'lac-prev-2',
    lactationNumber: 2,
    origin: 'BIRTH',
    originLabel: 'Parto',
    status: 'IN_PROGRESS',
    statusLabel: 'Em lactação',
    startDate: '2026-01-15',
    endDate: null,
    durationDays: null,
    accumulated305: null,
    totalAccumulated: null,
    peakLiters: null,
    peakDel: null,
  },
];

describe('Lactation routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE (CA1) ──────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/lactations', () => {
    const validInput = {
      animalId: 'animal-1',
      startDate: '2026-01-15',
      origin: 'BIRTH',
      calvingEventId: 'calv-1',
    };

    it('should create lactation and return 201', async () => {
      mockedService.createLactation.mockResolvedValue(SAMPLE_LACTATION);

      const res = await request(app)
        .post('/api/org/farms/farm-1/lactations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('lac-1');
      expect(res.body.origin).toBe('BIRTH');
      expect(res.body.lactationNumber).toBe(1);
      expect(mockedService.createLactation).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when animal not found', async () => {
      mockedService.createLactation.mockRejectedValue(
        new LactationError('Animal não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/lactations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
    });

    it('should return 409 when animal already has active lactation', async () => {
      mockedService.createLactation.mockRejectedValue(
        new LactationError(
          'Animal já possui lactação em andamento. Encerre a lactação atual antes de iniciar nova',
          409,
        ),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/lactations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('lactação em andamento');
    });

    it('should deny OPERATOR without animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/lactations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── INDUCE (CA3) ─────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/lactations/induce', () => {
    const validInduction = {
      animalId: 'animal-1',
      startDate: '2026-03-01',
      inductionProtocol: 'Protocolo hormonal P4 + E2',
      inductionReason: 'Vaca de alto valor genético vazia',
      inductionVet: 'Dr. Moura',
      firstMilkingDate: '2026-03-15',
    };

    it('should induce lactation and return 201', async () => {
      const induced: LactationItem = {
        ...SAMPLE_LACTATION,
        id: 'lac-ind-1',
        origin: 'INDUCTION',
        originLabel: 'Indução',
        inductionProtocol: 'Protocolo hormonal P4 + E2',
        inductionReason: 'Vaca de alto valor genético vazia',
        inductionVet: 'Dr. Moura',
        firstMilkingDate: '2026-03-15',
      };
      mockedService.induceLactation.mockResolvedValue(induced);

      const res = await request(app)
        .post('/api/org/farms/farm-1/lactations/induce')
        .set('Authorization', 'Bearer tok')
        .send(validInduction);

      expect(res.status).toBe(201);
      expect(res.body.origin).toBe('INDUCTION');
      expect(res.body.inductionProtocol).toBe('Protocolo hormonal P4 + E2');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 when protocol missing', async () => {
      mockedService.induceLactation.mockRejectedValue(
        new LactationError('Protocolo de indução é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/lactations/induce')
        .set('Authorization', 'Bearer tok')
        .send({ ...validInduction, inductionProtocol: '' });

      expect(res.status).toBe(400);
    });
  });

  // ─── LIST ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/lactations', () => {
    it('should list lactations with pagination', async () => {
      mockedService.listLactations.mockResolvedValue({
        data: [SAMPLE_LACTATION],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/lactations')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('should filter by status and animalId', async () => {
      mockedService.listLactations.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/lactations?status=IN_PROGRESS&animalId=animal-1')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listLactations).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ status: 'IN_PROGRESS', animalId: 'animal-1' }),
      );
    });
  });

  // ─── GET (CA4: DEL) ──────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/lactations/:lactationId', () => {
    it('should return lactation with DEL calculated', async () => {
      mockedService.getLactation.mockResolvedValue(SAMPLE_LACTATION);

      const res = await request(app)
        .get('/api/org/farms/farm-1/lactations/lac-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('lac-1');
      expect(res.body.del).toBeDefined();
      expect(typeof res.body.del).toBe('number');
    });

    it('should return 404 when not found', async () => {
      mockedService.getLactation.mockRejectedValue(
        new LactationError('Lactação não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/lactations/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/lactations/:lactationId', () => {
    it('should update lactation notes', async () => {
      const updated = { ...SAMPLE_LACTATION, notes: 'Observação atualizada' };
      mockedService.updateLactation.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/lactations/lac-1')
        .set('Authorization', 'Bearer tok')
        .send({ notes: 'Observação atualizada' });

      expect(res.status).toBe(200);
      expect(res.body.notes).toBe('Observação atualizada');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.updateLactation.mockRejectedValue(
        new LactationError('Lactação não encontrada', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/lactations/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ notes: 'test' });

      expect(res.status).toBe(404);
    });
  });

  // ─── DRY OFF (CA8) ───────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/lactations/:lactationId/dry-off', () => {
    const validDryOff = {
      endDate: '2026-03-10',
      dryingReason: 'SCHEDULED',
      dryingProtocol: 'Antibiótico intramamário + selante',
      dryingVet: 'Dr. Silva',
    };

    it('should dry off lactation successfully', async () => {
      mockedService.dryOff.mockResolvedValue(DRIED_LACTATION);

      const res = await request(app)
        .post('/api/org/farms/farm-1/lactations/lac-1/dry-off')
        .set('Authorization', 'Bearer tok')
        .send(validDryOff);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DRIED');
      expect(res.body.dryingReason).toBe('SCHEDULED');
      expect(res.body.dryingReasonLabel).toBe('Programada');
      expect(res.body.durationDays).toBe(54);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 400 when already dried', async () => {
      mockedService.dryOff.mockRejectedValue(new LactationError('Lactação já está encerrada', 400));

      const res = await request(app)
        .post('/api/org/farms/farm-1/lactations/lac-2/dry-off')
        .set('Authorization', 'Bearer tok')
        .send(validDryOff);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('encerrada');
    });

    it('should return 400 for invalid drying reason', async () => {
      mockedService.dryOff.mockRejectedValue(
        new LactationError(
          'Motivo da secagem inválido. Use SCHEDULED, LOW_PRODUCTION, TREATMENT ou ADVANCED_GESTATION',
          400,
        ),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/lactations/lac-1/dry-off')
        .set('Authorization', 'Bearer tok')
        .send({ ...validDryOff, dryingReason: 'INVALID' });

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/lactations/:lactationId', () => {
    it('should delete lactation', async () => {
      mockedService.deleteLactation.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/lactations/lac-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Lactação excluída com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('should return 404 when not found', async () => {
      mockedService.deleteLactation.mockRejectedValue(
        new LactationError('Lactação não encontrada', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/lactations/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('should deny OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/lactations/lac-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── CURVE (CA5) ──────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/lactations/:lactationId/curve', () => {
    it('should return lactation curve points', async () => {
      mockedService.getLactationCurve.mockResolvedValue(SAMPLE_CURVE);

      const res = await request(app)
        .get('/api/org/farms/farm-1/lactations/lac-1/curve')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].del).toBe(1);
      expect(res.body[0].liters).toBe(8.5);
      expect(res.body[2].del).toBe(3);
    });

    it('should return 404 when lactation not found', async () => {
      mockedService.getLactationCurve.mockRejectedValue(
        new LactationError('Lactação não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/lactations/unknown/curve')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── INDICATORS (CA6) ────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/lactations/:lactationId/indicators', () => {
    it('should calculate and return indicators', async () => {
      mockedService.calculateIndicators.mockResolvedValue(SAMPLE_INDICATORS);

      const res = await request(app)
        .post('/api/org/farms/farm-1/lactations/lac-1/indicators')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.peakLiters).toBe(25.0);
      expect(res.body.peakDel).toBe(45);
      expect(res.body.persistency).toBe(8.5);
      expect(res.body.accumulated305).toBe(5500.0);
      expect(res.body.projectedTotal).toBe(6203.7);
    });
  });

  // ─── DRYING ALERTS (CA9) ─────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/lactations/drying-alerts', () => {
    it('should return drying alerts', async () => {
      mockedService.getDryingAlerts.mockResolvedValue(SAMPLE_DRYING_ALERTS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/lactations/drying-alerts')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].animalEarTag).toBe('002');
      expect(res.body[0].del).toBe(320);
      expect(res.body[0].reasons).toHaveLength(2);
    });

    it('should accept configurable thresholds', async () => {
      mockedService.getDryingAlerts.mockResolvedValue([]);

      await request(app)
        .get(
          '/api/org/farms/farm-1/lactations/drying-alerts?maxDel=280&minProductionLiters=3&maxGestationDays=200',
        )
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getDryingAlerts).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        { maxDel: 280, minProductionLiters: 3, maxGestationDays: 200 },
      );
    });
  });

  // ─── ANIMAL HISTORY (CA11) ───────────────────────────────────────

  describe('GET /api/org/farms/:farmId/lactations/animal/:animalId/history', () => {
    it('should return lactation history for animal', async () => {
      mockedService.getAnimalLactationHistory.mockResolvedValue(SAMPLE_HISTORY);

      const res = await request(app)
        .get('/api/org/farms/farm-1/lactations/animal/animal-1/history')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].lactationNumber).toBe(1);
      expect(res.body[0].accumulated305).toBe(7200.0);
      expect(res.body[1].lactationNumber).toBe(2);
      expect(res.body[1].status).toBe('IN_PROGRESS');
    });

    it('should return 404 when animal not found', async () => {
      mockedService.getAnimalLactationHistory.mockRejectedValue(
        new LactationError('Animal não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/lactations/animal/unknown/history')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── ACTIVE LACTATIONS ───────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/lactations/active', () => {
    it('should return active lactations', async () => {
      mockedService.getActiveLactations.mockResolvedValue([SAMPLE_LACTATION]);

      const res = await request(app)
        .get('/api/org/farms/farm-1/lactations/active')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('IN_PROGRESS');
    });
  });

  // ─── EXPORT CSV ──────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/lactations/export', () => {
    it('should return CSV with correct headers', async () => {
      const csv = '\uFEFFRELATÓRIO DE LACTAÇÕES\nBrinco;Nome;Nº Lactação';
      mockedService.exportLactationsCsv.mockResolvedValue(csv);

      const res = await request(app)
        .get('/api/org/farms/farm-1/lactations/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('lactacoes-');
      expect(res.text).toContain('RELATÓRIO DE LACTAÇÕES');
    });

    it('should pass filter params to export', async () => {
      mockedService.exportLactationsCsv.mockResolvedValue('\uFEFF');

      await request(app)
        .get('/api/org/farms/farm-1/lactations/export?status=DRIED&animalId=animal-1')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.exportLactationsCsv).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ status: 'DRIED', animalId: 'animal-1' }),
      );
    });
  });
});
