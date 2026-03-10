import request from 'supertest';
import { app } from '../../app';
import * as operationTypeService from './operation-types.service';
import * as authService from '../auth/auth.service';
import {
  OperationTypeError,
  OperationTypeItem,
  FieldConfig,
  CropOperationSequenceItem,
} from './operation-types.types';

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

jest.mock('./operation-types.service', () => ({
  createOperationType: jest.fn(),
  listOperationTypes: jest.fn(),
  getOperationTypeTree: jest.fn(),
  getOperationType: jest.fn(),
  updateOperationType: jest.fn(),
  toggleOperationTypeActive: jest.fn(),
  deleteOperationType: jest.fn(),
  seedOperationTypes: jest.fn(),
  getCropSequence: jest.fn(),
  listCropSequences: jest.fn(),
  setCropSequence: jest.fn(),
  deleteCropSequence: jest.fn(),
  seedCropSequences: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(operationTypeService);
const mockedAuth = jest.mocked(authService);

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

const SAMPLE_ITEM: OperationTypeItem = {
  id: 'ot-1',
  organizationId: 'org-1',
  name: 'Preparo de Solo',
  description: 'Operações de preparo do solo',
  parentId: null,
  level: 1,
  sortOrder: 0,
  isSystem: false,
  isActive: true,
  childCount: 3,
  crops: ['Soja', 'Milho'],
  fields: [],
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
};

const SAMPLE_CHILD: OperationTypeItem = {
  ...SAMPLE_ITEM,
  id: 'ot-2',
  name: 'Aração',
  parentId: 'ot-1',
  level: 2,
  childCount: 0,
  crops: ['Soja'],
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── CREATE ─────────────────────────────────────────────────────────

describe('POST /api/org/operation-types', () => {
  it('should create a level-1 operation type', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOperationType.mockResolvedValue(SAMPLE_ITEM);

    const res = await request(app)
      .post('/api/org/operation-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Preparo de Solo', description: 'Operações de preparo do solo' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Preparo de Solo');
    expect(res.body.level).toBe(1);
    expect(mockedService.createOperationType).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      { name: 'Preparo de Solo', description: 'Operações de preparo do solo' },
    );
  });

  it('should create a child operation type', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOperationType.mockResolvedValue(SAMPLE_CHILD);

    const res = await request(app)
      .post('/api/org/operation-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Aração', parentId: 'ot-1' });

    expect(res.status).toBe(201);
    expect(res.body.parentId).toBe('ot-1');
    expect(res.body.level).toBe(2);
  });

  it('should return 409 for duplicate name', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOperationType.mockRejectedValue(
      new OperationTypeError('Já existe um tipo de operação com este nome neste nível', 409),
    );

    const res = await request(app)
      .post('/api/org/operation-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Preparo de Solo' });

    expect(res.status).toBe(409);
  });

  it('should return 400 when exceeding max levels', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOperationType.mockRejectedValue(
      new OperationTypeError('Máximo de 3 níveis hierárquicos permitidos', 400),
    );

    const res = await request(app)
      .post('/api/org/operation-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Sub-sub-sub', parentId: 'level3-id' });

    expect(res.status).toBe(400);
  });

  it('should deny access without farms:update permission', async () => {
    authAs(OPERATOR_PAYLOAD);

    const res = await request(app)
      .post('/api/org/operation-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Teste' });

    expect(res.status).toBe(403);
  });
});

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /api/org/operation-types', () => {
  it('should list operation types', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOperationTypes.mockResolvedValue([SAMPLE_ITEM, SAMPLE_CHILD]);

    const res = await request(app)
      .get('/api/org/operation-types')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('should filter by parentId', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOperationTypes.mockResolvedValue([SAMPLE_CHILD]);

    const res = await request(app)
      .get('/api/org/operation-types?parentId=ot-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listOperationTypes).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({ parentId: 'ot-1' }),
    );
  });

  it('should filter roots with parentId=null', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOperationTypes.mockResolvedValue([SAMPLE_ITEM]);

    await request(app)
      .get('/api/org/operation-types?parentId=null')
      .set('Authorization', 'Bearer token');

    expect(mockedService.listOperationTypes).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({ parentId: null }),
    );
  });

  it('should search by name', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOperationTypes.mockResolvedValue([SAMPLE_ITEM]);

    await request(app)
      .get('/api/org/operation-types?search=preparo')
      .set('Authorization', 'Bearer token');

    expect(mockedService.listOperationTypes).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({ search: 'preparo' }),
    );
  });
});

