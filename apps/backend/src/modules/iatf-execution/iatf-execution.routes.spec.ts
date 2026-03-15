import request from 'supertest';
import { app } from '../../app';
import * as iatfExecService from './iatf-execution.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { IatfExecutionError } from './iatf-execution.types';

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

jest.mock('./iatf-execution.service', () => ({
  createReproductiveLot: jest.fn(),
  listLots: jest.fn(),
  getLot: jest.fn(),
  executeStep: jest.fn(),
  recordInsemination: jest.fn(),
  removeAnimalFromLot: jest.fn(),
  completeLot: jest.fn(),
  cancelLot: jest.fn(),
  getUpcomingSteps: jest.fn(),
  listInseminations: jest.fn(),
  listLotStatuses: jest.fn(),
  listStepStatuses: jest.fn(),
  listInseminationTypes: jest.fn(),
  listCervicalMucusTypes: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(iatfExecService);
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

const FARM_ID = 'farm-1';

const SAMPLE_LOT_ITEM = {
  id: 'lot-1',
  organizationId: 'org-1',
  farmId: FARM_ID,
  name: 'Lote IATF 01',
  protocolId: 'proto-1',
  protocolName: 'P4 + BE padrão',
  d0Date: '2026-03-15',
  status: 'ACTIVE' as const,
  statusLabel: 'Ativo',
  totalCostCents: 0,
  notes: null,
  animalsCount: 3,
  stepsCount: 3,
  createdBy: 'admin-1',
  creatorName: 'Admin User',
  createdAt: '2026-03-14T00:00:00.000Z',
  updatedAt: '2026-03-14T00:00:00.000Z',
};

const SAMPLE_LOT_DETAIL = {
  ...SAMPLE_LOT_ITEM,
  animals: [
    {
      id: 'la-1',
      lotId: 'lot-1',
      animalId: 'animal-1',
      animalEarTag: '001',
      animalName: 'Mimosa',
      removedAt: null,
      removalReason: null,
    },
  ],
  steps: [
    {
      id: 'step-1',
      lotId: 'lot-1',
      protocolStepId: 'ps-1',
      dayNumber: 0,
      dayLabel: 'D0',
      scheduledDate: '2026-03-15',
      description: 'Inserção do implante de P4',
      isAiDay: false,
      status: 'PENDING' as const,
      statusLabel: 'Pendente',
      executedAt: null,
      responsibleName: null,
      notes: null,
      inseminations: [],
    },
  ],
};

const SAMPLE_STEP_ITEM = {
  id: 'step-1',
  lotId: 'lot-1',
  protocolStepId: 'ps-1',
  dayNumber: 0,
  dayLabel: 'D0',
  scheduledDate: '2026-03-15',
  description: 'Inserção do implante de P4',
  isAiDay: false,
  status: 'DONE' as const,
  statusLabel: 'Realizado',
  executedAt: '2026-03-15T10:00:00.000Z',
  responsibleName: 'Dr. Silva',
  notes: null,
  inseminations: [],
};

const SAMPLE_INSEMINATION = {
  id: 'ins-1',
  organizationId: 'org-1',
  farmId: FARM_ID,
  animalId: 'animal-1',
  animalEarTag: '001',
  animalName: 'Mimosa',
  lotStepId: 'step-3',
  inseminationType: 'IATF',
  inseminationTypeLabel: 'IATF',
  bullId: 'bull-1',
  bullName: 'Nelore Top',
  semenBatchId: 'batch-1',
  semenBatchNumber: 'LOT-2026-001',
  dosesUsed: 1,
  inseminatorName: 'João Inseminador',
  inseminationDate: '2026-03-25',
  inseminationTime: '08:30',
  cervicalMucus: 'CRYSTALLINE',
  cervicalMucusLabel: 'Cristalino',
  heatRecordId: null,
  matingPairId: null,
  plannedBullId: null,
  wasPlannedBull: null,
  substitutionReason: null,
  observations: null,
  recordedBy: 'admin-1',
  createdAt: '2026-03-25T08:30:00.000Z',
};

const SAMPLE_UPCOMING = [
  {
    stepId: 'step-2',
    lotId: 'lot-1',
    lotName: 'Lote IATF 01',
    dayNumber: 8,
    dayLabel: 'D8',
    scheduledDate: '2026-03-23',
    description: 'Remoção do implante de P4',
    isAiDay: false,
    animalsCount: 3,
  },
];

describe('IATF Execution routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── METADATA ──────────────────────────────────────────────────────

  describe('GET /api/org/iatf-execution/lot-statuses', () => {
    it('should return lot statuses', async () => {
      const statuses = [
        { value: 'ACTIVE', label: 'Ativo' },
        { value: 'COMPLETED', label: 'Concluído' },
        { value: 'CANCELLED', label: 'Cancelado' },
      ];
      mockedService.listLotStatuses.mockReturnValue(statuses);

      const res = await request(app)
        .get('/api/org/iatf-execution/lot-statuses')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(statuses);
    });
  });

  describe('GET /api/org/iatf-execution/step-statuses', () => {
    it('should return step statuses', async () => {
      const statuses = [
        { value: 'PENDING', label: 'Pendente' },
        { value: 'DONE', label: 'Realizado' },
        { value: 'SKIPPED', label: 'Pulado' },
      ];
      mockedService.listStepStatuses.mockReturnValue(statuses);

      const res = await request(app)
        .get('/api/org/iatf-execution/step-statuses')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(statuses);
    });
  });

  describe('GET /api/org/iatf-execution/insemination-types', () => {
    it('should return insemination types', async () => {
      const types = [
        { value: 'IATF', label: 'IATF' },
        { value: 'NATURAL_HEAT', label: 'Cio natural' },
      ];
      mockedService.listInseminationTypes.mockReturnValue(types);

      const res = await request(app)
        .get('/api/org/iatf-execution/insemination-types')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(types);
    });
  });

  describe('GET /api/org/iatf-execution/cervical-mucus-types', () => {
    it('should return cervical mucus types', async () => {
      const types = [
        { value: 'CRYSTALLINE', label: 'Cristalino' },
        { value: 'CLOUDY', label: 'Turvo' },
      ];
      mockedService.listCervicalMucusTypes.mockReturnValue(types);

      const res = await request(app)
        .get('/api/org/iatf-execution/cervical-mucus-types')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(types);
    });
  });

  // ─── CREATE LOT ───────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/reproductive-lots', () => {
    it('should create a reproductive lot and return 201', async () => {
      mockedService.createReproductiveLot.mockResolvedValue(SAMPLE_LOT_DETAIL);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/reproductive-lots`)
        .set('Authorization', 'Bearer tok')
        .send({
          name: 'Lote IATF 01',
          protocolId: 'proto-1',
          d0Date: '2026-03-15',
          animalIds: ['animal-1'],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Lote IATF 01');
      expect(res.body.animals).toHaveLength(1);
      expect(res.body.steps).toHaveLength(1);
      expect(mockedService.createReproductiveLot).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        'admin-1',
        expect.objectContaining({ name: 'Lote IATF 01' }),
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_REPRODUCTIVE_LOT',
          targetType: 'reproductive_lot',
          targetId: 'lot-1',
        }),
      );
    });

    it('should return 400 when no animals provided', async () => {
      mockedService.createReproductiveLot.mockRejectedValue(
        new IatfExecutionError('Selecione pelo menos um animal', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/reproductive-lots`)
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Lote', protocolId: 'proto-1', d0Date: '2026-03-15', animalIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('animal');
    });

    it('should return 400 when animals are not female', async () => {
      mockedService.createReproductiveLot.mockRejectedValue(
        new IatfExecutionError('Os seguintes animais não são fêmeas: 001', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/reproductive-lots`)
        .set('Authorization', 'Bearer tok')
        .send({
          name: 'Lote',
          protocolId: 'proto-1',
          d0Date: '2026-03-15',
          animalIds: ['animal-m'],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('fêmeas');
    });

    it('should deny OPERATOR without permission', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/reproductive-lots`)
        .set('Authorization', 'Bearer tok')
        .send({
          name: 'Lote',
          protocolId: 'proto-1',
          d0Date: '2026-03-15',
          animalIds: ['animal-1'],
        });

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST LOTS ────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/reproductive-lots', () => {
    it('should list lots with pagination', async () => {
      const result = {
        data: [SAMPLE_LOT_ITEM],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockedService.listLots.mockResolvedValue(result);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/reproductive-lots`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should pass status filter', async () => {
      mockedService.listLots.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get(`/api/org/farms/${FARM_ID}/reproductive-lots?status=COMPLETED`)
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listLots).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        expect.objectContaining({ status: 'COMPLETED' }),
      );
    });
  });

  // ─── UPCOMING STEPS ───────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/reproductive-lots/upcoming-steps', () => {
    it('should return upcoming steps', async () => {
      mockedService.getUpcomingSteps.mockResolvedValue(SAMPLE_UPCOMING);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/reproductive-lots/upcoming-steps`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].dayLabel).toBe('D8');
    });

    it('should pass daysAhead param', async () => {
      mockedService.getUpcomingSteps.mockResolvedValue([]);

      await request(app)
        .get(`/api/org/farms/${FARM_ID}/reproductive-lots/upcoming-steps?daysAhead=14`)
        .set('Authorization', 'Bearer tok');

      expect(mockedService.getUpcomingSteps).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        14,
      );
    });
  });

  // ─── GET LOT ──────────────────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/reproductive-lots/:lotId', () => {
    it('should return lot detail', async () => {
      mockedService.getLot.mockResolvedValue(SAMPLE_LOT_DETAIL);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/reproductive-lots/lot-1`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('lot-1');
      expect(res.body.animals).toHaveLength(1);
      expect(res.body.steps).toHaveLength(1);
    });

    it('should return 404 for unknown lot', async () => {
      mockedService.getLot.mockRejectedValue(
        new IatfExecutionError('Lote reprodutivo não encontrado', 404),
      );

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/reproductive-lots/unknown`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── EXECUTE STEP ─────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/reproductive-lots/:lotId/steps/:stepId/execute', () => {
    it('should execute a step', async () => {
      mockedService.executeStep.mockResolvedValue(SAMPLE_STEP_ITEM);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/reproductive-lots/lot-1/steps/step-1/execute`)
        .set('Authorization', 'Bearer tok')
        .send({ responsibleName: 'Dr. Silva' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DONE');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EXECUTE_LOT_STEP',
          targetType: 'reproductive_lot_step',
        }),
      );
    });

    it('should return 400 when step already done', async () => {
      mockedService.executeStep.mockRejectedValue(
        new IatfExecutionError('Etapa já foi executada', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/reproductive-lots/lot-1/steps/step-1/execute`)
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── REMOVE ANIMAL ────────────────────────────────────────────────

  describe('DELETE /api/org/farms/:farmId/reproductive-lots/:lotId/animals/:animalId', () => {
    it('should remove animal and return 204', async () => {
      mockedService.removeAnimalFromLot.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/reproductive-lots/lot-1/animals/animal-1`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REMOVE_LOT_ANIMAL',
        }),
      );
    });

    it('should return 404 when animal not in lot', async () => {
      mockedService.removeAnimalFromLot.mockRejectedValue(
        new IatfExecutionError('Animal não pertence a este lote', 404),
      );

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/reproductive-lots/lot-1/animals/unknown`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── COMPLETE LOT ─────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/reproductive-lots/:lotId/complete', () => {
    it('should complete a lot', async () => {
      const completed = {
        ...SAMPLE_LOT_ITEM,
        status: 'COMPLETED' as const,
        statusLabel: 'Concluído',
        totalCostCents: 15000,
      };
      mockedService.completeLot.mockResolvedValue(completed);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/reproductive-lots/lot-1/complete`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.totalCostCents).toBe(15000);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMPLETE_REPRODUCTIVE_LOT',
        }),
      );
    });

    it('should return 400 when lot is not active', async () => {
      mockedService.completeLot.mockRejectedValue(
        new IatfExecutionError('Lote não está ativo', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/reproductive-lots/lot-1/complete`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(400);
    });
  });

  // ─── CANCEL LOT ───────────────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/reproductive-lots/:lotId/cancel', () => {
    it('should cancel a lot', async () => {
      const cancelled = {
        ...SAMPLE_LOT_ITEM,
        status: 'CANCELLED' as const,
        statusLabel: 'Cancelado',
      };
      mockedService.cancelLot.mockResolvedValue(cancelled);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/reproductive-lots/lot-1/cancel`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CANCEL_REPRODUCTIVE_LOT',
        }),
      );
    });
  });

  // ─── RECORD INSEMINATION ──────────────────────────────────────────

  describe('POST /api/org/farms/:farmId/inseminations', () => {
    it('should record an insemination and return 201', async () => {
      mockedService.recordInsemination.mockResolvedValue(SAMPLE_INSEMINATION);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/inseminations`)
        .set('Authorization', 'Bearer tok')
        .send({
          animalId: 'animal-1',
          inseminationType: 'IATF',
          bullId: 'bull-1',
          semenBatchId: 'batch-1',
          inseminatorName: 'João Inseminador',
          inseminationDate: '2026-03-25',
          inseminationTime: '08:30',
          cervicalMucus: 'CRYSTALLINE',
          lotStepId: 'step-3',
        });

      expect(res.status).toBe(201);
      expect(res.body.inseminationType).toBe('IATF');
      expect(res.body.bullName).toBe('Nelore Top');
      expect(mockedService.recordInsemination).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        'admin-1',
        expect.objectContaining({ animalId: 'animal-1' }),
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RECORD_INSEMINATION',
          targetType: 'insemination',
          targetId: 'ins-1',
        }),
      );
    });

    it('should return 400 for insufficient semen doses', async () => {
      mockedService.recordInsemination.mockRejectedValue(
        new IatfExecutionError(
          'Doses insuficientes no lote de sêmen. Disponível: 0, solicitado: 1',
          400,
        ),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/inseminations`)
        .set('Authorization', 'Bearer tok')
        .send({
          animalId: 'animal-1',
          inseminationType: 'IATF',
          semenBatchId: 'batch-empty',
          inseminatorName: 'João',
          inseminationDate: '2026-03-25',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Doses insuficientes');
    });

    it('should return 400 for invalid insemination type', async () => {
      mockedService.recordInsemination.mockRejectedValue(
        new IatfExecutionError(
          'Tipo de inseminação inválido. Use: IATF, NATURAL_HEAT, HEAT_DURING_PROTOCOL',
          400,
        ),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/inseminations`)
        .set('Authorization', 'Bearer tok')
        .send({
          animalId: 'animal-1',
          inseminationType: 'INVALID',
          inseminatorName: 'João',
          inseminationDate: '2026-03-25',
        });

      expect(res.status).toBe(400);
    });

    it('should deny OPERATOR without permission', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/inseminations`)
        .set('Authorization', 'Bearer tok')
        .send({
          animalId: 'animal-1',
          inseminationType: 'IATF',
          inseminatorName: 'João',
          inseminationDate: '2026-03-25',
        });

      expect(res.status).toBe(403);
    });
  });

  // ─── LIST INSEMINATIONS ───────────────────────────────────────────

  describe('GET /api/org/farms/:farmId/inseminations', () => {
    it('should list inseminations with pagination', async () => {
      const result = {
        data: [SAMPLE_INSEMINATION],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockedService.listInseminations.mockResolvedValue(result);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/inseminations`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].inseminationType).toBe('IATF');
    });

    it('should pass filters', async () => {
      mockedService.listInseminations.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get(
          `/api/org/farms/${FARM_ID}/inseminations?animalId=animal-1&dateFrom=2026-03-01&dateTo=2026-03-31&inseminationType=IATF`,
        )
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listInseminations).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        FARM_ID,
        expect.objectContaining({
          animalId: 'animal-1',
          dateFrom: '2026-03-01',
          dateTo: '2026-03-31',
          inseminationType: 'IATF',
        }),
      );
    });
  });

  // ─── ERROR HANDLING ───────────────────────────────────────────────

  describe('Error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockedService.listLots.mockRejectedValue(new Error('Unexpected DB error'));

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/reproductive-lots`)
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Erro interno do servidor');
    });
  });
});
