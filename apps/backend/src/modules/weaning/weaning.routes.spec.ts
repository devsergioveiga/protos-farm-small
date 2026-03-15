import request from 'supertest';
import { app } from '../../app';
import * as weaningService from './weaning.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  WeaningError,
  type SeparationItem,
  type FeedingProtocolItem,
  type WeaningItem,
  type WeaningCriteriaItem,
  type WeaningCandidateItem,
  type WeaningIndicators,
} from './weaning.types';

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

jest.mock('./weaning.service', () => ({
  createSeparation: jest.fn(),
  setFeedingProtocol: jest.fn(),
  listSeparations: jest.fn(),
  getSeparation: jest.fn(),
  deleteSeparation: jest.fn(),
  setCriteria: jest.fn(),
  getCriteria: jest.fn(),
  getWeaningCandidates: jest.fn(),
  createWeaning: jest.fn(),
  listWeanings: jest.fn(),
  getWeaning: jest.fn(),
  deleteWeaning: jest.fn(),
  getWeaningIndicators: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(weaningService);
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

const SAMPLE_FEEDING_PROTOCOL: FeedingProtocolItem = {
  id: 'fp-1',
  separationId: 'sep-1',
  feedType: 'WHOLE_MILK',
  feedTypeLabel: 'Leite integral',
  dailyVolumeLiters: 4,
  frequencyPerDay: 2,
  feedingMethod: 'BUCKET_NIPPLE',
  feedingMethodLabel: 'Balde com bico',
  concentrateStartDate: '2026-03-20',
  concentrateGramsPerDay: 200,
  roughageType: 'feno',
  targetWeaningWeightKg: 70,
  notes: null,
  createdAt: '2026-03-15T10:00:00.000Z',
  updatedAt: '2026-03-15T10:00:00.000Z',
};

const SAMPLE_SEPARATION: SeparationItem = {
  id: 'sep-1',
  farmId: 'farm-1',
  calfId: 'calf-1',
  calfEarTag: '001-1',
  calfName: null,
  motherId: 'cow-1',
  motherEarTag: '001',
  motherName: 'Mimosa',
  separationDate: '2026-03-10',
  reason: 'Desmama programada',
  destination: 'CALF_PEN',
  destinationLabel: 'Bezerreiro',
  feedingProtocol: SAMPLE_FEEDING_PROTOCOL,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-10T10:00:00.000Z',
};

const SAMPLE_WEANING: WeaningItem = {
  id: 'wean-1',
  farmId: 'farm-1',
  calfId: 'calf-1',
  calfEarTag: '001-1',
  calfName: null,
  weaningDate: '2026-05-10',
  weightKg: 75,
  ageMonths: 3,
  concentrateConsumptionGrams: 900,
  previousCategory: 'BEZERRO',
  targetLotId: 'lot-recria',
  observations: 'Bezerro saudável',
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-05-10T10:00:00.000Z',
};

const SAMPLE_CRITERIA: WeaningCriteriaItem = {
  id: 'crit-1',
  organizationId: 'org-1',
  minAgeDays: 60,
  minWeightKg: 70,
  minConcentrateGrams: 800,
  consecutiveDays: 3,
  targetLotId: 'lot-recria',
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
};

const SAMPLE_CANDIDATES: WeaningCandidateItem[] = [
  {
    calfId: 'calf-1',
    calfEarTag: '001-1',
    calfName: null,
    birthDate: '2026-01-10',
    ageDays: 64,
    currentWeightKg: 72,
    motherId: 'cow-1',
    motherEarTag: '001',
    meetsAge: true,
    meetsWeight: true,
    meetsAllCriteria: true,
  },
];

const SAMPLE_INDICATORS: WeaningIndicators = {
  totalWeanings: 15,
  avgWeaningWeightKg: 72.3,
  avgWeaningAgeMonths: 2.8,
  totalSeparations: 20,
  nursingCalves: 5,
  mortalityRate: 3.5,
  feedingCostPlaceholder: null,
  periodStart: '2025-03-15',
  periodEnd: '2026-03-15',
};

describe('Weaning routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE SEPARATION (CA1) ──────────────────────────────────────

  describe('POST /api/org/farms/:farmId/calf-separations', () => {
    const validInput = {
      calfId: 'calf-1',
      motherId: 'cow-1',
      separationDate: '2026-03-10',
      reason: 'Desmama programada',
      destination: 'CALF_PEN',
    };

    it('deve criar separação e retornar 201', async () => {
      mockedService.createSeparation.mockResolvedValue(SAMPLE_SEPARATION);

      const res = await request(app)
        .post('/api/org/farms/farm-1/calf-separations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('sep-1');
      expect(res.body.calfEarTag).toBe('001-1');
      expect(res.body.motherEarTag).toBe('001');
      expect(res.body.destination).toBe('CALF_PEN');
      expect(res.body.destinationLabel).toBe('Bezerreiro');
      expect(mockedService.createSeparation).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando bezerro não encontrado', async () => {
      mockedService.createSeparation.mockRejectedValue(
        new WeaningError('Bezerro não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/calf-separations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Bezerro não encontrado');
    });

    it('deve retornar 409 para separação duplicada', async () => {
      mockedService.createSeparation.mockRejectedValue(
        new WeaningError('Bezerro 001-1 já possui registro de separação', 409),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/calf-separations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('já possui registro de separação');
    });

    it('deve negar acesso ao OPERATOR sem animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/calf-separations')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST SEPARATIONS ────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/calf-separations', () => {
    it('deve listar separações com paginação', async () => {
      mockedService.listSeparations.mockResolvedValue({
        data: [SAMPLE_SEPARATION],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/calf-separations')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('deve filtrar por calfId e intervalo de datas', async () => {
      mockedService.listSeparations.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get(
          '/api/org/farms/farm-1/calf-separations?calfId=calf-1&dateFrom=2026-01-01&dateTo=2026-12-31',
        )
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listSeparations).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({
          calfId: 'calf-1',
          dateFrom: '2026-01-01',
          dateTo: '2026-12-31',
        }),
      );
    });
  });

  // ─── GET SEPARATION ──────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/calf-separations/:separationId', () => {
    it('deve retornar detalhe da separação com protocolo de aleitamento', async () => {
      mockedService.getSeparation.mockResolvedValue(SAMPLE_SEPARATION);

      const res = await request(app)
        .get('/api/org/farms/farm-1/calf-separations/sep-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('sep-1');
      expect(res.body.feedingProtocol).toBeDefined();
      expect(res.body.feedingProtocol.feedType).toBe('WHOLE_MILK');
      expect(res.body.feedingProtocol.feedingMethod).toBe('BUCKET_NIPPLE');
    });

    it('deve retornar 404 quando não encontrada', async () => {
      mockedService.getSeparation.mockRejectedValue(
        new WeaningError('Registro de separação não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/calf-separations/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── SET FEEDING PROTOCOL (CA2) ──────────────────────────────────

  describe('PUT /api/org/farms/:farmId/calf-separations/:separationId/feeding-protocol', () => {
    const validProtocol = {
      feedType: 'WHOLE_MILK',
      dailyVolumeLiters: 4,
      frequencyPerDay: 2,
      feedingMethod: 'BUCKET_NIPPLE',
      concentrateStartDate: '2026-03-20',
      concentrateGramsPerDay: 200,
      roughageType: 'feno',
      targetWeaningWeightKg: 70,
    };

    it('deve definir protocolo de aleitamento', async () => {
      mockedService.setFeedingProtocol.mockResolvedValue(SAMPLE_FEEDING_PROTOCOL);

      const res = await request(app)
        .put('/api/org/farms/farm-1/calf-separations/sep-1/feeding-protocol')
        .set('Authorization', 'Bearer tok')
        .send(validProtocol);

      expect(res.status).toBe(200);
      expect(res.body.feedType).toBe('WHOLE_MILK');
      expect(res.body.feedTypeLabel).toBe('Leite integral');
      expect(res.body.dailyVolumeLiters).toBe(4);
      expect(res.body.feedingMethodLabel).toBe('Balde com bico');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 para separação inexistente', async () => {
      mockedService.setFeedingProtocol.mockRejectedValue(
        new WeaningError('Registro de separação não encontrado', 404),
      );

      const res = await request(app)
        .put('/api/org/farms/farm-1/calf-separations/unknown/feeding-protocol')
        .set('Authorization', 'Bearer tok')
        .send(validProtocol);

      expect(res.status).toBe(404);
    });

    it('deve retornar 400 para tipo de alimento inválido', async () => {
      mockedService.setFeedingProtocol.mockRejectedValue(
        new WeaningError(
          'Tipo de alimento inválido. Use WHOLE_MILK, PASTEURIZED_DISCARD_MILK ou MILK_REPLACER',
          400,
        ),
      );

      const res = await request(app)
        .put('/api/org/farms/farm-1/calf-separations/sep-1/feeding-protocol')
        .set('Authorization', 'Bearer tok')
        .send({ ...validProtocol, feedType: 'INVALID' });

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE SEPARATION ───────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/calf-separations/:separationId', () => {
    it('deve excluir separação', async () => {
      mockedService.deleteSeparation.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/calf-separations/sep-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Registro de separação excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando não encontrada', async () => {
      mockedService.deleteSeparation.mockRejectedValue(
        new WeaningError('Registro de separação não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/calf-separations/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('deve negar OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/calf-separations/sep-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── WEANING CRITERIA (CA4) ──────────────────────────────────────

  describe('GET /api/org/weaning-criteria', () => {
    it('deve retornar critérios configurados', async () => {
      mockedService.getCriteria.mockResolvedValue(SAMPLE_CRITERIA);

      const res = await request(app)
        .get('/api/org/weaning-criteria')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.minAgeDays).toBe(60);
      expect(res.body.minWeightKg).toBe(70);
      expect(res.body.minConcentrateGrams).toBe(800);
      expect(res.body.consecutiveDays).toBe(3);
    });

    it('deve retornar null quando sem critérios', async () => {
      mockedService.getCriteria.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/org/weaning-criteria')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });
  });

  describe('PUT /api/org/weaning-criteria', () => {
    it('deve definir critérios de desmame', async () => {
      mockedService.setCriteria.mockResolvedValue(SAMPLE_CRITERIA);

      const res = await request(app)
        .put('/api/org/weaning-criteria')
        .set('Authorization', 'Bearer tok')
        .send({
          minAgeDays: 60,
          minWeightKg: 70,
          minConcentrateGrams: 800,
          consecutiveDays: 3,
          targetLotId: 'lot-recria',
        });

      expect(res.status).toBe(200);
      expect(res.body.minAgeDays).toBe(60);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 400 para idade mínima inválida', async () => {
      mockedService.setCriteria.mockRejectedValue(
        new WeaningError('Idade mínima deve ser pelo menos 1 dia', 400),
      );

      const res = await request(app)
        .put('/api/org/weaning-criteria')
        .set('Authorization', 'Bearer tok')
        .send({ minAgeDays: 0 });

      expect(res.status).toBe(400);
    });
  });

  // ─── WEANING CANDIDATES (CA4) ────────────────────────────────────

  describe('GET /api/org/farms/:farmId/weanings/candidates', () => {
    it('deve retornar candidatos a desmame', async () => {
      mockedService.getWeaningCandidates.mockResolvedValue(SAMPLE_CANDIDATES);

      const res = await request(app)
        .get('/api/org/farms/farm-1/weanings/candidates')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].calfEarTag).toBe('001-1');
      expect(res.body[0].meetsAge).toBe(true);
      expect(res.body[0].meetsWeight).toBe(true);
      expect(res.body[0].meetsAllCriteria).toBe(true);
    });
  });

  // ─── CREATE WEANING (CA5-CA7, CA9) ───────────────────────────────

  describe('POST /api/org/farms/:farmId/weanings', () => {
    const validInput = {
      calfId: 'calf-1',
      weaningDate: '2026-05-10',
      weightKg: 75,
      ageMonths: 3,
      concentrateConsumptionGrams: 900,
      targetLotId: 'lot-recria',
      observations: 'Bezerro saudável',
    };

    it('deve registrar desmame e retornar 201', async () => {
      mockedService.createWeaning.mockResolvedValue(SAMPLE_WEANING);

      const res = await request(app)
        .post('/api/org/farms/farm-1/weanings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('wean-1');
      expect(res.body.calfEarTag).toBe('001-1');
      expect(res.body.weightKg).toBe(75);
      expect(res.body.ageMonths).toBe(3);
      expect(res.body.previousCategory).toBe('BEZERRO');
      expect(res.body.targetLotId).toBe('lot-recria');
      expect(mockedService.createWeaning).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando bezerro não encontrado', async () => {
      mockedService.createWeaning.mockRejectedValue(
        new WeaningError('Bezerro não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/weanings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
    });

    it('deve retornar 409 para desmame duplicado', async () => {
      mockedService.createWeaning.mockRejectedValue(
        new WeaningError('Bezerro 001-1 já possui registro de desmame', 409),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/weanings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('já possui registro de desmame');
    });

    it('deve negar acesso ao OPERATOR sem animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/weanings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST WEANINGS ───────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/weanings', () => {
    it('deve listar desmames com paginação', async () => {
      mockedService.listWeanings.mockResolvedValue({
        data: [SAMPLE_WEANING],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/weanings')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('deve filtrar por intervalo de datas', async () => {
      mockedService.listWeanings.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/weanings?dateFrom=2026-01-01&dateTo=2026-12-31')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listWeanings).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({
          dateFrom: '2026-01-01',
          dateTo: '2026-12-31',
        }),
      );
    });
  });

  // ─── GET WEANING ─────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/weanings/:weaningId', () => {
    it('deve retornar detalhe do desmame', async () => {
      mockedService.getWeaning.mockResolvedValue(SAMPLE_WEANING);

      const res = await request(app)
        .get('/api/org/farms/farm-1/weanings/wean-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('wean-1');
      expect(res.body.weightKg).toBe(75);
      expect(res.body.concentrateConsumptionGrams).toBe(900);
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.getWeaning.mockRejectedValue(
        new WeaningError('Registro de desmame não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/weanings/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE WEANING ──────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/weanings/:weaningId', () => {
    it('deve excluir desmame', async () => {
      mockedService.deleteWeaning.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/weanings/wean-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Registro de desmame excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.deleteWeaning.mockRejectedValue(
        new WeaningError('Registro de desmame não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/weanings/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('deve negar OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/weanings/wean-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── INDICATORS (CA8) ───────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/weanings/indicators', () => {
    it('deve retornar indicadores de desmame', async () => {
      mockedService.getWeaningIndicators.mockResolvedValue(SAMPLE_INDICATORS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/weanings/indicators')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.totalWeanings).toBe(15);
      expect(res.body.avgWeaningWeightKg).toBe(72.3);
      expect(res.body.avgWeaningAgeMonths).toBe(2.8);
      expect(res.body.totalSeparations).toBe(20);
      expect(res.body.nursingCalves).toBe(5);
      expect(res.body.mortalityRate).toBe(3.5);
      expect(res.body.feedingCostPlaceholder).toBeNull();
    });
  });
});
