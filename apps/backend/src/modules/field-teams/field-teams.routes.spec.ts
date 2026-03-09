import request from 'supertest';
import { app } from '../../app';
import * as teamService from './field-teams.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { FieldTeamError } from './field-teams.types';

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

jest.mock('./field-teams.service', () => ({
  createFieldTeam: jest.fn(),
  listFieldTeams: jest.fn(),
  getFieldTeam: jest.fn(),
  updateFieldTeam: jest.fn(),
  deleteFieldTeam: jest.fn(),
  getTeamTypes: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(teamService);
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
const TEAM_ID = 'team-1';

const SAMPLE_TEAM = {
  id: TEAM_ID,
  farmId: FARM_ID,
  name: 'Turma de Colheita 1',
  teamType: 'COLHEITA_MANUAL',
  teamTypeLabel: 'Colheita manual',
  isTemporary: false,
  leaderId: 'user-1',
  leaderName: 'João Silva',
  notes: null,
  memberCount: 2,
  members: [
    {
      id: 'm1',
      userId: 'user-2',
      userName: 'Maria',
      userEmail: 'maria@org.com',
      joinedAt: '2026-03-08T10:00:00.000Z',
      leftAt: null,
    },
    {
      id: 'm2',
      userId: 'user-3',
      userName: 'Pedro',
      userEmail: 'pedro@org.com',
      joinedAt: '2026-03-08T10:00:00.000Z',
      leftAt: null,
    },
  ],
  createdBy: 'admin-1',
  creatorName: 'Admin',
  createdAt: '2026-03-08T10:00:00.000Z',
  updatedAt: '2026-03-08T10:00:00.000Z',
};

describe('Field Teams Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /types', () => {
    it('returns 9 team types', async () => {
      authAs(ADMIN_PAYLOAD);
      const types = [
        { value: 'COLHEITA_MANUAL', label: 'Colheita manual' },
        { value: 'APLICACAO_DEFENSIVOS', label: 'Aplicação de defensivos' },
        { value: 'CAPINA_ROCAGEM', label: 'Capina/Roçagem' },
        { value: 'VACINACAO_MANEJO', label: 'Vacinação/Manejo' },
        { value: 'MANUTENCAO_CERCAS', label: 'Manutenção de cercas' },
        { value: 'PLANTIO_MANUAL', label: 'Plantio manual' },
        { value: 'COLHEITA_CAFE', label: 'Colheita de café' },
        { value: 'COLHEITA_LARANJA', label: 'Colheita de laranja' },
        { value: 'GENERICA', label: 'Genérica' },
      ];
      mockedService.getTeamTypes.mockReturnValue(types);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/field-teams/types`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(9);
    });
  });

  describe('POST', () => {
    it('creates a team', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createFieldTeam.mockResolvedValue(SAMPLE_TEAM);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/field-teams`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Turma de Colheita 1', teamType: 'COLHEITA_MANUAL', leaderId: 'user-1' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Turma de Colheita 1');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_FIELD_TEAM' }),
      );
    });

    it('returns 400 for invalid type', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createFieldTeam.mockRejectedValue(
        new FieldTeamError('Tipo de equipe inválido', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/field-teams`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', teamType: 'INVALIDO', leaderId: 'user-1' });

      expect(res.status).toBe(400);
    });

    it('rejects OPERATOR (no farms:update)', async () => {
      authAs({
        userId: 'v1',
        email: 'v@org.com',
        role: 'OPERATOR' as const,
        organizationId: 'org-1',
      });

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/field-teams`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', teamType: 'GENERICA', leaderId: 'user-1' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET list', () => {
    it('lists teams', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listFieldTeams.mockResolvedValue({
        data: [SAMPLE_TEAM],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/field-teams`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].memberCount).toBe(2);
    });
  });

  describe('GET by ID', () => {
    it('returns a team', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getFieldTeam.mockResolvedValue(SAMPLE_TEAM);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/field-teams/${TEAM_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(2);
    });

    it('returns 404', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getFieldTeam.mockRejectedValue(
        new FieldTeamError('Equipe não encontrada', 404),
      );

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/field-teams/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH', () => {
    it('updates a team', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.updateFieldTeam.mockResolvedValue({ ...SAMPLE_TEAM, name: 'Turma 2' });

      const res = await request(app)
        .patch(`/api/org/farms/${FARM_ID}/field-teams/${TEAM_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Turma 2' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Turma 2');
    });
  });

  describe('DELETE', () => {
    it('soft deletes', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteFieldTeam.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/field-teams/${TEAM_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_FIELD_TEAM' }),
      );
    });
  });

  describe('Error handling', () => {
    it('returns 500 for unexpected errors', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listFieldTeams.mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/field-teams`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
    });
  });
});
