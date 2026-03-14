import request from 'supertest';
import { app } from '../../app';
import * as protocolsService from './treatment-protocols.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { TreatmentProtocolError } from './treatment-protocols.types';

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

jest.mock('./treatment-protocols.service', () => ({
  createProtocol: jest.fn(),
  listProtocols: jest.fn(),
  getProtocol: jest.fn(),
  updateProtocol: jest.fn(),
  deleteProtocol: jest.fn(),
  duplicateProtocol: jest.fn(),
  listVersions: jest.fn(),
  listAdministrationRoutes: jest.fn(),
  listDosageUnits: jest.fn(),
  listProtocolStatuses: jest.fn(),
  SEED_PROTOCOLS: [
    {
      name: 'Mastite clínica grau 1 — cefalosporina',
      description: 'Tratamento para mastite',
      severity: 'MILD',
      authorName: 'Vet',
      diseaseNames: ['Mastite clínica'],
      steps: [
        {
          order: 1,
          productName: 'Cefalosporina',
          dosage: 1,
          dosageUnit: 'FIXED_DOSE',
          administrationRoute: 'INTRAMMARY',
          frequencyPerDay: 2,
          startDay: 1,
          durationDays: 3,
        },
      ],
    },
  ],
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(protocolsService);
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

const SAMPLE_STEP = {
  id: 'step-1',
  order: 1,
  productId: null,
  productName: 'Cefalosporina',
  dosage: 1,
  dosageUnit: 'FIXED_DOSE',
  dosageUnitLabel: 'Dose fixa',
  administrationRoute: 'INTRAMMARY',
  administrationRouteLabel: 'Intramamária',
  frequencyPerDay: 2,
  startDay: 1,
  durationDays: 3,
  withdrawalMeatDays: 4,
  withdrawalMilkDays: 96,
  notes: null,
};

const SAMPLE_PROTOCOL = {
  id: 'prot-1',
  organizationId: 'org-1',
  name: 'Mastite clínica grau 1 — cefalosporina',
  description: 'Tratamento para mastite',
  notes: null,
  severity: 'MILD',
  severityLabel: 'Leve',
  authorName: 'Dr. Silva',
  status: 'ACTIVE',
  statusLabel: 'Ativo',
  version: 1,
  originalId: null,
  withdrawalMeatDays: 4,
  withdrawalMilkDays: 96,
  estimatedCostCents: null,
  diseases: [{ id: 'pd-1', diseaseId: 'disease-1', diseaseName: 'Mastite clínica' }],
  steps: [SAMPLE_STEP],
  createdAt: '2026-03-13T00:00:00.000Z',
  updatedAt: '2026-03-13T00:00:00.000Z',
};

describe('Treatment Protocols routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── METADATA ──────────────────────────────────────────────────────

  describe('GET /api/org/treatment-protocols/administration-routes', () => {
    it('should return administration routes', async () => {
      const routes = [
        { value: 'IM', label: 'Intramuscular' },
        { value: 'SC', label: 'Subcutâneo' },
      ];
      mockedService.listAdministrationRoutes.mockReturnValue(routes);

      const res = await request(app)
        .get('/api/org/treatment-protocols/administration-routes')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(routes);
    });
  });

  describe('GET /api/org/treatment-protocols/dosage-units', () => {
    it('should return dosage units', async () => {
      const units = [
        { value: 'MG_KG', label: 'mg/kg' },
        { value: 'ML_ANIMAL', label: 'mL/animal' },
      ];
      mockedService.listDosageUnits.mockReturnValue(units);

      const res = await request(app)
        .get('/api/org/treatment-protocols/dosage-units')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(units);
    });
  });

  describe('GET /api/org/treatment-protocols/statuses', () => {
    it('should return protocol statuses', async () => {
      const statuses = [
        { value: 'ACTIVE', label: 'Ativo' },
        { value: 'INACTIVE', label: 'Inativo' },
      ];
      mockedService.listProtocolStatuses.mockReturnValue(statuses);

      const res = await request(app)
        .get('/api/org/treatment-protocols/statuses')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(statuses);
    });
  });

  // ─── CREATE ────────────────────────────────────────────────────────

  describe('POST /api/org/treatment-protocols', () => {
    it('should create a protocol and return 201', async () => {
      mockedService.createProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

      const res = await request(app)
        .post('/api/org/treatment-protocols')
        .set('Authorization', 'Bearer tok')
        .send({
          name: 'Mastite clínica grau 1 — cefalosporina',
          authorName: 'Dr. Silva',
          diseaseIds: ['disease-1'],
          steps: [
            {
              order: 1,
              productName: 'Cefalosporina',
              dosage: 1,
              dosageUnit: 'FIXED_DOSE',
              administrationRoute: 'INTRAMMARY',
              durationDays: 3,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Mastite clínica grau 1 — cefalosporina');
      expect(res.body.steps).toHaveLength(1);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_TREATMENT_PROTOCOL',
          targetType: 'treatment_protocol',
          targetId: 'prot-1',
        }),
      );
    });

    it('should return 409 for duplicate name', async () => {
      mockedService.createProtocol.mockRejectedValue(
        new TreatmentProtocolError('Já existe um protocolo com esse nome', 409),
      );

      const res = await request(app)
        .post('/api/org/treatment-protocols')
        .set('Authorization', 'Bearer tok')
        .send({
          name: 'Mastite clínica grau 1',
          authorName: 'Dr. Silva',
          steps: [
            {
              order: 1,
              productName: 'Cefalosporina',
              dosage: 1,
              dosageUnit: 'FIXED_DOSE',
              administrationRoute: 'INTRAMMARY',
              durationDays: 3,
            },
          ],
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Já existe');
    });

    it('should return 400 for missing name', async () => {
      mockedService.createProtocol.mockRejectedValue(
        new TreatmentProtocolError('Nome do protocolo é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/treatment-protocols')
        .set('Authorization', 'Bearer tok')
        .send({ authorName: 'Dr. Silva', steps: [] });

      expect(res.status).toBe(400);
    });

    it('should return 400 for empty steps', async () => {
      mockedService.createProtocol.mockRejectedValue(
        new TreatmentProtocolError('O protocolo deve ter pelo menos uma etapa', 400),
      );

      const res = await request(app)
        .post('/api/org/treatment-protocols')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Test', authorName: 'Dr. Silva', steps: [] });

      expect(res.status).toBe(400);
    });
  });

  // ─── LIST ──────────────────────────────────────────────────────────

  describe('GET /api/org/treatment-protocols', () => {
    it('should return paginated list', async () => {
      const result = {
        data: [SAMPLE_PROTOCOL],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockedService.listProtocols.mockResolvedValue(result);

      const res = await request(app)
        .get('/api/org/treatment-protocols')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should pass query filters', async () => {
      mockedService.listProtocols.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await request(app)
        .get('/api/org/treatment-protocols?status=ACTIVE&diseaseId=d1&search=mastite')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listProtocols).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({
          status: 'ACTIVE',
          diseaseId: 'd1',
          search: 'mastite',
        }),
      );
    });

    it('should pass pagination params', async () => {
      mockedService.listProtocols.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 15, totalPages: 2 },
      });

      await request(app)
        .get('/api/org/treatment-protocols?page=2&limit=10')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listProtocols).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });
  });

  // ─── GET ───────────────────────────────────────────────────────────

  describe('GET /api/org/treatment-protocols/:protocolId', () => {
    it('should return a protocol by id', async () => {
      mockedService.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

      const res = await request(app)
        .get('/api/org/treatment-protocols/prot-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('prot-1');
      expect(res.body.steps).toHaveLength(1);
      expect(res.body.diseases).toHaveLength(1);
    });

    it('should return 404 for non-existing protocol', async () => {
      mockedService.getProtocol.mockRejectedValue(
        new TreatmentProtocolError('Protocolo não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/treatment-protocols/nonexistent')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────

  describe('PATCH /api/org/treatment-protocols/:protocolId', () => {
    it('should update a protocol', async () => {
      const updated = { ...SAMPLE_PROTOCOL, name: 'Mastite — atualizado' };
      mockedService.updateProtocol.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/treatment-protocols/prot-1')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Mastite — atualizado' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Mastite — atualizado');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_TREATMENT_PROTOCOL',
          targetId: 'prot-1',
        }),
      );
    });

    it('should return 404 when updating non-existing', async () => {
      mockedService.updateProtocol.mockRejectedValue(
        new TreatmentProtocolError('Protocolo não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/treatment-protocols/nonexistent')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });

    it('should create new version when steps change', async () => {
      const versioned = { ...SAMPLE_PROTOCOL, version: 2, originalId: 'prot-1', id: 'prot-2' };
      mockedService.updateProtocol.mockResolvedValue(versioned);

      const res = await request(app)
        .patch('/api/org/treatment-protocols/prot-1')
        .set('Authorization', 'Bearer tok')
        .send({
          steps: [
            {
              order: 1,
              productName: 'Ceftiofur',
              dosage: 2,
              dosageUnit: 'MG_KG',
              administrationRoute: 'IM',
              durationDays: 5,
            },
          ],
          versionReason: 'Rotação de antibiótico',
        });

      expect(res.status).toBe(200);
      expect(res.body.version).toBe(2);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            version: 2,
            reason: 'Rotação de antibiótico',
          }),
        }),
      );
    });
  });

  // ─── DUPLICATE ─────────────────────────────────────────────────────

  describe('POST /api/org/treatment-protocols/:protocolId/duplicate', () => {
    it('should duplicate a protocol and return 201', async () => {
      const duplicated = {
        ...SAMPLE_PROTOCOL,
        id: 'prot-copy',
        name: 'Mastite clínica grau 1 — cefalosporina (cópia)',
      };
      mockedService.duplicateProtocol.mockResolvedValue(duplicated);

      const res = await request(app)
        .post('/api/org/treatment-protocols/prot-1/duplicate')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(201);
      expect(res.body.name).toContain('(cópia)');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DUPLICATE_TREATMENT_PROTOCOL',
          metadata: expect.objectContaining({ sourceId: 'prot-1' }),
        }),
      );
    });

    it('should return 404 for non-existing source', async () => {
      mockedService.duplicateProtocol.mockRejectedValue(
        new TreatmentProtocolError('Protocolo não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/treatment-protocols/nonexistent/duplicate')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── VERSION HISTORY ──────────────────────────────────────────────

  describe('GET /api/org/treatment-protocols/:protocolId/versions', () => {
    it('should return version history', async () => {
      const versions = [
        { ...SAMPLE_PROTOCOL, version: 2, id: 'prot-2', originalId: 'prot-1' },
        SAMPLE_PROTOCOL,
      ];
      mockedService.listVersions.mockResolvedValue(versions);

      const res = await request(app)
        .get('/api/org/treatment-protocols/prot-1/versions')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].version).toBe(2);
    });
  });

  // ─── DELETE ────────────────────────────────────────────────────────

  describe('DELETE /api/org/treatment-protocols/:protocolId', () => {
    it('should soft delete and return 204', async () => {
      mockedService.deleteProtocol.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/treatment-protocols/prot-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_TREATMENT_PROTOCOL',
          targetId: 'prot-1',
        }),
      );
    });

    it('should return 404 when deleting non-existing', async () => {
      mockedService.deleteProtocol.mockRejectedValue(
        new TreatmentProtocolError('Protocolo não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/treatment-protocols/nonexistent')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── SEED ──────────────────────────────────────────────────────────

  describe('POST /api/org/treatment-protocols/seed', () => {
    it('should seed protocols and return count', async () => {
      mockedService.createProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

      // Mock the dynamic import of rls module
      jest.mock('../../database/rls', () => ({
        withRlsContext: jest.fn().mockImplementation((_ctx, fn) =>
          fn({
            disease: {
              findMany: jest.fn().mockResolvedValue([{ id: 'disease-1' }]),
            },
          }),
        ),
      }));

      const res = await request(app)
        .post('/api/org/treatment-protocols/seed')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('created');
      expect(res.body).toHaveProperty('total');
    });
  });

  // ─── AUTH ──────────────────────────────────────────────────────────

  describe('Authentication & Authorization', () => {
    it('should return 401 without token', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app).get('/api/org/treatment-protocols');

      expect(res.status).toBe(401);
    });

    it('should allow OPERATOR to read protocols', async () => {
      authAs(OPERATOR_PAYLOAD);
      mockedService.listProtocols.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const res = await request(app)
        .get('/api/org/treatment-protocols')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
    });
  });
});
