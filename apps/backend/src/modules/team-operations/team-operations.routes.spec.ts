import request from 'supertest';
import { app } from '../../app';
import * as teamOpService from './team-operations.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { TeamOperationError } from './team-operations.types';

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

jest.mock('./team-operations.service', () => ({
  createTeamOperation: jest.fn(),
  listTeamOperations: jest.fn(),
  getTeamOperation: jest.fn(),
  deleteTeamOperation: jest.fn(),
  getOperationTypes: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(teamOpService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const FARM_ID = 'farm-1';
const OP_ID = 'op-1';

const SAMPLE_OPERATION = {
  id: OP_ID,
  farmId: FARM_ID,
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão Norte',
  teamId: 'team-1',
  teamName: 'Equipe Colheita',
  operationType: 'COLHEITA',
  operationTypeLabel: 'Colheita',
  performedAt: '2026-03-09T00:00:00.000Z',
  timeStart: '2026-03-09T07:00:00.000Z',
  timeEnd: '2026-03-09T12:00:00.000Z',
  durationHours: 5,
  notes: null,
  photoUrl: null,
  latitude: null,
  longitude: null,
  entryCount: 3,
  entries: [
    {
      id: 'e1',
      userId: 'user-1',
      userName: 'Maria',
      userEmail: 'maria@org.com',
      hoursWorked: null,
      productivity: null,
      productivityUnit: null,
      notes: null,
    },
    {
      id: 'e2',
      userId: 'user-2',
      userName: 'Pedro',
      userEmail: 'pedro@org.com',
      hoursWorked: null,
      productivity: null,
      productivityUnit: null,
      notes: null,
    },
    {
      id: 'e3',
      userId: 'user-3',
      userName: 'Ana',
      userEmail: 'ana@org.com',
      hoursWorked: null,
      productivity: null,
      productivityUnit: null,
      notes: null,
    },
  ],
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-09T12:00:00.000Z',
  updatedAt: '2026-03-09T12:00:00.000Z',
};

describe('Team Operations Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /types', () => {
    it('returns 12 operation types', async () => {
      authAs(ADMIN_PAYLOAD);
      const types = [
        { value: 'PULVERIZACAO', label: 'Pulverização' },
        { value: 'COLHEITA', label: 'Colheita' },
      ];
      mockedService.getOperationTypes.mockReturnValue(types);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations/types`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('POST', () => {
    it('creates a team operation with entries for all members', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createTeamOperation.mockResolvedValue(SAMPLE_OPERATION);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/team-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          teamId: 'team-1',
          operationType: 'COLHEITA',
          performedAt: '2026-03-09',
          timeStart: '2026-03-09T07:00:00Z',
          timeEnd: '2026-03-09T12:00:00Z',
          memberIds: ['user-1', 'user-2', 'user-3'],
        });

      expect(res.status).toBe(201);
      expect(res.body.entryCount).toBe(3);
      expect(res.body.entries).toHaveLength(3);
      expect(res.body.teamName).toBe('Equipe Colheita');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_TEAM_OPERATION' }),
      );
    });

    it('returns 400 for missing memberIds', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createTeamOperation.mockRejectedValue(
        new TeamOperationError('Selecione ao menos um membro da equipe', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/team-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          teamId: 'team-1',
          operationType: 'COLHEITA',
          performedAt: '2026-03-09',
          timeStart: '2026-03-09T07:00:00Z',
          timeEnd: '2026-03-09T12:00:00Z',
          memberIds: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('membro');
    });

    it('returns 400 for invalid operation type', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createTeamOperation.mockRejectedValue(
        new TeamOperationError('Tipo de operação inválido', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/team-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          teamId: 'team-1',
          operationType: 'INVALIDO',
          performedAt: '2026-03-09',
          timeStart: '2026-03-09T07:00:00Z',
          timeEnd: '2026-03-09T12:00:00Z',
          memberIds: ['user-1'],
        });

      expect(res.status).toBe(400);
    });

    it('rejects OPERATOR (no farms:update)', async () => {
      authAs({
        userId: 'op-1',
        email: 'op@org.com',
        role: 'OPERATOR' as const,
        organizationId: 'org-1',
      });

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/team-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          teamId: 'team-1',
          operationType: 'COLHEITA',
          performedAt: '2026-03-09',
          timeStart: '2026-03-09T07:00:00Z',
          timeEnd: '2026-03-09T12:00:00Z',
          memberIds: ['user-1'],
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET list', () => {
    it('lists operations with filters', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listTeamOperations.mockResolvedValue({
        data: [SAMPLE_OPERATION],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations?teamId=team-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].entryCount).toBe(3);
    });
  });

  describe('GET by ID', () => {
    it('returns operation with entries', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getTeamOperation.mockResolvedValue(SAMPLE_OPERATION);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations/${OP_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(3);
      expect(res.body.durationHours).toBe(5);
    });

    it('returns 404', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getTeamOperation.mockRejectedValue(
        new TeamOperationError('Operação não encontrada', 404),
      );

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE', () => {
    it('soft deletes', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteTeamOperation.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/team-operations/${OP_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_TEAM_OPERATION' }),
      );
    });
  });

  describe('Error handling', () => {
    it('returns 500 for unexpected errors', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listTeamOperations.mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
    });
  });
});
