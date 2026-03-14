import request from 'supertest';
import { app } from '../../app';
import * as sanitaryService from './sanitary-protocols.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { SanitaryProtocolError } from './sanitary-protocols.types';

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

jest.mock('./sanitary-protocols.service', () => ({
  createSanitaryProtocol: jest.fn(),
  listSanitaryProtocols: jest.fn(),
  getSanitaryProtocol: jest.fn(),
  updateSanitaryProtocol: jest.fn(),
  deleteSanitaryProtocol: jest.fn(),
  duplicateSanitaryProtocol: jest.fn(),
  listSanitaryProtocolVersions: jest.fn(),
  seedSanitaryProtocols: jest.fn(),
  getSanitaryAlerts: jest.fn(),
  listProcedureTypes: jest.fn(),
  listTriggerTypes: jest.fn(),
  listEventTriggers: jest.fn(),
  listCalendarFrequencies: jest.fn(),
  listSanitaryStatuses: jest.fn(),
  listTargetCategories: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(sanitaryService);
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

const SAMPLE_ITEM = {
  id: 'item-1',
  order: 1,
  procedureType: 'VACCINATION',
  procedureTypeLabel: 'Vacinação',
  productId: null,
  productName: 'Vacina contra clostridioses',
  dosage: 5,
  dosageUnit: 'ML_ANIMAL',
  dosageUnitLabel: 'mL/animal',
  administrationRoute: 'SC',
  administrationRouteLabel: 'Subcutâneo',
  triggerType: 'AGE',
  triggerTypeLabel: 'Por idade',
  triggerAgeDays: 120,
  triggerAgeMaxDays: null,
  triggerEvent: null,
  triggerEventLabel: null,
  triggerEventOffsetDays: null,
  calendarFrequency: null,
  calendarFrequencyLabel: null,
  calendarMonths: [],
  isReinforcement: false,
  reinforcementIntervalDays: null,
  reinforcementDoseNumber: null,
  withdrawalMeatDays: null,
  withdrawalMilkDays: null,
  notes: null,
};

const SAMPLE_PROTOCOL = {
  id: 'sp-1',
  organizationId: 'org-1',
  name: 'Protocolo Vacinal Bezerras',
  description: 'Vacinações para bezerras 0-12 meses',
  authorName: 'Dr. Veterinário',
  status: 'ACTIVE',
  statusLabel: 'Ativo',
  version: 1,
  originalId: null,
  isObligatory: false,
  targetCategories: ['BEZERRA'],
  targetCategoryLabels: ['Bezerra'],
  items: [SAMPLE_ITEM],
  createdAt: '2026-03-14T00:00:00.000Z',
  updatedAt: '2026-03-14T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── METADATA ──────────────────────────────────────────────────────

describe('GET /api/org/sanitary-protocols/procedure-types', () => {
  it('returns procedure types', async () => {
    authAs(ADMIN_PAYLOAD);
    const data = [{ value: 'VACCINATION', label: 'Vacinação' }];
    mockedService.listProcedureTypes.mockReturnValue(data);

    const res = await request(app)
      .get('/api/org/sanitary-protocols/procedure-types')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
  });
});

describe('GET /api/org/sanitary-protocols/trigger-types', () => {
  it('returns trigger types', async () => {
    authAs(ADMIN_PAYLOAD);
    const data = [{ value: 'AGE', label: 'Por idade' }];
    mockedService.listTriggerTypes.mockReturnValue(data);

    const res = await request(app)
      .get('/api/org/sanitary-protocols/trigger-types')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
  });
});

describe('GET /api/org/sanitary-protocols/event-triggers', () => {
  it('returns event triggers', async () => {
    authAs(ADMIN_PAYLOAD);
    const data = [{ value: 'BIRTH', label: 'Nascimento' }];
    mockedService.listEventTriggers.mockReturnValue(data);

    const res = await request(app)
      .get('/api/org/sanitary-protocols/event-triggers')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
  });
});

describe('GET /api/org/sanitary-protocols/calendar-frequencies', () => {
  it('returns calendar frequencies', async () => {
    authAs(ADMIN_PAYLOAD);
    const data = [{ value: 'ANNUAL', label: 'Anual' }];
    mockedService.listCalendarFrequencies.mockReturnValue(data);

    const res = await request(app)
      .get('/api/org/sanitary-protocols/calendar-frequencies')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
  });
});

describe('GET /api/org/sanitary-protocols/statuses', () => {
  it('returns statuses', async () => {
    authAs(ADMIN_PAYLOAD);
    const data = [{ value: 'ACTIVE', label: 'Ativo' }];
    mockedService.listSanitaryStatuses.mockReturnValue(data);

    const res = await request(app)
      .get('/api/org/sanitary-protocols/statuses')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
  });
});

describe('GET /api/org/sanitary-protocols/target-categories', () => {
  it('returns target categories', async () => {
    authAs(ADMIN_PAYLOAD);
    const data = [{ value: 'BEZERRA', label: 'Bezerra' }];
    mockedService.listTargetCategories.mockReturnValue(data);

    const res = await request(app)
      .get('/api/org/sanitary-protocols/target-categories')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
  });
});

// ─── CREATE ─────────────────────────────────────────────────────────

describe('POST /api/org/sanitary-protocols', () => {
  const payload = {
    name: 'Protocolo Vacinal Bezerras',
    description: 'Vacinações para bezerras 0-12 meses',
    authorName: 'Dr. Veterinário',
    targetCategories: ['BEZERRA'],
    items: [
      {
        order: 1,
        procedureType: 'VACCINATION',
        productName: 'Vacina contra clostridioses',
        dosage: 5,
        dosageUnit: 'ML_ANIMAL',
        administrationRoute: 'SC',
        triggerType: 'AGE',
        triggerAgeDays: 120,
      },
    ],
  };

  it('creates a sanitary protocol (201)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createSanitaryProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    const res = await request(app)
      .post('/api/org/sanitary-protocols')
      .set('Authorization', 'Bearer token')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Protocolo Vacinal Bezerras');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_SANITARY_PROTOCOL' }),
    );
  });

  it('returns 400 on validation error', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createSanitaryProtocol.mockRejectedValue(
      new SanitaryProtocolError('Nome do protocolo é obrigatório', 400),
    );

    const res = await request(app)
      .post('/api/org/sanitary-protocols')
      .set('Authorization', 'Bearer token')
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate name', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createSanitaryProtocol.mockRejectedValue(
      new SanitaryProtocolError('Já existe um protocolo sanitário com esse nome', 409),
    );

    const res = await request(app)
      .post('/api/org/sanitary-protocols')
      .set('Authorization', 'Bearer token')
      .send(payload);

    expect(res.status).toBe(409);
  });

  it('returns 403 for OPERATOR role', async () => {
    authAs(OPERATOR_PAYLOAD);

    const res = await request(app)
      .post('/api/org/sanitary-protocols')
      .set('Authorization', 'Bearer token')
      .send(payload);

    expect(res.status).toBe(403);
  });
});

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /api/org/sanitary-protocols', () => {
  it('lists protocols with pagination', async () => {
    authAs(ADMIN_PAYLOAD);
    const response = {
      data: [SAMPLE_PROTOCOL],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    mockedService.listSanitaryProtocols.mockResolvedValue(response);

    const res = await request(app)
      .get('/api/org/sanitary-protocols')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('passes query params to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listSanitaryProtocols.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    await request(app)
      .get(
        '/api/org/sanitary-protocols?status=ACTIVE&procedureType=VACCINATION&targetCategory=BEZERRA&search=vacinal',
      )
      .set('Authorization', 'Bearer token');

    expect(mockedService.listSanitaryProtocols).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        status: 'ACTIVE',
        procedureType: 'VACCINATION',
        targetCategory: 'BEZERRA',
        search: 'vacinal',
      }),
    );
  });
});