// ─── TREE ───────────────────────────────────────────────────────────

describe('GET /api/org/operation-types/tree', () => {
  it('should return full tree structure', async () => {
    authAs(ADMIN_PAYLOAD);
    const tree = [{ ...SAMPLE_ITEM, children: [{ ...SAMPLE_CHILD, children: [] }] }];
    mockedService.getOperationTypeTree.mockResolvedValue(tree);

    const res = await request(app)
      .get('/api/org/operation-types/tree')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].children).toHaveLength(1);
    expect(res.body[0].children[0].name).toBe('Aração');
  });
});

// ─── GET BY ID ──────────────────────────────────────────────────────

describe('GET /api/org/operation-types/:id', () => {
  it('should return a single operation type', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getOperationType.mockResolvedValue(SAMPLE_ITEM);

    const res = await request(app)
      .get('/api/org/operation-types/ot-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('ot-1');
  });

  it('should return 404 for non-existent', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getOperationType.mockRejectedValue(
      new OperationTypeError('Tipo de operação não encontrado', 404),
    );

    const res = await request(app)
      .get('/api/org/operation-types/non-existent')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE ─────────────────────────────────────────────────────────

describe('PATCH /api/org/operation-types/:id', () => {
  it('should update an operation type', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_ITEM, name: 'Preparo do Solo Atualizado' };
    mockedService.updateOperationType.mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/org/operation-types/ot-1')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Preparo do Solo Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Preparo do Solo Atualizado');
  });

  it('should return 400 for self-parent', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateOperationType.mockRejectedValue(
      new OperationTypeError('Tipo de operação não pode ser pai de si mesmo', 400),
    );

    const res = await request(app)
      .patch('/api/org/operation-types/ot-1')
      .set('Authorization', 'Bearer token')
      .send({ parentId: 'ot-1' });

    expect(res.status).toBe(400);
  });
});

// ─── TOGGLE ACTIVE ──────────────────────────────────────────────────

