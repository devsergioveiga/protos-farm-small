import request from 'supertest';
import { app } from '../../app';
import * as trainingTypesService from './training-types.service';
import * as authService from '../auth/auth.service';
import { TrainingTypeError } from './training-types.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./training-types.service', () => ({
  seedNr31TrainingTypes: jest.fn(),
  listTrainingTypes: jest.fn(),
  getTrainingType: jest.fn(),
  createTrainingType: jest.fn(),
  updateTrainingType: jest.fn(),
  deleteTrainingType: jest.fn(),
  listPositionTrainingRequirements: jest.fn(),
  createPositionTrainingRequirement: jest.fn(),
  deletePositionTrainingRequirement: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(trainingTypesService);
const mockedAuth = jest.mocked(authService);

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: 'org-1',
};

function authAs(payload: typeof MANAGER_PAYLOAD): void {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

const ORG_ID = 'org-1';
const TYPE_ID = 'type-1';

const SAMPLE_TRAINING_TYPE = {
  id: TYPE_ID,
  name: 'Agrotóxicos',
  description: 'Treinamento obrigatório NR-31.8',
  minHours: 20,
  defaultValidityMonths: 12,
  nrReference: 'NR-31.8',
  isSystem: true,
  isGlobal: false,
  organizationId: null,
  createdAt: '2026-03-01T00:00:00.000Z',
};

const CUSTOM_TRAINING_TYPE = {
  id: 'type-custom',
  name: 'Treinamento Personalizado',
  description: null,
  minHours: 4,
  defaultValidityMonths: 6,
  nrReference: null,
  isSystem: false,
  isGlobal: false,
  organizationId: ORG_ID,
  createdAt: '2026-03-01T00:00:00.000Z',
};

const SAMPLE_REQUIREMENT = {
  id: 'req-1',
  positionId: 'pos-1',
  positionName: 'Operador de Máquinas',
  trainingTypeId: TYPE_ID,
  trainingTypeName: 'Agrotóxicos',
};

// ─── Test 1: POST /training-types/seed creates 7 system types ────────

describe('POST /api/training-types/seed', () => {
  it('seeds NR-31 training types and returns success message', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.seedNr31TrainingTypes.mockResolvedValue();

    const res = await request(app)
      .post('/api/training-types/seed')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(mockedService.seedNr31TrainingTypes).toHaveBeenCalledTimes(1);
  });
});

// ─── Test 2: GET /training-types returns both system and org types ────

describe('GET /api/training-types', () => {
  it('returns system types and org-specific types', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listTrainingTypes.mockResolvedValue([SAMPLE_TRAINING_TYPE, CUSTOM_TRAINING_TYPE]);

    const res = await request(app).get('/api/training-types').set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const systemType = res.body.find((t: typeof SAMPLE_TRAINING_TYPE) => t.isSystem);
    const customType = res.body.find((t: typeof CUSTOM_TRAINING_TYPE) => !t.isSystem);
    expect(systemType).toBeDefined();
    expect(customType).toBeDefined();
    expect(mockedService.listTrainingTypes).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
    );
  });
});

// ─── Test 3: GET /training-types/:id returns a single type ──────────

describe('GET /api/training-types/:id', () => {
  it('returns the training type by id', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getTrainingType.mockResolvedValue(SAMPLE_TRAINING_TYPE);

    const res = await request(app)
      .get(`/api/training-types/${TYPE_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', TYPE_ID);
    expect(res.body).toHaveProperty('isSystem', true);
  });

  it('returns 404 when training type not found', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getTrainingType.mockRejectedValue(
      new TrainingTypeError('Tipo de treinamento não encontrado', 'NOT_FOUND'),
    );

    const res = await request(app)
      .get('/api/training-types/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });
});

// ─── Test 4: POST /training-types creates custom type ────────────────

describe('POST /api/training-types', () => {
  it('creates custom training type successfully', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTrainingType.mockResolvedValue(CUSTOM_TRAINING_TYPE);

    const res = await request(app)
      .post('/api/training-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Treinamento Personalizado', minHours: 4, defaultValidityMonths: 6 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'type-custom');
    expect(res.body).toHaveProperty('isSystem', false);
    expect(res.body).toHaveProperty('organizationId', ORG_ID);
  });

  it('returns 409 when name already exists in org', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createTrainingType.mockRejectedValue(
      new TrainingTypeError('Já existe um tipo de treinamento com esse nome', 'NAME_CONFLICT'),
    );

    const res = await request(app)
      .post('/api/training-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Duplicado', minHours: 4, defaultValidityMonths: 6 });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('code', 'NAME_CONFLICT');
  });
});

// ─── Test 5: PUT system type returns 400 (SYSTEM_TYPE_READONLY) ──────

describe('PUT /api/training-types/:id — system type protection', () => {
  it('returns 400 when attempting to edit a system type', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.updateTrainingType.mockRejectedValue(
      new TrainingTypeError(
        'Treinamentos do sistema não podem ser editados',
        'SYSTEM_TYPE_READONLY',
      ),
    );

    const res = await request(app)
      .put(`/api/training-types/${TYPE_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ minHours: 99 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'SYSTEM_TYPE_READONLY');
  });
});