// ─── GET ────────────────────────────────────────────────────────────

describe('GET /api/org/sanitary-protocols/:protocolId', () => {
  it('returns a single protocol', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getSanitaryProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    const res = await request(app)
      .get('/api/org/sanitary-protocols/sp-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sp-1');
  });

  it('returns 404 when not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getSanitaryProtocol.mockRejectedValue(
      new SanitaryProtocolError('Protocolo sanitário não encontrado', 404),
    );

    const res = await request(app)
      .get('/api/org/sanitary-protocols/not-found')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── UPDATE ─────────────────────────────────────────────────────────

describe('PATCH /api/org/sanitary-protocols/:protocolId', () => {
  it('updates a protocol', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...SAMPLE_PROTOCOL, name: 'Protocolo Atualizado' };
    mockedService.updateSanitaryProtocol.mockResolvedValue(updated);

    const res = await request(app)
      .patch('/api/org/sanitary-protocols/sp-1')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Protocolo Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Protocolo Atualizado');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_SANITARY_PROTOCOL' }),
    );
  });

  it('creates new version when items change', async () => {
    authAs(ADMIN_PAYLOAD);
    const versioned = { ...SAMPLE_PROTOCOL, version: 2, originalId: 'sp-1' };
    mockedService.updateSanitaryProtocol.mockResolvedValue(versioned);

    const res = await request(app)
      .patch('/api/org/sanitary-protocols/sp-1')
      .set('Authorization', 'Bearer token')
      .send({
        items: [
          {
            order: 1,
            procedureType: 'VACCINATION',
            productName: 'Nova vacina',
            triggerType: 'AGE',
            triggerAgeDays: 120,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
  });
});

// ─── DUPLICATE ──────────────────────────────────────────────────────

describe('POST /api/org/sanitary-protocols/:protocolId/duplicate', () => {
  it('duplicates a protocol', async () => {
    authAs(ADMIN_PAYLOAD);
    const duplicated = {
      ...SAMPLE_PROTOCOL,
      id: 'sp-2',
      name: 'Protocolo Vacinal Bezerras (cópia)',
    };
    mockedService.duplicateSanitaryProtocol.mockResolvedValue(duplicated);

    const res = await request(app)
      .post('/api/org/sanitary-protocols/sp-1/duplicate')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(201);
    expect(res.body.name).toContain('cópia');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DUPLICATE_SANITARY_PROTOCOL' }),
    );
  });
});

// ─── VERSION HISTORY ────────────────────────────────────────────────

describe('GET /api/org/sanitary-protocols/:protocolId/versions', () => {
  it('returns version history', async () => {
    authAs(ADMIN_PAYLOAD);
    const v2 = { ...SAMPLE_PROTOCOL, version: 2, originalId: 'sp-1' };
    mockedService.listSanitaryProtocolVersions.mockResolvedValue([v2, SAMPLE_PROTOCOL]);

    const res = await request(app)
      .get('/api/org/sanitary-protocols/sp-1/versions')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/org/sanitary-protocols/:protocolId', () => {
  it('soft deletes a protocol (204)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteSanitaryProtocol.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/org/sanitary-protocols/sp-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_SANITARY_PROTOCOL' }),
    );
  });

  it('returns 404 when not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteSanitaryProtocol.mockRejectedValue(
      new SanitaryProtocolError('Protocolo sanitário não encontrado', 404),
    );

    const res = await request(app)
      .delete('/api/org/sanitary-protocols/not-found')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });

  it('returns 403 for OPERATOR role', async () => {
    authAs(OPERATOR_PAYLOAD);

    const res = await request(app)
      .delete('/api/org/sanitary-protocols/sp-1')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});