describe('PATCH /api/org/operation-types/:id/toggle-active', () => {
  it('should toggle active state', async () => {
    authAs(ADMIN_PAYLOAD);
    const toggled = { ...SAMPLE_ITEM, isActive: false };
    mockedService.toggleOperationTypeActive.mockResolvedValue(toggled);

    const res = await request(app)
      .patch('/api/org/operation-types/ot-1/toggle-active')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/org/operation-types/:id', () => {
  it('should soft-delete an operation type', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteOperationType.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/org/operation-types/ot-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
  });

  it('should return 400 when deleting with children', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteOperationType.mockRejectedValue(
      new OperationTypeError(
        'Não é possível excluir: existem sub-operações vinculadas. Remova-as primeiro.',
        400,
      ),
    );

    const res = await request(app)
      .delete('/api/org/operation-types/ot-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
  });
});

// ─── CA2: CROP LINKAGE ──────────────────────────────────────────────

describe('CA2: Crop linkage', () => {
  it('should create operation type with crops', async () => {
    authAs(ADMIN_PAYLOAD);
    const withCrops = { ...SAMPLE_ITEM, crops: ['Café', 'Milho', 'Soja'] };
    mockedService.createOperationType.mockResolvedValue(withCrops);

    const res = await request(app)
      .post('/api/org/operation-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Colheita', crops: ['Soja', 'Milho', 'Café'] });

    expect(res.status).toBe(201);
    expect(res.body.crops).toEqual(['Café', 'Milho', 'Soja']);
  });

  it('should return crops in tree response', async () => {
    authAs(ADMIN_PAYLOAD);
    const tree = [
      {
        ...SAMPLE_ITEM,
        crops: ['Milho', 'Soja'],
        children: [{ ...SAMPLE_CHILD, crops: ['Soja'], children: [] }],
      },
    ];
    mockedService.getOperationTypeTree.mockResolvedValue(tree);

    const res = await request(app)
      .get('/api/org/operation-types/tree')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body[0].crops).toEqual(['Milho', 'Soja']);
    expect(res.body[0].children[0].crops).toEqual(['Soja']);
  });

  it('should update crops on existing type', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_ITEM, crops: ['Café', 'Laranja'] };
    mockedService.updateOperationType.mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/org/operation-types/ot-1')
      .set('Authorization', 'Bearer token')
      .send({ crops: ['Café', 'Laranja'] });

    expect(res.status).toBe(200);
    expect(res.body.crops).toEqual(['Café', 'Laranja']);
  });

  it('should reject child crops not in parent', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOperationType.mockRejectedValue(
      new OperationTypeError(
        'Culturas não permitidas pelo nível pai: Trigo. Culturas disponíveis: Soja, Milho',
        400,
      ),
    );

    const res = await request(app)
      .post('/api/org/operation-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Sub-op', parentId: 'ot-1', crops: ['Soja', 'Trigo'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('não permitidas');
  });

  it('should accept "Todas" as wildcard crop', async () => {
    authAs(ADMIN_PAYLOAD);
    const withTodas = { ...SAMPLE_ITEM, crops: ['Todas'] };
    mockedService.createOperationType.mockResolvedValue(withTodas);

    const res = await request(app)
      .post('/api/org/operation-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Genérica', crops: ['Todas'] });

    expect(res.status).toBe(201);
    expect(res.body.crops).toEqual(['Todas']);
  });
});

// ─── CA3: FILTER BY CROP ───────────────────────────────────────────

describe('CA3: Filter by crop', () => {
  it('should pass crop filter to list endpoint', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOperationTypes.mockResolvedValue([SAMPLE_CHILD]);

    const res = await request(app)
      .get('/api/org/operation-types?crop=Soja')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listOperationTypes).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({ crop: 'Soja' }),
    );
  });

  it('should pass crop filter to tree endpoint', async () => {
    authAs(ADMIN_PAYLOAD);
    const tree = [
      {
        ...SAMPLE_ITEM,
        crops: ['Soja', 'Milho'],
        children: [{ ...SAMPLE_CHILD, crops: ['Soja'], children: [] }],
      },
    ];
    mockedService.getOperationTypeTree.mockResolvedValue(tree);

    const res = await request(app)
      .get('/api/org/operation-types/tree?crop=Soja')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.getOperationTypeTree).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({ crop: 'Soja' }),
    );
  });

  it('should not pass crop when not specified', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listOperationTypes.mockResolvedValue([SAMPLE_ITEM]);

    await request(app).get('/api/org/operation-types').set('Authorization', 'Bearer token');

    expect(mockedService.listOperationTypes).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      expect.objectContaining({ crop: undefined }),
    );
  });

  it('should filter tree by crop and return only matching branches', async () => {
    authAs(ADMIN_PAYLOAD);
    const filteredTree = [
      {
        ...SAMPLE_ITEM,
        name: 'Tratos Culturais',
        crops: ['Café', 'Todas'],
        children: [
          {
            ...SAMPLE_CHILD,
            name: 'Derriça',
            crops: ['Café'],
            children: [],
          },
        ],
      },
    ];
    mockedService.getOperationTypeTree.mockResolvedValue(filteredTree);

    const res = await request(app)
      .get('/api/org/operation-types/tree?crop=Café')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].children[0].name).toBe('Derriça');
  });
});

// ─── CA4: SEED DEFAULTS ─────────────────────────────────────────────

