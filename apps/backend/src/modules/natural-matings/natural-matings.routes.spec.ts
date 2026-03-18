import request from 'supertest';
import { app } from '../../app';
import * as naturalMatingsService from './natural-matings.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  NaturalMatingError,
  type NaturalMatingDetail,
  type NaturalMatingItem,
  type OverstayAlertItem,
  type MatingIndicators,
} from './natural-matings.types';

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

jest.mock('./natural-matings.service', () => ({
  createNaturalMating: jest.fn(),
  listNaturalMatings: jest.fn(),
  getNaturalMating: jest.fn(),
  updateNaturalMating: jest.fn(),
  deleteNaturalMating: jest.fn(),
  getOverstayAlerts: jest.fn(),
  getMatingIndicators: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(naturalMatingsService);
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

const SAMPLE_MATING_ITEM: NaturalMatingItem = {
  id: 'mating-1',
  farmId: 'farm-1',
  bullId: 'bull-1',
  bullName: 'Netuno',
  bullBreedName: null,
  reason: 'POST_IATF_REPASSE',
  reasonLabel: 'Repasse pós-IATF',
  entryDate: '2026-02-01',
  exitDate: null,
  maxStayDays: 60,
  isOverstay: false,
  stayDays: 42,
  paternityType: 'PROBABLE_NATURAL',
  paternityTypeLabel: 'Provável — monta natural',
  animalCount: 3,
  notes: null,
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-02-01T10:00:00.000Z',
};

const SAMPLE_MATING_DETAIL: NaturalMatingDetail = {
  ...SAMPLE_MATING_ITEM,
  animals: [
    { id: 'ma-1', animalId: 'animal-1', animalEarTag: '001', animalName: 'Mimosa' },
    { id: 'ma-2', animalId: 'animal-2', animalEarTag: '002', animalName: 'Estrela' },
    { id: 'ma-3', animalId: 'animal-3', animalEarTag: '003', animalName: null },
  ],
};

const SAMPLE_UNKNOWN_BULL: NaturalMatingDetail = {
  ...SAMPLE_MATING_ITEM,
  id: 'mating-2',
  bullId: null,
  bullName: null,
  bullBreedName: 'Gir',
  reason: 'DIRECT_COVERAGE',
  reasonLabel: 'Cobertura direta',
  paternityType: 'UNKNOWN_BREED_ONLY',
  paternityTypeLabel: 'Desconhecido — raça informada',
  animals: [{ id: 'ma-4', animalId: 'animal-4', animalEarTag: '004', animalName: 'Lua' }],
};

const SAMPLE_OVERSTAY_ALERTS: OverstayAlertItem[] = [
  {
    id: 'mating-3',
    bullId: 'bull-2',
    bullName: 'Trovão',
    bullBreedName: null,
    entryDate: '2026-01-01',
    maxStayDays: 60,
    currentStayDays: 73,
    daysOverstay: 13,
    animalCount: 5,
    reason: 'DIRECT_COVERAGE',
    reasonLabel: 'Cobertura direta',
  },
];

const SAMPLE_INDICATORS: MatingIndicators = {
  totalMatings: 10,
  activeMatings: 3,
  completedMatings: 7,
  overstayCount: 1,
  avgStayDays: 45.2,
  pregnancyRateNaturalPlaceholder: null,
  pregnancyRateAiPlaceholder: null,
  byReason: [
    { reason: 'POST_IATF_REPASSE', reasonLabel: 'Repasse pós-IATF', count: 6 },
    { reason: 'DIRECT_COVERAGE', reasonLabel: 'Cobertura direta', count: 4 },
  ],
  periodStart: '2025-09-14',
  periodEnd: '2026-03-14',
};

describe('NaturalMatings routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── CREATE (CA1, CA2, CA3) ───────────────────────────────────────

  describe('POST /api/org/farms/:farmId/natural-matings', () => {
    const validInput = {
      bullId: 'bull-1',
      reason: 'POST_IATF_REPASSE',
      entryDate: '2026-02-01',
      animalIds: ['animal-1', 'animal-2', 'animal-3'],
    };

    it('deve criar monta natural com touro conhecido e retornar 201', async () => {
      mockedService.createNaturalMating.mockResolvedValue(SAMPLE_MATING_DETAIL);

      const res = await request(app)
        .post('/api/org/farms/farm-1/natural-matings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('mating-1');
      expect(res.body.paternityType).toBe('PROBABLE_NATURAL');
      expect(res.body.bullId).toBe('bull-1');
      expect(res.body.animals).toHaveLength(3);
      expect(mockedService.createNaturalMating).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        'admin-1',
        validInput,
      );
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve criar monta com touro desconhecido (CA2) e definir paternityType UNKNOWN_BREED_ONLY', async () => {
      const unknownBullInput = {
        bullBreedName: 'Gir',
        reason: 'DIRECT_COVERAGE',
        entryDate: '2026-02-01',
        animalIds: ['animal-4'],
      };

      mockedService.createNaturalMating.mockResolvedValue(SAMPLE_UNKNOWN_BULL);

      const res = await request(app)
        .post('/api/org/farms/farm-1/natural-matings')
        .set('Authorization', 'Bearer tok')
        .send(unknownBullInput);

      expect(res.status).toBe(201);
      expect(res.body.bullId).toBeNull();
      expect(res.body.bullBreedName).toBe('Gir');
      expect(res.body.paternityType).toBe('UNKNOWN_BREED_ONLY');
      expect(res.body.paternityTypeLabel).toBe('Desconhecido — raça informada');
    });

    it('deve retornar 404 quando touro não encontrado', async () => {
      mockedService.createNaturalMating.mockRejectedValue(
        new NaturalMatingError('Touro não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/natural-matings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Touro não encontrado');
    });

    it('deve retornar 400 para animal macho', async () => {
      mockedService.createNaturalMating.mockRejectedValue(
        new NaturalMatingError('Animal 001 não é fêmea. Monta natural é apenas para fêmeas', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/natural-matings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('não é fêmea');
    });

    it('deve retornar 400 para animal sem liberação reprodutiva', async () => {
      mockedService.createNaturalMating.mockRejectedValue(
        new NaturalMatingError('Animal 002 não possui liberação reprodutiva', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/natural-matings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('liberação reprodutiva');
    });

    it('deve retornar 400 sem touro nem raça informada', async () => {
      mockedService.createNaturalMating.mockRejectedValue(
        new NaturalMatingError('Informe o touro ou, quando desconhecido, a raça do touro', 400),
      );

      const res = await request(app)
        .post('/api/org/farms/farm-1/natural-matings')
        .set('Authorization', 'Bearer tok')
        .send({ reason: 'DIRECT_COVERAGE', entryDate: '2026-02-01', animalIds: ['a-1'] });

      expect(res.status).toBe(400);
    });

    it('deve negar acesso ao OPERATOR sem animals:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/farms/farm-1/natural-matings')
        .set('Authorization', 'Bearer tok')
        .send(validInput);

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST ─────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/natural-matings', () => {
    it('deve listar montas naturais com paginação', async () => {
      mockedService.listNaturalMatings.mockResolvedValue({
        data: [SAMPLE_MATING_ITEM],
        total: 1,
      });

      const res = await request(app)
        .get('/api/org/farms/farm-1/natural-matings')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].reasonLabel).toBe('Repasse pós-IATF');
    });

    it('deve filtrar por bullId', async () => {
      mockedService.listNaturalMatings.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/natural-matings?bullId=bull-1')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listNaturalMatings).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ bullId: 'bull-1' }),
      );
    });

    it('deve filtrar por razão e intervalo de datas', async () => {
      mockedService.listNaturalMatings.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get(
          '/api/org/farms/farm-1/natural-matings?reason=DIRECT_COVERAGE&dateFrom=2026-01-01&dateTo=2026-03-31',
        )
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listNaturalMatings).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({
          reason: 'DIRECT_COVERAGE',
          dateFrom: '2026-01-01',
          dateTo: '2026-03-31',
        }),
      );
    });

    it('deve filtrar por overstayOnly', async () => {
      mockedService.listNaturalMatings.mockResolvedValue({ data: [], total: 0 });

      await request(app)
        .get('/api/org/farms/farm-1/natural-matings?overstayOnly=true')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listNaturalMatings).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'farm-1',
        expect.objectContaining({ overstayOnly: true }),
      );
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/natural-matings/:matingId', () => {
    it('deve retornar detalhe da monta com lista de animais', async () => {
      mockedService.getNaturalMating.mockResolvedValue(SAMPLE_MATING_DETAIL);

      const res = await request(app)
        .get('/api/org/farms/farm-1/natural-matings/mating-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('mating-1');
      expect(res.body.animals).toHaveLength(3);
      expect(res.body.animals[0].animalEarTag).toBe('001');
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.getNaturalMating.mockRejectedValue(
        new NaturalMatingError('Registro de monta natural não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/farms/farm-1/natural-matings/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe('PATCH /api/org/farms/:farmId/natural-matings/:matingId', () => {
    it('deve atualizar data de saída e recalcular isOverstay', async () => {
      const updated: NaturalMatingDetail = {
        ...SAMPLE_MATING_DETAIL,
        exitDate: '2026-03-01',
        isOverstay: false,
        stayDays: 28,
      };
      mockedService.updateNaturalMating.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/farms/farm-1/natural-matings/mating-1')
        .set('Authorization', 'Bearer tok')
        .send({ exitDate: '2026-03-01' });

      expect(res.status).toBe(200);
      expect(res.body.exitDate).toBe('2026-03-01');
      expect(res.body.isOverstay).toBe(false);
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.updateNaturalMating.mockRejectedValue(
        new NaturalMatingError('Registro de monta natural não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/natural-matings/unknown')
        .set('Authorization', 'Bearer tok')
        .send({ exitDate: '2026-03-01' });

      expect(res.status).toBe(404);
    });

    it('deve retornar 400 para data de saída anterior à entrada', async () => {
      mockedService.updateNaturalMating.mockRejectedValue(
        new NaturalMatingError('Data de saída não pode ser anterior à data de entrada', 400),
      );

      const res = await request(app)
        .patch('/api/org/farms/farm-1/natural-matings/mating-1')
        .set('Authorization', 'Bearer tok')
        .send({ exitDate: '2026-01-01' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Data de saída');
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/natural-matings/:matingId', () => {
    it('deve excluir monta natural', async () => {
      mockedService.deleteNaturalMating.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/natural-matings/mating-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Registro de monta natural excluído com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalled();
    });

    it('deve retornar 404 quando não encontrado', async () => {
      mockedService.deleteNaturalMating.mockRejectedValue(
        new NaturalMatingError('Registro de monta natural não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/farms/farm-1/natural-matings/unknown')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });

    it('deve negar OPERATOR', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .delete('/api/org/farms/farm-1/natural-matings/mating-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(403);
    });
  });

  // ─── OVERSTAY ALERTS (CA4) ────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/natural-matings/overstay-alerts', () => {
    it('deve retornar alertas de touros com permanência excedida', async () => {
      mockedService.getOverstayAlerts.mockResolvedValue(SAMPLE_OVERSTAY_ALERTS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/natural-matings/overstay-alerts')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].bullName).toBe('Trovão');
      expect(res.body[0].currentStayDays).toBe(73);
      expect(res.body[0].daysOverstay).toBe(13);
      expect(res.body[0].maxStayDays).toBe(60);
    });

    it('deve retornar lista vazia quando não há overstay', async () => {
      mockedService.getOverstayAlerts.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/org/farms/farm-1/natural-matings/overstay-alerts')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // ─── INDICATORS (CA5) ────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/natural-matings/indicators', () => {
    it('deve retornar indicadores de monta natural vs IA', async () => {
      mockedService.getMatingIndicators.mockResolvedValue(SAMPLE_INDICATORS);

      const res = await request(app)
        .get('/api/org/farms/farm-1/natural-matings/indicators')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.totalMatings).toBe(10);
      expect(res.body.activeMatings).toBe(3);
      expect(res.body.completedMatings).toBe(7);
      expect(res.body.overstayCount).toBe(1);
      expect(res.body.avgStayDays).toBe(45.2);
      expect(res.body.pregnancyRateNaturalPlaceholder).toBeNull();
      expect(res.body.pregnancyRateAiPlaceholder).toBeNull();
      expect(res.body.byReason).toHaveLength(2);
    });
  });
});
