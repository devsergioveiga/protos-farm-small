import request from 'supertest';
import { app } from '../../app';
import * as dietsService from './diets.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import {
  DietError,
  type DietDetail,
  type ListDietsResult,
  type DietLotAssignmentItem,
  type SimulationResult,
  type DietVersionItem,
} from './diets.types';

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

jest.mock('./diets.service', () => ({
  createDiet: jest.fn(),
  listDiets: jest.fn(),
  getDiet: jest.fn(),
  updateDiet: jest.fn(),
  deleteDiet: jest.fn(),
  duplicateDiet: jest.fn(),
  assignToLot: jest.fn(),
  removeFromLot: jest.fn(),
  simulateDiet: jest.fn(),
  recalculateNutrients: jest.fn(),
  listVersions: jest.fn(),
  exportRecipeCsv: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(dietsService);
const mockedAuth = jest.mocked(authService);
jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const CONSULTANT_PAYLOAD = {
  userId: 'consult-1',
  email: 'consult@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const SAMPLE_DIET: DietDetail = {
  id: 'diet-1',
  organizationId: 'org-1',
  name: 'Dieta Vacas Lactação',
  targetCategory: 'VACA_LACTACAO',
  targetCategoryLabel: 'Vaca em lactação',
  startDate: '2026-03-01',
  endDate: '2026-06-30',
  nutritionist: 'Dr. Silva',
  objective: 'Manter produção de 30L/dia',
  version: 1,
  parentId: null,
  isActive: true,
  nutrients: {
    totalDmKgDay: 18.5,
    totalCpGDay: 2960,
    cpPercentDm: 16.0,
    ndfPercentDm: 35.0,
    adfPercentDm: 20.0,
    eePercentDm: 3.5,
    tdnPercentDm: 70.0,
    nelMcalDay: 27.5,
    nelMcalKgDm: 1.49,
    caGDay: 120,
    pGDay: 80,
    roughageConcentrateRatio: 55.0,
    costPerAnimalDay: 12.5,
    costPerKgDm: 0.676,
  },
  ingredientCount: 3,
  lotCount: 1,
  notes: null,
  createdBy: 'admin-1',
  creatorName: 'Admin',
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
  ingredients: [
    {
      id: 'di-1',
      feedIngredientId: 'fi-1',
      feedIngredientName: 'Silagem de Milho',
      feedIngredientType: 'ROUGHAGE',
      quantityKgDay: 25,
      sortOrder: 0,
      dmKgDay: 8.25,
      cpGDay: 618.75,
      costPerDay: 8.75,
      notes: null,
    },
    {
      id: 'di-2',
      feedIngredientId: 'fi-2',
      feedIngredientName: 'Farelo de Soja',
      feedIngredientType: 'CONCENTRATE',
      quantityKgDay: 3,
      sortOrder: 1,
      dmKgDay: 2.64,
      cpGDay: 1267.2,
      costPerDay: 5.1,
      notes: null,
    },
    {
      id: 'di-3',
      feedIngredientId: 'fi-3',
      feedIngredientName: 'Milho Grão',
      feedIngredientType: 'CONCENTRATE',
      quantityKgDay: 5,
      sortOrder: 2,
      dmKgDay: 4.35,
      cpGDay: 391.5,
      costPerDay: 4.5,
      notes: null,
    },
  ],
  lotAssignments: [
    {
      id: 'dla-1',
      lotId: 'lot-1',
      lotName: 'Lote Produção A',
      animalCount: 50,
      startDate: '2026-03-01',
      endDate: null,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  authAs(ADMIN_PAYLOAD);
});

// ═══════════════════════════════════════════════════════════════════
// POST /org/diets
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/org/diets', () => {
  it('creates a diet (201)', async () => {
    mockedService.createDiet.mockResolvedValue(SAMPLE_DIET);

    const res = await request(app)
      .post('/api/org/diets')
      .set('Authorization', 'Bearer token')
      .send({
        name: 'Dieta Vacas Lactação',
        targetCategory: 'VACA_LACTACAO',
        ingredients: [
          { feedIngredientId: 'fi-1', quantityKgDay: 25 },
          { feedIngredientId: 'fi-2', quantityKgDay: 3 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Dieta Vacas Lactação');
    expect(res.body.nutrients.totalDmKgDay).toBe(18.5);
    expect(res.body.ingredients).toHaveLength(3);
  });

  it('returns 400 on validation error', async () => {
    mockedService.createDiet.mockRejectedValue(new DietError('Nome é obrigatório', 400));

    const res = await request(app)
      .post('/api/org/diets')
      .set('Authorization', 'Bearer token')
      .send({ targetCategory: 'VACA_LACTACAO', ingredients: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Nome');
  });

  it('returns 403 for CONSULTANT role', async () => {
    authAs(CONSULTANT_PAYLOAD);

    const res = await request(app)
      .post('/api/org/diets')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Test', targetCategory: 'VACA_LACTACAO', ingredients: [] });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /org/diets
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/org/diets', () => {
  it('lists diets', async () => {
    const result: ListDietsResult = {
      data: [{ ...SAMPLE_DIET }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    mockedService.listDiets.mockResolvedValue(result);

    const res = await request(app).get('/api/org/diets').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('filters by targetCategory', async () => {
    mockedService.listDiets.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const res = await request(app)
      .get('/api/org/diets?targetCategory=TOURO')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listDiets).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ targetCategory: 'TOURO' }),
    );
  });

  it('filters by search', async () => {
    mockedService.listDiets.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const res = await request(app)
      .get('/api/org/diets?search=lactacao')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listDiets).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: 'lactacao' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /org/diets/:id
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/org/diets/:id', () => {
  it('returns diet detail', async () => {
    mockedService.getDiet.mockResolvedValue(SAMPLE_DIET);

    const res = await request(app)
      .get('/api/org/diets/diet-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('diet-1');
    expect(res.body.ingredients).toHaveLength(3);
    expect(res.body.lotAssignments).toHaveLength(1);
  });

  it('returns 404 when not found', async () => {
    mockedService.getDiet.mockRejectedValue(new DietError('Dieta não encontrada', 404));

    const res = await request(app)
      .get('/api/org/diets/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PUT /org/diets/:id
// ═══════════════════════════════════════════════════════════════════

describe('PUT /api/org/diets/:id', () => {
  it('updates a diet', async () => {
    const updated = { ...SAMPLE_DIET, name: 'Dieta Atualizada' };
    mockedService.updateDiet.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/org/diets/diet-1')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Dieta Atualizada' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Dieta Atualizada');
  });

  it('creates new version when diet has lots and ingredients change', async () => {
    const versioned = { ...SAMPLE_DIET, id: 'diet-2', version: 2, parentId: 'diet-1' };
    mockedService.updateDiet.mockResolvedValue(versioned);

    const res = await request(app)
      .put('/api/org/diets/diet-1')
      .set('Authorization', 'Bearer token')
      .send({
        ingredients: [
          { feedIngredientId: 'fi-1', quantityKgDay: 30 },
          { feedIngredientId: 'fi-2', quantityKgDay: 4 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /org/diets/:id
// ═══════════════════════════════════════════════════════════════════

describe('DELETE /api/org/diets/:id', () => {
  it('deletes a diet (204)', async () => {
    mockedService.deleteDiet.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/org/diets/diet-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
  });

  it('returns 404 when not found', async () => {
    mockedService.deleteDiet.mockRejectedValue(new DietError('Dieta não encontrada', 404));

    const res = await request(app)
      .delete('/api/org/diets/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /org/diets/:id/duplicate (CA8)
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/org/diets/:id/duplicate', () => {
  it('duplicates a diet (201)', async () => {
    const duplicated = { ...SAMPLE_DIET, id: 'diet-copy', name: 'Dieta Vacas Lactação (cópia)' };
    mockedService.duplicateDiet.mockResolvedValue(duplicated);

    const res = await request(app)
      .post('/api/org/diets/diet-1/duplicate')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(201);
    expect(res.body.name).toContain('cópia');
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /org/diets/simulate (CA7)
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/org/diets/simulate', () => {
  it('simulates a diet without saving', async () => {
    const result: SimulationResult = {
      nutrients: SAMPLE_DIET.nutrients,
      ingredients: [
        {
          feedIngredientId: 'fi-1',
          feedIngredientName: 'Silagem de Milho',
          feedIngredientType: 'ROUGHAGE',
          quantityKgDay: 25,
          dmKgDay: 8.25,
          cpGDay: 618.75,
          costPerDay: 8.75,
        },
      ],
    };
    mockedService.simulateDiet.mockResolvedValue(result);

    const res = await request(app)
      .post('/api/org/diets/simulate')
      .set('Authorization', 'Bearer token')
      .send({
        ingredients: [{ feedIngredientId: 'fi-1', quantityKgDay: 25 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.nutrients.totalDmKgDay).toBe(18.5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /org/diets/:id/recalculate (CA3)
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/org/diets/:id/recalculate', () => {
  it('recalculates nutrients', async () => {
    mockedService.recalculateNutrients.mockResolvedValue(SAMPLE_DIET);

    const res = await request(app)
      .post('/api/org/diets/diet-1/recalculate')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.nutrients.totalDmKgDay).toBe(18.5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /org/diets/:id/versions
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/org/diets/:id/versions', () => {
  it('lists versions of a diet', async () => {
    const versions: DietVersionItem[] = [
      {
        id: 'diet-2',
        version: 2,
        name: 'Dieta Vacas Lactação',
        isActive: true,
        createdAt: '2026-03-10T10:00:00.000Z',
        creatorName: 'Admin',
      },
      {
        id: 'diet-1',
        version: 1,
        name: 'Dieta Vacas Lactação',
        isActive: false,
        createdAt: '2026-03-01T10:00:00.000Z',
        creatorName: 'Admin',
      },
    ];
    mockedService.listVersions.mockResolvedValue(versions);

    const res = await request(app)
      .get('/api/org/diets/diet-1/versions')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].version).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /org/diets/:id/recipe (CA9)
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/org/diets/:id/recipe', () => {
  it('exports recipe as CSV', async () => {
    mockedService.exportRecipeCsv.mockResolvedValue(
      'Ingrediente;Tipo;Qtd/Animal/Dia\nSilagem de Milho;ROUGHAGE;25.000',
    );

    const res = await request(app)
      .get('/api/org/diets/diet-1/recipe')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Silagem de Milho');
  });

  it('exports recipe with lot context', async () => {
    mockedService.exportRecipeCsv.mockResolvedValue('csv data');

    const res = await request(app)
      .get('/api/org/diets/diet-1/recipe?lotId=lot-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.exportRecipeCsv).toHaveBeenCalledWith(
      expect.anything(),
      'diet-1',
      'lot-1',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// LOT ASSIGNMENTS (CA4)
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/org/diets/:id/lots', () => {
  it('assigns diet to lot (201)', async () => {
    const assignment: DietLotAssignmentItem = {
      id: 'dla-2',
      lotId: 'lot-2',
      lotName: 'Lote B',
      animalCount: 30,
      startDate: '2026-03-15',
      endDate: null,
    };
    mockedService.assignToLot.mockResolvedValue(assignment);

    const res = await request(app)
      .post('/api/org/diets/diet-1/lots')
      .set('Authorization', 'Bearer token')
      .send({ lotId: 'lot-2', startDate: '2026-03-15' });

    expect(res.status).toBe(201);
    expect(res.body.lotName).toBe('Lote B');
  });
});

describe('DELETE /api/org/diets/:id/lots/:assignmentId', () => {
  it('removes lot assignment (204)', async () => {
    mockedService.removeFromLot.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/org/diets/diet-1/lots/dla-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
  });
});

// ═══════════════════════════════════════════════════════════════════
// AUTH & PERMISSIONS
// ═══════════════════════════════════════════════════════════════════

describe('Auth & permissions', () => {
  it('returns 401 without token', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const res = await request(app).get('/api/org/diets');

    expect(res.status).toBe(401);
  });

  it('CONSULTANT can read diets', async () => {
    authAs(CONSULTANT_PAYLOAD);
    mockedService.listDiets.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const res = await request(app).get('/api/org/diets').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
  });

  it('CONSULTANT cannot create diets', async () => {
    authAs(CONSULTANT_PAYLOAD);

    const res = await request(app)
      .post('/api/org/diets')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Test', targetCategory: 'VACA_LACTACAO', ingredients: [] });

    expect(res.status).toBe(403);
  });

  it('CONSULTANT can simulate diets', async () => {
    authAs(CONSULTANT_PAYLOAD);
    mockedService.simulateDiet.mockResolvedValue({
      nutrients: SAMPLE_DIET.nutrients,
      ingredients: [],
    });

    const res = await request(app)
      .post('/api/org/diets/simulate')
      .set('Authorization', 'Bearer token')
      .send({ ingredients: [{ feedIngredientId: 'fi-1', quantityKgDay: 25 }] });

    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════

describe('Error handling', () => {
  it('returns 500 on unexpected errors', async () => {
    mockedService.listDiets.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app).get('/api/org/diets').set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
  });

  it('handles DietError with correct status', async () => {
    mockedService.getDiet.mockRejectedValue(new DietError('Dieta não encontrada', 404));

    const res = await request(app)
      .get('/api/org/diets/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Dieta não encontrada');
  });
});