describe('CA4: Seed default operation types', () => {
  it('should seed default operation types', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.seedOperationTypes.mockResolvedValue({ created: 42 });

    const res = await request(app)
      .post('/api/org/operation-types/seed')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(42);
    expect(mockedService.seedOperationTypes).toHaveBeenCalledWith({
      organizationId: 'org-1',
    });
  });

  it('should return 409 if org already has operation types', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.seedOperationTypes.mockRejectedValue(
      new OperationTypeError(
        'Organização já possui tipos de operação cadastrados. O carregamento padrão só pode ser feito em organizações sem cadastros existentes.',
        409,
      ),
    );

    const res = await request(app)
      .post('/api/org/operation-types/seed')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(409);
  });

  it('should deny access without farms:update permission', async () => {
    authAs(OPERATOR_PAYLOAD);

    const res = await request(app)
      .post('/api/org/operation-types/seed')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});

// ─── CA5: FIELD CONFIGURATION ──────────────────────────────────────

describe('CA5: Field configuration', () => {
  const sampleFields: FieldConfig[] = [
    { fieldKey: 'product', visibility: 'required', sortOrder: 0 },
    { fieldKey: 'dose', visibility: 'required', sortOrder: 1 },
  ];

  it('should create operation type with field configs', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createOperationType.mockResolvedValue({ ...SAMPLE_ITEM, fields: sampleFields });

    const res = await request(app)
      .post('/api/org/operation-types')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Pulverização', fields: sampleFields });

    expect(res.status).toBe(201);
    expect(res.body.fields).toHaveLength(2);
    expect(res.body.fields[0].fieldKey).toBe('product');
  });

  it('should update field configs on existing type', async () => {
    authAs(ADMIN_PAYLOAD);
    const machineField: FieldConfig[] = [
      { fieldKey: 'machine', visibility: 'required', sortOrder: 0 },
    ];
    mockedService.updateOperationType.mockResolvedValue({ ...SAMPLE_ITEM, fields: machineField });

    const res = await request(app)
      .patch('/api/org/operation-types/ot-1')
      .set('Authorization', 'Bearer token')
      .send({ fields: machineField });

    expect(res.status).toBe(200);
    expect(res.body.fields).toHaveLength(1);
  });

  it('should return fields in operation type response', async () => {
    authAs(ADMIN_PAYLOAD);
    const mixedFields: FieldConfig[] = [
      { fieldKey: 'product', visibility: 'required', sortOrder: 0 },
      { fieldKey: 'machine', visibility: 'hidden', sortOrder: 1 },
    ];
    mockedService.getOperationType.mockResolvedValue({ ...SAMPLE_ITEM, fields: mixedFields });

    const res = await request(app)
      .get('/api/org/operation-types/ot-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.fields).toHaveLength(2);
  });
});

// ─── CA6: CROP OPERATION SEQUENCES ──────────────────────────────────

const SAMPLE_SEQUENCE: CropOperationSequenceItem[] = [
  {
    id: 'seq-1',
    organizationId: 'org-1',
    crop: 'Café',
    operationTypeId: 'ot-poda',
    operationTypeName: 'Poda',
    sequenceOrder: 1,
    notes: 'Após colheita',
  },
  {
    id: 'seq-2',
    organizationId: 'org-1',
    crop: 'Café',
    operationTypeId: 'ot-adub',
    operationTypeName: 'Adubação de cobertura',
    sequenceOrder: 2,
    notes: 'Início das chuvas',
  },
  {
    id: 'seq-3',
    organizationId: 'org-1',
    crop: 'Café',
    operationTypeId: 'ot-derrica',
    operationTypeName: 'Derriça',
    sequenceOrder: 3,
    notes: null,
  },
];