// ─── Test 6: DELETE system type returns 400 (SYSTEM_TYPE_READONLY) ───

describe('DELETE /api/training-types/:id — system type protection', () => {
  it('returns 400 when attempting to delete a system type', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.deleteTrainingType.mockRejectedValue(
      new TrainingTypeError(
        'Treinamentos do sistema não podem ser excluídos',
        'SYSTEM_TYPE_READONLY',
      ),
    );

    const res = await request(app)
      .delete(`/api/training-types/${TYPE_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'SYSTEM_TYPE_READONLY');
  });

  it('returns 409 when type has training records', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.deleteTrainingType.mockRejectedValue(
      new TrainingTypeError('Tipo de treinamento possui registros vinculados', 'HAS_RECORDS'),
    );

    const res = await request(app)
      .delete('/api/training-types/type-custom')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('code', 'HAS_RECORDS');
  });
});

// ─── Test 7: GET /training-types/position-requirements ───────────────

describe('GET /api/training-types/position-requirements', () => {
  it('returns all position requirements for the org', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listPositionTrainingRequirements.mockResolvedValue([SAMPLE_REQUIREMENT]);

    const res = await request(app)
      .get('/api/training-types/position-requirements')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty('positionName', 'Operador de Máquinas');
    expect(res.body[0]).toHaveProperty('trainingTypeName', 'Agrotóxicos');
  });

  it('filters by positionId when query param provided', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listPositionTrainingRequirements.mockResolvedValue([SAMPLE_REQUIREMENT]);

    const res = await request(app)
      .get('/api/training-types/position-requirements?positionId=pos-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listPositionTrainingRequirements).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      'pos-1',
    );
  });
});

// ─── Test 8: POST /training-types/position-requirements ──────────────

describe('POST /api/training-types/position-requirements', () => {
  it('creates position training requirement successfully', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createPositionTrainingRequirement.mockResolvedValue(SAMPLE_REQUIREMENT);

    const res = await request(app)
      .post('/api/training-types/position-requirements')
      .set('Authorization', 'Bearer token')
      .send({ positionId: 'pos-1', trainingTypeId: TYPE_ID });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'req-1');
    expect(res.body).toHaveProperty('positionId', 'pos-1');
  });

  it('returns 409 when requirement already exists', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.createPositionTrainingRequirement.mockRejectedValue(
      new TrainingTypeError(
        'Este tipo de treinamento já está vinculado a este cargo',
        'DUPLICATE_REQUIREMENT',
      ),
    );

    const res = await request(app)
      .post('/api/training-types/position-requirements')
      .set('Authorization', 'Bearer token')
      .send({ positionId: 'pos-1', trainingTypeId: TYPE_ID });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('code', 'DUPLICATE_REQUIREMENT');
  });
});

// ─── Test 9: DELETE /training-types/position-requirements/:id ────────

describe('DELETE /api/training-types/position-requirements/:id', () => {
  it('deletes position requirement and returns 204', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.deletePositionTrainingRequirement.mockResolvedValue();

    const res = await request(app)
      .delete('/api/training-types/position-requirements/req-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
  });

  it('returns 404 when requirement not found', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.deletePositionTrainingRequirement.mockRejectedValue(
      new TrainingTypeError('Requisito de treinamento não encontrado', 'NOT_FOUND'),
    );

    const res = await request(app)
      .delete('/api/training-types/position-requirements/nonexistent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── Test 10: GET /training-types/position-requirements/:positionId ──

describe('GET /api/training-types/position-requirements/:positionId', () => {
  it('returns requirements filtered by positionId path param', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.listPositionTrainingRequirements.mockResolvedValue([SAMPLE_REQUIREMENT]);

    const res = await request(app)
      .get('/api/training-types/position-requirements/pos-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockedService.listPositionTrainingRequirements).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID }),
      'pos-1',
    );
  });
});

// ─── Test 11: PUT /training-types/:id updates custom type ────────────

describe('PUT /api/training-types/:id — update custom type', () => {
  it('updates custom training type successfully', async () => {
    authAs(MANAGER_PAYLOAD);
    const updated = { ...CUSTOM_TRAINING_TYPE, minHours: 8 };
    mockedService.updateTrainingType.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/training-types/type-custom')
      .set('Authorization', 'Bearer token')
      .send({ minHours: 8 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('minHours', 8);
  });
});

// ─── Test 12: Unauthenticated request returns 401 ────────────────────

describe('Authentication required', () => {
  it('returns 401 when no auth header provided', async () => {
    const res = await request(app).get('/api/training-types');

    expect(res.status).toBe(401);
  });
});
