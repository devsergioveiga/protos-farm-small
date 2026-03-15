import request from 'supertest';
import { app } from '../../app';
import * as iatfService from './iatf-protocols.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { IatfProtocolError } from './iatf-protocols.types';

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

jest.mock('./iatf-protocols.service', () => ({
  createProtocol: jest.fn(),
  listProtocols: jest.fn(),
  getProtocol: jest.fn(),
  updateProtocol: jest.fn(),
  deleteProtocol: jest.fn(),
  duplicateProtocol: jest.fn(),
  calculateEstimatedCost: jest.fn(),
  listVersions: jest.fn(),
  exportProtocolCsv: jest.fn(),
  listTargetCategories: jest.fn(),
  listIatfStatuses: jest.fn(),
  listDoseUnits: jest.fn(),
  listAdminRoutes: jest.fn(),
  SEED_IATF_PROTOCOLS: [
    {
      name: 'Ovsynch',
      description: 'Protocolo Ovsynch',
      targetCategory: 'COWS',
      veterinaryAuthor: 'Dr. Vet',
      steps: [{ dayNumber: 0, description: 'D0', products: [] }],
    },
    {
      name: 'P4 + BE padrão',
      description: 'Protocolo P4+BE',
      targetCategory: 'BOTH',
      veterinaryAuthor: 'Dr. Vet',
      steps: [{ dayNumber: 0, description: 'D0', products: [] }],
    },
  ],
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(iatfService);
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
  dayNumber: 0,
  dayLabel: 'D0',
  description: 'Inserção do implante de P4',
  isAiDay: false,
  sortOrder: 0,
  products: [
    {
      id: 'prod-1',
      productId: null,
      productName: 'Implante de progesterona (P4)',
      dose: 1,
      doseUnit: 'UI',
      doseUnitLabel: 'UI',
      administrationRoute: 'INTRAVAGINAL',
      administrationRouteLabel: 'Intravaginal',
      notes: null,
    },
  ],
};

const SAMPLE_PROTOCOL = {
  id: 'proto-1',
  organizationId: 'org-1',
  name: 'P4 + BE padrão',
  description: 'Protocolo convencional',
  targetCategory: 'BOTH',
  targetCategoryLabel: 'Ambos',
  veterinaryAuthor: 'Dr. Vet',
  status: 'ACTIVE',
  statusLabel: 'Ativo',
  version: 1,
  parentId: null,
  estimatedCostCents: 0,
  notes: null,
  createdBy: 'admin-1',
  steps: [SAMPLE_STEP],
  createdAt: '2026-03-14T00:00:00.000Z',
  updatedAt: '2026-03-14T00:00:00.000Z',
};

describe('IATF Protocols routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── METADATA ──────────────────────────────────────────────────────

  describe('GET /api/org/iatf-protocols/target-categories', () => {
    it('should return target categories', async () => {
      const cats = [
        { value: 'COWS', label: 'Vacas' },
        { value: 'HEIFERS', label: 'Novilhas' },
        { value: 'BOTH', label: 'Ambos' },
      ];
      mockedService.listTargetCategories.mockReturnValue(cats);

      const res = await request(app)
        .get('/api/org/iatf-protocols/target-categories')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(cats);
    });
  });

  describe('GET /api/org/iatf-protocols/statuses', () => {
    it('should return protocol statuses', async () => {
      const statuses = [
        { value: 'ACTIVE', label: 'Ativo' },
        { value: 'INACTIVE', label: 'Inativo' },
      ];
      mockedService.listIatfStatuses.mockReturnValue(statuses);

      const res = await request(app)
        .get('/api/org/iatf-protocols/statuses')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(statuses);
    });
  });

  describe('GET /api/org/iatf-protocols/dose-units', () => {
    it('should return dose units', async () => {
      const units = [
        { value: 'mg', label: 'mg' },
        { value: 'mL', label: 'mL' },
        { value: 'UI', label: 'UI' },
      ];
      mockedService.listDoseUnits.mockReturnValue(units);

      const res = await request(app)
        .get('/api/org/iatf-protocols/dose-units')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(units);
    });
  });

  describe('GET /api/org/iatf-protocols/admin-routes', () => {
    it('should return administration routes', async () => {
      const routes = [
        { value: 'IM', label: 'Intramuscular' },
        { value: 'SC', label: 'Subcutâneo' },
      ];
      mockedService.listAdminRoutes.mockReturnValue(routes);

      const res = await request(app)
        .get('/api/org/iatf-protocols/admin-routes')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(routes);
    });
  });

  // ─── CREATE ────────────────────────────────────────────────────────

  describe('POST /api/org/iatf-protocols', () => {
    it('should create a protocol and return 201', async () => {
      mockedService.createProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

      const res = await request(app)
        .post('/api/org/iatf-protocols')
        .set('Authorization', 'Bearer tok')
        .send({
          name: 'P4 + BE padrão',
          targetCategory: 'BOTH',
          steps: [{ dayNumber: 0, description: 'D0', products: [] }],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('P4 + BE padrão');
      expect(mockedService.createProtocol).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'admin-1',
        expect.objectContaining({ name: 'P4 + BE padrão' }),
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_IATF_PROTOCOL',
          targetType: 'iatf_protocol',
          targetId: 'proto-1',
        }),
      );
    });

    it('should return 409 for duplicate name', async () => {
      mockedService.createProtocol.mockRejectedValue(
        new IatfProtocolError('Já existe um protocolo IATF com esse nome', 409),
      );

      const res = await request(app)
        .post('/api/org/iatf-protocols')
        .set('Authorization', 'Bearer tok')
        .send({
          name: 'P4 + BE padrão',
          targetCategory: 'BOTH',
          steps: [{ dayNumber: 0, description: 'D0', products: [] }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Já existe');
    });

    it('should return 400 for missing name', async () => {
      mockedService.createProtocol.mockRejectedValue(
        new IatfProtocolError('Nome do protocolo é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/iatf-protocols')
        .set('Authorization', 'Bearer tok')
        .send({ targetCategory: 'BOTH', steps: [] });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid target category', async () => {
      mockedService.createProtocol.mockRejectedValue(
        new IatfProtocolError('Categoria alvo inválida. Use: COWS, HEIFERS, BOTH', 400),
      );

      const res = await request(app)
        .post('/api/org/iatf-protocols')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Test', targetCategory: 'INVALID', steps: [] });

      expect(res.status).toBe(400);
    });
  });

  // ─── LIST ─────────────────────────────────────────────────────────

  describe('GET /api/org/iatf-protocols', () => {
    it('should return paginated list', async () => {
      const result = {
        data: [SAMPLE_PROTOCOL],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockedService.listProtocols.mockResolvedValue(result);

      const res = await request(app)
        .get('/api/org/iatf-protocols')
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
        .get('/api/org/iatf-protocols?status=ACTIVE&targetCategory=COWS&search=ovsynch')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listProtocols).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({
          status: 'ACTIVE',
          targetCategory: 'COWS',
          search: 'ovsynch',
        }),
      );
    });

    it('should pass pagination params', async () => {
      mockedService.listProtocols.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 15, totalPages: 2 },
      });

      await request(app)
        .get('/api/org/iatf-protocols?page=2&limit=10')
        .set('Authorization', 'Bearer tok');

      expect(mockedService.listProtocols).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────

  describe('GET /api/org/iatf-protocols/:protocolId', () => {
    it('should return a protocol by id', async () => {
      mockedService.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

      const res = await request(app)
        .get('/api/org/iatf-protocols/proto-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('proto-1');
      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0].products).toHaveLength(1);
    });

    it('should return 404 for non-existing protocol', async () => {
      mockedService.getProtocol.mockRejectedValue(
        new IatfProtocolError('Protocolo IATF não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/iatf-protocols/nonexistent')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe('PATCH /api/org/iatf-protocols/:protocolId', () => {
    it('should update a protocol', async () => {
      const updated = { ...SAMPLE_PROTOCOL, name: 'Protocolo atualizado' };
      mockedService.updateProtocol.mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/org/iatf-protocols/proto-1')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Protocolo atualizado' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Protocolo atualizado');
      expect(mockedService.updateProtocol).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'proto-1',
        'admin-1',
        { name: 'Protocolo atualizado' },
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_IATF_PROTOCOL',
          targetId: 'proto-1',
        }),
      );
    });

    it('should return 404 when updating non-existing', async () => {
      mockedService.updateProtocol.mockRejectedValue(
        new IatfProtocolError('Protocolo IATF não encontrado', 404),
      );

      const res = await request(app)
        .patch('/api/org/iatf-protocols/nonexistent')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });

    it('should create new version when steps change', async () => {
      const versioned = { ...SAMPLE_PROTOCOL, id: 'proto-2', version: 2, parentId: 'proto-1' };
      mockedService.updateProtocol.mockResolvedValue(versioned);

      const res = await request(app)
        .patch('/api/org/iatf-protocols/proto-1')
        .set('Authorization', 'Bearer tok')
        .send({
          steps: [{ dayNumber: 0, description: 'D0 atualizado', products: [] }],
        });

      expect(res.status).toBe(200);
      expect(res.body.version).toBe(2);
      expect(res.body.parentId).toBe('proto-1');
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE /api/org/iatf-protocols/:protocolId', () => {
    it('should soft delete and return 204', async () => {
      mockedService.deleteProtocol.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/iatf-protocols/proto-1')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_IATF_PROTOCOL',
          targetId: 'proto-1',
        }),
      );
    });

    it('should return 404 when deleting non-existing', async () => {
      mockedService.deleteProtocol.mockRejectedValue(
        new IatfProtocolError('Protocolo IATF não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/iatf-protocols/nonexistent')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── DUPLICATE (CA5) ──────────────────────────────────────────────

  describe('POST /api/org/iatf-protocols/:protocolId/duplicate', () => {
    it('should duplicate and return 201', async () => {
      const duplicated = { ...SAMPLE_PROTOCOL, id: 'proto-dup', name: 'P4 + BE padrão (cópia)' };
      mockedService.duplicateProtocol.mockResolvedValue(duplicated);

      const res = await request(app)
        .post('/api/org/iatf-protocols/proto-1/duplicate')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('P4 + BE padrão (cópia)');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DUPLICATE_IATF_PROTOCOL',
          targetId: 'proto-dup',
        }),
      );
    });

    it('should duplicate with custom name', async () => {
      const duplicated = { ...SAMPLE_PROTOCOL, id: 'proto-dup', name: 'Meu protocolo' };
      mockedService.duplicateProtocol.mockResolvedValue(duplicated);

      const res = await request(app)
        .post('/api/org/iatf-protocols/proto-1/duplicate')
        .set('Authorization', 'Bearer tok')
        .send({ name: 'Meu protocolo' });

      expect(res.status).toBe(201);
      expect(mockedService.duplicateProtocol).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'proto-1',
        'admin-1',
        'Meu protocolo',
      );
    });

    it('should return 404 for non-existing source', async () => {
      mockedService.duplicateProtocol.mockRejectedValue(
        new IatfProtocolError('Protocolo IATF não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/iatf-protocols/nonexistent/duplicate')
        .set('Authorization', 'Bearer tok')
        .send({});

      expect(res.status).toBe(404);
    });
  });

  // ─── COST (CA6) ──────────────────────────────────────────────────

  describe('GET /api/org/iatf-protocols/:protocolId/cost', () => {
    it('should return estimated cost', async () => {
      const costResult = {
        estimatedCostCents: 5000,
        details: [
          {
            productName: 'Implante P4',
            dose: 1,
            doseUnit: 'UI',
            unitCostCents: 5000,
            totalCostCents: 5000,
          },
        ],
      };
      mockedService.calculateEstimatedCost.mockResolvedValue(costResult);

      const res = await request(app)
        .get('/api/org/iatf-protocols/proto-1/cost')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body.estimatedCostCents).toBe(5000);
      expect(res.body.details).toHaveLength(1);
    });

    it('should return 404 for non-existing protocol', async () => {
      mockedService.calculateEstimatedCost.mockRejectedValue(
        new IatfProtocolError('Protocolo IATF não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/iatf-protocols/nonexistent/cost')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── VERSIONS (CA7) ──────────────────────────────────────────────

  describe('GET /api/org/iatf-protocols/:protocolId/versions', () => {
    it('should return version history', async () => {
      const versions = [
        { ...SAMPLE_PROTOCOL, id: 'proto-2', version: 2, parentId: 'proto-1' },
        SAMPLE_PROTOCOL,
      ];
      mockedService.listVersions.mockResolvedValue(versions);

      const res = await request(app)
        .get('/api/org/iatf-protocols/proto-1/versions')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].version).toBe(2);
    });

    it('should return 404 for non-existing protocol', async () => {
      mockedService.listVersions.mockRejectedValue(
        new IatfProtocolError('Protocolo IATF não encontrado', 404),
      );

      const res = await request(app)
        .get('/api/org/iatf-protocols/nonexistent/versions')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(404);
    });
  });

  // ─── EXPORT CSV ──────────────────────────────────────────────────

  describe('GET /api/org/iatf-protocols/:protocolId/export', () => {
    it('should return CSV content', async () => {
      const csvContent = '# Protocolo: P4 + BE padrão\nDia,Descrição\nD0,Inserção P4';
      mockedService.exportProtocolCsv.mockResolvedValue(csvContent);

      const res = await request(app)
        .get('/api/org/iatf-protocols/proto-1/export')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Protocolo: P4 + BE padrão');
    });
  });

  // ─── SEED (CA4) ──────────────────────────────────────────────────

  describe('POST /api/org/iatf-protocols/seed', () => {
    it('should seed protocols and return count', async () => {
      mockedService.createProtocol
        .mockResolvedValueOnce({ ...SAMPLE_PROTOCOL, id: 'p1', name: 'Ovsynch' })
        .mockResolvedValueOnce({ ...SAMPLE_PROTOCOL, id: 'p2', name: 'P4 + BE padrão' });

      const res = await request(app)
        .post('/api/org/iatf-protocols/seed')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(201);
      expect(res.body.created).toBe(2);
      expect(res.body.total).toBe(2);
    });

    it('should skip duplicates during seed', async () => {
      mockedService.createProtocol
        .mockResolvedValueOnce({ ...SAMPLE_PROTOCOL, id: 'p1' })
        .mockRejectedValueOnce(new IatfProtocolError('Já existe', 409));

      const res = await request(app)
        .post('/api/org/iatf-protocols/seed')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(201);
      expect(res.body.created).toBe(1);
    });
  });

  // ─── AUTH ─────────────────────────────────────────────────────────

  describe('Authentication & Authorization', () => {
    it('should return 401 without token', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token inválido');
      });

      const res = await request(app).get('/api/org/iatf-protocols');

      expect(res.status).toBe(401);
    });

    it('should allow OPERATOR to read protocols', async () => {
      authAs(OPERATOR_PAYLOAD);
      mockedService.listProtocols.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const res = await request(app)
        .get('/api/org/iatf-protocols')
        .set('Authorization', 'Bearer tok');

      expect(res.status).toBe(200);
    });
  });
});