// ─── SEED (CA8, CA9, CA10) ──────────────────────────────────────────

describe('POST /api/org/sanitary-protocols/seed', () => {
  it('seeds sanitary protocols (201)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.seedSanitaryProtocols.mockResolvedValue({ created: 8, total: 8 });

    const res = await request(app)
      .post('/api/org/sanitary-protocols/seed')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ created: 8, total: 8 });
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SEED_SANITARY_PROTOCOLS' }),
    );
  });

  it('skips duplicates on re-seed', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.seedSanitaryProtocols.mockResolvedValue({ created: 0, total: 8 });

    const res = await request(app)
      .post('/api/org/sanitary-protocols/seed')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(0);
  });

  it('returns 403 for OPERATOR role', async () => {
    authAs(OPERATOR_PAYLOAD);

    const res = await request(app)
      .post('/api/org/sanitary-protocols/seed')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});

// ─── ALERTS (CA12) ──────────────────────────────────────────────────

const SAMPLE_ALERTS_RESPONSE = {
  summary: { overdue: 1, due7Days: 1, due15Days: 0, due30Days: 1, total: 3 },
  alerts: [
    {
      protocolId: 'sp-1',
      protocolName: 'Protocolo Vacinal Bezerras',
      protocolItemId: 'item-1',
      procedureType: 'VACCINATION',
      procedureTypeLabel: 'Vacinação',
      productName: 'Vacina clostridioses',
      triggerType: 'AGE',
      triggerTypeLabel: 'Por idade',
      urgency: 'OVERDUE',
      urgencyLabel: 'Atrasado',
      isObligatory: false,
      targetCategories: ['BEZERRA'],
      targetCategoryLabels: ['Bezerra'],
      animalCount: 3,
      sampleAnimals: [
        { id: 'a-1', earTag: '001', name: 'Mimosa', farmName: 'Fazenda A', ageDays: 130 },
      ],
      calendarMonths: [],
      dueDescription: '10 dia(s) atrasado para 3 animal(is)',
      dosage: 5,
      dosageUnit: 'ML_ANIMAL',
      dosageUnitLabel: 'mL/animal',
      administrationRoute: 'SC',
      administrationRouteLabel: 'Subcutâneo',
      notes: null,
    },
  ],
};