describe('CA6: Crop operation sequences', () => {
  describe('GET /api/org/operation-sequences', () => {
    it('should return sequence for a specific crop', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getCropSequence.mockResolvedValue(SAMPLE_SEQUENCE);

      const res = await request(app)
        .get('/api/org/operation-sequences?crop=Café')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].operationTypeName).toBe('Poda');
      expect(res.body[0].sequenceOrder).toBe(1);
      expect(res.body[2].sequenceOrder).toBe(3);
      expect(mockedService.getCropSequence).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'Café',
      );
    });

    it('should return all sequences grouped by crop when no filter', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listCropSequences.mockResolvedValue({
        Café: SAMPLE_SEQUENCE,
        Soja: [{ ...SAMPLE_SEQUENCE[0], crop: 'Soja', operationTypeName: 'Dessecação' }],
      });

      const res = await request(app)
        .get('/api/org/operation-sequences')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.Café).toHaveLength(3);
      expect(res.body.Soja).toHaveLength(1);
    });

    it('should require farms:read permission', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .get('/api/org/operation-sequences?crop=Café')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/org/operation-sequences', () => {
    it('should set sequence for a crop', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.setCropSequence.mockResolvedValue(SAMPLE_SEQUENCE);

      const res = await request(app)
        .put('/api/org/operation-sequences')
        .set('Authorization', 'Bearer token')
        .send({
          crop: 'Café',
          items: [
            { operationTypeId: 'ot-poda', notes: 'Após colheita' },
            { operationTypeId: 'ot-adub', notes: 'Início das chuvas' },
            { operationTypeId: 'ot-derrica' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(mockedService.setCropSequence).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        {
          crop: 'Café',
          items: [
            { operationTypeId: 'ot-poda', notes: 'Após colheita' },
            { operationTypeId: 'ot-adub', notes: 'Início das chuvas' },
            { operationTypeId: 'ot-derrica' },
          ],
        },
      );
    });

    it('should return 400 for empty sequence', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.setCropSequence.mockRejectedValue(
        new OperationTypeError('A sequência deve conter ao menos uma operação', 400),
      );

      const res = await request(app)
        .put('/api/org/operation-sequences')
        .set('Authorization', 'Bearer token')
        .send({ crop: 'Café', items: [] });

      expect(res.status).toBe(400);
    });

    it('should return 400 for duplicate operations', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.setCropSequence.mockRejectedValue(
        new OperationTypeError('Tipos de operação duplicados na sequência', 400),
      );

      const res = await request(app)
        .put('/api/org/operation-sequences')
        .set('Authorization', 'Bearer token')
        .send({
          crop: 'Café',
          items: [{ operationTypeId: 'ot-1' }, { operationTypeId: 'ot-1' }],
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent operation types', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.setCropSequence.mockRejectedValue(
        new OperationTypeError('Tipos de operação não encontrados: ot-999', 404),
      );

      const res = await request(app)
        .put('/api/org/operation-sequences')
        .set('Authorization', 'Bearer token')
        .send({ crop: 'Café', items: [{ operationTypeId: 'ot-999' }] });

      expect(res.status).toBe(404);
    });

    it('should deny access without farms:update permission', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .put('/api/org/operation-sequences')
        .set('Authorization', 'Bearer token')
        .send({ crop: 'Café', items: [{ operationTypeId: 'ot-1' }] });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/org/operation-sequences/:crop', () => {
    it('should delete sequence for a crop', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteCropSequence.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/operation-sequences/Café')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
      expect(mockedService.deleteCropSequence).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'Café',
      );
    });

    it('should return 404 for non-existent sequence', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteCropSequence.mockRejectedValue(
        new OperationTypeError('Sequência não encontrada para a cultura: Arroz', 404),
      );

      const res = await request(app)
        .delete('/api/org/operation-sequences/Arroz')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/org/operation-sequences/seed', () => {
    it('should seed default sequences', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.seedCropSequences.mockResolvedValue({ seeded: 45, skipped: [] });

      const res = await request(app)
        .post('/api/org/operation-sequences/seed')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(201);
      expect(res.body.seeded).toBe(45);
      expect(res.body.skipped).toEqual([]);
    });

    it('should return 409 if sequences already exist', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.seedCropSequences.mockRejectedValue(
        new OperationTypeError('Organização já possui sequências de operações cadastradas.', 409),
      );

      const res = await request(app)
        .post('/api/org/operation-sequences/seed')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(409);
    });

    it('should deny access without farms:update permission', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/operation-sequences/seed')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
    });
  });
});