describe('GET /api/org/sanitary-protocols/alerts', () => {
  it('returns alerts with default params', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getSanitaryAlerts.mockResolvedValue(SAMPLE_ALERTS_RESPONSE);

    const res = await request(app)
      .get('/api/org/sanitary-protocols/alerts')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total).toBe(3);
    expect(res.body.alerts).toHaveLength(1);
    expect(mockedService.getSanitaryAlerts).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      {
        farmId: undefined,
        daysAhead: undefined,
        urgency: undefined,
        procedureType: undefined,
        targetCategory: undefined,
      },
    );
  });

  it('passes query params to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getSanitaryAlerts.mockResolvedValue({
      summary: { overdue: 0, due7Days: 0, due15Days: 0, due30Days: 0, total: 0 },
      alerts: [],
    });

    await request(app)
      .get('/api/org/sanitary-protocols/alerts')
      .query({
        farmId: 'farm-1',
        daysAhead: '15',
        urgency: 'OVERDUE',
        procedureType: 'VACCINATION',
        targetCategory: 'BEZERRA',
      })
      .set('Authorization', 'Bearer token');

    expect(mockedService.getSanitaryAlerts).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      {
        farmId: 'farm-1',
        daysAhead: 15,
        urgency: 'OVERDUE',
        procedureType: 'VACCINATION',
        targetCategory: 'BEZERRA',
      },
    );
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/org/sanitary-protocols/alerts');
    expect(res.status).toBe(401);
  });

  it('handles service errors', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getSanitaryAlerts.mockRejectedValue(new Error('db error'));

    const res = await request(app)
      .get('/api/org/sanitary-protocols/alerts')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
  });
});

// ─── ERROR HANDLING ─────────────────────────────────────────────────

describe('Error handling', () => {
  it('returns 500 for unexpected errors', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listSanitaryProtocols.mockRejectedValue(new Error('unexpected'));

    const res = await request(app)
      .get('/api/org/sanitary-protocols')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erro interno do servidor');
  });
});
